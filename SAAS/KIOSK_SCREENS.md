# M9Vends Kiosk — Screen-by-Screen Build Guide

> **For:** Frontend developers / AI building the kiosk UI
> **Read first:** `KIOSK_BACKEND_INTEGRATION.md` for all API details
> **Stack:** React 18 + Vite, Zustand, Axios, `qrcode.react`, `mqtt`
> **No routing library** — screens managed by a single `currentScreen` state variable

---

## Screen Map

```
[BOOT SCREEN]
    │
    ├─ isProvisioned: false ──► [PROVISION SCREEN]
    │                                  │
    │                          Admin scans QR → poll detects provisioned
    │                                  │
    └─ isProvisioned: true ────► [IDLE SCREEN]
                                       │
                                Customer touches
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

[ERROR SCREEN] ← critical API / network failures
```

---

## Project Structure

```
kiosk-screen/
├── .env
├── vite.config.js
├── index.html
└── src/
    ├── main.jsx
    ├── App.jsx                    ← screen state machine
    ├── index.css                  ← full design system
    ├── api/
    │   ├── axios.js               ← saasApi + iotApi instances
    │   ├── catalog.api.js         ← getCatalog()
    │   └── order.api.js           ← placeOrder, getOrderStatus, cancelOrder
    ├── store/
    │   └── kioskStore.js          ← Zustand — all kiosk state
    ├── hooks/
    │   └── useIdleTimeout.js      ← auto-reset on inactivity
    └── screens/
        ├── BootScreen.jsx         ← 1. IoT wake-up
        ├── ProvisionScreen.jsx    ← 2. QR for admin
        ├── IdleScreen.jsx         ← 3. attract mode
        ├── CatalogScreen.jsx      ← 4. product grid + cart bar
        ├── CartScreen.jsx         ← 5. review + payment choice
        ├── UpiPaymentScreen.jsx   ← 6. QR + countdown
        ├── CashPaymentScreen.jsx  ← 7. order ID + wait
        ├── SuccessScreen.jsx      ← 8. success
        ├── FailedScreen.jsx       ← 9. fail / timeout
        └── ErrorScreen.jsx        ← 10. critical error
```

---

## Zustand Store (`store/kioskStore.js`)

```js
import { create } from 'zustand'

export const useKioskStore = create((set, get) => ({
  // ─── Screen navigation
  currentScreen: 'boot',
  // Possible values: boot | provision | idle | catalog | cart | upi | cash | success | failed | error

  // ─── Device Identity (from IoT backend after boot)
  serialNumber:    import.meta.env.VITE_SERIAL_NUMBER,
  deviceVID:       null,      // from wake-up response = machine_id for REST API
  isProvisioned:   false,
  kioskBrowserURL: null,
  mqttConfig:      null,      // { url, port, username, password }

  // ─── Catalog
  catalog:      [],
  catalogError: null,

  // ─── Cart  [{ catalog_id, product_name, price, quantity, stock, image_url }]
  cart: [],

  // ─── Active Order
  currentOrder:  null,
  // UPI:  { order_id, razorpay_order_id, total_amount, payment_link, payment_method }
  // CASH: { order_id, total_amount, payment_method }
  paymentStatus: null,   // 'PENDING' | 'PAID' | 'FAILED'
  orderStatus:   null,   // 'PLACED' | 'DISPENSING' | 'COMPLETED' | 'CANCELLED'

  // ─── Actions
  goTo: (screen) => set({ currentScreen: screen }),

  setDeviceInfo: (info) => set({
    deviceVID:       info.deviceVID,
    isProvisioned:   info.isProvisioned,
    kioskBrowserURL: info.kioskBrowserURL ?? null,
    mqttConfig:      info.mqtt ?? null,
  }),

  addToCart: (item) => set((state) => {
    const existing = state.cart.find(c => c.catalog_id === item.catalog_id)
    if (existing) {
      return {
        cart: state.cart.map(c =>
          c.catalog_id === item.catalog_id
            ? { ...c, quantity: Math.min(c.quantity + 1, c.stock) }
            : c
        ),
      }
    }
    return { cart: [...state.cart, { ...item, quantity: 1 }] }
  }),

  updateQuantity: (catalog_id, qty) => set((state) => ({
    cart: qty <= 0
      ? state.cart.filter(c => c.catalog_id !== catalog_id)
      : state.cart.map(c => c.catalog_id === catalog_id ? { ...c, quantity: qty } : c),
  })),

  setCatalog:      (catalog) => set({ catalog, catalogError: null }),
  setCatalogError: (err)     => set({ catalogError: err }),

  setOrder: (order) => set({
    currentOrder:  order,
    paymentStatus: 'PENDING',
    orderStatus:   'PLACED',
  }),

  updatePaymentStatus: (payment_status, order_status) =>
    set({ paymentStatus: payment_status, orderStatus: order_status }),

  resetSession: () => set({ cart: [], currentOrder: null, paymentStatus: null, orderStatus: null }),

  resetToIdle: () => set({
    cart: [], currentOrder: null, paymentStatus: null, orderStatus: null,
    catalog: [], catalogError: null, currentScreen: 'idle',
  }),

  // Computed helpers
  cartTotal:     () => get().cart.reduce((s, i) => s + i.price * i.quantity, 0),
  cartItemCount: () => get().cart.reduce((s, i) => s + i.quantity, 0),
}))
```

---

## API Layer

### `api/axios.js`
```js
import axios from 'axios'

// M9Vends SaaS backend — Vite proxy routes /api/public and /api/device
export const saasApi = axios.create({
  baseURL: '/',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

// IoT backend — direct URL (proxied via /api/device in vite.config)
export const iotApi = axios.create({
  baseURL: import.meta.env.VITE_IOT_API_URL || 'http://localhost:3001',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})
```

### `api/catalog.api.js`
```js
import { saasApi } from './axios'

export const getCatalog = async (machine_id) => {
  const res = await saasApi.get(`/api/public/catalog/${machine_id}`)
  return res.data  // { success, machine_id, catalog[] }
}
```

### `api/order.api.js`
```js
import { saasApi } from './axios'

export const placeOrder = async ({ machine_id, items, payment_method = 'UPI' }) => {
  const res = await saasApi.post('/api/public/order', { machine_id, items, payment_method })
  return res.data  // { success, data: { order_id, payment_link?, total_amount, items, ... } }
}

export const getOrderStatus = async (order_id) => {
  const res = await saasApi.get(`/api/public/order/${order_id}/status`)
  return res.data  // { success, order_id, payment_status, order_status, total_amount, paid_at }
}

export const cancelOrder = async (order_id) => {
  const res = await saasApi.post(`/api/public/order/${order_id}/cancel`)
  return res.data
}
```

---

## App.jsx — Screen State Machine

```jsx
import { useKioskStore }    from './store/kioskStore'
import { useIdleTimeout }   from './hooks/useIdleTimeout'
import BootScreen           from './screens/BootScreen'
import ProvisionScreen      from './screens/ProvisionScreen'
import IdleScreen           from './screens/IdleScreen'
import CatalogScreen        from './screens/CatalogScreen'
import CartScreen           from './screens/CartScreen'
import UpiPaymentScreen     from './screens/UpiPaymentScreen'
import CashPaymentScreen    from './screens/CashPaymentScreen'
import SuccessScreen        from './screens/SuccessScreen'
import FailedScreen         from './screens/FailedScreen'
import ErrorScreen          from './screens/ErrorScreen'

const SCREENS = {
  boot:      BootScreen,
  provision: ProvisionScreen,
  idle:      IdleScreen,
  catalog:   CatalogScreen,
  cart:      CartScreen,
  upi:       UpiPaymentScreen,
  cash:      CashPaymentScreen,
  success:   SuccessScreen,
  failed:    FailedScreen,
  error:     ErrorScreen,
}

export default function App() {
  const currentScreen = useKioskStore(s => s.currentScreen)
  useIdleTimeout()

  const Screen = SCREENS[currentScreen] ?? ErrorScreen
  return (
    <div id="kiosk-root">
      <Screen />
    </div>
  )
}
```

---

## Screen 1 — Boot Screen (`BootScreen.jsx`)

**When shown:** App first load
**Purpose:** Call IoT wake-up API, determine provisioned state

```
┌───────────────────────┐
│                       │
│   [M9Vends Logo]      │
│                       │
│      ◌  spinner       │
│   Connecting...       │
│                       │
└───────────────────────┘
```

```jsx
import { useEffect }     from 'react'
import { iotApi }        from '../api/axios'
import { useKioskStore } from '../store/kioskStore'

export default function BootScreen() {
  const { serialNumber, setDeviceInfo, goTo } = useKioskStore()

  useEffect(() => {
    let cancelled = false
    const boot = async () => {
      try {
        const res = await iotApi.post('/api/device/wake-up', {
          serialNumber,
          model:  'M9-Vending-Pro',
          status: 'online',
        })
        if (cancelled) return
        setDeviceInfo(res.data)
        goTo(res.data.isProvisioned ? 'idle' : 'provision')
      } catch {
        if (!cancelled) setTimeout(boot, 5000)  // retry every 5s
      }
    }
    boot()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="boot-screen">
      <img src="/logo.png" alt="M9Vends" className="boot-logo" />
      <div className="spinner" />
      <p className="boot-text">Connecting...</p>
    </div>
  )
}
```

**Transitions:**

| Condition | Next screen |
|---|---|
| `isProvisioned: true` | `idle` |
| `isProvisioned: false` | `provision` |
| API error | Retry after 5s |

---

## Screen 2 — Provision Screen (`ProvisionScreen.jsx`)

**When shown:** Device is not yet linked to an admin account
**Purpose:** Show QR code so admin can scan and provision the device

```
┌───────────────────────────┐
│  Device Setup Required    │
│                           │
│  ┌─────────────────────┐  │
│  │      [QR CODE]      │  │  ← value = serialNumber only
│  └─────────────────────┘  │
│                           │
│  Serial: SN-M9V-4820     │
│  Scan with Admin App      │
│  ● Waiting...             │
└───────────────────────────┘
```

```jsx
import { useEffect }     from 'react'
import { QRCodeSVG }     from 'qrcode.react'
import { iotApi }        from '../api/axios'
import { useKioskStore } from '../store/kioskStore'

export default function ProvisionScreen() {
  const { serialNumber, setDeviceInfo, goTo } = useKioskStore()

  useEffect(() => {
    // Poll every 10 seconds — admin scanning QR triggers provision API
    // Next wake-up response will have isProvisioned: true
    const poll = setInterval(async () => {
      try {
        const res = await iotApi.post('/api/device/wake-up', {
          serialNumber, model: 'M9-Vending-Pro', status: 'online',
        })
        setDeviceInfo(res.data)
        if (res.data.isProvisioned) {
          clearInterval(poll)
          goTo('idle')
        }
      } catch { /* silent — keep polling */ }
    }, 10000)

    return () => clearInterval(poll)
  }, [])

  return (
    <div className="provision-screen">
      <h1>Device Setup Required</h1>
      <p className="provision-subtitle">
        Scan with the M9Vends Admin App to activate this machine
      </p>
      <div className="qr-wrapper">
        <QRCodeSVG value={serialNumber} size={260} level="M" bgColor="#ffffff" fgColor="#050a14" />
      </div>
      <p className="serial-label">Serial: {serialNumber}</p>
      <div className="waiting-indicator">
        <span className="pulse-dot" />
        Waiting for activation...
      </div>
    </div>
  )
}
```

**Transitions:**

| Condition | Next screen |
|---|---|
| Poll gets `isProvisioned: true` | `idle` |

---

## Screen 3 — Idle / Attract Screen (`IdleScreen.jsx`)

**When shown:** After provisioning or session reset
**Purpose:** Attract customers; preload nothing until touched

```
┌──────────────────────────────┐
│  ~~slow cyan/purple gradient~ │
│                              │
│      [M9Vends Logo]          │
│                              │
│   ✨  Touch to Start  ✨      │  ← pulsing
│                              │
└──────────────────────────────┘
```

```jsx
import { useEffect }     from 'react'
import { useKioskStore } from '../store/kioskStore'
import { getCatalog }    from '../api/catalog.api'

export default function IdleScreen() {
  const { deviceVID, setCatalog, setCatalogError, resetSession, goTo } = useKioskStore()

  useEffect(() => { resetSession() }, [])

  const handleTouch = async () => {
    goTo('catalog')
    try {
      const data = await getCatalog(deviceVID)  // deviceVID = machine_id
      setCatalog(data.catalog)
    } catch {
      setCatalogError('Failed to load products. Please try again.')
    }
  }

  return (
    <div className="idle-screen" onClick={handleTouch}>
      <div className="idle-bg-animation" />
      <img src="/logo.png" alt="M9Vends" className="idle-logo" />
      <h1 className="idle-cta">Touch to Start</h1>
    </div>
  )
}
```

**Transitions:**

| Condition | Next screen |
|---|---|
| Any touch | `catalog` (fetch catalog simultaneously) |

---

## Screen 4 — Catalog Screen (`CatalogScreen.jsx`)

**When shown:** After customer touches idle screen
**Purpose:** Browse products, adjust quantities, build cart
**Data source:** `catalog[]` from Zustand store (fetched on idle → catalog transition)

```
┌────────────────────────────────────────────┐
│ ← Back         M9Vends           🛒 3     │  ← header
├────────────────────────────────────────────┤
│ 🔍 Search products...                      │
├────────────────────────────────────────────┤
│ ┌───────────┐  ┌───────────┐               │
│ │ [Img/🥤]  │  │ [Img/🧃]  │               │
│ │ Pani Puri │  │ Mango     │               │
│ │ ₹25       │  │ Lassi ₹40 │               │
│ │ ● In stock│  │ ⚠ Only 2  │               │
│ │ [−][2][+] │  │  [ Add ]  │               │
│ └───────────┘  └───────────┘               │
│                                            │
│ ┌───────────┐  ┌───────────┐               │
│ │ [Img]     │  │ Out of    │               │
│ │ Cold Brew │  │ Stock     │               │
│ │ ₹60 [Add] │  │ (greyed)  │               │
│ └───────────┘  └───────────┘               │
├────────────────────────────────────────────┤
│  3 items · ₹90                [Checkout →] │  ← sticky bar
└────────────────────────────────────────────┘
```

```jsx
import { useState }      from 'react'
import { useKioskStore } from '../store/kioskStore'

export default function CatalogScreen() {
  const {
    catalog, catalogError,
    cart, addToCart, updateQuantity,
    cartTotal, cartItemCount, goTo,
  } = useKioskStore()
  const [search, setSearch] = useState('')

  const filtered = catalog.filter(p =>
    p.product_name.toLowerCase().includes(search.toLowerCase())
  )
  const getQty = (id) => cart.find(c => c.catalog_id === id)?.quantity ?? 0

  const handleAdd = (item) => {
    if (item.stock === 0) return
    addToCart({
      catalog_id:   item.catalog_id,
      product_name: item.product_name,
      price:        item.price,
      stock:        item.stock,
      image_url:    item.image_url,
    })
  }

  if (catalogError) return (
    <div className="catalog-error">
      <p>{catalogError}</p>
      <button onClick={() => goTo('idle')}>← Back to Start</button>
    </div>
  )

  return (
    <div className="catalog-screen">
      <header className="catalog-header">
        <button className="btn-back" onClick={() => goTo('idle')}>← Back</button>
        <h2>M9Vends</h2>
        <div className="cart-badge">🛒 {cartItemCount()}</div>
      </header>

      <input
        className="catalog-search"
        placeholder="🔍 Search products..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className="product-grid">
        {filtered.map(item => {
          const qty = getQty(item.catalog_id)
          const oos = item.stock === 0
          return (
            <div key={item.catalog_id} className={`product-card ${oos ? 'out-of-stock' : ''}`}>
              <div className="product-image">
                {item.image_url
                  ? <img src={item.image_url} alt={item.product_name} />
                  : <span className="product-emoji">🥤</span>}
              </div>
              <h3 className="product-name">{item.product_name}</h3>
              <p className="product-price">₹{item.price}</p>
              <div className={`stock-indicator ${item.stock > 5 ? 'high' : item.stock > 0 ? 'low' : 'none'}`}>
                {oos ? 'Out of stock' : item.stock <= 5 ? `Only ${item.stock} left` : 'In stock'}
              </div>
              {oos ? (
                <div className="oos-label">Unavailable</div>
              ) : qty === 0 ? (
                <button className="btn-add" onClick={() => handleAdd(item)}>Add</button>
              ) : (
                <div className="qty-control">
                  <button onClick={() => updateQuantity(item.catalog_id, qty - 1)}>−</button>
                  <span>{qty}</span>
                  <button onClick={() => updateQuantity(item.catalog_id, qty + 1)} disabled={qty >= item.stock}>+</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {cartItemCount() > 0 && (
        <div className="cart-bar">
          <span>{cartItemCount()} items · ₹{cartTotal()}</span>
          <button className="btn-checkout" onClick={() => goTo('cart')}>Checkout →</button>
        </div>
      )}
    </div>
  )
}
```

**Rules:**
- `stock === 0` → greyed card, "Unavailable" label, no button
- `stock <= 5` → amber "Only N left"
- Quantity cannot exceed stock
- Cart bar only visible when `cartItemCount() > 0`

**Transitions:**

| Action | Next screen |
|---|---|
| Checkout → | `cart` |
| ← Back | `idle` |

---

## Screen 5 — Cart / Review Screen (`CartScreen.jsx`)

**When shown:** Customer taps Checkout
**Purpose:** Review items, choose UPI or Cash, place order
**API:** `POST /api/public/order`

```
┌────────────────────────────────────────────┐
│ ← Back              Review Order           │
├────────────────────────────────────────────┤
│                                            │
│  Masala Pani Puri              ₹50        │
│  [−] [2] [+]                               │
│  ──────────────────────────────────────    │
│  Mango Lassi                   ₹40        │
│  [−] [1] [+]                               │
│                                            │
├────────────────────────────────────────────┤
│  Total                               ₹90  │
├────────────────────────────────────────────┤
│  ⚡ Pay ₹90 with UPI                       │  ← primary
│  💵 Pay with Cash                          │  ← secondary
└────────────────────────────────────────────┘
```

```jsx
import { useState }      from 'react'
import { useKioskStore } from '../store/kioskStore'
import { placeOrder }    from '../api/order.api'

export default function CartScreen() {
  const {
    cart, cartTotal, deviceVID,
    updateQuantity, setOrder, goTo,
  } = useKioskStore()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const handlePlaceOrder = async (payment_method) => {
    setLoading(true); setError(null)
    try {
      const res = await placeOrder({
        machine_id:     deviceVID,
        items:          cart.map(c => ({ catalog_id: c.catalog_id, quantity: c.quantity })),
        payment_method,
      })
      setOrder(res.data)
      goTo(payment_method === 'UPI' ? 'upi' : 'cash')
    } catch (err) {
      setError(err?.response?.data?.message || 'Order failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (cart.length === 0) { goTo('catalog'); return null }

  return (
    <div className="cart-screen">
      <header className="cart-header">
        <button className="btn-back" onClick={() => goTo('catalog')}>← Back</button>
        <h2>Review Order</h2>
      </header>

      <div className="cart-items">
        {cart.map(item => (
          <div key={item.catalog_id} className="cart-item">
            <div className="cart-item-info">
              <span className="cart-item-name">{item.product_name}</span>
              <span className="cart-item-subtotal">₹{item.price * item.quantity}</span>
            </div>
            <div className="qty-control">
              <button onClick={() => updateQuantity(item.catalog_id, item.quantity - 1)}>−</button>
              <span>{item.quantity}</span>
              <button onClick={() => updateQuantity(item.catalog_id, item.quantity + 1)} disabled={item.quantity >= item.stock}>+</button>
            </div>
          </div>
        ))}
      </div>

      <div className="cart-total">
        <span>Total</span>
        <strong>₹{cartTotal()}</strong>
      </div>

      {error && <div className="cart-error">{error}</div>}

      <div className="payment-buttons">
        <button className="btn-pay-upi" onClick={() => handlePlaceOrder('UPI')} disabled={loading}>
          {loading ? 'Processing...' : `⚡ Pay ₹${cartTotal()} with UPI`}
        </button>
        <button className="btn-pay-cash" onClick={() => handlePlaceOrder('CASH')} disabled={loading}>
          💵 Pay with Cash
        </button>
      </div>
    </div>
  )
}
```

**Transitions:**

| Action | Next screen |
|---|---|
| Pay with UPI | `POST /api/public/order {payment_method:'UPI'}` → `upi` |
| Pay with Cash | `POST /api/public/order {payment_method:'CASH'}` → `cash` |
| ← Back | `catalog` |
| API error | Inline error, stay on `cart` |

---

## Screen 6 — UPI Payment Screen (`UpiPaymentScreen.jsx`)

**When shown:** UPI order placed
**Purpose:** Show QR code, poll payment, manage 3-minute countdown
**APIs:**
- `GET /api/public/order/:id/status` every 3 seconds
- `POST /api/public/order/:id/cancel` on timeout or cancel

```
┌────────────────────────────────────────────┐
│  ✕ Cancel                      03:00 ⏱   │
├────────────────────────────────────────────┤
│                                            │
│              Scan to Pay                   │
│                                            │
│    ┌────────────────────────────────┐      │
│    │                                │      │
│    │          [QR CODE]             │      │
│    │    value = payment_link        │      │
│    │                                │      │
│    └────────────────────────────────┘      │
│                                            │
│                  ₹90                       │
│                                            │
│    Use GPay · PhonePe · Paytm              │
│                                            │
│    ● Waiting for payment...                │
│                                            │
└────────────────────────────────────────────┘
```

```jsx
import { useEffect, useRef, useState }    from 'react'
import { QRCodeSVG }                      from 'qrcode.react'
import { useKioskStore }                  from '../store/kioskStore'
import { getOrderStatus, cancelOrder }    from '../api/order.api'

const UPI_TIMEOUT_S = Math.floor((parseInt(import.meta.env.VITE_UPI_TIMEOUT_MS) || 180000) / 1000)
const POLL_MS       = parseInt(import.meta.env.VITE_POLL_INTERVAL_MS) || 3000

export default function UpiPaymentScreen() {
  const { currentOrder, updatePaymentStatus, goTo } = useKioskStore()
  const [secondsLeft, setSecondsLeft] = useState(UPI_TIMEOUT_S)
  const pollRef  = useRef(null)
  const timerRef = useRef(null)

  const stop = () => {
    clearInterval(pollRef.current)
    clearInterval(timerRef.current)
  }

  const handleCancel = async () => {
    stop()
    try { await cancelOrder(currentOrder.order_id) } catch {}
    updatePaymentStatus('FAILED', 'CANCELLED')
    goTo('failed')
  }

  useEffect(() => {
    if (!currentOrder?.order_id) { goTo('cart'); return }

    // Countdown
    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { handleCancel(); return 0 }
        return s - 1
      })
    }, 1000)

    // Payment polling
    pollRef.current = setInterval(async () => {
      try {
        const data = await getOrderStatus(currentOrder.order_id)
        updatePaymentStatus(data.payment_status, data.order_status)
        if (data.payment_status === 'PAID')   { stop(); goTo('success') }
        if (data.payment_status === 'FAILED') { stop(); goTo('failed') }
      } catch { /* network hiccup — keep polling */ }
    }, POLL_MS)

    return stop
  }, [])

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const ss = String(secondsLeft % 60).padStart(2, '0')

  return (
    <div className="upi-screen">
      <div className="upi-header">
        <button className="btn-cancel" onClick={handleCancel}>✕ Cancel</button>
        <div className={`countdown ${secondsLeft < 30 ? 'urgent' : ''}`}>{mm}:{ss} ⏱</div>
      </div>
      <h2 className="upi-title">Scan to Pay</h2>
      <div className="qr-container">
        <QRCodeSVG value={currentOrder.payment_link} size={280} level="M" bgColor="#ffffff" fgColor="#050a14" />
      </div>
      <div className="upi-amount">₹{currentOrder.total_amount}</div>
      <p className="upi-hint">Use GPay · PhonePe · Paytm or any UPI app</p>
      <div className="waiting-indicator">
        <span className="pulse-dot" /> Waiting for payment...
      </div>
    </div>
  )
}
```

**Transitions:**

| Condition | Next screen |
|---|---|
| `payment_status === 'PAID'` | `success` |
| `payment_status === 'FAILED'` | `failed` |
| Timer reaches 0 | Cancel order → `failed` |
| ✕ Cancel | Cancel order → `failed` |

---

## Screen 7 — Cash Payment Screen (`CashPaymentScreen.jsx`)

**When shown:** Cash order placed
**Purpose:** Show order ID to attendant, poll 10 minutes for admin confirmation
**APIs:**
- `GET /api/public/order/:id/status` every 3 seconds
- `POST /api/public/order/:id/cancel` on timeout

```
┌────────────────────────────────────────────┐
│  ✕ Cancel                      10:00 ⏱   │
├────────────────────────────────────────────┤
│                                            │
│              Pay with Cash                 │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │    Show this to the attendant        │  │
│  │                                      │  │
│  │       ORDER # C9D0A1B2               │  │  ← mono font, last 8 chars
│  │                                      │  │
│  └──────────────────────────────────────┘  │
│                                            │
│                   ₹25                      │
│                                            │
│   Hand ₹25 cash to the attendant.         │
│   They will confirm your order.            │
│                                            │
│    Waiting for confirmation...   │
│                                            │
└────────────────────────────────────────────┘
```

```jsx
import { useEffect, useRef, useState }    from 'react'
import { useKioskStore }                  from '../store/kioskStore'
import { getOrderStatus, cancelOrder }    from '../api/order.api'

const CASH_TIMEOUT_S = Math.floor((parseInt(import.meta.env.VITE_CASH_TIMEOUT_MS) || 600000) / 1000)
const POLL_MS        = parseInt(import.meta.env.VITE_POLL_INTERVAL_MS) || 3000

export default function CashPaymentScreen() {
  const { currentOrder, updatePaymentStatus, goTo } = useKioskStore()
  const [secondsLeft, setSecondsLeft] = useState(CASH_TIMEOUT_S)
  const pollRef  = useRef(null)
  const timerRef = useRef(null)

  const orderId     = currentOrder?.order_id ?? ''
  const shortId     = orderId.slice(-8).toUpperCase()
  const totalAmount = currentOrder?.total_amount ?? 0

  const stop = () => { clearInterval(pollRef.current); clearInterval(timerRef.current) }

  const handleCancel = async () => {
    stop()
    try { await cancelOrder(orderId) } catch {}
    updatePaymentStatus('FAILED', 'CANCELLED')
    goTo('failed')
  }

  useEffect(() => {
    if (!orderId) { goTo('cart'); return }

    timerRef.current = setInterval(() => {
      setSecondsLeft(s => { if (s <= 1) { handleCancel(); return 0 } return s - 1 })
    }, 1000)

    pollRef.current = setInterval(async () => {
      try {
        const data = await getOrderStatus(orderId)
        updatePaymentStatus(data.payment_status, data.order_status)
        if (data.payment_status === 'PAID')   { stop(); goTo('success') }
        if (data.payment_status === 'FAILED') { stop(); goTo('failed') }
      } catch {}
    }, POLL_MS)

    return stop
  }, [])

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0')
  const ss = String(secondsLeft % 60).padStart(2, '0')

  return (
    <div className="cash-screen">
      <div className="cash-header">
        <button className="btn-cancel" onClick={handleCancel}>✕ Cancel</button>
        <div className="countdown">{mm}:{ss} ⏱</div>
      </div>
      <h2 className="cash-title">Pay with Cash</h2>
      <div className="order-id-box">
        <p className="order-id-label">Show this to the attendant</p>
        <div className="order-id-number">ORDER # {shortId}</div>
      </div>
      <div className="cash-amount">₹{totalAmount}</div>
      <p className="cash-hint">Hand ₹{totalAmount} cash to the attendant. They will confirm your order.</p>
      <div className="waiting-dots"><span /><span /><span /></div>
      <p className="waiting-text">Waiting for confirmation...</p>
    </div>
  )
}
```

**Transitions:**

| Condition | Next screen |
|---|---|
| `payment_status === 'PAID'` | `success` |
| Timer reaches 0 | Cancel → `failed` |
| ✕ Cancel | Cancel → `failed` |

---

## Screen 8 — Success Screen (`SuccessScreen.jsx`)

**When shown:** `payment_status === 'PAID'`
**Purpose:** Confirm payment, show order summary, auto-return in 5 seconds

```
┌────────────────────────────────────────────┐
│                                            │
│               ✅                           │  ← pop-in animation
│                                            │
│        Payment Successful!                 │
│    Your order is being prepared            │
│                                            │
│    Masala Pani Puri × 2                   │
│    Mango Lassi × 1                        │
│    ────────────────────────               │
│    Total paid: ₹90                        │
│                                            │
│    Thank you for your purchase!        │
│                                            │
│    Returning to start in 5s...             │
│    [↩ Back to Start]                      │
│                                            │
└────────────────────────────────────────────┘
```

```jsx
import { useEffect, useState } from 'react'
import { useKioskStore }       from '../store/kioskStore'

export default function SuccessScreen() {
  const { currentOrder, cart, resetToIdle } = useKioskStore()
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(t); resetToIdle(); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="success-screen">
      <div className="success-icon">✅</div>
      <h1 className="success-title">Payment Successful!</h1>
      <p className="success-subtitle">Your order is being prepared</p>
      <div className="order-summary">
        {cart.map(item => (
          <div key={item.catalog_id} className="summary-item">
            {item.product_name} × {item.quantity}
          </div>
        ))}
        <div className="summary-total">Total paid: ₹{currentOrder?.total_amount}</div>
      </div>
      <p className="thank-you">Thank you for your purchase! 🙏</p>
      <p className="auto-return">Returning to start in {countdown}s...</p>
      <button className="btn-home" onClick={resetToIdle}>↩ Back to Start</button>
    </div>
  )
}
```

**Transitions:**

| Condition | Next screen |
|---|---|
| Auto after 5 seconds | `idle` |
| Button tap | `idle` |

---

## Screen 9 — Failed / Timeout Screen (`FailedScreen.jsx`)

**When shown:** Payment failed, UPI/cash timeout, or cancel pressed

```
┌────────────────────────────────────────────┐
│                                            │
│             ❌  (or ⏰ for timeout)         │
│                                            │
│         Payment Failed                     │
│    (or "Session Timed Out")                │
│                                            │
│    Please try again or contact staff       │
│                                            │
│    [🔄 Try Again]                          │
│    [↩ Back to Start]                      │
│                                            │
│    Auto-returning in 15s...                │
│                                            │
└────────────────────────────────────────────┘
```

```jsx
import { useEffect, useState } from 'react'
import { useKioskStore }       from '../store/kioskStore'

export default function FailedScreen() {
  const { orderStatus, resetToIdle, goTo } = useKioskStore()
  const [countdown, setCountdown] = useState(15)

  const isTimeout = orderStatus === 'CANCELLED'

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(t); resetToIdle(); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="failed-screen">
      <div className="failed-icon">{isTimeout ? '⏰' : '❌'}</div>
      <h1 className="failed-title">{isTimeout ? 'Session Timed Out' : 'Payment Failed'}</h1>
      <p className="failed-subtitle">Please try again or contact staff</p>
      <div className="failed-actions">
        <button className="btn-retry" onClick={() => goTo('catalog')}>🔄 Try Again</button>
        <button className="btn-home"  onClick={resetToIdle}>↩ Back to Start</button>
      </div>
      <p className="auto-return">Auto-returning in {countdown}s...</p>
    </div>
  )
}
```

**Transitions:**

| Action | Next screen |
|---|---|
| 🔄 Try Again | `catalog` |
| ↩ Back to Start | `idle` |
| Auto after 15 seconds | `idle` |

---

## Screen 10 — Error Screen (`ErrorScreen.jsx`)

**When shown:** Critical boot failure (network down, IoT service unreachable)

```jsx
import { useEffect }     from 'react'
import { useKioskStore } from '../store/kioskStore'

export default function ErrorScreen() {
  const { goTo } = useKioskStore()

  useEffect(() => {
    const t = setTimeout(() => goTo('boot'), 10000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="error-screen">
      <div className="error-icon">⚠️</div>
      <h1>Connection Error</h1>
      <p>Unable to connect to the network.</p>
      <p>Retrying automatically...</p>
      <div className="spinner" />
    </div>
  )
}
```

**Transitions:**

| Condition | Next screen |
|---|---|
| Auto after 10 seconds | `boot` (re-attempt) |

---

## Idle Timeout Hook (`hooks/useIdleTimeout.js`)

Auto-reset any active screen to idle if no touch for `VITE_IDLE_TIMEOUT_MS` (default 2 min):

```js
import { useEffect, useRef } from 'react'
import { useKioskStore }     from '../store/kioskStore'

// These screens manage their own timeouts — don't interfere
const EXCLUDED = ['boot', 'provision', 'success', 'failed', 'error']

const IDLE_MS = parseInt(import.meta.env.VITE_IDLE_TIMEOUT_MS) || 120000

export function useIdleTimeout() {
  const currentScreen = useKioskStore(s => s.currentScreen)
  const resetToIdle   = useKioskStore(s => s.resetToIdle)
  const timerRef = useRef(null)

  const resetTimer = () => {
    clearTimeout(timerRef.current)
    if (EXCLUDED.includes(currentScreen)) return
    timerRef.current = setTimeout(resetToIdle, IDLE_MS)
  }

  useEffect(() => {
    window.addEventListener('touchstart', resetTimer)
    window.addEventListener('click',      resetTimer)
    resetTimer()
    return () => {
      window.removeEventListener('touchstart', resetTimer)
      window.removeEventListener('click',      resetTimer)
      clearTimeout(timerRef.current)
    }
  }, [currentScreen])
}
```

---

## Design System (`index.css` — key tokens)

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;700&display=swap');

:root {
  --bg:            #050a14;
  --surface:       #0d1a2e;
  --card:          #122040;
  --border:        #1e3a5f;
  --accent:        #06b6d4;   /* cyan primary */
  --green:         #22c55e;
  --amber:         #f59e0b;
  --red:           #ef4444;
  --text-primary:  #ffffff;
  --text-secondary:#cbd5e1;
  --text-muted:    #64748b;
  --font-main:     'Inter', system-ui, sans-serif;
  --font-mono:     'JetBrains Mono', monospace;
  --touch-min:     56px;      /* ALL interactive elements */
  --radius-md:     16px;
  --radius-lg:     24px;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #root { height: 100%; overflow: hidden; }

#kiosk-root {
  height:      100vh;
  width:       100vw;
  background:  var(--bg);
  color:       var(--text-primary);
  font-family: var(--font-main);
  font-size:   18px;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

/* Shared components */
.spinner {
  width: 40px; height: 40px;
  border: 4px solid rgba(6,182,212,0.2);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto;
}
@keyframes spin { to { transform: rotate(360deg); } }

.pulse-dot {
  display: inline-block;
  width: 10px; height: 10px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse 1.4s ease-in-out infinite;
}
@keyframes pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.4; transform:scale(0.6); } }

.btn-back, .btn-cancel {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border);
  padding: 10px 20px;
  border-radius: var(--radius-md);
  font-size: 16px;
  cursor: pointer;
  min-height: var(--touch-min);
}

/* Screen layouts */
.boot-screen, .provision-screen, .idle-screen,
.success-screen, .failed-screen, .error-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 20px;
  padding: 40px;
  text-align: center;
}

.catalog-screen, .cart-screen, .upi-screen, .cash-screen {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0;
}

/* Product grid */
.product-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  padding: 16px 24px;
}

.product-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.product-card.out-of-stock { opacity: 0.45; }
.product-price { font-size: 22px; font-weight: 800; color: var(--accent); }
.stock-indicator.high  { color: var(--green); font-size: 13px; }
.stock-indicator.low   { color: var(--amber); font-size: 13px; }
.stock-indicator.none  { color: var(--red);   font-size: 13px; }

.btn-add {
  min-height: var(--touch-min);
  background: var(--accent); color: #050a14;
  border: none; border-radius: var(--radius-md);
  font-size: 18px; font-weight: 700; cursor: pointer;
}

.qty-control {
  display: flex; align-items: center; justify-content: space-between;
  background: var(--surface); border-radius: var(--radius-md); overflow: hidden;
}
.qty-control button {
  min-height: var(--touch-min); width: 56px;
  background: transparent; color: var(--text-primary);
  border: none; font-size: 24px; cursor: pointer;
}
.qty-control span { font-size: 20px; font-weight: 700; }

/* Cart bar */
.cart-bar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 24px; background: var(--surface); border-top: 1px solid var(--border);
}
.btn-checkout {
  min-height: var(--touch-min); padding: 0 28px;
  background: var(--accent); color: #050a14; border: none;
  border-radius: var(--radius-md); font-size: 18px; font-weight: 700; cursor: pointer;
}

/* Payment buttons */
.btn-pay-upi {
  min-height: 64px; width: 100%;
  background: var(--accent); color: #050a14; border: none;
  border-radius: var(--radius-md); font-size: 20px; font-weight: 800; cursor: pointer;
}
.btn-pay-cash {
  min-height: 64px; width: 100%;
  background: transparent; color: var(--amber); border: 2px solid var(--amber);
  border-radius: var(--radius-md); font-size: 18px; font-weight: 700; cursor: pointer;
}

/* Countdown */
.countdown { font-family: var(--font-mono); font-size: 22px; color: var(--amber); font-weight: 700; }
.countdown.urgent { color: var(--red); animation: urgent 0.5s ease-in-out infinite alternate; }
@keyframes urgent { from { opacity:1; } to { opacity:0.5; } }

/* QR */
.qr-container, .qr-wrapper {
  background: #fff; padding: 20px; border-radius: var(--radius-lg);
  box-shadow: 0 0 40px rgba(6,182,212,0.35);
}

/* Order ID */
.order-id-box { background: var(--card); border: 2px solid var(--accent); border-radius: var(--radius-lg); padding: 28px 40px; text-align: center; }
.order-id-number { font-family: var(--font-mono); font-size: 32px; font-weight: 700; color: var(--accent); letter-spacing: 4px; }

/* Amounts */
.upi-amount, .cash-amount { font-size: 56px; font-weight: 900; color: var(--green); }

/* Success */
.success-icon { font-size: 96px; animation: pop-in 0.4s cubic-bezier(0.175,0.885,0.32,1.275); }
@keyframes pop-in { from { transform:scale(0); opacity:0; } to { transform:scale(1); opacity:1; } }
.success-title { font-size: 36px; font-weight: 900; color: var(--green); }

/* Failed */
.failed-icon  { font-size: 96px; }
.failed-title { font-size: 36px; font-weight: 900; color: var(--red); }
.btn-retry {
  min-height: 64px; width: 100%;
  background: var(--accent); color: #050a14; border: none;
  border-radius: var(--radius-md); font-size: 20px; font-weight: 800; cursor: pointer;
}
.btn-home {
  min-height: 56px; width: 100%;
  background: transparent; color: var(--text-secondary);
  border: 2px solid var(--border); border-radius: var(--radius-md);
  font-size: 18px; cursor: pointer;
}

/* Idle */
.idle-screen { position: relative; cursor: pointer; overflow: hidden; }
.idle-bg-animation {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse at 30% 50%, rgba(6,182,212,0.12), transparent 60%),
              radial-gradient(ellipse at 70% 50%, rgba(139,92,246,0.1), transparent 60%);
  animation: bg-shift 8s ease-in-out infinite alternate;
}
@keyframes bg-shift { from { opacity:0.6; transform:scale(1); } to { opacity:1; transform:scale(1.05); } }
.idle-cta { font-size: 32px; font-weight: 800; color: var(--accent); animation: pulse-text 2s ease-in-out infinite; }
@keyframes pulse-text { 0%,100% { opacity:1; } 50% { opacity:0.5; } }

/* Waiting dots */
.waiting-dots { display: flex; gap: 8px; }
.waiting-dots span {
  width: 12px; height: 12px; border-radius: 50%; background: var(--accent);
  animation: dot-bounce 1.2s ease-in-out infinite;
}
.waiting-dots span:nth-child(2) { animation-delay: 0.2s; }
.waiting-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes dot-bounce { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-10px); } }
```

---

## Environment (`.env`)

```bash
# Hardware serial number — unique per physical machine
VITE_SERIAL_NUMBER=SN-M9V-4820

# Backend URLs
VITE_API_URL=http://localhost:5000          # M9Vends backend (REST)
VITE_IOT_API_URL=http://localhost:3001      # IoT service (wake-up, connect)
VITE_MQTT_BROKER_URL=ws://localhost:8083    # MQTT WebSocket (Phase 2)

# Timeouts (milliseconds)
VITE_UPI_TIMEOUT_MS=180000     # 3 minutes UPI countdown
VITE_CASH_TIMEOUT_MS=600000    # 10 minutes cash wait
VITE_IDLE_TIMEOUT_MS=120000    # 2 minutes idle → auto-reset
VITE_POLL_INTERVAL_MS=3000     # order status poll interval
```

## `vite.config.js`

```js
import { defineConfig } from 'vite'
import react            from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api/public': { target: 'http://localhost:5000', changeOrigin: true },
      '/api/device': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
})
```

## Install

```bash
cd SAAS/kiosk-screen
npm create vite@latest . -- --template react
npm install zustand axios qrcode.react react-hot-toast mqtt
```

---

## Build Order

```
Day 1 — Foundation
  [ ] Vite scaffold + .env + vite.config.js
  [ ] index.css (design tokens + all screen styles)
  [ ] kioskStore.js
  [ ] api/axios.js + catalog.api.js + order.api.js
  [ ] App.jsx (screen switcher)
  [ ] hooks/useIdleTimeout.js

Day 2 — Boot + Provisioning
  [ ] BootScreen.jsx
  [ ] ProvisionScreen.jsx
  [ ] Test: boot with real IoT service, QR provisioning flow

Day 3 — Customer Browsing
  [ ] IdleScreen.jsx
  [ ] CatalogScreen.jsx
  [ ] Test: getCatalog(), add/remove/qty-change

Day 4 — Checkout + Payment
  [ ] CartScreen.jsx
  [ ] UpiPaymentScreen.jsx
  [ ] CashPaymentScreen.jsx
  [ ] Test: full order flow UPI + Cash with live backend

Day 5 — Outcomes + Polish
  [ ] SuccessScreen.jsx
  [ ] FailedScreen.jsx
  [ ] ErrorScreen.jsx
  [ ] Touch target audit (all buttons >= 56px height)
  [ ] Full flow end-to-end test (boot → browse → pay → success → idle)
```
