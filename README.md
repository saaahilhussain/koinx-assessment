# KoinX – Transaction Reconciliation Engine

A Node.js service that ingests two CSV transaction exports (user + exchange), matches them against each other using configurable tolerances, and produces a structured reconciliation report.

---

## Setup

### Prerequisites

- Node.js v18+
- MongoDB running at the URI in your `.env`

### Install

```bash
npm install
```

### Environment

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

| Variable                      | Default                                              | Description                              |
| ----------------------------- | ---------------------------------------------------- | ---------------------------------------- |
| `PORT`                        | `3000`                                               | HTTP port                                |
| `MONGO_URI`                   | `mongodb://koinx:koinx123@localhost:27017/koinx?authSource=admin` | MongoDB connection string |
| `TIMESTAMP_TOLERANCE_SECONDS` | `300`                                                | Max timestamp delta for a match (±5 min) |
| `QUANTITY_TOLERANCE_PCT`      | `0.01`                                               | Max quantity delta as a % for a match    |

### Run

```bash
# production
npm start

# development (auto-restart)
npm run dev
```

---

## API

### `POST /reconcile`

Trigger a reconciliation run. Accepts two CSV files and optional tolerance overrides.

**Request** — `multipart/form-data`

| Field                       | Type   | Required | Description                             |
| --------------------------- | ------ | -------- | --------------------------------------- |
| `userFile`                  | file   | yes      | User transaction CSV                    |
| `exchangeFile`              | file   | yes      | Exchange transaction CSV                |
| `timestampToleranceSeconds` | number | no       | Overrides `TIMESTAMP_TOLERANCE_SECONDS` |
| `quantityTolerancePct`      | number | no       | Overrides `QUANTITY_TOLERANCE_PCT`      |

**Response**

```json
{
  "runId": "6650a1f2e3b4c5d6e7f8a9b0",
  "summary": {
    "totalUser": 120,
    "totalExchange": 118,
    "matched": 110,
    "conflicting": 3,
    "unmatchedUser": 7,
    "unmatchedExchange": 5
  }
}
```

---

### `GET /report/:runId`

Returns every entry in the reconciliation report for the given run, including the original rows from both sides where applicable.

---

### `GET /report/:runId/summary`

Returns just the counts: matched, conflicting, unmatched user, unmatched exchange.

---

### `GET /report/:runId/unmatched`

Returns only the unmatched entries (both user-only and exchange-only) along with the reason each was left unmatched.

---

## How it works

### Ingestion

Each CSV is parsed row by row. The parser is tolerant of varying column names (`timestamp` / `date` / `datetime`, `asset` / `currency` / `coin`, `quantity` / `amount`, etc.). Every row is saved to MongoDB regardless of validity — bad rows are flagged with `isValid: false` and a `flagReason` string rather than silently dropped.

### Matching

The engine runs in two passes per user transaction:

1. **ID match** — if a `transactionId` exists on both sides, they are paired directly. If the fields then exceed tolerance the entry is categorised as `conflicting` instead of `matched`.
2. **Proximity match** — if no ID match is found, the engine looks for an exchange transaction with the same normalised asset, a compatible type, a timestamp within ±`TIMESTAMP_TOLERANCE_SECONDS`, and a quantity within ±`QUANTITY_TOLERANCE_PCT`%.

Exchange transactions that survive both passes unmatched are recorded as `unmatched_exchange`.

### Report categories

| Category             | Meaning                                                          |
| -------------------- | ---------------------------------------------------------------- |
| `matched`            | Paired across both sources within all tolerances                 |
| `conflicting`        | Paired by ID but quantity or timestamp exceeds tolerance         |
| `unmatched_user`     | Present in the user file, no counterpart found in exchange file  |
| `unmatched_exchange` | Present in the exchange file, no counterpart found in user file  |

---

## Key decisions

**`TRANSFER_IN` ↔ `TRANSFER_OUT` mapping**  
The same transfer appears as `TRANSFER_IN` on one side and `TRANSFER_OUT` on the other depending on perspective. The matcher treats these as compatible types rather than a mismatch.

**Transactions scoped to a run**  
Each `Transaction` document carries the `runId` of the reconciliation run that ingested it. This means the matching engine only compares transactions from the same run, so repeated calls to `/reconcile` with different files do not interfere with each other.

**Invalid rows are stored, not dropped**  
Rows that fail validation (missing timestamp, unparseable quantity, etc.) are persisted with `isValid: false` and a human-readable `flagReason`. This makes data quality issues auditable rather than invisible.

**Tolerance configuration priority**  
Values passed in the request body take precedence over environment variables, which take precedence over hard-coded defaults (300 s / 0.01%). This makes it easy to experiment with different tolerances without redeploying.

**Asset normalisation**  
Common aliases (`Bitcoin` → `BTC`, `Ethereum` → `ETH`, etc.) are resolved at ingestion time so the matcher can do a simple string equality check rather than carrying alias logic into the matching loop.
