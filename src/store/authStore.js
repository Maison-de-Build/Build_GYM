import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import api from '../services/apiService';
import { useAnnouncementStore } from './announcementStore';
import { setUserId, setUserRole, setUserProperty } from '../services/analyticsService';

const KEYS = {
  ACCESS_TOKEN: 'bg_access_token',
  REFRESH_TOKEN: 'bg_refresh_token',
  USER_DATA: 'bg_user_data',
};

export const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true, // true until initialize() runs

  /**
   * Restore persisted session from SecureStore.
   * Called once on app launch (SplashScreen or App.js).
   */
  initialize: async () => {
    try {
      const [accessToken, refreshToken, userStr] = await Promise.all([
        SecureStore.getItemAsync(KEYS.ACCESS_TOKEN),
        SecureStore.getItemAsync(KEYS.REFRESH_TOKEN),
        SecureStore.getItemAsync(KEYS.USER_DATA),
      ]);

      const user = userStr ? JSON.parse(userStr) : null;

      if (accessToken && refreshToken && user) {
        set({ accessToken, refreshToken, user, isAuthenticated: true, isLoading: false });
        // Re-apply GA4 identity on session restore (display_id only, never UUID).
        setUserId(user.displayId ?? null).catch(() => {});
        setUserRole(user.role).catch(() => {});
        setUserProperty('is_trainer', String(user.role === 'trainer')).catch(() => {});
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      console.warn('authStore.initialize error:', err);
      set({ isLoading: false });
    }
  },

  /**
   * Persist full auth session (called after OTP verify).
   */
  setAuth: async (user, accessToken, refreshToken) => {
    try {
      await Promise.all([
        SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, accessToken),
        SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refreshToken),
        SecureStore.setItemAsync(KEYS.USER_DATA, JSON.stringify(user)),
      ]);
      set({ user, accessToken, refreshToken, isAuthenticated: true });
      // GA4 identity — display_id only, never the UUID.
      setUserId(user.displayId ?? null).catch(() => {});
      setUserRole(user.role).catch(() => {});
      setUserProperty('is_trainer', String(user.role === 'trainer')).catch(() => {});
      // Load this user's unread count fresh (clears any value left by a previous session).
      useAnnouncementStore.getState().clearUnread();
      useAnnouncementStore.getState().refreshUnreadCount().catch(() => {});
    } catch (err) {
      console.warn('authStore.setAuth error:', err);
    }
  },

  /**
   * Persist only the new access + refresh tokens (called after token refresh).
   */
  setTokens: async (accessToken, refreshToken) => {
    try {
      await Promise.all([
        SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, accessToken),
        SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, refreshToken),
      ]);
      set({ accessToken, refreshToken });
    } catch (err) {
      console.warn('authStore.setTokens error:', err);
    }
  },

  /**
   * Merge partial user fields into the stored user object (in-memory + SecureStore).
   * Used after personal details edits to keep the auth store in sync.
   */
  updateUser: async (fields) => {
    const { user } = get();
    if (!user) return;
    const updatedUser = { ...user, ...fields };
    try {
      await SecureStore.setItemAsync(KEYS.USER_DATA, JSON.stringify(updatedUser));
    } catch (_) {}
    set({ user: updatedUser });
  },

  /**
   * Update the user's profile photo URL in-memory + storage.
   * Pass null to clear the photo.
   */
  updateProfilePhoto: async (profilePhotoUrl) => {
    const { user } = get();
    if (!user) return;
    const updatedUser = { ...user, profilePhotoUrl };
    try {
      await SecureStore.setItemAsync(KEYS.USER_DATA, JSON.stringify(updatedUser));
    } catch (_) {}
    set({ user: updatedUser });
  },

  /**
   * Update user's onboardingCompleted flag in-memory + storage.
   */
  markOnboardingComplete: async () => {
    const { user } = get();
    if (!user) return;
    const updatedUser = { ...user, onboardingCompleted: true };
    try {
      await SecureStore.setItemAsync(KEYS.USER_DATA, JSON.stringify(updatedUser));
    } catch (_) {}
    set({ user: updatedUser });
    // Fetch fresh profile so optCommunity (and other member fields) are immediately available
    get().refreshUser();
  },

  /**
   * Fetch the latest user profile from the server and merge into store + SecureStore.
   * Call this on ProfileScreen mount to ensure profilePhotoUrl and other fields are fresh.
   */
  refreshUser: async () => {
    const { user } = get();
    if (!user) return;
    try {
      const { data } = await api.get('/customer/me');
      const fresh = data?.data;
      if (!fresh) return;
      const updatedUser = {
        ...user,
        displayId:       fresh.displayId       ?? user.displayId       ?? null,
        firstName:       fresh.firstName       ?? user.firstName,
        lastName:        fresh.lastName        ?? user.lastName,
        fullName:        fresh.fullName        ?? user.fullName,
        email:           fresh.email           ?? user.email,
        profilePhotoUrl: fresh.profilePhotoUrl ?? user.profilePhotoUrl ?? null,
        optCommunity:    fresh.optCommunity    ?? user.optCommunity    ?? false,
      };
      try {
        await SecureStore.setItemAsync(KEYS.USER_DATA, JSON.stringify(updatedUser));
      } catch (_) {}
      set({ user: updatedUser });
      // displayId may have arrived/changed here — keep GA4 user_id in sync.
      if (updatedUser.displayId && updatedUser.displayId !== user.displayId) {
        setUserId(updatedUser.displayId).catch(() => {});
      }
    } catch (err) {
      // Non-fatal — silently ignore network errors so the screen still loads
      console.warn('authStore.refreshUser error:', err?.message);
    }
  },

  /**
   * Clear all auth state and SecureStore keys. Navigates to Login via listener.
   */
  logout: async () => {
    // Detach this device from the outgoing user first, so their pushes don't
    // follow the handset to whoever signs in next. Best-effort and non-blocking.
    // Imported lazily: notificationService reaches back into the stores, and a
    // static import here would close that cycle at module-eval time.
    import('../services/notificationService')
      .then((m) => m.deregisterFCMToken())
      .catch(() => {});

    try {
      await Promise.all([
        SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN),
        SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN),
        SecureStore.deleteItemAsync(KEYS.USER_DATA),
      ]);
    } catch (_) {}
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
    // Drop the previous user's unread count so it can't leak into the next login.
    useAnnouncementStore.getState().clearUnread();
    // Same for chat: drop the /chat socket (it stays authenticated as the outgoing
    // user until disconnected), clear the store and empty the on-device cache.
    // Lazily imported for the same store-cycle reason as notificationService above.
    import('./chatStore')
      .then((m) => m.useChatStore.getState().reset())
      .catch(() => {});
    // Drop the resolved PT/freestyle mode, so the next member to sign in on this
    // handset is resolved fresh rather than inheriting the outgoing user's mode.
    // Lazily imported for the same store-cycle reason as the two above.
    import('../hooks/useMemberMode')
      .then((m) => m.resetMemberMode())
      .catch(() => {});
    // Clear GA4 identity so the next session starts clean.
    setUserId(null).catch(() => {});
  },
}));
