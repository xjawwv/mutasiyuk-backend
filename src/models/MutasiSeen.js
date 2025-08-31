import mongoose from 'mongoose';

const MutasiSeenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  mutasi_id: { type: Number, required: true, index: true },
  raw: mongoose.Schema.Types.Mixed,
  seenAt: { type: Date, default: Date.now }
}, { timestamps: true });

MutasiSeenSchema.index({ userId: 1, mutasi_id: 1 }, { unique: true });

export const MutasiSeen = mongoose.model('MutasiSeen', MutasiSeenSchema);
