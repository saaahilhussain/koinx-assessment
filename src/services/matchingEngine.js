import Transaction from '../models/Transaction.js';

// TRANSFER_IN on the exchange is the same tx as TRANSFER_OUT on the user side
const INVERSE_TYPES = {
  TRANSFER_IN: 'TRANSFER_OUT',
  TRANSFER_OUT: 'TRANSFER_IN',
};

const typesMatch = (userType, exchangeType) => {
  if (!userType || !exchangeType) return false;
  return (
    userType === exchangeType || INVERSE_TYPES[userType] === exchangeType
  );
};

const withinTimestamp = (t1, t2, toleranceSecs) => {
  if (!t1 || !t2) return false;
  return Math.abs(new Date(t1) - new Date(t2)) / 1000 <= toleranceSecs;
};

const withinQuantity = (q1, q2, tolerancePct) => {
  if (q1 === null || q2 === null) return false;
  if (q1 === 0 && q2 === 0) return true;
  const base = Math.max(Math.abs(q1), Math.abs(q2));
  return (Math.abs(q1 - q2) / base) * 100 <= tolerancePct;
};

const isProximityMatch = (userTx, exTx, config) =>
  userTx.asset === exTx.asset &&
  typesMatch(userTx.type, exTx.type) &&
  withinTimestamp(userTx.timestamp, exTx.timestamp, config.timestampToleranceSeconds) &&
  withinQuantity(userTx.quantity, exTx.quantity, config.quantityTolerancePct);

const runMatching = async (config, runId) => {
  const [userTxs, exchangeTxs] = await Promise.all([
    Transaction.find({ runId, source: 'user', isValid: true }).lean(),
    Transaction.find({ runId, source: 'exchange', isValid: true }).lean(),
  ]);

  const matchedExchangeIds = new Set();
  const reportEntries = [];

  for (const userTx of userTxs) {
    let exchangeMatch = null;
    let matchedById = false;

    // 1. Try to match by transaction ID first
    if (userTx.transactionId) {
      exchangeMatch = exchangeTxs.find(
        (e) =>
          e.transactionId === userTx.transactionId &&
          !matchedExchangeIds.has(String(e._id))
      );
      if (exchangeMatch) matchedById = true;
    }

    // 2. Fall back to proximity match
    if (!exchangeMatch) {
      exchangeMatch = exchangeTxs.find(
        (e) =>
          !matchedExchangeIds.has(String(e._id)) &&
          isProximityMatch(userTx, e, config)
      );
    }

    if (!exchangeMatch) {
      reportEntries.push({
        category: 'unmatched_user',
        userTransaction: userTx,
        exchangeTransaction: null,
        reason: 'No matching exchange transaction found',
      });
      continue;
    }

    matchedExchangeIds.add(String(exchangeMatch._id));

    if (matchedById) {
      // ID match — check if fields are still within tolerance
      const conflicts = [];
      if (!withinTimestamp(userTx.timestamp, exchangeMatch.timestamp, config.timestampToleranceSeconds))
        conflicts.push('timestamp exceeds tolerance');
      if (!withinQuantity(userTx.quantity, exchangeMatch.quantity, config.quantityTolerancePct))
        conflicts.push('quantity exceeds tolerance');

      if (conflicts.length > 0) {
        reportEntries.push({
          category: 'conflicting',
          userTransaction: userTx,
          exchangeTransaction: exchangeMatch,
          reason: `Matched by ID but conflicts: ${conflicts.join(', ')}`,
        });
        continue;
      }
    }

    reportEntries.push({
      category: 'matched',
      userTransaction: userTx,
      exchangeTransaction: exchangeMatch,
      reason: matchedById
        ? 'Matched by transaction ID within tolerance'
        : 'Matched by proximity (asset, type, timestamp, quantity)',
    });
  }

  // Remaining exchange transactions with no user counterpart
  for (const exTx of exchangeTxs) {
    if (!matchedExchangeIds.has(String(exTx._id))) {
      reportEntries.push({
        category: 'unmatched_exchange',
        userTransaction: null,
        exchangeTransaction: exTx,
        reason: 'No matching user transaction found',
      });
    }
  }

  return { reportEntries, totalUser: userTxs.length, totalExchange: exchangeTxs.length };
};

export { runMatching };
