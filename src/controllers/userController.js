import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User } from '../models/User.js';
import { registerWebhook } from '../services/providerService.js';

export async function me(req, res) {
  const u = req.user;
  return res.json({ status: true, data: {
    email: u.email,
    apiKeyStatus: u.apiKeyStatus,
    apiKeyCreatedAt: u.apiKeyCreatedAt,
    apiKeyLastUsedAt: u.apiKeyLastUsedAt,
    subscription_expires_at: u.subscription_expires_at,
    subscription_active: !!(u.subscription_expires_at && u.subscription_expires_at > new Date()),
    settings: {
      username: u.settings?.username || null,
      kodeMerchant: u.settings?.kodeMerchant || null,
      webhook: u.settings?.webhook || null
    }
  }});
}

export async function getSettings(req, res) {
  const u = req.user;
  return res.json({ status: true, data: {
    username: u.settings?.username || '',
    token: u.settings?.token || '',
    kodeMerchant: u.settings?.kodeMerchant || '',
    qrisBase: u.settings?.qrisBase || '',
    webhook: u.settings?.webhook || ''
  }});
}

export async function updateSettings(req, res) {
  const u = req.user;
  const { username, token, kodeMerchant, qrisBase, webhook } = req.body || {};
  u.settings = u.settings || {};
  if (username !== undefined) u.settings.username = username;
  if (token !== undefined) u.settings.token = token;
  if (kodeMerchant !== undefined) u.settings.kodeMerchant = kodeMerchant;
  if (qrisBase !== undefined) u.settings.qrisBase = qrisBase;
  if (webhook !== undefined) {
    u.settings.webhook = webhook;
    if (!u.settings.webhookSecret) u.settings.webhookSecret = crypto.randomBytes(16).toString('hex');
  }
  await u.save();

  if (u.settings?.username && u.settings?.token && u.settings?.webhook) {
    try {
      const out = await registerWebhook(u.settings.username, u.settings.token, u.settings.webhook);
      if (out?.success) {
        u.settings.providerWebhookRegisteredAt = new Date();
        await u.save();
      }
    } catch (e) {
      console.warn('registerWebhook failed:', e?.response?.status || e?.message);
    }
  }

  return res.json({ status: true, data: { updated: true } });
}

export async function rotateApiKey(req, res) {
  const u = req.user;
  const plain = 'sk_live_' + crypto.randomBytes(36).toString('base64url');
  const hash = await bcrypt.hash(plain, 10);
  u.apiKeyHash = hash;
  u.apiKeyCreatedAt = new Date();
  await u.save();
  return res.json({ status: true, data: { api_key: plain } });
}
