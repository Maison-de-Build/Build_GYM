import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Linking, Alert, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, TYPE, FONTS } from '../../theme';
import {
  AuthBackground, BrandHeader, GlassCard, AuthField, HoloButton,
} from '../../components/auth';
import { FCM_TOKEN_KEY, saveFCMToken } from '../../services/notificationService';
import NotificationPermissionBanner from '../../components/NotificationPermissionBanner';
import { sendOTP, passwordLogin } from '../../services/authService';
import { useAuthStore } from '../../store/authStore';
import { CommonActions } from '@react-navigation/native';
import { LEGAL_URLS } from '../../constants/legal';

const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const PHONE_RE = /^\d{10}$/;

export default function LoginScreen({ navigation }) {
  const [tab,        setTab]        = useState('otp');   // 'otp' | 'password'
  // OTP tab
  const [mobile,     setMobile]     = useState('');
  // Password tab
  const [identifier, setIdentifier] = useState('');
  const [password,   setPassword]   = useState('');
  const [showPw,     setShowPw]     = useState(false);

  const [loading, setLoading] = useState(false);
  // Guideline 1.2 (UGC): user must accept the Terms/EULA before logging in.
  const [agreed, setAgreed] = useState(false);

  // Logo scales with screen width (caps at 256, the mockup's w-64) so it never
  // overflows on small devices.
  const { width } = useWindowDimensions();
  // Portrait Maison de Build logo — size by width so its height stays balanced.
  const logoSize = Math.min(84, Math.round(width * 0.21));

  const setAuth = useAuthStore((s) => s.setAuth);

  // ── OTP tab ───────────────────────────────────────────────────────────────

  const handleGetOTP = async () => {
    if (mobile.length < 10 || loading) return;
    if (!agreed) { Alert.alert('Please agree to continue', 'You must accept the Terms & Conditions to sign in.'); return; }
    const fullPhone = `+91${mobile}`;
    setLoading(true);
    try {
      const fcmToken = await AsyncStorage.getItem(FCM_TOKEN_KEY);
      if (fcmToken) await saveFCMToken(fcmToken, fullPhone);
      await sendOTP(fullPhone, 'member');
      navigation.navigate('OTP', { phone: fullPhone });
    } catch (error) {
      if (error.response?.status === 404) {
        Alert.alert('Not Registered', 'This number is not registered. Please contact your admin.');
      } else if (error.response?.status === 403) {
        Alert.alert('Staff Account Detected', 'Please use the BuildGym Staff app to sign in.');
      } else {
        Alert.alert('Error', 'Failed to send OTP. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Password tab ──────────────────────────────────────────────────────────

  const handlePasswordLogin = async () => {
    if (!identifier.trim() || !password || loading) return;
    if (!agreed) { Alert.alert('Please agree to continue', 'You must accept the Terms & Conditions to sign in.'); return; }
    const trimmedId = identifier.trim();
    if (trimmedId.includes('@')) {
      if (!EMAIL_RE.test(trimmedId)) {
        Alert.alert('Invalid Email', 'Please enter a valid email address (e.g. name@domain.com).');
        return;
      }
    } else if (/^\d+$/.test(trimmedId)) {
      if (!PHONE_RE.test(trimmedId)) {
        Alert.alert('Invalid Phone', 'Phone number must be exactly 10 digits.');
        return;
      }
    } else {
      Alert.alert('Invalid Input', 'Please enter a valid 10-digit phone number or email address.');
      return;
    }
    setLoading(true);
    try {
      const raw = identifier.includes('@')
        ? identifier.trim().toLowerCase()
        : (identifier.trim().startsWith('+91') ? identifier.trim() : `+91${identifier.trim()}`);

      const { accessToken, refreshToken, user } = await passwordLogin(raw, password);

      if (user.role !== 'member') {
        Alert.alert('Access Denied', 'This app is for members only. Please use the BuildGym Staff app.');
        return;
      }

      const userWithPhone = user?.phone ? user : { ...user, phone: raw };
      await setAuth(userWithPhone, accessToken, refreshToken);

      // Associate FCM token (best-effort)
      AsyncStorage.getItem(FCM_TOKEN_KEY).then((token) => {
        if (!token) return;
        saveFCMToken(token, null, user.id).catch(() => {});
        import('../../services/cafeFcmService')
          .then((m) => m.registerCafeFcmToken(token, { phone: user.phone, userId: user.id }))
          .catch(() => {});
      }).catch(() => {});

      if (!user.hasPassword) {
        // Shouldn't reach here (logged in via password means hasPassword must be true),
        // but guard just in case
        navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'SetPassword', params: { user } }] }));
      } else if (user.onboardingCompleted) {
        navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' }] }));
      } else {
        navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Onboarding', params: { mobile: user.phone } }] }));
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Invalid credentials. Please try again.';
      Alert.alert('Login Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <AuthBackground scroll={false} contentStyle={styles.scroll}>
      <GlassCard style={styles.card}>
        {/* Identity */}
        <BrandHeader variant="outline" logoSize={logoSize} style={styles.brand} />
        <Text style={[TYPE.headlineSm, styles.title]}>Welcome Back.</Text>

        {/* Tab switcher */}
        <View style={styles.tabs}>
          <TouchableOpacity style={styles.tab} onPress={() => setTab('password')} activeOpacity={0.75}>
            <Text style={[TYPE.labelCaps, styles.tabText, tab === 'password' && styles.tabTextActive]}>
              Password
            </Text>
            {tab === 'password' && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.tab} onPress={() => setTab('otp')} activeOpacity={0.75}>
            <Text style={[TYPE.labelCaps, styles.tabText, tab === 'otp' && styles.tabTextActive]}>
              OTP Login
            </Text>
            {tab === 'otp' && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        </View>

        {/* Form */}
        {tab === 'otp' ? (
          <View style={styles.form}>
            <AuthField
              placeholder="Mobile Number"
              keyboardType="number-pad"
              maxLength={10}
              value={mobile}
              onChangeText={setMobile}
              returnKeyType="done"
              onSubmitEditing={handleGetOTP}
              leftAccessory={<Text style={styles.countryCode}>+91</Text>}
            />
            <HoloButton
              label="SEND ACCESS CODE"
              onPress={handleGetOTP}
              loading={loading}
              disabled={mobile.length < 10 || !agreed}
              style={styles.cta}
            />
          </View>
        ) : (
          <View style={styles.form}>
            <AuthField
              placeholder="Email or Phone"
              keyboardType="email-address"
              autoCapitalize="none"
              value={identifier}
              onChangeText={setIdentifier}
              returnKeyType="next"
            />
            <AuthField
              containerStyle={styles.fieldGap}
              placeholder="Password"
              secureTextEntry={!showPw}
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
              returnKeyType="done"
              onSubmitEditing={handlePasswordLogin}
              rightAccessory={(
                <TouchableOpacity onPress={() => setShowPw(!showPw)} style={styles.eyeBtn}>
                  <Ionicons name={showPw ? 'eye-off' : 'eye'} size={20} color={COLORS.textMuted} />
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={() => navigation.navigate('ForgotPassword')}
              activeOpacity={0.7}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
            <HoloButton
              label="ENTER THE CLUB"
              onPress={handlePasswordLogin}
              loading={loading}
              disabled={!identifier.trim() || !password || !agreed}
            />
          </View>
        )}

        {/* Guideline 1.2 — Terms/EULA acceptance (required to sign in) */}
        <TouchableOpacity
          style={styles.agreeRow}
          activeOpacity={0.75}
          onPress={() => setAgreed((v) => !v)}
        >
          <Ionicons
            name={agreed ? 'checkbox' : 'square-outline'}
            size={20}
            color={agreed ? COLORS.primaryNeon : COLORS.textMuted}
          />
          <Text style={styles.agreeText}>
            I agree to the{' '}
            <Text style={styles.agreeLink} onPress={() => Linking.openURL(LEGAL_URLS.terms)}>
              Terms &amp; Conditions
            </Text>{' '}and{' '}
            <Text style={styles.agreeLink} onPress={() => Linking.openURL(LEGAL_URLS.privacy)}>
              Privacy Policy
            </Text>, including a zero-tolerance policy for objectionable content and abusive behaviour.
          </Text>
        </TouchableOpacity>

        {/* Notifications are the primary channel for OTP, bookings and coach
            messages — surface the ask here on every visit to the login screen. */}
        <NotificationPermissionBanner
          style={styles.permissionBanner}
          message="Notifications are off. Turn them on so you don’t miss your OTP, booking reminders or messages from your coach."
        />
      </GlassCard>

      {/* Help */}
      <View style={styles.helpBox}>
        <Text style={styles.helpText}>
          Need help?{' '}
          <Text
            style={styles.helpLink}
            onPress={() => Linking.openURL('mailto:reception@buildgym.in')}
          >
            reception@buildgym.in
          </Text>
        </Text>
      </View>

      {/* Members-only notice */}
      <View style={styles.noticeBox}>
        <Text style={styles.noticeText}>
          Only registered Build Gym members can access this app.
        </Text>
      </View>
    </AuthBackground>
  );
}

const styles = StyleSheet.create({
  // main: max-w-420, px-margin-mobile (20), centered
  scroll: {
    paddingHorizontal: 20, paddingVertical: 40,
    justifyContent: 'center', alignItems: 'center', flexGrow: 1,
  },

  card: { width: '100%', maxWidth: 400, padding: 22, paddingTop: 30 }, // p-8 pt-10
  brand: { marginBottom: 24 },                                        // mb-6
  title: {
    textAlign: 'center', fontSize: 24, lineHeight: 29, letterSpacing: 1.2, marginBottom: 4,
  },                                                                  // text-2xl, mb-1

  // Tab switcher — flex gap-4, mt-4, mb-stack-md(32)
  tabs: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 16, marginBottom: 32 },
  tab: { alignItems: 'center', paddingBottom: 4 },                    // pb-1
  tabText: { fontFamily: FONTS.bodyBold, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: 'rgba(212,193,207,0.5)' }, // on-surface-variant/50
  tabTextActive: { color: COLORS.primaryNeon },
  tabUnderline: {
    position: 'absolute', bottom: 0, height: 2, width: '100%',
    backgroundColor: COLORS.primaryNeon,
  },                                                                  // border-b-2

  form: {},
  fieldGap: { marginTop: 12 },                                        // gap-stack-sm
  countryCode: { ...TYPE.bodyMd, color: COLORS.textSecondary, marginRight: 12 },
  eyeBtn: { paddingLeft: 8 },

  forgotBtn: { alignSelf: 'flex-end', marginTop: 12, marginBottom: 4 },
  forgotText: { ...TYPE.bodySm, color: COLORS.primaryLight },

  cta: { marginTop: 8 },                                              // mt-2

  // Terms/EULA agreement row (Guideline 1.2)
  permissionBanner: { marginTop: 18 },
  agreeRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    marginTop: 20, paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  agreeText: { flex: 1, fontFamily: FONTS.body, fontSize: 11, lineHeight: 16, color: 'rgba(212,193,207,0.8)' },
  agreeLink: { color: '#9d4fff', fontFamily: FONTS.bodyMedium },

  // Help box — mt-8, px-4 py-3, border #7f29ff/20, bg #7f29ff/5, rounded-lg
  helpBox: {
    width: '100%', maxWidth: 420,
    marginTop: 32, paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 8, borderWidth: 1,
    borderColor: 'rgba(127,41,255,0.20)', backgroundColor: 'rgba(127,41,255,0.05)',
  },
  helpText: { fontFamily: FONTS.body, fontSize: 12, textAlign: 'center', color: 'rgba(212,193,207,0.8)' },
  helpLink: { color: '#9d4fff', fontFamily: FONTS.bodyMedium },

  // Notice box — mt-4, border primary-container/20, bg surface-container-lowest/50
  noticeBox: {
    width: '100%', maxWidth: 420,
    marginTop: 16, paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 8, borderWidth: 1,
    borderColor: 'rgba(127,41,130,0.20)', backgroundColor: 'rgba(16,13,16,0.5)',
  },
  noticeText: {
    fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
    fontFamily: FONTS.bodyMedium, textAlign: 'center', color: COLORS.textSecondary,
  },
});
