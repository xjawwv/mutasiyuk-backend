export function notFound(_req, res, _next) {
  return res.status(404).json({ status: false, data: { pesan: 'Endpoint tidak ditemukan' } });
}
export function errorHandler(err, _req, res, _next) {
  console.error('[ERROR]', err);
  const code = err.statusCode || 500;
  const message = err.expose ? err.message : 'Terjadi kesalahan';
  res.status(code).json({ status: false, data: { pesan: message } });
}
