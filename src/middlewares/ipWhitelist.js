// src/middlewares/ipWhitelist.js
export function ipWhitelist(allowedList = []) {
  // allowedList: array IP v4/v6 tanpa spasi, mis. ["127.0.0.1","103.10.11.12"]
  const allowed = new Set(
    (allowedList || []).map((s) => s.trim()).filter(Boolean)
  );

  return (req, res, next) => {
    // Dengan trust proxy = 1 (di belakang Nginx), req.ip sudah IP client yang benar
    let ip = (req.ip || '').trim();
    // Normalisasi IPv4-mapped IPv6, contoh "::ffff:127.0.0.1" -> "127.0.0.1"
    if (ip.startsWith('::ffff:')) ip = ip.replace('::ffff:', '');

    // Selalu izinkan localhost
    if (ip === '127.0.0.1' || ip === '::1') return next();

    if (allowed.has(ip)) return next();

    return res.status(403).json({
      status: false,
      data: { pesan: `Forbidden: IP ${ip} tidak diizinkan` },
    });
  };
}
