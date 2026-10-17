# M9Vends User Kiosk Final — Complete Documentation

> **Stack:** React 18 + Vite | **State:** Zustand | **HTTP:** Axios
> **Screens:** 10 | **Payment:** UPI (Razorpay QR) + Cash
> **Last Updated:** October 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Screen Map & Navigation Flow](#2-screen-map--navigation-flow)
3. [Project Structure](#3-project-structure)
4. [Environment Setup](#4-environment-setup)
5. [Zustand Store Design](#5-zustand-store-design)
6. [API Layer](#6-api-layer)
7. [Screen-by-Screen Reference](#7-screen-by-screen-reference)
8. [Payment Flows](#8-payment-flows)
9. [IoT Integration (MQTT — Phase 2)](#9-iot-integration-mqtt--phase-2)
10. [Hooks Reference](#10-hooks-reference)
11. [Identity & Machine ID Rules](#11-identity--machine-id-rules)
12. [Known Issues & Future Work](#12-known-issues--future-work)

---

## 1. Overview

The M9Vends Kiosk is a **single-page React application** that runs on a physical vending machine's embedded screen. It:

- Boots up and identifies itself to the IoT backend using a hardware serial number
- Fetches the machine's product catalog from the SaaS backend
- Lets customers browse products, build a cart, and pay via UPI QR or Cash
- Polls the backend for payment confirmation and signals the machine to dispense

### Key Architectural Decisions

| Decision | Reason |
|---|---|
| No React Router | A single `currentScreen` Zustand state variable drives all 10 screens. No URL routing needed. |
| No auth tokens | Kiosk uses only public API routes. Security is by `machine_id` (only provisioned machines know theirs). |
| Polling for payment | `setInterval` every 3s on `/order/:id/status`. MQTT dispensing confirmation is Phase 2. |
| Serial Number in `.env` | `VITE_SERIAL_NUMBER` is the only hardcoded identifier. Everything else comes from the IoT backend. |

---

## 2. Screen Map & Navigation Flow

```
[BOOT SCREEN]
    │
    ├─ isProvisioned: false ──► [PROVISION SCREEN]
    │                                  │
    │                          Admin scans QR → poll detects provisioned
    │                                  │
    └─ isProvisioned: true ────► [IDLE SCREEN]
                                       │
                                Customer touches screen
                                       │
                                [CATALOG SCREEN]
                                       │
                                Checkout button
                                       │
                                [CART SCREEN]
                                ┌──────┴──────┐
                            UPI │             │ CASH
                                ▼             ▼
                          [UPI PAYMENT] [CASH PAYMENT]
                                │             │
                          PAID/FAIL      PAID/TIMEOUT
                                └──────┬──────┘
                          ┌────────────┴────────────┐
                          ▼                         ▼
                  [SUCCESS SCREEN]         [FAILED SCREEN]
                  auto-return 5s           retry or idle 15s
                          └────────────┬────────────┘
                                       ▼
                                 [IDLE SCREEN]

[ERROR SCREEN] ← critical API / network failures (boot-level)
```

### Screen State Values

```js
// All valid values for currentScreen in Zustand store:
'boot'       // IoT wake-up in progress
'provision'  // Machine not linked to admin account yet
'idle'       // Attract mode (screensaver)
'catalog'    // Product grid + floating cart bar
'cart'       // Cart review + payment method selection
'upi'        // QR code + countdown timer
'cash'       // Order ID display + wait for admin
'success'    // Thank you / dispensing screen
'failed'     // Payment failed / timed out
'error'      // Critical boot error
```

---

## 3. Project Structure

```
kiosk-screen/
├── .env                          # VITE_SERIAL_NUMBER + API URLs
├── vite.config.js
├── index.html
└── src/
    ├── main.jsx                  # React root mount
    ├── App.jsx                   # Screen state machine (switch on currentScreen)
    ├── index.css                 # Full design system (CSS variables, tokens, animations)
    ├── api/
    │   ├── axios.js              # saasApi + iotApi Axios instances
    │   ├── catalog.api.js        # getCatalog(machine_id)
    │   └── order.api.js          # placeOrder, getOrderStatus, cancelOrder
    ├── store/
    │   └── kioskStore.js         # Zustand — all kiosk state
    ├── hooks/
    │   └── useIdleTimeout.js     # Auto-reset on inactivity (30s default)
    └── screens/
        ├── BootScreen.jsx        # Screen 1: IoT wake-up
        ├── ProvisionScreen.jsx   # Screen 2: QR for admin
        ├── IdleScreen.jsx        # Screen 3: attract mode
        ├── CatalogScreen.jsx     # Screen 4: product grid + cart bar
        ├── CartScreen.jsx        # Screen 5: review + payment choice
        ├── UpiPaymentScreen.jsx  # Screen 6: QR + countdown
        ├── CashPaymentScreen.jsx # Screen 7: order ID + wait
        ├── SuccessScreen.jsx     # Screen 8: success
        ├── FailedScreen.jsx      # Screen 9: fail / timeout
        └── ErrorScreen.jsx       # Screen 10: critical error
```

---

## 4. Environment Setup

Create a `.env` file at the kiosk project root:

```env
# ── Hardware Identity ─────────────────────────────────
VITE_SERIAL_NUMBER=SN-M9V-4820    # Unique per physical device — NEVER share

# ── API Endpoints ─────────────────────────────────────
VITE_SAAS_API_URL=http://localhost:5000        # SaaS backend
VITE_IOT_API_URL=http://localhost:3001         # IoT backend

# ── MQTT (Phase 2 — not yet wired up) ─────────────────
VITE_MQTT_BROKER_URL=ws://13.239.132.146:8083  # WebSocket MQTT URL
```

> ⚠️ **Every physical kiosk machine needs its own unique `VITE_SERIAL_NUMBER`.** Never copy `.env` files across machines.

### Running the Kiosk

```bash
npm install
npm run dev      # development
npm run build    # production build
```

### Running in Kiosk/Locked Mode (Production)

```bash
# Chrome in kiosk mode (no browser controls):
chrome --kiosk --app=http://localhost:5174

# Or use a dedicated kiosk OS (e.g. Raspberry Pi with Chromium kiosk mode)
```

---

## 5. Zustand Store Design

**File:** `src/store/kioskStore.js`

```js
import { create } from 'zustand'

export const useKioskStore = create((set, get) => ({

  // ── Screen Navigation ─────────────────────────────────
  currentScreen: 'boot',
  // Valid values: boot | provision | idle | catalog | cart | upi | cash | success | failed | error

  // ── Device Identity (from IoT backend after wake-up) ──
  serialNumber:    import.meta.env.VITE_SERIAL_NUMBER,
  deviceVID:       null,      // from IoT wake-up response = machine_id for all REST calls
  isProvisioned:   false,
  kioskBrowserURL: null,
  mqttConfig:      null,      // { url, port, username, password }

  // ── Product Catalog ───────────────────────────────────
  catalog:      [],
  catalogError: null,

  // ── Shopping Cart ─────────────────────────────────────
  cart: [],                   // [{ catalog_id, product_name, price, quantity, stock }]

  // ── Active Order ──────────────────────────────────────
  currentOrder: null,
  // {
  //   order_id:          string
  //   razorpay_order_id: string | null   (UPI only)
  //   total_amount:      number
  //   payment_link:      string | null   (UPI only — render as QR)
  //   payment_method:    'UPI' | 'CASH'
  //   items:             [...resolved items]
  // }

  // ── Actions ───────────────────────────────────────────

  // Navigate to any screen
  goTo: (screen) => set({ currentScreen: screen }),

  // Store device identity after IoT wake-up
  setDeviceInfo: ({ deviceVID, isProvisioned, kioskBrowserURL, mqttConfig }) =>
    set({ deviceVID, isProvisioned, kioskBrowserURL, mqttConfig }),

  // Store catalog after fetch
  setCatalog: (catalog) => set({ catalog, catalogError: null }),
  setCatalogError: (err) => set({ catalogError: err }),

  // Cart operations
  addToCart: (item) => set((state) => {
    const existing = state.cart.find(c => c.catalog_id === item.catalog_id)
    if (existing) {
      return {
        cart: state.cart.map(c =>
          c.catalog_id === item.catalog_id
            ? { ...c, quantity: Math.min(c.quantity + 1, item.stock) }
            : c
        )
      }
    }
    return { cart: [...state.cart, { ...item, quantity: 1 }] }
  }),

  removeFromCart: (catalog_id) => set((state) => ({
    cart: state.cart.filter(c => c.catalog_id !== catalog_id)
  })),

  updateQuantity: (catalog_id, quantity) => set((state) => ({
    cart: quantity <= 0
      ? state.cart.filter(c => c.catalog_id !== catalog_id)
      : state.cart.map(c => c.catalog_id === catalog_id ? { ...c, quantity } : c)
  })),

  clearCart: () => set({ cart: [] }),

  // Cart computed values
  get cartTotal() {
    return get().cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  },
  get cartItemCount() {
    return get().cart.reduce((sum, item) => sum + item.quantity, 0)
  },

  // Store order after creation
  setCurrentOrder: (order) => set({ currentOrder: order }),
  clearOrder: () => set({ currentOrder: null }),

  // Reset entire session (return to idle)
  resetSession: () => set({
    cart: [],
    currentOrder: null,
    currentScreen: 'idle',
  }),
}))
```

---

## 6. API Layer

### 6.1 Axios Instances (`src/api/axios.js`)

```js
import axios from 'axios'

export const saasApi = axios.create({
  baseURL: import.meta.env.VITE_SAAS_API_URL,   // http://localhost:5000
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

export const iotApi = axios.create({
  baseURL: import.meta.env.VITE_IOT_API_URL,    // http://localhost:3001
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})
```

### 6.2 Catalog API (`src/api/catalog.api.js`)

```js
import { saasApi } from './axios.js'

/**
 * Fetch all active products for a machine.
 * @param {string} machine_id - deviceVID from IoT wake-up
 * @returns {Promise<CatalogItem[]>}
 */
export const getCatalog = async (machine_id) => {
  const { data } = await saasApi.get(`/api/public/catalog/${machine_id}`)
  return data.catalog
}
```

### 6.3 Order API (`src/api/order.api.js`)

```js
import { saasApi } from './axios.js'

/**
 * Create an order.
 * @param {{ machine_id, items, payment_method }} payload
 */
export const placeOrder = async ({ machine_id, items, payment_method = 'UPI' }) => {
  const { data } = await saasApi.post('/api/public/order', {
    machine_id,
    payment_method,
    items: items.map(i => ({ catalog_id: i.catalog_id, quantity: i.quantity })),
  })
  return data.data
}

/**
 * Poll order payment status.
 * @param {string} order_id
 * @returns {{ payment_status, order_status, total_amount, paid_at }}
 */
export const getOrderStatus = async (order_id) => {
  const { data } = await saasApi.get(`/api/public/order/${order_id}/status`)
  return data
}

/**
 * Cancel a pending order (UPI timeout or user pressed Cancel).
 * @param {string} order_id
 */
export const cancelOrder = async (order_id) => {
  const { data } = await saasApi.post(`/api/public/order/${order_id}/cancel`)
  return data
}
```

### 6.4 IoT Wake-up API

Called inside `BootScreen.jsx`:

```js
import { iotApi } from './axios.js'

export const wakeUp = async ({ serialNumber }) => {
  const { data } = await iotApi.post('/api/device/wake-up', {
    serialNumber,
    model:  'M9-Vending-Pro',
    status: 'online',
  })
  return data
  // Returns: { deviceVID, isProvisioned, kioskBrowserURL, mqtt }
}
```

---

## 7. Screen-by-Screen Reference

### Screen 1: `BootScreen`

**Purpose:** Called on every app launch. Wakes up the IoT backend and determines provisioning state.

**Logic flow:**
1. On mount → call `POST /api/device/wake-up` with `{ serialNumber, model, status: 'online' }`
2. On success:
   - Save `deviceVID`, `isProvisioned`, `kioskBrowserURL`, `mqttConfig` to Zustand
   - If `isProvisioned === false` → navigate to `'provision'`
   - If `isProvisioned === true` → navigate to `'idle'`
3. On error → retry after 5s (show spinner + error message)

**Key rules:**
- `deviceVID` from this response = `machine_id` for ALL subsequent REST API calls
- Store deviceVID to localStorage as fallback for reconnection

---

### Screen 2: `ProvisionScreen`

**Purpose:** Displayed when the machine is not yet linked to an admin account.

**Logic flow:**
1. Render the `serialNumber` as a QR code (using `qrcode.react`)
2. Poll `POST /api/device/wake-up` every 10 seconds
3. When `isProvisioned` becomes `true` → navigate to `'idle'`

**QR Code value:** ONLY the `serialNumber` string — nothing else.

```jsx
import { QRCodeSVG } from 'qrcode.react'

<QRCodeSVG
  value={serialNumber}   // e.g. "SN-M9V-4820"
  size={260}
  level="M"
/>
```

---

### Screen 3: `IdleScreen`

**Purpose:** Attract mode — shown when no customer is interacting.

**Logic flow:**
1. Display a welcome message / brand animation / promo
2. On any touch/click → navigate to `'catalog'`
3. Also fetch catalog in the background here (pre-load for faster catalog screen)

**Important:** `useIdleTimeout` is **NOT** applied on this screen (machine is already idle here).

---

### Screen 4: `CatalogScreen`

**Purpose:** Product grid showing all available items. Customer builds their cart here.

**Logic flow:**
1. On mount → `getCatalog(deviceVID)` and store result in Zustand
2. Render each catalog item as a product card
3. Customer taps + / - buttons → `addToCart`, `updateQuantity`, `removeFromCart`
4. A floating cart bar at the bottom shows cart total and "Go to Checkout" button
5. "Go to Checkout" → navigate to `'cart'`

**Product card rules:**
- If `stock === 0` → show "Out of Stock" badge, disable add button
- If `image_url === null` → show emoji/placeholder
- Display `price` (already price_override-aware from backend)

**Idle timeout:** 30s of inactivity → return to `'idle'` and call `resetSession()`

---

### Screen 5: `CartScreen`

**Purpose:** Review order + select payment method.

**Logic flow:**
1. Show cart items with quantity controls
2. Show total amount
3. Two buttons: **Pay with UPI** and **Pay with Cash**
4. On UPI click → call `placeOrder({ machine_id, items, payment_method: 'UPI' })` → navigate to `'upi'`
5. On Cash click → call `placeOrder({ machine_id, items, payment_method: 'CASH' })` → navigate to `'cash'`
6. Store response in `currentOrder` Zustand state

**Idle timeout:** 30s of inactivity → return to `'idle'`

---

### Screen 6: `UpiPaymentScreen`

**Purpose:** Displays Razorpay UPI QR code. Polls for payment. Runs 3-minute countdown.

**Logic flow:**
1. On mount → get `payment_link` from `currentOrder.payment_link`
2. Render `payment_link` as a QR code
3. Start polling `getOrderStatus(order_id)` every 3 seconds
4. Start 3-minute (180s) countdown timer
5. On `payment_status === 'PAID'` → clearInterval + navigate to `'success'`
6. On `payment_status === 'FAILED'` → clearInterval + navigate to `'failed'`
7. On countdown reaching 0 → `cancelOrder(order_id)` + navigate to `'failed'`
8. Cancel button → `cancelOrder(order_id)` + navigate back to `'cart'`

**Important:** `useIdleTimeout` is **NOT** applied on this screen (countdown manages itself).

```jsx
import { QRCodeSVG } from 'qrcode.react'

<QRCodeSVG
  value={currentOrder.payment_link}
  size={280}
  bgColor="#000000"
  fgColor="#ffffff"
  level="M"
/>
```

---

### Screen 7: `CashPaymentScreen`

**Purpose:** Displays order ID and total for cash transactions. Waits for admin confirmation.

**Logic flow:**
1. Show `currentOrder.order_id` (shortened) + `currentOrder.total_amount`
2. Show message: "Please hand cash to attendant"
3. Poll `getOrderStatus(order_id)` every 3 seconds
4. Admin confirms cash in admin panel → `payment_status` becomes `'PAID'`
5. On `payment_status === 'PAID'` → navigate to `'success'`
6. After 10-minute timeout → navigate to `'failed'`
7. Cancel button → navigate back to `'cart'`

**Important:** `useIdleTimeout` is **NOT** applied on this screen.

---

### Screen 8: `SuccessScreen`

**Purpose:** Payment confirmed — machine is dispensing.

**Logic flow:**
1. Show success animation / checkmark
2. Show "Your items are being dispensed!"
3. Auto-return to `'idle'` after 5 seconds (call `resetSession()`)

---

### Screen 9: `FailedScreen`

**Purpose:** Payment failed or timed out.

**Logic flow:**
1. Show failure message (distinguish timeout vs payment failed)
2. Two buttons: **Try Again** → navigate to `'cart'` (keep cart) | **Start Over** → `resetSession()`
3. Auto-return to `'idle'` after 15 seconds if no action

---

### Screen 10: `ErrorScreen`

**Purpose:** Shown on critical boot failures.

**Logic flow:**
1. Show error details (e.g. "Cannot reach server")
2. Auto-retry every 30 seconds (re-run BootScreen logic)
3. Manual retry button

---

## 8. Payment Flows

### 8.1 UPI Payment Flow

```
Customer confirms cart
    │
    ▼
POST /api/public/order
  { machine_id, items, payment_method: "UPI" }
    │
    ▼
Backend creates Razorpay order → returns payment_link
    │
    ▼
Render QR code from payment_link
Start 3-minute countdown
Start polling GET /api/public/order/:id/status every 3s
    │
    ├─ payment_status === "PAID"    → clearInterval → SUCCESS SCREEN
    ├─ payment_status === "FAILED"  → clearInterval → FAILED SCREEN
    └─ countdown = 00:00            → POST /api/public/order/:id/cancel
                                    → FAILED SCREEN ("Payment Timed Out")
```

### 8.2 Cash Payment Flow

```
Customer confirms cart with CASH
    │
    ▼
POST /api/public/order
  { machine_id, items, payment_method: "CASH" }
    │
    ▼
Backend returns order_id + total_amount (NO Razorpay, NO QR)
    │
    ▼
Show Order ID + amount on screen
"Please pay ₹{amount} to attendant"
Start polling GET /api/public/order/:id/status every 3s
    │
    ▼
Admin sees cash order in dashboard → clicks Confirm Cash
    │
    ▼
Backend marks PAID + decrements stock
    │
    ▼
Polling detects PAID → SUCCESS SCREEN
```

---

## 9. IoT Integration (MQTT — Phase 2)

> ⚠️ **Not yet implemented in the kiosk frontend.** `mqttConfig` is stored in Zustand but no MQTT subscription is active. Dispensing confirmation relies on REST polling.

### When Phase 2 is Implemented:

**Connection setup:**
```js
import mqtt from 'mqtt'

// 1. Fetch short-lived JWT from IoT backend
const res = await iotApi.get(`/api/device/connect/${deviceVID}`)
const token = res.data.mqttCredentials.token

// 2. Connect via WebSocket (NOT TCP)
const client = mqtt.connect(import.meta.env.VITE_MQTT_BROKER_URL, {
  username: 'FrontendClient',   // fixed string for browser clients
  password: token,
  clientId: `kiosk_${Math.random().toString(16).substr(2, 8)}`,
})

// 3. Subscribe to device topics
client.subscribe(`device/${deviceVID}/status`)
client.subscribe(`device/${deviceVID}/telemetry`)

// 4. Publish commands
client.publish(
  `device/${deviceVID}/commands`,
  JSON.stringify({ message: 'dispense' }),
  { qos: 1 }
)
```

**Token refresh:** Token expires in 25 minutes. Refresh and reconnect every 20 minutes:
```js
setTimeout(reconnect, 20 * 60 * 1000)
```

**Telemetry parsing:**
```js
client.on('message', (topic, payload) => {
  const raw = payload.toString()
  if (raw === 'Device(Arduino) Not Connected') { /* show hardware error */ return }
  if (raw === 'Anomaly Detected')              { /* show alert */ return }
  const telemetry = JSON.parse(raw)
  // { "Steering Motor Temperature": 28, "Tank Levels": [25,50,40,10], ... }
})
```

---

## 10. Hooks Reference

### `useIdleTimeout.js`

Automatically returns the kiosk to idle after a period of inactivity.

```js
/**
 * Resets to idle screen after 'timeout' ms of no user interaction.
 * Does NOT apply on: 'upi', 'cash', 'boot', 'provision', 'idle' screens.
 *
 * @param {number} timeout - milliseconds of inactivity (default: 30000)
 */
export function useIdleTimeout(timeout = 30000) {
  const { currentScreen, resetSession } = useKioskStore()
  const EXCLUDED_SCREENS = ['upi', 'cash', 'boot', 'provision', 'idle']

  useEffect(() => {
    if (EXCLUDED_SCREENS.includes(currentScreen)) return

    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        resetSession()
      }, timeout)
    }

    let timer = setTimeout(() => resetSession(), timeout)

    window.addEventListener('click', reset)
    window.addEventListener('touchstart', reset)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('click', reset)
      window.removeEventListener('touchstart', reset)
    }
  }, [currentScreen, timeout])
}
```

---

## 11. Identity & Machine ID Rules

This is the single most critical concept in the kiosk:

| Identifier | Example | Source | Used in |
|---|---|---|---|
| `VITE_SERIAL_NUMBER` | `SN-M9V-4820` | Burned into hardware / `.env` | QR code on `ProvisionScreen` ONLY |
| `deviceVID` | `60d5ec49f3e4e9001f3b2e99` | IoT backend wake-up response | MQTT topic paths |
| `machine_id` | `60d5ec49f3e4e9001f3b2e99` | **Same value as `deviceVID`** | ALL SaaS REST API calls |

> **Rule:** `machine_id` = `deviceVID`. Once set from IoT wake-up, use it as `machine_id` everywhere in the SaaS backend calls. Never hardcode this value.

**Persistence recommendation:**
```js
// After wake-up, save to localStorage for session recovery
localStorage.setItem('m9v_device', JSON.stringify({
  deviceVID,
  isProvisioned,
  kioskBrowserURL,
  mqttConfig,
}))

// On next boot, check localStorage first (optional optimization)
const saved = JSON.parse(localStorage.getItem('m9v_device') || '{}')
```

---

## 12. Known Issues & Future Work

### 🔴 Critical — Before Production

| Issue | Fix |
|---|---|
| `MERCHANT_UPI_ID` placeholder in `orderService.js` | Replace with real Razorpay VPA or use Razorpay Payment Links API |
| Kiosk device must be physically locked down | Run Chrome with `--kiosk` flag or use kiosk OS |
| Every machine needs unique `VITE_SERIAL_NUMBER` | Never share `.env` files across physical machines |

### 🟡 Important — Before Launch

| Issue | Notes |
|---|---|
| MQTT not wired up | `mqttConfig` stored in Zustand but no subscription. Dispensing uses polling only. |
| Empty catalog edge case | If 0 products are enabled, kiosk shows spinner indefinitely. Add empty state. |
| `clearInterval()` on unmount | Verify all polling intervals are cleared on every unmount path. |

### 🟢 Nice to Have — Post-Launch

| Feature | Notes |
|---|---|
| Product images | `image_url` is null for all products. Integrate S3/Cloudinary. |
| Idle video screensaver | Replace static IdleScreen with promotional video loop. |
| Offline mode | Cache last catalog for brief network outages. |
| Accessibility | Larger tap targets, high-contrast mode for outdoor/bright light. |

---

## Appendix — Complete API Calls Made by Kiosk

| Screen | Method | Endpoint | Frequency |
|---|---|---|---|
| BootScreen | `POST` | `[IoT] /api/device/wake-up` | Once on boot |
| ProvisionScreen | `POST` | `[IoT] /api/device/wake-up` | Every 10s |
| CatalogScreen | `GET` | `/api/public/catalog/:machine_id` | Once on enter |
| CartScreen | `POST` | `/api/public/order` | On payment selection |
| UpiPaymentScreen | `GET` | `/api/public/order/:id/status` | Every 3s |
| UpiPaymentScreen | `POST` | `/api/public/order/:id/cancel` | On timeout/cancel |
| CashPaymentScreen | `GET` | `/api/public/order/:id/status` | Every 3s |
