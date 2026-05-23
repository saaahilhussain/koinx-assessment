import mongoose from "mongoose";

const reconciliationRunSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed"],
      default: "pending",
    },
    config: {
      timestampToleranceSeconds: {
        type: Number,
        default: 300,
      },
      quantityTolerancePct: {
        type: Number,
        default: 0.01,
      },
    },
    summary: {
      totalUser: { type: Number, default: 0 },
      totalExchange: { type: Number, default: 0 },
      matched: { type: Number, default: 0 },
      conflicting: { type: Number, default: 0 },
      unmatchedUser: { type: Number, default: 0 },
      unmatchedExchange: { type: Number, default: 0 },
    },
    error: String,
    completedAt: Date,
  },
  { timestamps: true },
);

export default mongoose.model("ReconciliationRun", reconciliationRunSchema);
