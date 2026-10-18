# M9Vends — Complete System Guide
### How to Set Up, Run, and Use the Entire Platform

> This document is the **single entry point** for understanding and operating the complete M9Vends system.
> It covers: initial setup, day-to-day operations, and how all three components (Backend, Kiosk, Admin Panel) work together.

---

## Table of Contents

1. [What Is M9Vends?](#1-what-is-m9vends)
2. [System Components at a Glance](#2-system-components-at-a-glance)
3. [Complete Data & Event Flow](#3-complete-data--event-flow)
4. [Prerequisites](#4-prerequisites)
5. [Step 1 — Set Up the SaaS Backend](#5-step-1--set-up-the-saas-backend)
6. [Step 2 — Seed Your First Company & Admin](#6-step-2--seed-your-first-company--admin)
7. [Step 3 — Set Up the User Kiosk](#7-step-3--set-up-the-user-kiosk)
8. [Step 4 — Set Up the Admin Panel](#8-step-4--set-up-the-admin-panel)
9. [Step 5 — Provision a Physical Machine](#9-step-5--provision-a-physical-machine)
10. [Step 6 — Set Up the Product Catalog](#10-step-6--set-up-the-product-catalog)
11. [Daily Operations — Admin Panel Workflows](#11-daily-operations--admin-panel-workflows)
12. [Daily Operations — Kiosk Customer Journey](#12-daily-operations--kiosk-customer-journey)
13. [Payment Operations](#13-payment-operations)
14. [Staff Management](#14-staff-management)
15. [Troubleshooting](#15-troubleshooting)
16. [Environment Checklist](#16-environment-checklist)
17. [Key IDs to Note](#17-key-ids-to-note)

---

## 1. What Is M9Vends?

M9Vends is a **cloud-connected vending machine management platform** with three parts:

| Component | What it is | Who uses it |
|---|---|---|
| **SaaS Backend** | REST API + Socket.IO + MQTT bridge server | No direct user — powers everything |
| **User Kiosk** | React touch-screen app on the physical machine | Customers buying food/beverages |
| **Admin Panel** | Next.js dashboard | Business owners, managers, technicians |

**The core purchase flow:**
```
Customer taps Kiosk → selects products → pays via UPI QR or Cash
→ Backend records order → Machine dispenses → Admin sees it in dashboard
```

---

## 2. System Components at a Glance

```
┌─────────────────────────────────────────────────────────────────────┐
│                        M9Vends Ecosystem                            │
│                                                                     │
│  ┌─────────────┐    REST     ┌──────────────────────────────────┐  │
│  │  User Kiosk │ ──────────► │  SaaS Backend  :5000             │  │
│  │  React/Vite │ ◄────────── │  Express + MongoDB Atlas          │  │
│  │  (on machine│    REST     │                                   │  │
│  │   screen)   │             │  /api/public/* ← Kiosk routes    │  │
│  └─────────────┘             │  /api/admin/*  ← Admin routes    │  │
│                              │                                   │  │
│  ┌─────────────┐  Socket.IO  │  Socket.IO server                 │  │
│  │ Admin Panel │ ◄─────────► │  (real-time telemetry + alerts)  │  │
│  │ Next.js 14  │             │                                   │  │
│  │ (browser)   │    REST     │  MQTT client (server-side)       │  │
│  └─────────────┘ ──────────► │  ↕ IoT Broker :1883              │  │
│                              └──────────────────────────────────┘  │
│                                         │                           │
│                                   IoT REST API                      │
│                                         │                           │
│                              ┌──────────▼─────────────┐            │
│                              │  IoT Backend Service    │            │
│                              │  (separate deployment)  │            │
│                              └──────────┬──────────────┘            │
│                                         │ MQTT                      │
│                              ┌──────────▼──────────────┐           │
│                              │  Physical Vending Machine│           │
│                              │  (Arduino + IoT unit)    │           │
│                              └──────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Complete Data & Event Flow

### A. Machine Boot Flow (happens every time a kiosk powers on)

```
1. Kiosk boots → reads VITE_SERIAL_NUMBER from .env
2. POST [IoT] /api/device/wake-up { serialNumber }
3. IoT backend returns { deviceVID, isProvisioned, mqttConfig }
4. deviceVID = machine_id for ALL subsequent API calls
5. If NOT provisioned → show QR screen, wait for admin to scan
6. If provisioned → load catalog screen
```

### B. Customer Purchase Flow (UPI)

```
1. Customer taps screen → Catalog loads from SaaS
   GET /api/public/catalog/:machine_id

2. Customer builds cart, taps "Pay with UPI"
   POST /api/public/order { machine_id, items, payment_method: "UPI" }
   ← { order_id, payment_link }

3. Kiosk shows QR code (payment_link rendered as QR)
   Kiosk polls GET /api/public/order/:id/status every 3s
   Customer scans QR with phone UPI app

4. Customer pays → Razorpay captures payment
   → Razorpay webhook: POST /api/public/payment/webhook/:company_id
   → Backend verifies signature, marks order PAID + DISPENSING
   → Decrements stock

5. Kiosk polling detects payment_status: "PAID"
   → Shows success screen
   → Machine dispenses items
```

### C. Customer Purchase Flow (Cash)

```
1. Same as A, but customer taps "Pay with Cash"
   POST /api/public/order { machine_id, items, payment_method: "CASH" }
   ← { order_id, total_amount } (no QR, no Razorpay)

2. Kiosk shows order ID + amount
   Customer pays cash to attendant

3. Admin sees pending cash order in dashboard (via Socket.IO order:cash_pending event)
   Admin clicks "Confirm Cash" in Admin Panel
   POST /api/admin/orders/:id/confirm-cash

4. Backend marks order PAID + DISPENSING, decrements stock
5. Kiosk polling detects PAID → Success screen → machine dispenses
```

### D. Real-time Machine Monitoring Flow (Admin Panel)

```
Physical Machine (Arduino)
   ↓ MQTT publish device/<deviceVID>/telemetry (every 1 second)
   ↓ MQTT publish device/<deviceVID>/status ("online"/"offline")

MQTT Broker (13.239.132.146:1883)
   ↓

SaaS Backend mqttService.js
   - subscribed to device/+/telemetry and device/+/status
   - parses deviceVID from topic
   - caches latest telemetry in memory Map
   - detects alert strings vs normal JSON telemetry
   ↓ Socket.IO emit to company room

Admin Panel Browser (useSocket.ts)
   → machine:telemetry → update machineStore → render gauges, tank bars
   → machine:status → update machineStore → update online/offline badge
   → machine:alert → update alertStore → show banner/toast + sound
```

---

## 4. Prerequisites

Before starting, you need:

| Requirement | Details |
|---|---|
| Node.js | Version 18 or higher |
| npm | Version 8 or higher |
| MongoDB Atlas account | Free tier is fine for development |
| Razorpay account | Test mode keys for development |
| IoT backend running | `https://m9vends-iot-backend-service.onrender.com` or local `http://localhost:3001` |
| MQTT Broker accessible | `13.239.132.146:1883` — confirm it's reachable from your server |
| Git | For version control |

> ⚠️ **Render free tier cold-start:** The IoT backend sleeps after 15 min of inactivity. The first request after sleep may take 30–60 seconds. The kiosk `BootScreen` handles this with a retry loop.

---

## 5. Step 1 — Verify IoT Backend is Reachable

Before setting up anything else, confirm the IoT backend (and MQTT broker) are accessible.

```bash
# Test IoT backend REST API (will wake it up if sleeping)
curl -X POST https://m9vends-iot-backend-service.onrender.com/api/device/wake-up \
  -H "Content-Type: application/json" \
  -d '{ "serialNumber": "SN-TEST-001", "model": "TestModel", "status": "online" }'
# Expected: { "deviceVID": "...", "isProvisioned": false, ... }
```

> If you get a timeout (first cold-start on Render), wait 30s and retry.

```bash
# Test MQTT broker reachability (requires mosquitto_pub or similar tool)
# If you don't have it, skip this — the SaaS backend will log MQTT status on startup
ping 13.239.132.146
```

> 📄 Full IoT backend API reference: [00_IOT_BACKEND_DOCUMENTATION.md](./00_IOT_BACKEND_DOCUMENTATION.md)

---

## 6. Step 2 — Set Up the SaaS Backend

### 5.1 Install dependencies

```bash
cd backend
npm install
```

### 5.2 Configure environment

Create `backend/.env`:

```env
PORT=5000
NODE_ENV=development

MONGO_URI=mongodb+srv://<user>:<password>@cluster0.u8nxqy3.mongodb.net/<dbname>

JWT_ACCESS_SECRET=your_super_secret_access_key_min_10_chars
JWT_REFRESH_SECRET=your_super_secret_refresh_key_min_10_chars
ACCESS_TOKEN_EXPIRY=1d
REFRESH_TOKEN_EXPIRY=7d

FRONTEND_URL=http://localhost:3000
KIOSK_URL=http://localhost:5174

RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXXXXX
RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXXXXXXXXXX

MQTT_BROKER_HOST=13.239.132.146
MQTT_BROKER_TCP_PORT=1883
MQTT_ADMIN_USERNAME=
MQTT_ADMIN_PASSWORD=
IOT_API_BASE_URL=https://m9vends-iot-backend-service.onrender.com
```

### 5.3 Start the backend

```bash
npm run dev    # development (auto-restart on changes)
# or
npm start      # production
```

### 5.4 Verify it's running

```bash
curl http://localhost:5000/health
# Expected: { "success": true, "message": "Server is running", ... }
```

You should see in the terminal:
```
[INFO] Server running on http://localhost:5000
[INFO] Environment → development
[INFO] [MQTT] Service started   ← (if MQTT env vars are set)
```

---

## 6. Step 2 — Seed Your First Company & Admin

### 6.1 Create the Company in MongoDB Atlas

> ⚠️ There is currently no API endpoint to create a Company. You must insert it directly in MongoDB Atlas.

1. Open MongoDB Atlas → Browse Collections → `companies` collection
2. Click "Insert Document" and paste:

```json
{
  "company_name": "M9Vends Demo Co",
  "plan": "FREE",
  "contact_email": "admin@m9vends.com",
  "contact_phone": "+91 99999 00000",
  "is_active": true,
  "plan_expires_at": null,
  "razorpay_key_id": null,
  "razorpay_key_secret": null,
  "createdAt": { "$date": "2026-01-01T00:00:00Z" },
  "updatedAt": { "$date": "2026-01-01T00:00:00Z" }
}
```

3. Note the generated `_id` — this is your `company_id`.

### 6.2 Create the first Admin user

**Option A: Use the seed script**

```bash
cd backend
node seedAdmin.js
```

**Option B: Call the register endpoint**

```bash
curl -X POST http://localhost:5000/api/admin/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "company_id": "<your_company_id_from_atlas>",
    "name": "Admin User",
    "email": "admin@m9vends.com",
    "password": "SecurePass123!",
    "role": "SUPER_ADMIN"
  }'
```

### 6.3 Test login

```bash
curl -X POST http://localhost:5000/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "admin@m9vends.com", "password": "SecurePass123!" }'
```

You should receive a JSON response with an `accessToken`.

---

## 7. Step 3 — Set Up the User Kiosk

### 7.1 Create the kiosk project

```bash
# In a new directory (sibling to SAAS/):
cd kiosk-screen
npm install
```

### 7.2 Configure environment

Create `kiosk-screen/.env`:

```env
VITE_SERIAL_NUMBER=SN-M9V-0001        # Unique per physical machine
VITE_SAAS_API_URL=http://localhost:5000
VITE_IOT_API_URL=https://m9vends-iot-backend-service.onrender.com
VITE_MQTT_BROKER_URL=ws://13.239.132.146:8083
```

> ⚠️ **VITE_SERIAL_NUMBER must be unique per physical device.**

### 7.3 Run the kiosk

```bash
npm run dev       # Opens at http://localhost:5174
```

### 7.4 What you should see

On first launch, the kiosk will show the **Boot Screen** (spinning loader) while it calls the IoT backend. Then:
- If machine is NOT provisioned → **Provision Screen** with QR code
- If machine IS provisioned → **Idle Screen** (attract mode)

---

## 8. Step 4 — Set Up the Admin Panel

### 8.1 Create the Next.js project

```bash
npx create-next-app@latest admin-panel --typescript --tailwind --app
cd admin-panel
npm i zustand @tanstack/react-query axios socket.io-client recharts lucide-react
npx shadcn-ui@latest init
```

### 8.2 Configure environment

Create `admin-panel/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

### 8.3 Run the admin panel

```bash
npm run dev       # Opens at http://localhost:3000
```

### 8.4 Login

1. Open `http://localhost:3000`
2. Enter the admin credentials created in Step 2
3. You should see the dashboard

---

## 9. Step 5 — Provision a Physical Machine

Provisioning links a physical machine's serial number to your company account.

### 9.1 What happens on the Kiosk side

When the kiosk boots with an **unregistered** serial number, it shows a QR code containing only the serial number (e.g. `SN-M9V-0001`).

### 9.2 Provision via Admin Panel (Recommended)

1. Open Admin Panel → **Machines** → **Add Machine**
2. Click **Scan QR Code**
3. Point camera at the QR code on the kiosk screen
4. The app reads the serial number and calls:
   ```
   POST /api/admin/machines/provision { serialNumber: "SN-M9V-0001" }
   ```
5. The IoT backend links the machine to your company account
6. The kiosk automatically detects it's provisioned (polling every 10s) and shows the **Catalog Screen**

### 9.3 Provision via API (Developer/Manual)

```bash
# First, get your access token via login
curl -X POST http://localhost:5000/api/admin/machines/provision \
  -H "Authorization: Bearer <your_access_token>" \
  -H "Content-Type: application/json" \
  -d '{ "serialNumber": "SN-M9V-0001" }'
```

### 9.4 Verify provisioning

After provisioning, the machine's `deviceVID` (the MongoDB ObjectId the IoT backend assigns) is returned. **Save this value** — it is the `machine_id` used everywhere:

```json
{ "vid": "60d5ec49f3e4e9001f3b2e99", "message": "Provisioning Successful" }
```

---

## 10. Step 6 — Set Up the Product Catalog

### 10.1 Create products in the product library

Via Admin Panel → **Products** → **Add Product**

Or via API:

```bash
curl -X POST http://localhost:5000/api/admin/products \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "product_name": "Masala Pani Puri",
    "description": "Tangy street-style pani puri",
    "price": 25,
    "category": "Snacks",
    "sku": "PPU-001"
  }'
```

Note the returned `_id` — this is your `product_id`.

### 10.2 Add products to a machine's catalog

Via Admin Panel → **Catalog** → Select Machine → **Add Product**

Or via API:

```bash
curl -X POST http://localhost:5000/api/admin/catalog \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "machine_id": "60d5ec49f3e4e9001f3b2e99",
    "product_id": "<product_id_from_step_1>",
    "stock": 50,
    "max_capacity": 50,
    "slot_label": "A1",
    "is_enabled": true
  }'
```

### 10.3 Verify on kiosk

Open the kiosk → go to Catalog Screen → you should see the product listed.

---

## 11. Daily Operations — Admin Panel Workflows

### Monitoring Live Machine Status

1. Open `/dashboard` — Machine Status Grid shows online/offline badges in real time
2. Click any machine → goes to `/machines/[deviceVID]`
3. Live telemetry panel shows:
   - Motor temperature (°C) with color-coded gauge
   - Tank fill levels (%) with animated bars
   - Current sensor reading (mA)
   - Online/Offline status

### Restocking a Machine

1. Go to `/machines/[deviceVID]` → scroll to **STOCK / CATALOG** section
2. Find the slot that's running low (shown in red/amber)
3. Click **Restock** → enter new stock count → click **Save**

Or via API:

```bash
curl -X PUT http://localhost:5000/api/admin/catalog/<catalog_id> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "stock": 50 }'
```

### Confirming a Cash Order

1. Dashboard shows real-time notification when cash order arrives (Socket.IO event)
2. Or go to `/orders?status=PENDING`
3. Find the PENDING cash order → click **Confirm Cash Received**
4. Backend marks it PAID + decrements stock
5. Kiosk shows success to customer + machine dispenses

Or via API:

```bash
curl -X POST http://localhost:5000/api/admin/orders/<order_id>/confirm-cash \
  -H "Authorization: Bearer <token>"
```

### Viewing Analytics

Go to `/analytics`:

- **Revenue Over Time** — line chart, toggle day/week/month
- **Top Products** — bar chart sorted by quantity sold
- **Revenue by Machine** — compare machine performance
- **Payment Methods** — UPI vs Cash pie chart

Filter by date range using `from_date` and `to_date` query params.

### Sending a Command to a Machine

> Requires SUPER_ADMIN or ADMIN role.

1. Go to `/machines/[deviceVID]` → **COMMANDS** panel
2. Click **Force Read Telemetry** — requests immediate sensor data
3. Click **Toggle Steering Motor** — toggles motor ON/OFF

Or via API:

```bash
curl -X POST http://localhost:5000/api/admin/machines/<machine_id>/commands \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "message": "getDataFromHardware" }'
```

---

## 12. Daily Operations — Kiosk Customer Journey

### Normal Purchase (UPI)

```
1. Customer approaches machine → screen shows idle/attract mode

2. Customer taps screen
   → Catalog screen loads (pre-fetched)

3. Customer taps + on items they want
   → Cart bar at bottom shows total

4. Customer taps "Checkout"
   → Cart review screen shows all items + total

5. Customer taps "Pay with UPI"
   → Backend creates Razorpay order
   → QR code appears (3-minute countdown starts)

6. Customer opens UPI app (PhonePe, Google Pay, Paytm, etc.)
   → Scans QR code → completes payment

7. Kiosk polls payment status
   → payment_status becomes "PAID"
   → Success screen: "Your items are being dispensed!"

8. Machine dispenses items
   → Screen returns to idle after 5 seconds
```

### Normal Purchase (Cash)

```
1–4. Same as UPI up to "Checkout"

5. Customer taps "Pay with Cash"
   → Backend creates cash order (no QR needed)
   → Screen shows: "Order #12345 — ₹25 — Please pay cash to attendant"

6. Customer pays cash to the staff member at the machine

7. Staff member opens Admin Panel on phone/laptop
   → Confirms cash payment

8. Kiosk polling detects PAID → Success screen → machine dispenses
```

### What Happens on Payment Timeout (UPI)

```
3-minute countdown expires
  → Kiosk automatically calls POST /api/public/order/:id/cancel
  → Shows "Payment Timed Out" on FailedScreen
  → Customer can retry or start over
```

---

## 13. Payment Operations

### UPI Flow Detail

| Step | Actor | Action |
|---|---|---|
| 1 | Kiosk | `POST /api/public/order` with `payment_method: "UPI"` |
| 2 | Backend | Creates Razorpay order → generates `payment_link` (UPI deep link) |
| 3 | Kiosk | Renders `payment_link` as QR code |
| 4 | Customer | Scans QR with UPI app → pays |
| 5 | Razorpay | Sends `payment.captured` webhook to backend |
| 6 | Backend | Verifies HMAC signature → marks order PAID → decrements stock |
| 7 | Kiosk | Polls detect PAID → shows Success |

### Cash Flow Detail

| Step | Actor | Action |
|---|---|---|
| 1 | Kiosk | `POST /api/public/order` with `payment_method: "CASH"` |
| 2 | Backend | Creates order WITHOUT Razorpay → returns order_id + total |
| 3 | Kiosk | Shows order ID + amount on screen |
| 4 | Customer | Pays cash to attendant |
| 5 | Admin | `POST /api/admin/orders/:id/confirm-cash` |
| 6 | Backend | Marks order PAID → decrements stock |
| 7 | Kiosk | Polls detect PAID → shows Success |

### Razorpay Webhook Setup

In your Razorpay Dashboard:

1. Go to **Settings → Webhooks**
2. Add webhook URL: `https://your-backend-domain.com/api/public/payment/webhook/<company_id>`
3. Enable event: `payment.captured`
4. Copy the webhook secret → add to your `.env` as `RAZORPAY_KEY_SECRET`

> ⚠️ Replace `MERCHANT_UPI_ID` placeholder in `backend/src/services/orderService.js` line ~131 with your real Razorpay merchant VPA before going live.

---

## 14. Staff Management

### Inviting an Admin

1. Admin Panel → **Users** → **Add User**
2. Fill in name, email, password, role: `ADMIN`
3. Share credentials with the new admin

```bash
# Via API:
curl -X POST http://localhost:5000/api/admin/users \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Operations Manager",
    "email": "ops@company.com",
    "password": "TempPass123!",
    "role": "ADMIN"
  }'
```

### Inviting a Technician

Same as Admin but with `role: "TECHNICIAN"`.

### Assigning a Technician to a Machine

After creating the Technician account:

1. Admin Panel → **Machines** → Select machine → **Assignments** tab
2. Click **Assign Technician** → select from dropdown

Or via API:

```bash
curl -X POST http://localhost:5000/api/admin/assignments \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "machine_id": "60d5ec49f3e4e9001f3b2e99",
    "technician_id": "<technician_user_id>"
  }'
```

The Technician can now:
- See this machine in their dashboard
- View its live telemetry
- Update stock
- Confirm cash payments for this machine

### Deactivating a User

```bash
curl -X PATCH http://localhost:5000/api/admin/users/<user_id>/status \
  -H "Authorization: Bearer <super_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{ "is_active": false }'
```

Deactivated users cannot login and cannot receive new tokens.

---

## 15. Troubleshooting

### Backend won't start

**Problem:** `Invalid environment variables` error on startup.

**Fix:** Check `.env` file:
- `MONGO_URI` must be set
- `JWT_ACCESS_SECRET` must be at least 10 characters
- `JWT_REFRESH_SECRET` must be at least 10 characters
- `NODE_ENV` must be `development`, `production`, or `test`

---

### Kiosk stuck on Boot Screen

**Problem:** Kiosk shows spinner, never progresses.

**Fix:** Check IoT backend connectivity:
```bash
curl https://m9vends-iot-backend-service.onrender.com/api/device/wake-up \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{ "serialNumber": "SN-M9V-TEST", "model": "test", "status": "online" }'
```

If unreachable, the IoT backend may be sleeping (Render free tier). Wait 30s and retry.

---

### Catalog shows empty / 404

**Problem:** Kiosk catalog screen shows "no products" or error.

**Fix checklist:**
1. Machine is provisioned (`isProvisioned: true` from IoT wake-up)
2. Products exist in admin panel (`/products`)
3. Products are added to this machine's catalog (`/catalog`)
4. Catalog entries have `is_enabled: true` AND products have `is_available: true`
5. Check backend logs for the catalog fetch request

---

### Payment not confirming

**Problem:** Customer paid UPI but kiosk keeps showing QR.

**Fix:**
1. Check Razorpay webhook is set up (see Section 13)
2. Check backend logs for `[Webhook]` entries
3. Verify `RAZORPAY_KEY_SECRET` in `.env` matches your Razorpay webhook secret
4. If in test mode, use Razorpay test UPI: `success@razorpay`

---

### Admin Panel shows no machine data

**Problem:** `/machines` shows empty list.

**Fix:**
1. Check `IOT_API_BASE_URL` in backend `.env`
2. Test IoT API directly: `curl $IOT_API_BASE_URL/api/device/user/<your_user_id>`
3. Ensure the logged-in admin's `user._id` owns devices in the IoT backend

---

### Socket.IO events not received

**Problem:** Machine status badges not updating live in admin panel.

**Fix:**
1. Check browser console for Socket.IO connection errors
2. Verify `NEXT_PUBLIC_SOCKET_URL` points to the running backend
3. Check backend CORS config includes the admin panel origin
4. Confirm MQTT service is running (check backend terminal for `[MQTT] Service started`)
5. Verify the machine is actually publishing MQTT data

---

### "Invalid catalog_id" error on order placement

**Problem:** `POST /api/public/order` returns 400 with "Invalid catalog_id".

**Fix:** The kiosk is using a hardcoded or stale `catalog_id`. Always fetch fresh catalog data from `GET /api/public/catalog/:machine_id` and use the `catalog_id` field from that response — never the `product_id`.

---

### Cash order — kiosk stuck waiting

**Problem:** Cash payment screen shows order ID but never progresses.

**Fix:** Admin must confirm the cash payment in the Admin Panel:
- `/orders` → filter by `status=PENDING` → click **Confirm Cash**
- Or use API: `POST /api/admin/orders/:id/confirm-cash`

---

## 16. Environment Checklist

Use this before going to production:

### Backend `.env`

- [ ] `MONGO_URI` points to production database (not test cluster)
- [ ] `JWT_ACCESS_SECRET` is a long random string (min 32 chars for production)
- [ ] `JWT_REFRESH_SECRET` is a different long random string
- [ ] `NODE_ENV=production`
- [ ] `RAZORPAY_KEY_ID` is the **live** key (not test)
- [ ] `RAZORPAY_KEY_SECRET` is the **live** secret
- [ ] `FRONTEND_URL` is your production admin panel URL
- [ ] `KIOSK_URL` is your production kiosk URL

### Kiosk `.env`

- [ ] `VITE_SERIAL_NUMBER` is unique for this physical machine
- [ ] `VITE_SAAS_API_URL` points to production backend
- [ ] `VITE_IOT_API_URL` points to production IoT service
- [ ] Running in Chrome `--kiosk` mode (no address bar, no DevTools)

### Admin Panel `.env.local`

- [ ] `NEXT_PUBLIC_API_URL` points to production backend
- [ ] `NEXT_PUBLIC_SOCKET_URL` points to production backend

### Razorpay Dashboard

- [ ] Webhook URL is set to `https://<backend>/api/public/payment/webhook/<company_id>`
- [ ] `payment.captured` event is enabled
- [ ] Test mode disabled (switched to live)

### Codebase

- [ ] `MERCHANT_UPI_ID` in `orderService.js` replaced with real merchant VPA
- [ ] No `console.log` with sensitive data in production builds

---

## 17. Key IDs to Note

When you set up the system, keep track of these IDs:

| Item | Where to Find It | Used In |
|---|---|---|
| Company `_id` | MongoDB Atlas → companies collection | User registration, all data isolation |
| Admin User `_id` | MongoDB Atlas → users collection, or login response | Machine provisioning in IoT backend |
| Machine `deviceVID` | IoT wake-up response / provisioning response | All kiosk API calls (`machine_id`) |
| Product `_id` | `POST /api/admin/products` response | Adding to catalog |
| Catalog entry `_id` | `POST /api/admin/catalog` response | Stock updates, catalog edits |
| Order `_id` | `POST /api/public/order` response | Status polling, cash confirmation |
| Razorpay order ID | `POST /api/public/order` response (UPI) | Webhook matching |

---

## Appendix — Quick Command Reference

```bash
# Start backend (development)
cd backend && npm run dev

# Start kiosk (development)
cd kiosk-screen && npm run dev

# Start admin panel (development)
cd admin-panel && npm run dev

# Seed admin user
cd backend && node seedAdmin.js

# Check backend health
curl http://localhost:5000/health

# Test login
curl -X POST http://localhost:5000/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@m9vends.com","password":"YourPassword"}'

# List all machines (needs auth)
curl http://localhost:5000/api/admin/machines \
  -H "Authorization: Bearer <token>"

# List catalog for a machine (public)
curl http://localhost:5000/api/public/catalog/<machine_id>

# Get analytics summary (needs auth)
curl http://localhost:5000/api/admin/analytics/summary \
  -H "Authorization: Bearer <token>"

# List recent orders (needs auth)
curl "http://localhost:5000/api/admin/orders?limit=10&page=1" \
  -H "Authorization: Bearer <token>"
```

---

## Appendix — Port Map

| Service | Port | URL |
|---|---|---|
| SaaS Backend | 5000 | http://localhost:5000 |
| Admin Panel (Next.js) | 3000 | http://localhost:3000 |
| Kiosk (Vite) | 5174 | http://localhost:5174 |
| IoT Backend | 3001 | http://localhost:3001 (or Render URL) |
| MQTT Broker (TCP) | 1883 | mqtt://13.239.132.146:1883 — admin + device credentials |
| MQTT Broker (WebSocket) | 8083 | ws://13.239.132.146:8083 — browser JWT token |
| MQTT Broker (WS TLS) | 8084 | wss://13.239.132.146:8084 — production browser |

---

*For detailed documentation on each component, see:*
- 📄 [IoT Backend Documentation](./00_IOT_BACKEND_DOCUMENTATION.md)
- 📄 [SaaS Backend Documentation](./01_BACKEND_DOCUMENTATION.md)
- 📄 [Kiosk Documentation](./02_KIOSK_DOCUMENTATION.md)
- 📄 [Admin Panel Documentation](./03_ADMIN_PANEL_DOCUMENTATION.md)
