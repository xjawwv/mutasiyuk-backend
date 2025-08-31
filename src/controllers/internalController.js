import dayjs from 'dayjs';
import { User } from '../models/User.js';
import { SubscriptionOrder } from '../models/SubscriptionOrder.js';
import { WebhookLog } from '../models/WebhookLog.js';

export async function subscriptionWebhook(req, res) {
  // log awal
  const log = await WebhookLog.create({
    ip: (req.ip || '').replace('::ffff:', ''),
    path: req.originalUrl,
    headers: {
      'content-type': req.get('content-type'),
      'user-agent': req.get('user-agent'),
      'x-forwarded-for': req.get('x-forwarded-for'),
    },
    body: req.body,
  });

  try {
    const body = req.body || {};
    const sourceUser = body?.sourceUser || null;
    const trx = body?.newTransaction || {};
    const kreditInt =
      parseInt(String(trx?.kredit || '0').replace(/\D/g, ''), 10) || 0;
    const mutasiId = trx?.id;
    const detail =
      trx?.keterangan || trx?.brand?.name || trx?.brand?.toString() || '';
    const price = parseInt(process.env.SUBS_PRICE || '10000', 10);
    const now = new Date();

    if (kreditInt < price) {
      log.processed = false;
      log.result = {
        status: 'ignored',
        reason: 'amount too small',
        kredit: kreditInt,
        price,
      };
      await log.save();
      return res
        .status(200)
        .json({ status: true, ignored: true, reason: 'amount too small' });
    }

    // 1) cari user dari sourceUser (username atau email)
    let user = null;
    if (sourceUser) {
      user = await User.findOne({
        $or: [{ 'settings.username': sourceUser }, { email: sourceUser }],
      });
    }

    // 2) coba match order pending by amount
    const baseQuery = {
      status: 'Pending',
      amount: kreditInt, // harus Number
      expiredAt: { $gt: now },
    };

    let ord = await SubscriptionOrder.findOne(
      user ? { ...baseQuery, userId: user._id } : baseQuery
    ).sort({ createdAt: -1 });

    // 3) fallback: tanpa user
    if (!ord && !user) {
      ord = await SubscriptionOrder.findOne(baseQuery).sort({ createdAt: -1 });
      if (ord) user = await User.findById(ord.userId);
    }

    // 4) fallback terakhir: kalau tidak ketemu order tapi ada user -> mode legacy
    if (!ord && user) {
      const current = user.subscription_expires_at
        ? dayjs(user.subscription_expires_at)
        : null;
      const base = current && current.isAfter(now) ? current : dayjs(now);
      const newExp = base.add(30, 'day').toDate();
      user.subscription_expires_at = newExp;
      await user.save();

      log.processed = true;
      log.userId = user._id;
      log.matched_order_id = null;
      log.result = { mode: 'legacy', extendedDays: 30, newExpiresAt: newExp };
      await log.save();

      return res.json({
        status: true,
        extendedDays: 30,
        user: user.email,
        newExpiresAt: newExp,
        matched: false,
      });
    }

    if (!ord) {
      log.processed = false;
      log.result = {
        status: 'ignored',
        reason: 'no matching order',
        kredit: kreditInt,
      };
      await log.save();
      return res
        .status(202)
        .json({ status: true, ignored: true, reason: 'no matching order' });
    }

    // 5) mark order success + extend owner
    ord.status = 'Success';
    ord.successAt = now;
    ord.matched_mutasi_id = mutasiId || undefined;
    ord.detail_pengirim = detail || undefined;
    ord.brand = trx?.brand || undefined;
    await ord.save();

    const owner = user || (await User.findById(ord.userId));
    const current = owner.subscription_expires_at
      ? dayjs(owner.subscription_expires_at)
      : null;
    const base = current && current.isAfter(now) ? current : dayjs(now);
    const newExp = base.add(30, 'day').toDate();
    owner.subscription_expires_at = newExp;
    await owner.save();

    // update log
    log.processed = true;
    log.userId = owner._id;
    log.matched_order_id = ord.order_id;
    log.result = { extendedDays: 30, order_id: ord.order_id, newExpiresAt: newExp };
    await log.save();

    return res.json({
      status: true,
      extendedDays: 30,
      user: owner.email,
      newExpiresAt: newExp,
      order_id: ord.order_id,
    });
  } catch (e) {
    console.error('subscriptionWebhook error', e);
    log.processed = false;
    log.error = e?.message || String(e);
    await log.save();
    return res.status(500).json({ status: false, pesan: 'Server error' });
  }
}
