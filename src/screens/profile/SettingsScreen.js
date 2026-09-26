import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Linking, Alert, Platform,
} from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS, FONTS } from '../../theme';
import SafeBottomBar from '../../components/SafeBottomBar';
import GradientIcon from '../../components/GradientIcon';
import { useAuthStore } from '../../store/authStore';
import { LEGAL_URLS } from '../../constants/legal';
import { requestAccountDeletion } from '../../services/customerProfileService';

/**
 * BUILD Settings.
 * Every row is wired to a real action — navigation, an external legal/support
 * link, opening the OS notification settings, or an account action. Non-functional
 * placeholder toggles were removed.
 */
export default function SettingsScreen({ navigation }) {
  const logout = useAuthStore((s) => s.logout);

  const openURL = (url) =>
    Linking.openURL(url).catch(() =>
      Alert.alert('Unable to open link', 'Please try again later.'));

  const handleLogout = () =>
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }));
        },
      },
    ]);

  const handleRequestDeletion = () =>
    Alert.alert(
      'Request Account Deletion',
      'This sends a request to permanently delete your account and associated data. Our team will process it. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Deletion',
          style: 'destructive',
          onPress: async () => {
            try {
              await requestAccountDeletion();
              Alert.alert('Request received', 'Your account deletion request has been submitted.');
            } catch (err) {
              Alert.alert('Error', err?.response?.data?.message || 'Could not submit the request. Please try again.');
            }
          },
        },
      ],
    );

  const LinkRow = ({ icon, label, value, locked, onPress, display }) => (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      disabled={locked || display || !onPress}
      onPress={onPress}
    >
      <View style={styles.rowIcon}>
        <MaterialIcons name={icon} size={20} color={COLORS.textSecondary} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      {!!value && <Text style={styles.rowValue}>{value}</Text>}
      {locked
        ? <MaterialIcons name="lock" size={16} color={COLORS.textMuted} />
        : display
          ? null
          : <MaterialIcons name="chevron-right" size={22} color={COLORS.textMuted} />}
    </TouchableOpacity>
  );

  return (
    <SafeBottomBar style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      <TouchableOpacity style={styles.floatLeft} onPress={() => navigation.goBack()} hitSlop={10} activeOpacity={0.7}>
        <GradientIcon name="arrow-back" size={24} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Settings</Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Account */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.card}>
          <LinkRow icon="key" label="Change Password" onPress={() => navigation.navigate('ForgotPassword')} />
          <LinkRow icon="smartphone" label="Linked Phone" locked />
          <LinkRow icon="mail" label="Email Address" onPress={() => navigation.navigate('EditProfile')} />
          <LinkRow icon="language" label="Language" value="English" display />
        </View>

        {/* Notifications */}
        <Text style={styles.sectionLabel}>Notifications</Text>
        <View style={styles.card}>
          <LinkRow
            icon="notifications"
            label="Push Notifications"
            value="System settings"
            onPress={() => Linking.openSettings().catch(() =>
              Alert.alert('Unable to open settings', 'Please manage notifications in your phone’s Settings app.'))}
          />
        </View>

        {/* Health — Apple Health is iPhone-only; Android gets this row with Whoop. */}
        {Platform.OS === 'ios' && (
          <>
            <Text style={styles.sectionLabel}>Health</Text>
            <View style={styles.card}>
              <LinkRow
                icon="watch"
                label="Devices"
                value="Apple Health"
                onPress={() => navigation.navigate('MdbWearableSettings')}
              />
            </View>
          </>
        )}

        {/* Privacy */}
        <Text style={styles.sectionLabel}>Privacy</Text>
        <View style={styles.card}>
          <LinkRow icon="analytics" label="Data & Analytics" onPress={() => openURL(LEGAL_URLS.privacy)} />
        </View>

        {/* About */}
        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.card}>
          <LinkRow icon="help" label="Help & Support" onPress={() => navigation.navigate('Support')} />
          <LinkRow icon="policy" label="Privacy Policy" onPress={() => openURL(LEGAL_URLS.privacy)} />
          <LinkRow icon="description" label="Terms & Conditions" onPress={() => openURL(LEGAL_URLS.terms)} />
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <MaterialIcons name="info" size={20} color={COLORS.textSecondary} />
            </View>
            <Text style={styles.rowLabel}>App Version</Text>
            <Text style={styles.rowValue}>2.1.0</Text>
          </View>
        </View>

        {/* Footer actions */}
        <TouchableOpacity style={styles.deleteBtn} activeOpacity={0.8} onPress={handleRequestDeletion}>
          <MaterialIcons name="delete-outline" size={16} color="#F87171" />
          <Text style={styles.deleteText}>Request Account Deletion</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.8} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeBottomBar>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  floatLeft: { position: 'absolute', top: 52, left: 20, zIndex: 100, padding: 4 },
  headerTitle: { fontFamily: FONTS.bodyBold, fontSize: 16, color: COLORS.white, textAlign: 'center', marginTop: 54 },

  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20 },

  sectionLabel: {
    fontFamily: FONTS.label, fontSize: 11, color: COLORS.textMuted,
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 18,
  },
  card: {
    backgroundColor: '#1A1A2E', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 14, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rowIcon: { width: 28, alignItems: 'center' },
  rowLabel: { flex: 1, fontFamily: FONTS.bodyMedium, fontSize: 14, color: COLORS.white },
  rowValue: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, marginRight: 6 },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 28, paddingVertical: 14, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(248,113,113,0.3)', backgroundColor: 'rgba(248,113,113,0.06)',
  },
  deleteText: { fontFamily: FONTS.bodyBold, fontSize: 13, color: '#F87171' },
  logoutBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16, marginTop: 6 },
  logoutText: { fontFamily: FONTS.label, fontSize: 13, color: '#EF4444', letterSpacing: 2, opacity: 0.85 },
});
