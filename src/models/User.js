import mongoose from 'mongoose';

const SettingsSchema = new mongoose.Schema({
  username: String,
  token: String,
  kodeMerchant: String,
  qrisBase: String,
  webhook: String,
  webhookSecret: String,
  unique_code_max_value: { type: Number, default: () => parseInt(process.env.UNIQUE_CODE_MAX_DEFAULT || '100', 10) },
  providerWebhookRegisteredAt: Date
}, { _id: false });

const UserSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  passwordHash: String,
  apiKeyHash: String,
  apiKeyCreatedAt: Date,
  apiKeyLastUsedAt: Date,
  apiKeyStatus: { type: String, enum: ['active','disabled'], default: 'active' },
  settings: SettingsSchema,
  subscription_expires_at: { type: Date, default: null }
}, { timestamps: true });

export const User = mongoose.model('User', UserSchema);
