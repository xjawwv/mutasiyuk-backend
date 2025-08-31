# MutasiYuk Backend – Subscription + Deposit (MERN-ready API Backend)

Backend penyedia **API Key** mirip Mutasiku untuk integrasi **QRIS**: ada **Deposit** (v1) dan **Subscription** (v2) lengkap dengan **webhook internal + logging ke DB**. Ditulis dengan **Node.js (Express) + MongoDB**.

> Fokus proyek ini: **Backend-only** (tanpa admin UI). Endpoint dibuat agar mudah dipakai FE MERN/Next.js.

---

## ✨ Fitur Utama

* **Auth & API Key**
  JWT untuk login/register. API Key per-user untuk akses `/v1/*`.
* **Deposit API**
  Buat deposit, cancel, cek status (rate-limit 5 detik).
* **Subscription API**
  Buat order subscription dgn **kode unik random** + **auto-cancel order lama**.
  Matching via webhook (amount = SUBS\_PRICE + kode\_unik).
  Middleware `checkSubscription` memblokir akses `/v1` jika subscription **null/expired**.
* **Internal Webhook + Log DB**
  `/internal/subscription/webhook` dengan **IP Whitelist**. Semua request dicatat ke koleksi **WebhookLog** (TTL configurable).
* **Keamanan**

  * IP whitelist untuk route internal.
  * Rate limit global 120 req/menit.
  * CORS, Helmet.
  * Optional: HMAC signature (off by default).

---

## 🧱 Arsitektur & Struktur Folder

```
src/
  config/
    db.js                 # koneksi MongoDB
  controllers/
    depositController.js
    internalController.js # webhook & log
    subscriptionController.js
  jobs/
    poller.js             # (opsional) worker / poller
  middlewares/
    auth.js               # jwtAuth
    apiKeyAuth.js         # otentikasi X-API-Key
    checkSubscription.js  # blokir jika subscription non-aktif
    errorHandler.js
    ipWhitelist.js
  models/
    User.js
    Deposit.js
    SubscriptionOrder.js
    WebhookLog.js
  routes/
    auth.js
    me.js
    v1.js                 # deposit API (butuh API Key + subscription aktif)
    subscription.js       # order subscription (butuh JWT)
    internal.js           # webhook & log (IP whitelist)
  services/
    providerService.js    # call ke provider QRIS (bisa mock saat dev)
  utils/
    crypto.js             # (opsional) HMAC kalau mau dipakai
  server.js               # bootstrap express
```

---

## 🔧 Instalasi

1. **Clone & Install**

```bash
git clone <repo-url>
cd mutasiyuk-backend
npm install
```

2. **Environment (.env)** – contoh minimal

```ini
# --- App & DB ---
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/mutasiyuk
JWT_SECRET=change-this
API_KEY_SECRET=change-this
NODE_ENV=development

# --- Subscription ---
SUBS_PRICE=10000                       # harga langganan (Rp)
SUBS_QRIS_BASE=qrisBaseAdmin           # qrisBase untuk terima pembayaran subscription
SUBS_ORDER_TTL_MINUTES=30              # masa berlaku order subs
SUBS_UNIQUE_CODE_MAX_SUB=100           # range kode unik 1..N (random)

# --- Internal Webhook ---
SUBS_WEBHOOK_WHITELIST=127.0.0.1,::1   # IP yang diizinkan akses /internal/*
SUBS_WEBHOOK_LOG_TTL_DAYS=30           # TTL log webhook (hari)
SUBS_WEBHOOK_LOG_MAX_RETURN=200        # limit GET logs
# (Optional jika ingin HMAC)
SUBS_WEBHOOK_VERIFY=false
SUBS_WEBHOOK_SECRET=change-this-too

# --- Provider QRIS ---
PROVIDER_BASE_URL=https://api.heyta25.my.id
REQUEST_TIMEOUT_MS=12000
```

> **Catatan:** saat development dan provider down, Anda bisa mock `generateQris()` agar mengembalikan URL gambar dummy (lihat bagian **Mock Provider** di bawah).

3. **Jalankan**

```bash
npm run dev      # nodemon
# atau produksi
npm start        # node
# atau pakai PM2
pm2 start "npm run start" --name mutasiyuk-backend
pm2 save && pm2 startup
```

---

## 🔐 Keamanan & Proxy

* **IP Whitelist**: semua endpoint `/internal/*` dibatasi oleh `SUBS_WEBHOOK_WHITELIST`.
* **trust proxy**: di `server.js` sudah `app.set('trust proxy', NODE_ENV==='production'?1:false)`.
  Jika di belakang Nginx, gunakan `1` **dan** set header di Nginx:

  ```nginx
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  ```
* **Rate limit**: global 120 req/menit; cek status deposit dan status subscription order limit **1x/5 detik**.
* **HMAC Signature (Opsional)**: secara default **OFF**. Jika ingin ON: set `SUBS_WEBHOOK_VERIFY=true` dan gunakan header `X-Signature: <hex hmac_sha256(raw_body, SUBS_WEBHOOK_SECRET)>` di pihak pengirim webhook.

---

## 📚 Endpoint Ringkas

### 1) Auth (publik)

* `POST /auth/register`
  Body: `{ email, password }`
* `POST /auth/login`
  Body: `{ email, password }`
  Respon: `{ token }` (JWT)

### 2) Me (JWT)

* `GET /me` → profil + `subscription_expires_at`
* `PUT /me/settings` → set `{ username, token, kodeMerchant, qrisBase, webhook }`
* `POST /me/api-key/rotate` → buat/rotate `apiKey`

### 3) Deposit API (butuh **X-API-Key** + subscription aktif)

> Semua route di bawah memakai `apiKeyAuth` **dan** `checkSubscription`.

* `POST /v1/deposits`
  Body: `{ nominal }`
* `GET /v1/deposits/:kodeDeposit`
  **Rate-limit**: 1x/5 detik per user+kode
* `POST /v1/deposits/:kodeDeposit/cancel`
* `GET /v1/subscription`
  Cek status subscription via API key

**Header wajib:**

```
X-API-Key: <apiKey_user>
Content-Type: application/json
```

### 4) Subscription API (butuh **JWT**)

* `POST /subscription/order`
  Buat order subscription **dengan kode unik random**.
  **Auto-cancel** semua order Pending user sebelumnya.
  Respon contoh:

  ```json
  {
    "status": true,
    "data": {
      "order_id": "SUBCF4V7EQL",
      "nominal": 10000,
      "kode_unik": 2,
      "amount": 10002,
      "status": "Pending",
      "expired": "2025-08-31 19:58",
      "qris_url": "https://.../qris_10002.png"
    }
  }
  ```
* `GET /subscription/order/:orderId`
  **Rate-limit**: 1x/5 detik per user+orderId
* `GET /subscription/me`
  Lihat masa aktif subscription: `{ active, expires_at }`

**Header wajib:**

```
Authorization: Bearer <JWT>
Content-Type: application/json
```

### 5) Internal (admin/provider only, **IP whitelist**)

* `POST /internal/subscription/webhook`
  **Body (JSON):**

  ```json
  {
    "sourceUser": "xjaww",               
    "newTransaction": {
      "id": 168700427,
      "debet": "0",
      "kredit": "10002",                 
      "keterangan": "NOBU / REZA",
      "status": "IN",
      "brand": { "name": "Bank Jago", "logo": "https://.../default.png" }
    }
  }
  ```

  **Aturan matching:**

  * Sistem mencari **SubscriptionOrder** `status=Pending` dengan `amount == kredit` dan `expiredAt > now`.
  * Jika `sourceUser` valid (match `settings.username` / `email`) maka prioritas ke order milik user tsb.
  * Jika **ketemu** → order **Success**, `successAt` diisi, `subscription_expires_at` user **ditambah 30 hari**.
  * Jika **tidak ada order** tapi `sourceUser` valid → **legacy mode**: tetap extend 30 hari (order tidak berubah).
* `GET /internal/webhook/logs?limit=50&processed=true&order_id=SUB...&since=2025-08-31T00:00:00Z&sourceUser=xjaww`
  Lihat riwayat webhook (TTL default 30 hari).
* `GET /internal/webhook/logs/:id`
  Detail satu log.

**Header wajib (minimal):**

```
Content-Type: application/json
# Jika HMAC diaktifkan (opsional):
X-Signature: <hex hmac_sha256(raw_body, SUBS_WEBHOOK_SECRET)>
```

---

## 🧪 Contoh cURL

### Register → Login → Order Subscription → Cek Status

```bash
# Register
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret"}'

# Login (ambil token)
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret"}'
# -> simpan data.token sebagai JWT

# Buat order subscription
curl -X POST http://localhost:3000/subscription/order \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{}'

# Misal respon amount = 10014 dan order_id = SUBXXXX
# Kirim webhook (simulasi provider)
curl -X POST http://localhost:3000/internal/subscription/webhook \
  -H "Content-Type: application/json" \
  -d '{"sourceUser":"user","newTransaction":{"kredit":"10014","status":"IN"}}'

# Cek status order
curl -H "Authorization: Bearer <JWT>" \
  http://localhost:3000/subscription/order/SUBXXXX

# Cek masa aktif subscription
curl -H "Authorization: Bearer <JWT>" \
  http://localhost:3000/subscription/me
```

### Deposit API (dengan API Key + subscription aktif)

```bash
# Rotate ambil API Key
curl -X POST http://localhost:3000/me/api-key/rotate \
  -H "Authorization: Bearer <JWT>"
# -> simpan apiKey

# Buat deposit
curl -X POST http://localhost:3000/v1/deposits \
  -H "X-API-Key: <apiKey>" \
  -H "Content-Type: application/json" \
  -d '{"nominal": 10000}'

# Cek status deposit (kena rate limit 1x/5 detik)
curl -H "X-API-Key: <apiKey>" \
  http://localhost:3000/v1/deposits/MYABCDE1
```

---

## 🧠 Perilaku Penting

* **Kode unik random** (1..`SUBS_UNIQUE_CODE_MAX_SUB`) saat `POST /subscription/order`.
  Sistem **membatalkan** semua order Pending milik user sebelum membuat order baru.
* **Matching Webhook**: berdasarkan `amount == kredit`. Jika tidak ketemu tetapi `sourceUser` valid, sistem tetap extend (**legacy mode**).
  **Saran:** selalu sertakan `sourceUser` yang sama dengan `settings.username` user agar akurat.
* **checkSubscription**: semua endpoint `/v1` akan **403** jika subscription null/expired.
* **Rate Limit**:

  * Global: 120 req/menit
  * `GET /v1/deposits/:kodeDeposit` & `GET /subscription/order/:id`: **1x/5 detik** per user+resource
* **WebhookLog**: otomatis terhapus oleh TTL (default 30 hari). Bisa diubah via `.env`.

---

## 🧪 Mock Provider (Dev)

Jika provider QRIS down/sedang nonaktif, Anda bisa membuat fallback di `services/providerService.js`:

```js
export async function generateQris(qrisBase, nominal) {
  if (process.env.NODE_ENV !== 'production') {
    return { success: true, data: { image_url: `http://localhost:3000/dummy-qris/${nominal}.png` } };
  }
  // production: call provider nyata
}
```

Atau arahkan `PROVIDER_BASE_URL` ke service lokal Anda.

---

## 🛠 Nginx (opsional, untuk domain)

```nginx
server {
  server_name api.mutasiyuk.my.id;
  listen 80;
  listen 443 ssl;
  ssl_certificate     /etc/letsencrypt/live/api.mutasiyuk.my.id/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.mutasiyuk.my.id/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

> Untuk **internal webhook** di server yang sama, paling aman gunakan **`http://127.0.0.1:3000/internal/subscription/webhook`** (tanpa expose publik) dan whitelist `127.0.0.1,::1`.

---

## 🧩 Indeks MongoDB (Disarankan)

Tambahkan index berikut (sebagian sudah ada di schema):

```js
// SubscriptionOrder
SubscriptionOrderSchema.index({ status: 1, amount: 1 });
SubscriptionOrderSchema.index({ userId: 1, status: 1 });
SubscriptionOrderSchema.index({ order_id: 1 }, { unique: true });

// WebhookLog
WebhookLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60*60*24*TTL_DAYS });
```

---

## 🧯 Troubleshooting

* **404** – Pastikan path & method benar (mis. `/subscription/order` adalah **POST**, bukan GET).
* **ENOTFOUND `localhost3000`** – Kurang `:` di URL. Harus `http://localhost:3000/...`.
* **Invalid character in header content \[Authorization]** – Header `Authorization` salah format (ada newline/kutip). Gunakan tab Authorization Postman: *Bearer Token*.
* **502 Bad Gateway saat buat order** – Provider QRIS down atau `SUBS_QRIS_BASE` salah. Saat dev, gunakan **Mock Provider**.
* **Order tetap Pending** – Webhook tidak match (cek: `amount` disimpan Number? `kredit` sama dengan amount?). Lihat `GET /internal/webhook/logs`.
* **Subscription tidak update** – `sourceUser` tidak match user (`settings.username` kosong), atau `user.save()` tidak terpanggil. Isi `settings.username` dan kirim `sourceUser` pada webhook.
* **Rate-limit trust proxy warning** – Jangan set `app.set('trust proxy', true)`. Pakai `1` di belakang Nginx atau `false` di lokal.

---

## 📄 Lisensi

Private project – penggunaan sesuai kesepakatan internal.

---

## ✅ Checklist Production

* [ ] `.env` terisi semua (khususnya `SUBS_QRIS_BASE`, secrets, whitelist IP)
* [ ] Nginx proxy header IP aktif + `trust proxy = 1`
* [ ] TLS/HTTPS aktif
* [ ] Mongo index dibuat
* [ ] PM2/autostart aktif
* [ ] Monitoring log (WebhookLog) dan rotasi log Node

> Selesai. Kalau butuh template Postman Collection/Environment, tinggal bilang—aku siapin. 🙌
