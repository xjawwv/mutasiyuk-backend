import dayjs from 'dayjs';
import { User } from '../models/User.js';
import { Deposit } from '../models/Deposit.js';
import { MutasiSeen } from '../models/MutasiSeen.js';
import { getMutasi } from '../services/providerService.js';
import { dispatchUserWebhook } from '../services/webhookDispatcher.js';

function parseAmount(str) { if (!str) return 0; const n = parseInt(String(str).replace(/\D/g,''),10); return Number.isFinite(n)?n:0; }
function isInStatusIn(item) { const s=(item?.status||'').toUpperCase(); return s==='IN'; }

async function tryMatchForUser(user) {
  const settings = user.settings || {};
  if (!settings.username || !settings.token) return;

  const now = new Date();
  const pendings = await Deposit.find({ userId: user._id, status: 'Pending', expiredAt: { $gt: now } }).sort({ createdAt: 1 }).lean();
  if (pendings.length === 0) return;

  let data;
  try { data = await getMutasi(settings.username, settings.token); }
  catch (e) { console.warn('getMutasi failed for user', user._id, e?.response?.status || e?.message); return; }

  if (!data?.success || !data?.qris_history?.results) return;
  const results = data.qris_history.results;

  for (const item of results) {
    if (!isInStatusIn(item)) continue;
    const kredit = parseAmount(item.kredit);
    const mutasiId = item.id;
    const seen = await MutasiSeen.findOne({ userId: user._id, mutasi_id: mutasiId }).lean();
    if (seen) continue;

    const match = pendings.find(p => p.saldo_didapat === kredit);
    if (!match) continue;

    const updated = await Deposit.findOneAndUpdate(
      { _id: match._id, status: 'Pending' },
      { $set: {
        status: 'Success',
        matched_mutasi_id: mutasiId,
        detail_pengirim: item.keterangan || (item.brand?.name || ''),
        brand: item.brand || undefined
      }},
      { new: true }
    );
    await MutasiSeen.create({ userId: user._id, mutasi_id: mutasiId, raw: item });

    if (updated) {
      await dispatchUserWebhook(user, {
        event: 'deposit.updated',
        data: {
          kode_deposit: updated.kode_deposit,
          status: 'Success',
          nominal: updated.saldo_didapat,
          detail_pengirim: updated.detail_pengirim || (updated.brand?.name || ''),
          matched_mutasi_id: mutasiId
        }
      });
    }
  }

  await Deposit.updateMany(
    { userId: user._id, status: 'Pending', expiredAt: { $lte: now } },
    { $set: { status: 'Expired' } }
  );
}

export function startPoller() {
  const intervalMs = 5000;
  setInterval(async () => {
    try {
      const users = await User.find({ 'settings.username': { $exists: true, $ne: '' }, 'settings.token': { $exists: true, $ne: '' } }).limit(200);
      for (const u of users) { await tryMatchForUser(u); }
    } catch (e) { console.error('poller error', e); }
  }, intervalMs);
  console.log('🛰️  Poller started @', intervalMs, 'ms');
}
