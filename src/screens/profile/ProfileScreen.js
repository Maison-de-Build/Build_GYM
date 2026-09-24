import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Alert,
  Image, Modal, Pressable, ActivityIndicator, TextInput, Animated, Easing, Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../../theme';
import SafeBottomBar from '../../components/SafeBottomBar';
import GradientIcon from '../../components/GradientIcon';
import { fetchMyMembership } from '../../services/membershipService';
import { useAuthStore } from '../../store/authStore';
import { uploadProfilePhoto, removeProfilePhoto } from '../../services/profileService';
import { useGuideStore } from '../../guide';
import { eligibleGuides } from '../../guide/guideRules';

// Profile menu — Stitch "Elite Refined" order, each row's accent tint + route.
const MENU = [
  { id: 'personal',  label: 'Personal Info',      sub: 'Update your profile details',  icon: 'person',         nav: 'EditProfile',  color: '#A78BFA', bg: 'rgba(127,41,130,0.20)' },
  { id: 'achieve',   label: 'Achievements',       sub: 'View your badges & XP',        icon: 'emoji-events',   nav: 'Achievements', color: '#F59E0B', bg: 'rgba(245,158,11,0.18)' },
  { id: 'bookings',  label: 'My Bookings',        sub: 'Manage your sessions',         icon: 'calendar-today', nav: 'MyBookings',   color: '#2DD4BF', bg: 'rgba(13,148,136,0.22)' },
  { id: 'orders',    label: 'Order History',      sub: 'Past transactions & invoices', icon: 'receipt-long',   nav: 'OrderHistory', color: '#2DD4BF', bg: 'rgba(13,148,136,0.22)' },
  { id: 'activity',  label: 'Activity Dashboard', sub: 'Club usage & stats',           icon: 'insights',       nav: 'Activity',     color: '#FBBF24', bg: 'rgba(245,158,11,0.16)' },
  { id: 'progress',  label: 'Progress Tracker',   sub: 'Body weight & photos',         icon: 'trending-up',    nav: 'ProgressTracker', color: '#34D399', bg: 'rgba(16,185,129,0.16)' },
  { id: 'replay',    label: 'Replay guide',       sub: 'Run an onboarding guide again', icon: 'replay',        nav: 'GuideReplay',  color: '#A78BFA', bg: 'rgba(127,41,130,0.20)' },
  { id: 'settings',  label: 'Settings',           sub: 'App & privacy preferences',    icon: 'settings',       nav: 'Settings',     color: '#C7C4CC', bg: 'rgba(255,255,255,0.08)' },
  { id: 'support',   label: 'Support',            sub: '24/7 concierge assistance',    icon: 'support-agent',  nav: 'Support',      color: '#60A5FA', bg: 'rgba(96,165,250,0.14)' },
  { id: 'complaint', label: 'Register Complaint', sub: 'Feedback & issue reporting',   icon: 'report',         nav: 'MyComplaints', color: '#F87171', bg: 'rgba(248,113,113,0.14)' },
];

const fmtMMYY = (raw) => {
  if (!raw) return '--/--';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '--/--';
  return `${String(d.getMonth() + 1).padStart(2, '0')} / ${String(d.getFullYear()).slice(-2)}`;
};

export default function ProfileScreen({ navigation }) {
  const user               = useAuthStore((s) => s.user);
  const logout             = useAuthStore((s) => s.logout);
  const updateProfilePhoto = useAuthStore((s) => s.updateProfilePhoto);
  const refreshUser        = useAuthStore((s) => s.refreshUser);

  const firstName = user?.firstName || user?.fullName?.split(' ')[0] || 'Athlete';

  const [membershipData, setMembershipData] = useState(null);

  useEffect(() => {
    refreshUser(); // ensure latest profilePhotoUrl + name from server
    fetchMyMembership().then(setMembershipData).catch(() => setMembershipData(null));
  }, []);

  // ── Membership card data ──────────────────────────────────────────────────
  const m = membershipData;
  const active = m?.membership?.status === 'active';
  const tier = (m?.plan?.tier ?? m?.plan?.name ?? 'Member').toString().toUpperCase();
  const planName = (m?.plan?.name ?? m?.plan?.tier ?? 'Membership').toString().toUpperCase();
  const statusLabel = active
    ? `ACTIVE ${planName}`
    : (m?.membership?.status ? String(m.membership.status).toUpperCase() : 'NO ACTIVE PLAN');
  const expiry = fmtMMYY(m?.membership?.endDate);
  const sinceRaw = m?.membership?.startDate ?? m?.membership?.createdAt;
  const sinceYear = sinceRaw ? new Date(sinceRaw).getFullYear() : null;
  const daysRemaining = (() => {
    const end = m?.membership?.endDate;
    if (!end) return null;
    const d = Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);
    return d > 0 ? d : 0;
  })();

  // Use persisted photo URL from auth store; fall back to null (shows initials)
  const profilePhoto = user?.profilePhotoUrl ?? null;

  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [uploading,         setUploading]         = useState(false);

  // ── Floating search (filters the menu rows by label) ───────────────────────
  const [searchActive, setSearchActive] = useState(false);
  const [query, setQuery] = useState('');
  const searchAnim = useRef(new Animated.Value(0)).current;
  const openSearch = () => {
    setSearchActive(true);
    Animated.timing(searchAnim, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };
  const closeSearch = () => {
    Animated.timing(searchAnim, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
      setSearchActive(false);
      setQuery('');
    });
  };
  const guideConfig = useGuideStore((s) => s.config);
  const hasGuides = guideConfig.welcome || eligibleGuides(guideConfig).length > 0;

  const filteredMenu = useMemo(() => {
    const base = hasGuides ? MENU : MENU.filter((i) => i.id !== 'replay');
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((i) => `${i.label} ${i.sub}`.toLowerCase().includes(q));
  }, [query, hasGuides]);

  // ── Membership card light-sweep shimmer ────────────────────────────────────
  // Everything is derived from the static screen width — no onLayout/state
  // coupling — so the loop starts once on mount and never restarts/freezes.
  const SCREEN_W = Dimensions.get('window').width;
  const cardHeight = Math.round((SCREEN_W - 40) / 1.6);
  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [sweep]);
  const sweepX = sweep.interpolate({ inputRange: [0, 1], outputRange: [-SCREEN_W, SCREEN_W] });

  const handlePickedImage = async (uri) => {
    setUploading(true);
    try {
      const { profilePhotoUrl } = await uploadProfilePhoto(uri);
      await updateProfilePhoto(profilePhotoUrl);
    } catch (err) {
      Alert.alert('Upload failed', err?.response?.data?.message || 'Could not upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const openCamera = async () => {
    setPhotoModalVisible(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled) await handlePickedImage(result.assets[0].uri);
  };

  const openGallery = async () => {
    setPhotoModalVisible(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library access is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled) await handlePickedImage(result.assets[0].uri);
  };

  const removePhoto = async () => {
    setPhotoModalVisible(false);
    try {
      await removeProfilePhoto();
      await updateProfilePhoto(null);
    } catch (err) {
      Alert.alert('Error', err?.response?.data?.message || 'Could not remove photo. Please try again.');
    }
  };

  const handleLogout = () =>
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          // AppNavigator's useEffect will detect isAuthenticated = false
          // and reset the stack to Login automatically.
        },
      },
    ]);

  return (
    <SafeBottomBar style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* ── Floating header icons (gradient, fixed over content) ── */}
      <TouchableOpacity style={styles.floatLeft} onPress={() => navigation.goBack()} hitSlop={10} activeOpacity={0.7}>
        <GradientIcon name="arrow-back" size={24} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.floatRight} onPress={openSearch} hitSlop={10} activeOpacity={0.7}>
        <GradientIcon name="search" size={24} />
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Title */}
        <Text style={styles.headerTitle}>PROFILE</Text>

        {/* Avatar + info */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={() => !uploading && setPhotoModalVisible(true)}
            activeOpacity={0.85}
          >
            {profilePhoto ? (
              <Image source={{ uri: profilePhoto }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarLetter}>{firstName.charAt(0)}</Text>
              </View>
            )}
            <View style={styles.cameraBadge}>
              {uploading
                ? <ActivityIndicator size={10} color="#F59E0B" />
                : <MaterialIcons name="photo-camera" size={13} color="#F59E0B" />}
            </View>
          </TouchableOpacity>
          <Text style={styles.name}>{user?.fullName || firstName}</Text>
          <Text style={styles.subline}>
            {sinceYear ? `Member since ${sinceYear}` : 'Build Member'}
            {user?.displayId ? `   ·   ID: ${user.displayId}` : ''}
          </Text>
        </View>

        {/* Membership card */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigation.navigate(active ? 'Membership' : 'MembershipPlans')}
        >
          <LinearGradient
            colors={['#0D0D0F', '#1A1A2E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.memCard, { height: cardHeight }]}
          >
            {/* Light sweep */}
            {(
              <Animated.View
                pointerEvents="none"
                style={[styles.sweep, { transform: [{ translateX: sweepX }, { rotate: '30deg' }] }]}
              >
                <LinearGradient
                  colors={['transparent', 'rgba(255,255,255,0.08)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </Animated.View>
            )}

            <View style={styles.memTopRow}>
              <View style={styles.memTier}>
                <MaterialIcons name="workspace-premium" size={14} color="#F59E0B" />
                <Text style={styles.memTierText}>{tier}</Text>
              </View>
              <Text style={styles.memAccess}>
                {daysRemaining != null ? `${daysRemaining} DAYS REMAINING` : 'PRIVATE ACCESS'}
              </Text>
            </View>

            <View style={styles.memChip} />

            <Text style={styles.memName}>{user?.fullName || firstName}</Text>

            <View style={styles.memBottomRow}>
              <View>
                <Text style={styles.memMetaLabel}>MEMBERSHIP STATUS</Text>
                <Text style={styles.memMetaValue}>{statusLabel}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.memMetaLabel}>EXPIRY</Text>
                <Text style={[styles.memMetaValue, { color: '#F59E0B' }]}>{expiry}</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Menu items */}
        <View style={styles.menuList}>
          {filteredMenu.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              onPress={() => navigation.navigate(item.nav)}
              activeOpacity={0.8}
            >
              <View style={[styles.menuIcon, { backgroundColor: item.bg }]}>
                <MaterialIcons name={item.icon} size={22} color={item.color} />
              </View>
              <View style={styles.menuInfo}>
                <Text style={styles.menuLabel}>{item.label}</Text>
                <Text style={styles.menuSub}>{item.sub}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={COLORS.textMuted} />
            </TouchableOpacity>
          ))}
          {filteredMenu.length === 0 && (
            <Text style={styles.noResults}>Nothing found.</Text>
          )}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>LOG OUT</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── Search overlay ── */}
      {searchActive && (
        <Animated.View style={[styles.searchOverlay, { opacity: searchAnim }]}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search settings..."
              placeholderTextColor={COLORS.textMuted}
              autoFocus
              returnKeyType="search"
            />
          </View>
          <TouchableOpacity onPress={closeSearch} hitSlop={8}>
            <Text style={styles.searchCancel}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── Profile Photo Modal ── */}
      <Modal
        visible={photoModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPhotoModalVisible(false)}
      >
        <Pressable style={styles.photoOverlay} onPress={() => setPhotoModalVisible(false)}>
          <Pressable style={styles.photoSheet} onPress={() => {}}>
            <View style={styles.photoHandle} />

            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              {profilePhoto ? (
                <Image source={{ uri: profilePhoto }} style={styles.photoPreview} />
              ) : (
                <View style={[styles.photoPreview, styles.avatarFallback, { alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={styles.avatarLetter}>{firstName.charAt(0)}</Text>
                </View>
              )}
            </View>

            <Text style={styles.photoTitle}>Profile Photo</Text>
            <Text style={styles.photoSub}>Choose how you’d like to update your photo</Text>

            <TouchableOpacity style={styles.photoOption} onPress={openCamera} activeOpacity={0.8}>
              <View style={styles.photoOptionIcon}>
                <Ionicons name="camera" size={20} color={COLORS.primaryLight} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.photoOptionLabel}>Take Photo</Text>
                <Text style={styles.photoOptionSub}>Use your camera</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.photoOption} onPress={openGallery} activeOpacity={0.8}>
              <View style={styles.photoOptionIcon}>
                <Ionicons name="images" size={20} color={COLORS.primaryLight} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.photoOptionLabel}>Choose from Library</Text>
                <Text style={styles.photoOptionSub}>Pick from your gallery</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>

            {profilePhoto && (
              <TouchableOpacity style={[styles.photoOption, styles.photoOptionDanger]} onPress={removePhoto} activeOpacity={0.8}>
                <View style={[styles.photoOptionIcon, { backgroundColor: 'rgba(248,113,113,0.14)' }]}>
                  <Ionicons name="trash-outline" size={20} color="#F87171" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.photoOptionLabel, { color: '#F87171' }]}>Remove Photo</Text>
                  <Text style={styles.photoOptionSub}>Revert to default avatar</Text>
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.photoCancel}
              onPress={() => setPhotoModalVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.photoCancelText}>Cancel</Text>
            </TouchableOpacity>

            <View style={{ height: 12 }} />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeBottomBar>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // Floating header
  floatLeft: { position: 'absolute', top: 52, left: 20, zIndex: 100, padding: 4 },
  floatRight: { position: 'absolute', top: 52, right: 20, zIndex: 100, padding: 4 },

  scroll: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 20 },

  headerTitle: {
    fontFamily: FONTS.headline, fontSize: 18, color: COLORS.textPrimary,
    letterSpacing: 5, textAlign: 'center', textTransform: 'uppercase', marginBottom: 24,
  },

  // Avatar
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatarWrap: { position: 'relative', marginBottom: 14 },
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)' },
  avatarFallback: {
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { fontFamily: FONTS.display, fontSize: 34, color: COLORS.white },
  cameraBadge: {
    position: 'absolute', bottom: -2, right: -2, width: 26, height: 26,
    borderRadius: 13, backgroundColor: '#1A1A2E', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  name: { fontFamily: FONTS.headline, fontSize: 26, color: COLORS.white, marginBottom: 6 },
  subline: { fontFamily: FONTS.label, fontSize: 11, color: COLORS.textMuted, letterSpacing: 1.5 },

  // Membership card
  memCard: {
    width: '100%', borderRadius: 20, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
    padding: 22, marginBottom: 28, overflow: 'hidden', justifyContent: 'space-between',
  },
  // Full card-width light band; sweeps left:-100%→100% (translateX -cardW→cardW),
  // rotated 30° — matches Stitch `lightSweep`.
  sweep: { position: 'absolute', top: -60, bottom: -60, left: 0, width: '100%' },
  memTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  memTier: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  memTierText: { fontFamily: FONTS.label, fontSize: 11, color: '#F59E0B', letterSpacing: 2 },
  memAccess: { fontFamily: FONTS.label, fontSize: 10, color: '#F59E0B', letterSpacing: 1.5 },
  memChip: {
    width: 36, height: 26, borderRadius: 6, backgroundColor: 'rgba(245,158,11,0.35)',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)',
  },
  memName: { fontFamily: FONTS.headline, fontSize: 20, color: COLORS.white, letterSpacing: 1.5, textTransform: 'uppercase' },
  memBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  memMetaLabel: { fontFamily: FONTS.label, fontSize: 8, color: 'rgba(212,193,207,0.4)', letterSpacing: 1.5, marginBottom: 4 },
  memMetaValue: { fontFamily: FONTS.bodyBold, fontSize: 12, color: COLORS.white, letterSpacing: 0.5 },

  // Menu
  menuList: { gap: 12, marginBottom: 16 },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#1A1A2E', borderRadius: 12, padding: 16,
  },
  menuIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  menuInfo: { flex: 1 },
  menuLabel: { fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.white, marginBottom: 2 },
  menuSub: { fontFamily: FONTS.body, fontSize: 11, color: 'rgba(212,193,207,0.6)' },
  noResults: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, textAlign: 'center', paddingVertical: 24 },

  // Logout
  logoutBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16, marginTop: 8, marginBottom: 4 },
  logoutText: { fontFamily: FONTS.label, fontSize: 13, color: '#EF4444', letterSpacing: 3, opacity: 0.85 },

  // Search overlay
  searchOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 96,
    backgroundColor: 'rgba(8,6,8,0.96)', flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 20, paddingBottom: 14, gap: 12, zIndex: 200,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 44,
    backgroundColor: '#1A1A2E', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(124,58,237,0.4)',
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontFamily: FONTS.body, fontSize: 14, color: COLORS.white, padding: 0 },
  searchCancel: { fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.primaryLight },

  // Photo picker modal
  photoOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  photoSheet: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 4, borderWidth: 1, borderColor: COLORS.border,
  },
  photoHandle: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: 20,
  },
  photoPreview: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 3, borderColor: COLORS.primary, backgroundColor: COLORS.primary,
  },
  photoTitle: { fontFamily: FONTS.headline, fontSize: 18, color: COLORS.white, textAlign: 'center', marginBottom: 4 },
  photoSub: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted, textAlign: 'center', marginBottom: 20 },
  photoOption: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.backgroundAlt, borderRadius: 14, borderWidth: 1, borderColor: COLORS.border,
    padding: 14, marginBottom: 10,
  },
  photoOptionDanger: { borderColor: 'rgba(248,113,113,0.3)' },
  photoOptionIcon: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  photoOptionLabel: { fontFamily: FONTS.bodyBold, fontSize: 15, color: COLORS.white, marginBottom: 2 },
  photoOptionSub: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.textMuted },
  photoCancel: {
    marginTop: 4, paddingVertical: 14, borderRadius: 14,
    backgroundColor: COLORS.backgroundAlt, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center',
  },
  photoCancelText: { fontFamily: FONTS.bodyBold, fontSize: 15, color: COLORS.textSecondary },
});
