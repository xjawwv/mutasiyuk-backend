import mongoose from "mongoose";

const SubscriptionOrderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      required: true,
    },
    order_id: { type: String, unique: true, required: true },

    nominal: { type: Number, required: true }, // harga dasar (SUBS_PRICE)
    unique_code: { type: Number, required: true }, // 1..N
    amount: { type: Number, required: true }, // nominal + unique_code

    status: {
      type: String,
      enum: ["Pending", "Success", "Expired", "Cancelled"],
      default: "Pending",
      index: true,
    },
    expiredAt: { type: Date, required: true, index: true },
    successAt: { type: Date },
    unique_code: { type: Number, required: true },
    cancelledAt: { type: Date },

    qris_url: { type: String },

    matched_mutasi_id: Number,
    detail_pengirim: String,
    brand: { name: String, logo: String },
  },
  { timestamps: true }
);

SubscriptionOrderSchema.index({ userId: 1, status: 1, amount: 1 });
// unique: true on order_id already creates index; no need to add another to avoid duplicate-index warning

export const SubscriptionOrder = mongoose.model(
  "SubscriptionOrder",
  SubscriptionOrderSchema
);
