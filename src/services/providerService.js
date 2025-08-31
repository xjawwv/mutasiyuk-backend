import axios from 'axios';
const baseURL = process.env.PROVIDER_BASE_URL || 'https://api.heyta25.my.id';
const timeout = parseInt(process.env.REQUEST_TIMEOUT_MS || '12000', 10);
const http = axios.create({ baseURL, timeout });

export async function getMutasi(username, token) {
  const url = `/mutasi/${encodeURIComponent(username)}/${encodeURIComponent(token)}`;
  const { data } = await http.get(url);
  return data;
}
export async function generateQris(qrisBase, nominal) {
  const url = `/qris/${encodeURIComponent(qrisBase)}/${encodeURIComponent(nominal)}`;
  const { data } = await http.get(url);
  return data;
}
export async function registerWebhook(username, token, webhookUrl) {
  const url = `/webhook/register`;
  const { data } = await http.post(url, { username, token, webhook: webhookUrl });
  return data;
}
