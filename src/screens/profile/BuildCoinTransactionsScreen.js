import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar,
  ActivityIndicator, RefreshControl, Linking, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '../../theme';
import { useWalletStore } from '../../store/walletStore';
import SafeBottomBar from '../../components/SafeBottomBar';

const GOLD = '#FFD700';
const AMBER = '#F59E0B';
const LOW_BALANCE_THRESHOLD = 200;
// Used until /wallet/balance has returned the Super Admin–configured link.
const DEFAULT_PURCHASE_URL = 'https://pay.maisondebuild.com/';

export default function BuildCoinTransactionsScreen({ navigation }) {
  const {
    balance,
    purchaseUrl,
    transactions,
    hasMore,
    isLoading,
    isTxnLoading,
    fetchBalance,
    fetchTransactions,
    fetchMoreTransactions,
  } = useWalletStore();

  const [refreshing, setRefreshing] = useState(false);
  const [lowBalance, setLowBalance] = useState(false);

  useEffect(() => {
    fetchBalance();
    fetchTransactions();
  }, []);

  useEffect(() => {
    setLowBalance(balance < LOW_BALANCE_THRESHOLD);
  }, [balance]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchBalance(), fetchTransactions()]);
    setRefreshing(false);
  }, [fetchBalance, fetchTransactions]);

  // Coins are bought on the web top-up page, opened in the browser rather than
  // inside the app. openURL().catch() rather than canOpenURL() — see UpdateGate.
  const openPurchasePage = () => {
    Linking.openURL(purchaseUrl || DEFAULT_PURCHASE_URL).catch(() => {
      Alert.alert('Could not open', 'Please try again in a moment.');
    });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  return (
    <SafeBottomBar style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <LinearGradient colors={['rgba(127,41,130,0.15)', 'transparent']} style={styles.glowTop} pointerEvents="none" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs')}>
          <Ionicons name="arrow-back" size={20} color={COLORS.primaryLight} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transaction History</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primaryLight} />}
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const isNearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 80;
          if (isNearBottom) fetchMoreTransactions();
        }}
        scrollEventThrottle={400}
      >
        {/* Balance hero */}
        <View style={styles.balanceSection}>
          <Text style={styles.balanceLabel}>YOUR BALANCE</Text>
          {isLoading ? (
            <ActivityIndicator color={COLORS.primaryLight} size="large" style={{ marginVertical: 16 }} />
          ) : (
            <View style={styles.balanceRow}>
              <Text style={styles.balanceNum}>{balance.toLocaleString('en-IN')}</Text>
              <Ionicons name="ellipse" size={22} color={GOLD} style={{ marginLeft: 8 }} />
            </View>
          )}

          <TouchableOpacity
            activeOpacity={0.9}
            onPress={openPurchasePage}
            style={styles.addBtnWrap}
          >
            <LinearGradient
              colors={[AMBER, GOLD]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.addBtn}
            >
              <Ionicons name="add" size={20} color="#1A1206" />
              <Text style={styles.addBtnText}>ADD COINS</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Low balance banner */}
        {lowBalance && (
          <View style={styles.lowBanner}>
            <Ionicons name="warning-outline" size={20} color={AMBER} />
            <Text style={styles.lowBannerText}>
              Low Balance. Top up to continue booking sessions without interruption.
            </Text>
          </View>
        )}

        {/* Transactions */}
        <Text style={styles.sectionLabel}>RECENT TRANSACTIONS</Text>

        {isTxnLoading && transactions.length === 0 ? (
          <ActivityIndicator color={COLORS.primaryLight} style={{ marginVertical: 20 }} />
        ) : transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={40} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        ) : (
          <>
            {transactions.map((t) => {
              const isCredit  = t.transactionType === 'CREDIT' || t.transactionType === 'REFUND';
              const isRefund  = t.transactionType === 'REFUND';
              const isSession = t.itemCategory === 'SESSION';
              const isCafe    = t.itemCategory === 'CAFE';

              // Formatted label per category
              let label = t.itemName;
              let iconName = isCredit ? 'add' : 'remove';
              let iconColor = isCredit ? '#4ADE80' : '#F87171';
              let iconBg    = isCredit ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)';
              let sublabel  = null;

              if (isSession) {
                label     = isRefund ? `Refund: ${t.itemName}` : `Activity: ${t.itemName}`;
                sublabel  = isRefund ? 'Session refund' : 'Session booking';
                iconName  = isRefund ? 'refresh-circle-outline' : 'fitness-outline';
                iconColor = isRefund ? '#3B82F6' : COLORS.primaryLight;
                iconBg    = isRefund ? 'rgba(59,130,246,0.12)' : COLORS.primarySoft;
              } else if (isCafe) {
                label     = isRefund ? `Refund: ${t.itemName}` : t.itemName;
                sublabel  = isRefund ? 'Café refund' : 'Café order';
                iconName  = isRefund ? 'refresh-circle-outline' : 'restaurant-outline';
                iconColor = isRefund ? '#3B82F6' : '#4ADE80';
                iconBg    = isRefund ? 'rgba(59,130,246,0.12)' : 'rgba(74,222,128,0.12)';
              } else if (t.itemCategory === 'PURCHASE' || t.transactionType === 'CREDIT') {
                sublabel = 'Coins added';
                iconName  = 'add-circle-outline';
                iconColor = '#4ADE80';
                iconBg    = 'rgba(74,222,128,0.12)';
              }

              return (
                <TouchableOpacity
                  key={t.id}
                  style={styles.txnRow}
                  activeOpacity={0.75}
                  onPress={() => navigation.navigate('TransactionDetail', { transaction: t })}
                >
                  <View style={[styles.txnIcon, { backgroundColor: iconBg }]}>
                    <Ionicons name={iconName} size={18} color={iconColor} />
                  </View>
                  <View style={styles.txnInfo}>
                    <Text style={styles.txnLabel}>{label}</Text>
                    <Text style={styles.txnDate}>
                      {sublabel ? `${sublabel} · ` : ''}{formatDate(t.createdAt)}
                    </Text>
                  </View>
                  <Text style={[styles.txnAmount, { color: isCredit ? '#4ADE80' : '#F87171' }]}>
                    {isCredit ? '+ ₿ ' : '− ₿ '}{t.coinAmount}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={COLORS.textMuted} style={{ marginLeft: 4 }} />
                </TouchableOpacity>
              );
            })}

            {isTxnLoading && (
              <ActivityIndicator color={COLORS.primaryLight} style={{ marginVertical: 16 }} />
            )}

            {!hasMore && transactions.length > 0 && (
              <Text style={styles.endText}>— All transactions loaded —</Text>
            )}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeBottomBar>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  glowTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 280 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 52, paddingBottom: 12,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.glass,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  headerTitle: { fontFamily: FONTS.bodyBold, fontSize: 15, color: COLORS.white },

  scroll: { paddingHorizontal: 20, paddingBottom: 20 },

  // Balance
  balanceSection: { alignItems: 'center', paddingVertical: 24 },
  balanceLabel: { fontFamily: FONTS.label, fontSize: 11, color: COLORS.textMuted, letterSpacing: 2, marginBottom: 12 },
  balanceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  balanceNum: { fontFamily: FONTS.headline, fontSize: 44, color: COLORS.white },
  addBtnWrap: { borderRadius: 999, overflow: 'hidden' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, paddingHorizontal: 28,
  },
  addBtnText: { fontFamily: FONTS.bodyBold, fontSize: 13, color: '#1A1206', letterSpacing: 1 },

  sectionLabel: { fontFamily: FONTS.label, fontSize: 10, color: COLORS.primaryLight, letterSpacing: 2.5, marginBottom: 12, marginTop: 8 },

  // Low balance
  lowBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
    borderRadius: 12, padding: 14, marginBottom: 24,
  },
  lowBannerText: { flex: 1, fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSecondary, lineHeight: 18 },

  // Transactions
  txnRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.surfaceLow, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    padding: 14, marginBottom: 8,
  },
  txnIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  txnInfo: { flex: 1 },
  txnLabel: { fontFamily: FONTS.bodyBold, fontSize: 13, color: COLORS.white, marginBottom: 2 },
  txnDate: { fontFamily: FONTS.body, fontSize: 10, color: COLORS.textMuted },
  txnAmount: { fontFamily: FONTS.bodyBold, fontSize: 14 },

  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textMuted },
  endText: { textAlign: 'center', fontFamily: FONTS.body, fontSize: 11, color: COLORS.textMuted, paddingVertical: 16 },
});
