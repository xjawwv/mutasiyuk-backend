import mongoose from 'mongoose';

const ttlDays = parseInt(process.env.SUBS_WEBHOOK_LOG_TTL_DAYS || '30', 10);
const expireAfterSeconds = Math.max(1, ttlDays) * 24 * 60 * 60;

const WebhookLogSchema = new mongoose.Schema(
  {
    ip: String,                 // IP caller
    path: String,               // e.g. /internal/subscription/webhook
    headers: Object,            // potong seperlunya
    body: Object,               // payload webhook
    processed: { type: Boolean, default: false },  // sudah diproses (match/extend) atau tidak
    result: Object,             // ringkasan hasil yang dikembalikan handler
    error: String,              // error message kalau ada
    matched_order_id: String,   // order subscription yang ter-match (kalau ada)
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

// TTL index berdasarkan createdAt
WebhookLogSchema.index({ createdAt: 1 }, { expireAfterSeconds });

export const WebhookLog = mongoose.model('WebhookLog', WebhookLogSchema);
