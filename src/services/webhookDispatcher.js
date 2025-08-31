import axios from 'axios';
import { hmacSign } from '../utils/crypto.js';

export async function dispatchUserWebhook(user, payloadObj) {
  const url = user?.settings?.webhook;
  const secret = user?.settings?.webhookSecret;
  if (!url || !secret) return { skipped: true };
  const raw = JSON.stringify(payloadObj);
  const signature = hmacSign(secret, raw);
  const ts = Date.now().toString();
  try {
    const res = await axios.post(url, raw, {
      headers: { 'Content-Type': 'application/json', 'X-Signature': signature, 'X-Timestamp': ts },
      timeout: 8000
    });
    return { ok: true, status: res.status };
  } catch (e) {
    console.error('[WEBHOOK ERROR]', e?.response?.status || e?.message);
    return { ok: false, error: e?.message };
  }
}
