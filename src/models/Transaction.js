import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    runId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReconciliationRun',
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['user', 'exchange'],
      required: true,
    },
    transactionId: String,
    timestamp: Date,
    type: String,
    asset: String,
    quantity: Number,
    price: Number,
    fee: Number,
    rawData: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    isValid: {
      type: Boolean,
      default: true,
    },
    flagReason: String,
  },
  { timestamps: true }
);

export default mongoose.model('Transaction', transactionSchema);
