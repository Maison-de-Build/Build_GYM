import React, { useEffect, useRef } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Animated,
  StatusBar,
  Easing,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../../store/authStore';
import { consumeColdStartData, handleNotificationData } from '../../services/notificationService';

const MAISON_LOGO = require('../../../assets/maison-logo.png');

const { width } = Dimensions.get('window');

// Matches the native splash / window background exactly so the hand-off from the
// OS splash to this animated screen is seamless (no color jump, no flash).
const SPLASH_BG = '#0D0D0D';
const ACCENT = '#EA6A25'; // Maison orange
const LOGO_W = width * 0.62;
const LOGO_H = LOGO_W * (1516 / 1238); // preserve the logo's aspect ratio

/**
 * Launch splash — "Maison de Build" (approved artifact: splash-login-preview.html).
 * Dark #0D0D0D · logo fades + scales in · a thin orange accent line sweeps under it.
 * Runs once, then routes to Home / Onboarding / Login.
 */
export default function SplashScreen({ navigation }) {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale   = useRef(new Animated.Value(0.75)).current;
  const lineAnim    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Timing matches the approved artifact's keyframes exactly (3.6s loop, scaled
    // to its 0%/14%/26% marks): logo enters over 504ms, the line then sweeps out
    // over the next 432ms — both on the same ease-in-out curve as the CSS.
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1, duration: 504, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1, duration: 504, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
      }),
    ]).start();

    // Accent line: starts growing the instant the logo finishes its entrance.
    Animated.timing(lineAnim, {
      toValue: 1, duration: 432, delay: 504, easing: Easing.inOut(Easing.ease), useNativeDriver: false,
    }).start();

    // AppNavigator already called initialize() before this screen mounts, so the
    // auth state is ready. Hold the animation, then route once.
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      const { isAuthenticated, user } = useAuthStore.getState();
      if (isAuthenticated && user) {
        if (user.onboardingCompleted) {
          navigation.replace('MainTabs');
          const pending = consumeColdStartData();
          if (pending) setTimeout(() => handleNotificationData(pending), 400);
        } else {
          navigation.replace('Onboarding');
        }
      } else {
        navigation.replace('Login');
      }
    }, 2800);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [logoOpacity, logoScale, lineAnim, navigation]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={SPLASH_BG} />

      <Animated.Image
        source={MAISON_LOGO}
        resizeMode="contain"
        style={[
          styles.logo,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
      />

      <Animated.View
        style={[
          styles.line,
          {
            opacity: lineAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.9] }),
            width: lineAnim.interpolate({ inputRange: [0, 1], outputRange: [0, width * 0.56] }),
          },
        ]}
      >
        <LinearGradient
          colors={['transparent', ACCENT, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SPLASH_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: LOGO_W,
    height: LOGO_H,
  },
  line: {
    height: 2,
    borderRadius: 2,
    marginTop: 20,
    overflow: 'hidden',
  },
});
