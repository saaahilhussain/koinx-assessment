import fs from 'fs';
import { parse } from 'csv-parse';
import Transaction from '../models/Transaction.js';

const ASSET_ALIASES = {
  bitcoin: 'BTC',
  ethereum: 'ETH',
  eth: 'ETH',
  tether: 'USDT',
  solana: 'SOL',
  ripple: 'XRP',
};

const normalizeAsset = (raw) => {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  return ASSET_ALIASES[key] ?? raw.trim().toUpperCase();
};

const parseTimestamp = (raw) => {
  if (!raw) return null;
  const d = new Date(raw.trim());
  return isNaN(d.getTime()) ? null : d;
};

const parseNumber = (raw) => {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = parseFloat(String(raw).replace(/,/g, ''));
  return isNaN(n) ? null : n;
};

const buildTransaction = (row, source) => {
  const id =
    row.id ?? row.transaction_id ?? row.txid ?? row.tx_id ?? null;

  const timestamp = parseTimestamp(
    row.timestamp ?? row.date ?? row.time ?? row.datetime
  );

  const type = row.type ? row.type.trim().toUpperCase() : null;

  const asset = normalizeAsset(
    row.asset ?? row.currency ?? row.coin ?? row.symbol
  );

  const quantity = parseNumber(row.quantity ?? row.amount ?? row.qty);
  const price = parseNumber(row.price);
  const fee = parseNumber(row.fee);

  const issues = [];
  if (!timestamp) issues.push('invalid or missing timestamp');
  if (!type) issues.push('missing type');
  if (!asset) issues.push('missing asset');
  if (quantity === null) issues.push('invalid or missing quantity');

  return {
    source,
    transactionId: id,
    timestamp,
    type,
    asset,
    quantity,
    price,
    fee,
    rawData: { ...row },
    isValid: issues.length === 0,
    flagReason: issues.length > 0 ? issues.join('; ') : undefined,
  };
};

const ingestCSV = (filePath, source) =>
  new Promise((resolve, reject) => {
    const rows = [];

    fs.createReadStream(filePath)
      .pipe(parse({ columns: true, trim: true, skip_empty_lines: true }))
      .on('data', (row) => rows.push(buildTransaction(row, source)))
      .on('error', reject)
      .on('end', async () => {
        try {
          await Transaction.insertMany(rows, { ordered: false });

          const flagged = rows.filter((r) => !r.isValid);
          console.log(
            `[ingestion] ${source}: ${rows.length} rows parsed, ${flagged.length} flagged`
          );
          if (flagged.length > 0) {
            flagged.forEach((r) =>
              console.warn(`  flagged row [${r.transactionId ?? 'no-id'}]: ${r.flagReason}`)
            );
          }

          resolve({ total: rows.length, flagged: flagged.length });
        } catch (err) {
          reject(err);
        }
      });
  });

export { ingestCSV };
