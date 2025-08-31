import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';

function subscriptionActive(user) {
  if (String(process.env.SUBS_ENFORCE || 'true').toLowerCase() !== 'true') return true;
  const exp = user.subscription_expires_at;
  if (!exp) return false;
  return exp.getTime() > Date.now();
}

export async function apiKeyAuth(req, res, next) {
  try {
    const key = req.header('X-API-Key') || req.header('x-api-key');
    if (!key) return res.status(401).json({ status: false, data: { pesan: 'API key diperlukan' } });

    const cursor = User.find({ apiKeyHash: { $exists: true, $ne: null }, apiKeyStatus: 'active' }).cursor();
    let matchedUser = null;
    for await (const u of cursor) {
      const ok = await bcrypt.compare(key, u.apiKeyHash);
      if (ok) { matchedUser = u; break; }
    }
    if (!matchedUser) return res.status(401).json({ status: false, data: { pesan: 'API key invalid' } });

    if (!subscriptionActive(matchedUser)) {
      return res.status(402).json({ status: false, data: { pesan: 'Subscription expired' } });
    }

    req.user = matchedUser;
    matchedUser.apiKeyLastUsedAt = new Date();
    await matchedUser.save();
    next();
  } catch (e) {
    console.error('apiKeyAuth error', e);
    return res.status(401).json({ status: false, data: { pesan: 'Unauthorized' } });
  }
}
