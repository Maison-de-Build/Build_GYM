/**
 * walletService.js
 *
 * API calls for the Build Coins wallet.
 * Uses the authenticated `api` instance (JWT auto-refresh included).
 *
 * Read-only by design. The in-app purchase calls that used to live here
 * (POST /wallet/purchase, and the Razorpay create-order/verify pair) are gone.
 * Top-ups happen at reception via the admin app, or on the web top-up page,
 * which the wallet's ADD COINS button opens in the browser.
 */

import api from './apiService';

/**
 * GET /api/wallet/balance
 * Returns { balance, updatedAt, purchaseUrl }.
 */
export const fetchBalance = async () => {
  const { data } = await api.get('/wallet/balance');
  return data.data; // { balance, updatedAt, purchaseUrl }
};

/**
 * GET /api/wallet/transactions/:id
 * Returns a single coin transaction by ID.
 */
export const fetchTransactionById = async (id) => {
  const { data } = await api.get(`/wallet/transactions/${id}`);
  return data.data;
};

/**
 * GET /api/wallet/transactions?limit=&cursor=
 * Returns { data: [], nextCursor, hasMore }.
 */
export const fetchTransactions = async ({ limit = 20, cursor } = {}) => {
  const params = { limit };
  if (cursor) params.cursor = cursor;
  const { data } = await api.get('/wallet/transactions', { params });
  return data; // { success, data, nextCursor, hasMore }
};
