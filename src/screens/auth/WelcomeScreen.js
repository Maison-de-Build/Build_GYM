import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, StatusBar, Animated, Image, useWindowDimensions,
} from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { COLORS, FONTS, TYPE } from '../../theme';
import { HoloButton } from '../../components/auth';
import { useAuthStore } from '../../store/authStore';

const LOGO = require('../../../assets/maison-logo.png');

/**
 * Post-onboarding welcome — "Obsidian Pulse" mockup
 * (NewUi/build_welcome_refined_noir). Three zones over a cinematic purple
 * radial: greeting (name + member id), glowing logo, "GO TO HOME" CTA.
 */
export default function WelcomeScreen({ route, navigation }) {
  const firstName = route?.params?.firstName || 'Member';
  const displayId = useAuthStore((st) => st.user?.displayId);

  const { width, height } = useWindowDimensions();

  const fade = useRef(new Animated.Value(0)).current;     // overall content
  const logoFade = useRef(new Animated.Value(0)).current;  // logo (fade-in-slow)
  const glow = useRef(new Animated.Value(0.25)).current;   // logo glow pulse

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(logoFade, { toValue: 1, duration: 900, delay: 200, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 0.45, duration: 1800, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.25, duration: 1800, useNativeDriver: true }),
      ]),
    ).start();
  }, [fade, logoFade, glow]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0F" />

      {/* Cinematic purple radial background */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="welcomeBg" cx="50%" cy="46%" rx="78%" ry="58%">
            <Stop offset="0%" stopColor="#2D1B69" stopOpacity={0.55} />
            <Stop offset="45%" stopColor="#1A0A2E" stopOpacity={0.5} />
            <Stop offset="100%" stopColor="#0D0D0F" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#welcomeBg)" />
      </Svg>

      <Animated.View style={[styles.content, { opacity: fade }]}>
        {/* ── Greeting ── */}
        <View style={styles.greeting}>
          <Text style={styles.welcome}>Welcome,</Text>
          <Text style={styles.name}>{firstName}</Text>
          {!!displayId && <Text style={styles.memberId}>Member ID: {displayId}</Text>}
        </View>

        {/* ── Logo ── */}
        <Animated.View style={[styles.logoWrap, { opacity: logoFade }]}>
          <Animated.View style={[styles.logoGlow, { opacity: glow }]} pointerEvents="none">
            <Svg width={300} height={300}>
              <Defs>
                <RadialGradient id="logoGlow" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor="#7f2982" stopOpacity={0.9} />
                  <Stop offset="55%" stopColor="#0A2A2A" stopOpacity={0.25} />
                  <Stop offset="100%" stopColor="#0D0D0F" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect width={300} height={300} fill="url(#logoGlow)" />
            </Svg>
          </Animated.View>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        </Animated.View>

        {/* ── CTA ── */}
        <View style={styles.cta}>
          <Text style={styles.tagline}>Your journey starts today.</Text>
          <HoloButton
            label="GO TO HOME"
            icon="arrow-forward"
            onPress={() => navigation.replace('MainTabs')}
            style={styles.ctaBtn}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0F' },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
    gap: 40,
  },

  // Greeting
  greeting: { alignItems: 'center' },
  welcome: {
    ...TYPE.taglineItalic,
    fontSize: 20,
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  name: {
    fontFamily: FONTS.display,
    fontSize: 48,
    lineHeight: 52,
    color: COLORS.white,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  memberId: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.textMuted,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },

  // Logo
  logoWrap: { alignItems: 'center', justifyContent: 'center', width: 200, height: 210 },
  logoGlow: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 165, height: 202 },

  // CTA
  cta: { width: '100%', alignItems: 'center' },
  tagline: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.textMuted,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 24,
  },
  ctaBtn: { width: '100%', maxWidth: 384 },
});
