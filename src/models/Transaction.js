import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
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
