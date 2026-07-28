# Kiosk Screen — Complete Build Roadmap

> **What:** Customer-facing touchscreen UI that runs ON the vending machine  
> **Who uses it:** End customer (no login, no auth)  
> **Where:** `SAAS/kiosk-screen/` — separate Vite project, separate port  
> **Backend port:** 5000 (same backend, public API endpoints — no JWT)

---

## 1. Architecture Decision

```
SAAS/
├── backend/          ← Port 5000 — shared by both frontends
├── admin-dashboard/  ← Port 5173 — admin panel (built)
└── kiosk-screen/     ← Port 5174 — customer kiosk (this project)
```

The kiosk only uses **public API endpoints** — no auth, no JWT, no cookies.  
The `machine_id` is **hardcoded in a `.env` file** on each machine (e.g. `VM-BPL-001`).

---

## 2. Backend API — What Exists vs What's Missing

### ✅ Already Built (you can start immediately)

| Method | Endpoint | What It Does | Used In |
|---|---|---|---|
| `GET` | `/api/public/catalog/:machine_id` | Fetch all products for this machine | Catalog screen |
| `POST` | `/api/public/order` | Place order, get Razorpay order + UPI link | Cart → Payment |
| `GET` | `/api/public/order/:id/status` | Poll payment status (PENDING/PAID/FAILED) | Payment polling |
| `POST` | `/api/public/payment/webhook` | Razorpay calls this on payment captured | Backend only |

### ✅ Catalog Response (what you get)
```json
{
  "success": true,
  "machine_id": "VM-BPL-001",
  "machine_name": "DB Mall Bhopal",
  "location": { "address": "...", "city": "Bhopal", "state": "MP" },
  "catalog": [
    {
      "catalog_id": "...",
      "product_id": "...",
      "product_name": "Masala Pani Puri",
      "description": "Tangy street-style pani puri",
      "image_url": "https://...",
      "price": 25,
      "stock": 48,
      "slot_label": "A1"
    }
  ]
}
```

### ✅ Create Order Request + Response
```json
// POST /api/public/order
// Request:
{
  "machine_id": "VM-BPL-001",
  "items": [
    { "catalog_id": "...", "quantity": 2 },
    { "catalog_id": "...", "quantity": 1 }
  ]
}

// Response:
{
  "success": true,
  "data": {
    "order_id": "...",
    "razorpay_order_id": "order_xyz123",
    "total_amount": 75,
    "payment_link": "upi://pay?pa=MERCHANT_UPI_ID&pn=M9Vends&tr=order_xyz123&am=75&cu=INR",
    "items": [...],
    "currency": "INR"
  }
}
```

### ✅ Order Status Response (poll every 3 seconds)
```json
// GET /api/public/order/:id/status
{
  "success": true,
  "order_id": "...",
  "payment_status": "PENDING",  // → "PAID" → "FAILED"
  "order_status": "PENDING",    // → "DISPENSING" → "COMPLETED" → "FAILED"
  "total_amount": 75,
  "paid_at": null
}
```

### ❌ Missing — You Need to Add These to Backend

| What | Why Needed | Endpoint to Create |
|---|---|---|
| **Cash payment initiation** | Customer selects CASH → kiosk needs to place a CASH order (no Razorpay) | `POST /api/public/order` needs `payment_method: "CASH"` support |
| **Machine health check** | Kiosk should show maintenance screen if machine is offline | `GET /api/public/machine/:machine_id/status` |
| **Cancel order** | Customer can go back from payment screen (timeout) | `DELETE /api/public/order/:id` or `POST /api/public/order/:id/cancel` |

---

## 3. Backend Changes Required

### 3A. Add Cash Payment Support to `placeOrder`

**File:** `backend/src/services/orderService.js`

Currently `placeOrder` always creates a Razorpay order. Add support for `payment_method: "CASH"`:

```js
// What to change in placeOrder:
export const placeOrder = async ({ machine_id, items, payment_method = 'ONLINE' }) => {
  // ... existing validation ...

  const order = await Order.create({
    company_id: device.company_id,
    machine_id: normalizedMachineId,
    items: resolvedItems,
    total_amount,
    payment_method,   // ← ADD THIS
  });

  // Only create Razorpay order if ONLINE payment
  if (payment_method === 'ONLINE') {
    // ... existing Razorpay code ...
    return { order_id, razorpay_order_id, total_amount, items, payment_link, currency: 'INR' }
  }

  // CASH: no Razorpay, just return order ID for admin to confirm
  return { order_id: order._id, total_amount, items, payment_method: 'CASH' }
}
```

**Also update:** `backend/src/api/public/controllers/orderController.js` — pass `payment_method` from request body.

### 3B. Add Machine Status Endpoint

**File:** `backend/src/api/public/routes/catalogRoutes.js`

```js
// Add new route:
router.get('/:machine_id/status', getMachineStatus)
```

**New controller function:**
```js
export const getMachineStatus = async (req, res, next) => {
  const device = await Device.findOne({ device_id: req.params.machine_id.toUpperCase() })
    .select('device_id machine_name status location last_seen_at')
  if (!device) return next(ApiError.notFound('Machine not found'))
  res.json({ success: true, data: device })
}
```

### 3C. Add Order Cancel/Timeout

**File:** `backend/src/api/public/routes/orderRoutes.js`

```js
router.post('/:id/cancel', cancelOrder)
```

**Service:** Update order's `payment_status` to `"FAILED"`, `order_status` to `"CANCELLED"`.  
Only cancel if `payment_status === 'PENDING'` and order is less than 15 minutes old.

---

## 4. Screen Flow

```
[Idle / Attract Screen]
        ↓  (touch anywhere / scan QR)
[Catalog Screen]  ←──────────────────────────────┐
  Product grid                                    │
  + / - quantity buttons                          │ (go back)
  Cart summary bar at bottom                      │
        ↓ (Checkout button)                       │
[Cart Review Screen]                              │
  Order summary                                   │
  Total amount                                    │
  [PAY WITH UPI]  [PAY WITH CASH]                 │
        ↓                   ↓                     │
[UPI Payment Screen]   [Cash Screen]              │
  QR code displayed    "Show this to attendant"   │
  Timer (3 min)        Order ID shown             │
  Polling every 3s     Waiting for admin confirm  │
        ↓                   ↓                     │
      [SUCCESS SCREEN] ←────┘                     │
        Machine dispensing                        │
        Thank you message                         │
        Auto-return to idle (5s)                  │
              ↓                                   │
        [IDLE SCREEN] ────────────────────────────┘

[FAILED/TIMEOUT SCREEN]  → auto-return to idle
[MAINTENANCE SCREEN]     → when machine status ≠ ACTIVE
```

---

## 5. Tech Stack

```bash
# Inside SAAS/kiosk-screen/
npm create vite@latest . -- --template react
npm install axios react-hot-toast zustand qrcode.react
```

| Package | Purpose |
|---|---|
| `axios` | HTTP calls to backend public API |
| `zustand` | Cart state + order state (no Redux needed) |
| `qrcode.react` | Render UPI payment link as QR code |
| `react-hot-toast` | Error/success toasts |

**No React Query** — the kiosk has simple linear flow, not a dashboard. Just `axios` + `useEffect` polling is cleaner.

**No React Router** — single page, manage screens with a `currentScreen` state variable.

---

## 6. Project Structure

```
kiosk-screen/
├── .env                        ← VITE_MACHINE_ID=VM-BPL-001
├── index.html
├── vite.config.js              ← Proxy /api → :5000, port: 5174
├── public/
│   └── logo.png
└── src/
    ├── index.css               ← Design system (kiosk-specific, dark + vibrant)
    ├── main.jsx
    ├── App.jsx                 ← Single screen state machine
    │
    ├── api/
    │   ├── axios.js            ← No auth, just baseURL proxy
    │   ├── catalog.api.js      ← getCatalog(machine_id)
    │   └── order.api.js        ← placeOrder, pollStatus, cancelOrder
    │
    ├── store/
    │   └── kioskStore.js       ← cart, currentScreen, currentOrder
    │
    └── screens/                ← One component per screen
        ├── IdleScreen.jsx
        ├── CatalogScreen.jsx
        ├── CartScreen.jsx
        ├── UpiPaymentScreen.jsx
        ├── CashPaymentScreen.jsx
        ├── SuccessScreen.jsx
        ├── FailedScreen.jsx
        └── MaintenanceScreen.jsx
```

---

## 7. Zustand Store (`kioskStore.js`)

```js
// The entire kiosk state
{
  // Screen navigation
  currentScreen: 'idle',   // idle | catalog | cart | upi | cash | success | failed | maintenance

  // Catalog
  catalog: [],
  machineInfo: null,       // { machine_id, machine_name, location }

  // Cart
  cart: [],                // [{ catalog_id, product_name, price, quantity, stock }]

  // Active order
  currentOrder: null,      // { order_id, razorpay_order_id, total_amount, payment_link }
  paymentStatus: null,     // PENDING | PAID | FAILED

  // Actions
  goTo: (screen) => {},
  addToCart: (product) => {},
  removeFromCart: (catalog_id) => {},
  updateQuantity: (catalog_id, qty) => {},
  clearCart: () => {},
  setOrder: (order) => {},
  resetKiosk: () => {},      // reset everything → idle screen
}
```

---

## 8. Screen-by-Screen Spec

### 8.1 Idle Screen
- Full-screen dark background with animated gradient/particles
- M9Vends logo centered
- "Touch to Start" pulsing text
- Machine name + location in corner
- **Action:** Any touch → go to Catalog screen (load catalog)
- **Auto-trigger:** Machine status check on mount. If status ≠ ACTIVE → show Maintenance screen.

### 8.2 Catalog Screen
```
GET /api/public/catalog/:machine_id

Layout:
  Header: Machine name | Cart icon (item count badge)
  Search bar (filter products)
  Product Grid (2 or 3 col):
    [Product Card]
      Image (or category emoji)
      Product name
      Price (₹)
      Stock indicator (dot: green if stock > 5, amber if 1-5, red if 0)
      [ - ] [ qty ] [ + ] buttons
  Bottom bar: "X items · ₹YY" [Checkout →]
```

**Rules:**
- Out of stock (stock === 0) → card grayed out, no add button
- Cart total updates live as quantities change
- If cart is empty, checkout button is disabled

### 8.3 Cart / Review Screen
```
Header: "Review Order" [← Back]
Item list:
  Product name · qty · ₹subtotal
  [ - qty + ] inline
Divider
Total: ₹XXX
Payment buttons:
  [⚡ Pay with UPI]    (full width, primary blue)
  [💵 Pay with Cash]  (outline, smaller)
```

**UPI click:** `POST /api/public/order` with `payment_method: 'ONLINE'` → go to UPI screen  
**Cash click:** `POST /api/public/order` with `payment_method: 'CASH'` → go to Cash screen

### 8.4 UPI Payment Screen
```
API: uses payment_link from createOrder response
Library: qrcode.react → <QRCodeSVG value={payment_link} size={280} />

Layout:
  "Scan to Pay" heading
  QR code (large, centered)
  ₹ total amount (large, green)
  "Scan with any UPI app: GPay, PhonePe, Paytm"
  Countdown timer: 03:00 → 00:00
  [Cancel] button (bottom)

Polling:
  setInterval every 3s → GET /api/public/order/:id/status
  If payment_status === 'PAID' → stop polling → go to Success screen
  If payment_status === 'FAILED' → go to Failed screen
  If timer hits 0 → POST /api/public/order/:id/cancel → go to Failed screen
```

### 8.5 Cash Payment Screen
```
Layout:
  "Pay with Cash" heading
  Order ID (large mono text) — show this to attendant
  ₹ total amount
  "Hand cash to the attendant. They will confirm your payment."
  Waiting animation (pulsing dots)
  [Cancel] button

Polling:
  Same as UPI — poll every 3s
  When admin confirms via dashboard → payment_status becomes 'PAID' → Success screen
  Timer: 10 minutes max, then auto-cancel
```

### 8.6 Success Screen
```
Layout:
  ✅ Large checkmark (animated green)
  "Payment Successful!"
  "Your order is being dispensed"
  Order summary (items, total)
  "Thank you for your purchase"
  Auto-return to Idle in 5 seconds (countdown shown)
  [Back to Start] button
```

**On mount:** `resetKiosk()` after 5 seconds

### 8.7 Failed / Timeout Screen
```
Layout:
  ❌ or ⏱ icon
  "Payment Failed" or "Session Timed Out"
  "Please try again or contact staff"
  [Try Again] → go to Catalog
  [Back to Start] → go to Idle
  Auto-return to Idle in 15 seconds
```

### 8.8 Maintenance Screen
```
Layout:
  🔧 Wrench icon
  "Machine Under Maintenance"
  Machine ID shown
  "We'll be back soon!"
  No user interaction possible
  Re-check machine status every 60 seconds
```

---

## 9. Kiosk Design System

The kiosk is **NOT the admin dashboard**. Different aesthetic:

| Property | Admin Dashboard | Kiosk Screen |
|---|---|---|
| Audience | Business owner on laptop | Customer on touchscreen |
| Screen | Normal desktop/web | Large touchscreen (10-21") | Phone screen 
| Font size | 13-14px | 18-24px minimum |
| Touch targets | Normal click | Minimum 48x48px |
| Colors 
| Animations | Subtle 150ms | Bold, engaging, 300-500ms |
| Text | Dense info | Large, simple, minimal |

### Kiosk Color Palette
```css
:root {
  --bg-kiosk:       #050a14;   /* very dark */
  --surface-kiosk:  #0d1a2e;
  --card-kiosk:     #122040;
  --accent-blue:    #3b82f6;   /* primary CTA */
  --accent-green:   #22c55e;   /* success, in-stock */
  --accent-amber:   #f59e0b;   /* low stock, cash */
  --accent-red:     #ef4444;   /* error, out of stock */
  --accent-cyan:    #06b6d4;   /* highlights */
  --text-hero:      #ffffff;   /* headings */
  --text-body:      #e2e8f0;
  --text-muted:     #64748b;
  --font-kiosk:     'Inter', system-ui, sans-serif;
  --font-mono:      'JetBrains Mono', monospace;
  --radius-card:    16px;
  --radius-btn:     12px;
}
```

---

## 10. Vite Config (`vite.config.js`)

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
```

---

## 11. Environment (`.env`)

```bash
# Kiosk .env — different per physical machine
VITE_MACHINE_ID=VM-BPL-001         # hardcoded per device
VITE_IDLE_TIMEOUT_MS=120000        # 2 min idle → return to attract screen
VITE_PAYMENT_TIMEOUT_SECS=180      # 3 min UPI timeout
VITE_POLL_INTERVAL_MS=3000         # poll every 3 seconds
```

Access in code: `import.meta.env.VITE_MACHINE_ID`

---

## 12. Build Phases

### Phase 1 — Foundation (Day 1)
- [ ] Scaffold Vite project in `SAAS/kiosk-screen/`
- [ ] Set up Vite proxy, `.env`, folder structure
- [ ] Write `kioskStore.js` (Zustand)
- [ ] Write `api/catalog.api.js` + `api/order.api.js`
- [ ] Write `index.css` design system
- [ ] Write `App.jsx` screen state machine
- [ ] **Backend:** Add cash payment support to `placeOrder`

### Phase 2 — Core Screens (Day 2-3)
- [ ] `IdleScreen.jsx` — attract mode, touch to start
- [ ] `CatalogScreen.jsx` — product grid + cart sidebar
- [ ] `CartScreen.jsx` — order review + payment choice
- [ ] **Backend:** Add machine status endpoint

### Phase 3 — Payment Flow (Day 4-5)
- [ ] `UpiPaymentScreen.jsx` — QR code + polling
- [ ] `CashPaymentScreen.jsx` — order ID display + polling
- [ ] `SuccessScreen.jsx` — animated success + auto-return
- [ ] `FailedScreen.jsx` — timeout/failure + retry
- [ ] **Backend:** Add order cancel endpoint

### Phase 4 — Polish (Day 6-7)
- [ ] `MaintenanceScreen.jsx`
- [ ] Idle timeout → auto-reset if customer walks away
- [ ] All animations and transitions
- [ ] Touch target sizes (all buttons minimum 48px)
- [ ] Test full flow end-to-end with real backend

---

## 13. Backend Change Summary (What to Tell Your Backend Dev)

> Tell your backend dev to make these 3 changes before kiosk frontend starts Phase 3:

**Change 1 — Cash payment in `placeOrder` service:**
```
In backend/src/services/orderService.js:
- Add payment_method parameter (default: 'ONLINE')
- If payment_method === 'CASH': skip Razorpay, return { order_id, total_amount, payment_method: 'CASH' }
- If payment_method === 'ONLINE': existing Razorpay flow unchanged
```

**Change 2 — Machine status endpoint:**
```
Add to backend/src/api/public/routes/catalogRoutes.js:
  GET /api/public/catalog/:machine_id/status
  → Returns { device_id, machine_name, status, location }
  → No auth required (public)
```

**Change 3 — Order cancel endpoint:**
```
Add to backend/src/api/public/routes/orderRoutes.js:
  POST /api/public/order/:id/cancel
  → Only cancel if payment_status === 'PENDING' AND order < 15 min old
  → Set payment_status = 'FAILED', order_status = 'CANCELLED'
```

---

## 14. Key Differences From Admin Dashboard

| | Admin Dashboard | Kiosk |
|---|---|---|
| Auth | JWT + httpOnly cookie | ❌ None |
| Data fetching | React Query | `axios` + `useEffect` |
| State | Zustand (auth) | Zustand (cart + screen) |
| Routing | React Router | Single `currentScreen` state |
| CSS | CSS variables, `index.css` | Separate design system |
| Error handling | Toast + form errors | Full-screen error states |
| Network | Fails gracefully (retry) | Show "connection error" screen |
| Timeout | None | Payment timeout + idle timeout |
| Touch | Not optimized | ALL interactions must be touch-friendly |
