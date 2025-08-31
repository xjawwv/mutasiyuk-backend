import mongoose from 'mongoose';

const DepositSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  kode_deposit: { type: String, unique: true, required: true },
  metode: { type: String, default: 'QRIS' },
  nominal: { type: Number, required: true },
  unique_code: { type: Number, required: true },
  saldo_didapat: { type: Number, required: true },
  status: { type: String, enum: ['Pending','Success','Cancelled','Expired'], default: 'Pending' },
  expiredAt: Date,
  link_qr: String,
  qris_image_url: String,
  matched_mutasi_id: Number,
  detail_pengirim: String,
  brand: { name: String, logo: String }
}, { timestamps: true });

DepositSchema.index({ userId: 1, status: 1, expiredAt: 1 });
DepositSchema.index({ saldo_didapat: 1, status: 1 });

export const Deposit = mongoose.model('Deposit', DepositSchema);
