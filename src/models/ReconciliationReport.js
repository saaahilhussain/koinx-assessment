import mongoose from 'mongoose';

const reconciliationReportSchema = new mongoose.Schema(
  {
    runId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReconciliationRun',
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['matched', 'conflicting', 'unmatched_user', 'unmatched_exchange'],
      required: true,
    },
    userTransaction: mongoose.Schema.Types.Mixed,
    exchangeTransaction: mongoose.Schema.Types.Mixed,
    reason: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('ReconciliationReport', reconciliationReportSchema);
