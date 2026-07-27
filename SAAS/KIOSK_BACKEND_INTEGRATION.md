# M9Vends Kiosk — Complete Backend Integration Reference

> **For:** Frontend developers building the customer-facing kiosk screen in a separate folder/project  
> **M9Vends Backend:** `http://localhost:5000` (dev) | production domain (prod)  
> **No auth required** for any endpoint in this document — all are public  
> **IoT Layer:** MQTT via the separate M9Vends IoT Service

---

## Table of Contents

1. [System Architecture & Identity](#1-system-architecture--identity)
2. [Device Boot & Provisioning Flow (IoT Backend)](#2-device-boot--provisioning-flow-iot-backend)
   - [2.1 Wake-up API](#21-wake-up-api-post-apidevicewake-up)
   - [2.2 QR Code Screen](#22-unprovisioned-state--qr-code-screen)
   - [2.3 Provisioning API](#23-provisioning-api-post-apideviceprovision)
   - [2.4 Connect API — MQTT Credentials](#24-connect-api--mqtt-credentials-get-apideviceconnectid)
   - [2.5 Complete Boot State Machine](#25-complete-boot-state-machine)
3. [M9Vends REST API (Catalog & Orders)](#3-m9vends-rest-api-catalog--orders)
   - [3.1 Get Machine Catalog](#31-get-machine-catalog-get-apipubliccatalogmachine_id)
   - [3.2 Place Order](#32-place-order-post-apipublicorder)
   - [3.3 Poll Order Status](#33-poll-order-status-get-apipublicorderidstatus)
   - [3.4 Cancel Order](#34-cancel-order-post-apipublicorderidcancel)
   - [3.5 Cash Payment](#35-cash-payment-payment_method-cash)
   - [3.6 Razorpay Webhook (backend only)](#36-razorpay-webhook-backend-only)
4. [IoT / MQTT Real-Time Integration](#4-iot--mqtt-real-time-integration)
   - [4.1 Architecture & Protocol](#41-architecture--protocol)
   - [4.2 Topic Architecture](#42-topic-architecture)
   - [4.3 Telemetry Payloads & Parsing](#43-telemetry-payloads--parsing)
   - [4.4 Dispatching Commands](#44-dispatching-commands)
   - [4.5 React Hook (`useMqtt.js`)](#45-react-hook-usemqttjs)
5. [Data Models Reference](#5-data-models-reference)
6. [Payment Flow Guide](#6-payment-flow-guide)
7. [Error Handling](#7-error-handling)
8. [Backend Changes Checklist](#8-backend-changes-checklist)
9. [Kiosk Environment Setup](#9-kiosk-environment-setup)

---

## 1. System Architecture & Identity

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Physical Kiosk Device                      │
│                                                                     │
│  ┌──────────────┐    HTTP/REST    ┌──────────────────────────────┐  │
│  │   Kiosk UI   │ ◄────────────► │   M9Vends Backend  :5000     │  │
│  │  (React/Vite)│                │   /api/public/*              │  │
│  │              │    MQTT/WS     ├──────────────────────────────┤  │
│  │              │ ◄────────────► │   IoT Service  :3001/:8083   │  │
│  └──────────────┘                └──────────────────────────────┘  │
│                                           │                         │
│                               Webhook     │ payment.captured        │
│                          ┌────────────────┘                         │
│                          ▼                                          │
│                     Razorpay UPI                                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Identity Resolution — Single Source of Truth

The kiosk has **no hardcoded device IDs** in `.env`. Everything is provided by the IoT backend.

| Identifier | Example | Source | Used for |
|---|---|---|---|
| `serialNumber` | `SN-M9V-4820` | Hardware (burned in / `.env`) | QR code content — unprovisioned screen only |
| `deviceVID` | `60d5ec49f3e4e9001f3b2e99` | IoT backend — wake-up/provisioning response | MQTT topic paths + IoT connect API |
| `machine_id` | `60d5ec49f3e4e9001f3b2e99` | **Same as `deviceVID`** | M9Vends REST API — catalog & orders |

> ⚠️ **Key rule:** `machine_id` = `deviceVID`. They are the **same value** — a lowercase hex MongoDB ObjectId string provided by the IoT backend. The M9Vends backend has **no Device collection** — device management is 100% handled by the IoT service.

---

## 2. Device Boot & Provisioning Flow (IoT Backend)

### 2.1 Wake-up API (`POST /api/device/wake-up`)

Called by the kiosk **on every boot**. Registers new devices and wakes up existing ones.

> This endpoint is on the **IoT Service**, not M9Vends backend.

**Request:**
```http
POST /api/device/wake-up
Host: http://localhost:3001
Content-Type: application/json
```

```json
{
  "serialNumber": "SN-M9V-4820",
  "model": "M9-Vending-Pro",
  "mac": "00:1A:2B:3C:4D:5E",
  "ip": "192.168.1.55",
  "status": "online",
  "components": [
    { "id": 1, "catagory": "sensor", "name": "Temperature Sensor", "type": "sensor" }
  ]
}
```

| Field | Required | Notes |
|---|---|---|
| `serialNumber` | ✅ Yes | Hardware serial — only hardcoded identifier |
| `model` | ✅ Yes | Device model name |
| `mac` | Optional | MAC address |
| `ip` | Optional | Current IP address |
| `status` | Optional | `"online"` or `"offline"` |
| `components` | Optional | Attached sensors/actuators |

**Response — Case 1: Not yet provisioned**
```json
{
  "message": "Created New Device",
  "deviceVID": "60d5ec49f3e4e9001f3b2e99",
  "mqtt": { "url": "localhost", "port": 1883, "username": "Device", "password": "Device@123" },
  "topics": { "pub": ["telemetry", "status"], "sub": ["commands"] },
  "isProvisioned": false
}
```
→ **Action:** Store `deviceVID`. Show QR screen. Poll every 10s.

**Response — Case 2: Provisioned ✅**
```json
{
  "message": "Wakeup Existing Device",
  "deviceVID": "60d5ec49f3e4e9001f3b2e99",
  "mqtt": { "url": "localhost", "port": 1883, "username": "Device", "password": "Device@123" },
  "topics": { "pub": ["telemetry", "status"], "sub": ["commands"] },
  "isProvisioned": true,
  "kioskBrowserURL": "https://kiosk.m9vends.com/60d5ec49f3e4e9001f3b2e99"
}
```
→ **Action:** Save `deviceVID` (= `machine_id`). Show catalog screen.

**Error Responses:**
```json
{ "message": "Bad Request" }          // 400 — missing body
{ "message": "Something Went Wrong" } // 500 — missing serialNumber/model or DB error
```

**What to save to localStorage after every wake-up:**
```js
{
  deviceVID:       response.deviceVID,       // always present — use as machine_id for REST
  isProvisioned:   response.isProvisioned,   // true | false
  kioskBrowserURL: response.kioskBrowserURL, // only when isProvisioned: true
  mqttConfig:      response.mqtt,            // url, port, username, password (Phase 2)
}
```

---

### 2.2 Unprovisioned State — QR Code Screen

Render when `isProvisioned === false`:

```jsx
import { QRCodeSVG } from 'qrcode.react'

function UnprovisionedScreen({ serialNumber }) {
  return (
    <div className="provision-screen">
      <h1>Device Setup Required</h1>
      <p>Scan this QR code with the M9Vends Admin App to link this machine.</p>

      <div className="qr-wrapper">
        {/* QR value is ONLY the serialNumber — nothing else */}
        <QRCodeSVG value={serialNumber} size={260} level="M" />
      </div>

      <p className="serial">Serial: {serialNumber}</p>
    </div>
  )
}
```

Poll `POST /api/device/wake-up` every 10 seconds. When `isProvisioned` becomes `true`, transition to catalog screen.

---

### 2.3 Provisioning API (`POST /api/device/provision`)

> **Called by the Admin Mobile App**, NOT the kiosk. Shown here for reference only.

```http
POST /api/device/provision
Host: http://localhost:3001
Content-Type: application/json
```

```json
{ "serialNumber": "SN-M9V-4820", "userID": "60d5ec49f3e4e9001f3b2e75" }
```

**Success `200`:**
```json
{ "vid": "60d5ec49f3e4e9001f3b2e99", "message": "Provisioning Successful" }
```
> ⚠️ Response field is `vid`, NOT `deviceVID`.

**Error Responses:**
```json
{ "message": "Bad Request" }
{ "message": "Invalid User ID" }
{ "message": "User Not Found" }
{ "message": "Device Not Configured" }
{ "message": "Device Already Owned" }
{ "message": "Couldn't Reach Device, Please try restarting it..." }
```

---

### 2.4 Connect API — MQTT Credentials (`GET /api/device/connect/:id`)

Fetches a short-lived JWT token for browser MQTT WebSocket connection.

> Separate from the hardware MQTT credentials in the wake-up response. Browser MUST use this.

```http
GET /api/device/connect/60d5ec49f3e4e9001f3b2e99
Host: http://localhost:3001
```

**Success `200`:**
```json
{
  "message": "Successfully generated mqtt credentials",
  "mqttCredentials": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "25m"
  }
}
```

**Error Responses:**
```json
{ "message": "Invalid Device ID" }               // 400 — bad ObjectId format
{ "message": "Device doesn't exist, Invalid Id" } // 400 — not found / not provisioned
```

**How to use:**
```js
mqtt.connect('ws://iot-host:8083', {
  username: 'FrontendClient', // fixed string for all browser clients
  password: token,            // JWT from this API
  clientId: `kiosk_${Math.random().toString(16).substr(2, 8)}`,
})
```

Token expires in 25 min → re-fetch every 20 min and reconnect.

---

### 2.5 Complete Boot State Machine

```
App Boots
    │
    ▼
POST /api/device/wake-up  (IoT service)
    │
    ├─ 400/500 ──────────────────► [ERROR SCREEN] retry after 5s
    │
    ├─ isProvisioned: false
    │       │
    │       ▼
    │   [QR SCREEN] — show serialNumber as QR code
    │   Poll POST /api/device/wake-up every 10s
    │       │
    │       └─ isProvisioned: true ───────────────────────────────┐
    │                                                              │
    └─ isProvisioned: true ────────────────────────────────────────┤
                                                                   │
                                                                   ▼
                                                  Save to localStorage:
                                                  - deviceVID  (= machine_id)
                                                  - kioskBrowserURL
                                                  - mqttConfig  (Phase 2)
                                                                   │
                                                                   ▼
                                                          [CATALOG SCREEN]
                                                       GET /api/public/catalog/:deviceVID
                                                                   │
                                                   (Phase 2 — MQTT)
                                                   GET /api/device/connect/:deviceVID
                                                   → JWT token → MQTT connect
```

---

## 3. M9Vends REST API (Catalog & Orders)

**Base URL (dev):** `http://localhost:5000`  
**All endpoints:** No Authorization header required  
**Content-Type:** `application/json`

---

### 3.1 Get Machine Catalog (`GET /api/public/catalog/:machine_id`)

Fetch all active products for a machine. Use `deviceVID` as `:machine_id`.

```http
GET /api/public/catalog/60d5ec49f3e4e9001f3b2e99
```

**Success `200`:**
```json
{
  "success": true,
  "machine_id": "60d5ec49f3e4e9001f3b2e99",
  "catalog": [
    {
      "catalog_id": "64f1a2b3c4d5e6f7a8b9c0d1",
      "product_id": "64f1a2b3c4d5e6f7a8b9c0d2",
      "product_name": "Masala Pani Puri",
      "description": "Tangy street-style pani puri with mint water",
      "image_url": "https://example.com/pani-puri.jpg",
      "price": 25,
      "stock": 48,
      "slot_label": "A1"
    },
    {
      "catalog_id": "64f1a2b3c4d5e6f7a8b9c0d3",
      "product_id": "64f1a2b3c4d5e6f7a8b9c0d4",
      "product_name": "Mango Lassi",
      "description": null,
      "image_url": null,
      "price": 40,
      "stock": 0,
      "slot_label": "B2"
    }
  ]
}
```

**Field notes:**
- `price` = machine-level price override if set, otherwise product base price
- `stock === 0` → disable Add to Cart button
- `image_url` can be `null` → show placeholder
- `slot_label` can be `null`
- Only `is_enabled: true` + `is_available: true` products are returned
- Response does **NOT** include `machine_name` or `location` (no Device model in SaaS backend)

**Error Responses:**
```json
{ "success": false, "message": "Machine ID is required" }         // 400
{ "success": false, "message": "Machine '...' not found" }        // 404 — no catalog entries
```

**When to call:**
- On app startup after provisioning
- When customer taps "Start Shopping"
- On session restart

---

### 3.2 Place Order (`POST /api/public/order`)

Creates an order. For UPI payments returns a Razorpay QR link. For cash payments skips Razorpay entirely.

```http
POST /api/public/order
Content-Type: application/json
```

**Request:**
```json
{
  "machine_id": "60d5ec49f3e4e9001f3b2e99",
  "items": [
    { "catalog_id": "64f1a2b3c4d5e6f7a8b9c0d1", "quantity": 2 },
    { "catalog_id": "64f1a2b3c4d5e6f7a8b9c0d3", "quantity": 1 }
  ]
}
```

- `machine_id` = `deviceVID` from IoT backend
- `catalog_id` = from catalog response (NOT `product_id`)
- `quantity` = integer ≥ 1

**Success `201`:**
```json
{
  "success": true,
  "data": {
    "order_id": "64f9a1b2c3d4e5f6a7b8c9d0",
    "razorpay_order_id": "order_NeFKQJQhA1ZWGb",
    "total_amount": 90,
    "currency": "INR",
    "payment_link": "upi://pay?pa=MERCHANT_UPI_ID&pn=M9Vends&tr=order_NeFKQJQhA1ZWGb&am=90&cu=INR",
    "items": [
      {
        "catalog_id": "64f1a2b3c4d5e6f7a8b9c0d1",
        "product_id": "64f1a2b3c4d5e6f7a8b9c0d2",
        "product_name": "Masala Pani Puri",
        "quantity": 2,
        "unit_price": 25,
        "subtotal": 50
      },
      {
        "catalog_id": "64f1a2b3c4d5e6f7a8b9c0d3",
        "product_id": "64f1a2b3c4d5e6f7a8b9c0d4",
        "product_name": "Mango Lassi",
        "quantity": 1,
        "unit_price": 40,
        "subtotal": 40
      }
    ]
  }
}
```

**Render `payment_link` as QR:**
```jsx
import { QRCodeSVG } from 'qrcode.react'

<QRCodeSVG
  value={data.payment_link}
  size={280}
  bgColor="#000000"
  fgColor="#ffffff"
  level="M"
/>
```

**Error Responses:**
```json
{ "success": false, "message": "Catalog item '64f...' not found or disabled" }      // 400
{ "success": false, "message": "'Mango Lassi' is not available" }                    // 400
{ "success": false, "message": "Insufficient stock for 'Masala Pani Puri'. Available: 3" } // 400
{ "success": false, "message": "Order cannot be created: company information missing from catalog" } // 400
```

**After calling this:**
- Store `order_id` in state
- Start polling `GET /api/public/order/:id/status` every 3s
- Start 3-minute UPI countdown timer

---

### 3.3 Poll Order Status (`GET /api/public/order/:id/status`)

Poll every 3 seconds after placing an order.

```http
GET /api/public/order/64f9a1b2c3d4e5f6a7b8c9d0/status
```

**Success `200`:**
```json
{
  "success": true,
  "order_id": "64f9a1b2c3d4e5f6a7b8c9d0",
  "payment_status": "PENDING",
  "order_status": "PLACED",
  "total_amount": 90,
  "paid_at": null
}
```

**`payment_status` values:**

| Value | Meaning | Kiosk Action |
|---|---|---|
| `"PENDING"` | Awaiting payment | Keep polling |
| `"PAID"` | Payment confirmed ✅ | Stop polling → Success screen |
| `"FAILED"` | Payment failed ❌ | Stop polling → Failed screen |
| `"REFUNDED"` | Payment refunded | Stop polling → show message |

**`order_status` values:**

| Value | Meaning |
|---|---|
| `"PLACED"` | Created, awaiting payment |
| `"DISPENSING"` | Paid, machine dispensing |
| `"COMPLETED"` | Items dispensed |
| `"CANCELLED"` | Order cancelled |

**Polling example:**
```js
const startPolling = (orderId) => {
  const interval = setInterval(async () => {
    try {
      const res = await fetch(`/api/public/order/${orderId}/status`)
      const data = await res.json()
      if (data.payment_status === 'PAID') {
        clearInterval(interval)
        navigateTo('success')
      } else if (data.payment_status === 'FAILED') {
        clearInterval(interval)
        navigateTo('failed')
      }
    } catch (e) {
      // Network error — keep retrying
    }
  }, 3000)
  return interval
}
```

**Error `404`:**
```json
{ "success": false, "message": "Order not Found" }
```

---

### 3.4 Cancel Order (`POST /api/public/order/:id/cancel`)

> Call this when the UPI countdown timer expires or the customer presses Cancel.

```http
POST /api/public/order/64f9a1b2c3d4e5f6a7b8c9d0/cancel
```
```json
{ "success": true, "message": "Order cancelled successfully" }
```

---

### 3.5 Cash Payment (`payment_method: "CASH"`)

> The `Order` model has a `payment_method` field (`"UPI" | "CASH" | "CARD" | "WALLET"`). `placeOrder` now accepts `payment_method` and skips Razorpay for cash orders.

**Cash request:**
```json
{
  "machine_id": "60d5ec49f3e4e9001f3b2e99",
  "payment_method": "CASH",
  "items": [
    { "catalog_id": "64f1a2b3c4d5e6f7a8b9c0d1", "quantity": 1 }
  ]
}
```

**Cash Response:**
```json
{
  "success": true,
  "data": {
    "order_id": "64f9a1b2c3d4e5f6a7b8c9d0",
    "total_amount": 25,
    "payment_method": "CASH",
    "items": [...]
  }
}
```

Admin confirms cash from the Admin Dashboard → `payment_status` becomes `"PAID"` → polling detects it → Success screen.

---

### 3.6 Razorpay Webhook (Backend Only)

> 🚫 Frontend does NOT call this. Razorpay calls it automatically.

```http
POST /api/public/order/webhook
```

Razorpay sends `payment.captured` event → backend verifies HMAC signature → marks order `PAID` + `DISPENSING` → your polling detects it.

---

## 4. IoT / MQTT Real-Time Integration

### 4.1 Architecture & Protocol

- **Protocol:** WebSockets — `ws://` port `8083` (or `wss://` port `8084` for TLS)
- **Auth:** JWT token from `GET /api/device/connect/:deviceVID` as MQTT password
- **Username:** Always the fixed string `"FrontendClient"` for browser clients

---

### 4.2 Topic Architecture

All topics are prefixed by `deviceVID`:

```
device/
└── <deviceVID>/
    ├── status      ← Subscribe: "online" | "offline"
    ├── telemetry   ← Subscribe: JSON telemetry or alert strings
    └── commands    ← Publish:   { "message": "<commandName>" }
```

---

### 4.3 Telemetry Payloads & Parsing

Two formats arrive on `device/<deviceVID>/telemetry`:

**Format 1 — Normal JSON telemetry:**
```json
{
  "Steering Motor Temperature": 28,
  "Tank Levels": [25, 50, 40, 10],
  "Steering Motor": true,
  "Current Sensor": 250
}
```

| Field | Type | Notes |
|---|---|---|
| `Steering Motor Temperature` | number | °C |
| `Tank Levels` | number[4] | % fill — 4 tanks |
| `Steering Motor` | boolean | `true` = running |
| `Current Sensor` | number | mA |

**Format 2 — Alert strings (plain text):**
```
"Device(Arduino) Not Connected"
"Anomaly Detected"
```

**Safe parsing:**
```js
client.on('message', (topic, payload) => {
  const raw = payload.toString()

  if (topic === `device/${deviceVID}/telemetry`) {
    if (raw === 'Device(Arduino) Not Connected') { setHardwareAlert(raw); return }
    if (raw === 'Anomaly Detected')              { setAnomalyAlert(true); return }
    try {
      setTelemetry(JSON.parse(raw))
    } catch { /* ignore unknown format */ }
  }
})
```

---

### 4.4 Dispatching Commands

Publish to `device/<deviceVID>/commands`:

```json
{ "message": "getDataFromHardware" }
```
```json
{ "message": "toggleSteeringMotor" }
```

---

### 4.5 React Hook (`useMqtt.js`)

```js
import { useEffect, useState, useRef, useCallback } from 'react'
import mqtt from 'mqtt'

export function useMqtt({ deviceVID, iotApiUrl, brokerUrl }) {
  const [status, setStatus]               = useState('disconnected')
  const [deviceOnline, setDeviceOnline]   = useState(false)
  const [telemetry, setTelemetry]         = useState(null)
  const [hardwareAlert, setHardwareAlert] = useState(null)
  const [anomalyAlert, setAnomalyAlert]   = useState(false)

  const clientRef = useRef(null)
  const timerRef  = useRef(null)

  const getToken = useCallback(async () => {
    const res  = await fetch(`${iotApiUrl}/api/device/connect/${deviceVID}`)
    const data = await res.json()
    return data.mqttCredentials?.token ?? null
  }, [deviceVID, iotApiUrl])

  const connect = useCallback(async () => {
    if (!deviceVID) return
    setStatus('connecting')

    const token = await getToken()
    if (!token) { setStatus('error'); return }

    if (clientRef.current) clientRef.current.end(true)

    const client = mqtt.connect(brokerUrl, {
      username:        'FrontendClient',
      password:        token,
      clientId:        `kiosk_${Math.random().toString(16).substr(2, 8)}`,
      keepalive:       60,
      reconnectPeriod: 5000,
    })

    client.on('connect', () => {
      setStatus('connected')
      client.subscribe([
        `device/${deviceVID}/status`,
        `device/${deviceVID}/telemetry`,
      ])
    })

    client.on('message', (topic, payload) => {
      const raw = payload.toString()
      if (topic === `device/${deviceVID}/status`) {
        setDeviceOnline(raw === 'online')
        return
      }
      if (topic === `device/${deviceVID}/telemetry`) {
        if (raw === 'Device(Arduino) Not Connected') { setHardwareAlert(raw); return }
        if (raw === 'Anomaly Detected')              { setAnomalyAlert(true); return }
        try { setTelemetry(JSON.parse(raw)); setHardwareAlert(null) }
        catch { /* ignore */ }
      }
    })

    client.on('error', () => setStatus('error'))
    client.on('close', () => setStatus('disconnected'))
    clientRef.current = client

    // Refresh token 5 min before it expires (25min - 5min = 20min)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(connect, 20 * 60 * 1000)
  }, [deviceVID, brokerUrl, getToken])

  const sendCommand = useCallback((cmd) => {
    if (!clientRef.current || status !== 'connected') return
    clientRef.current.publish(
      `device/${deviceVID}/commands`,
      JSON.stringify({ message: cmd }),
      { qos: 1 }
    )
  }, [deviceVID, status])

  useEffect(() => {
    connect()
    return () => {
      if (timerRef.current)  clearTimeout(timerRef.current)
      if (clientRef.current) clientRef.current.end(true)
    }
  }, [connect])

  return {
    mqttStatus: status,       // 'disconnected' | 'connecting' | 'connected' | 'error'
    deviceOnline,             // boolean
    telemetry,                // JSON object or null
    hardwareAlert,            // string or null
    anomalyAlert,             // boolean
    clearAnomaly: () => setAnomalyAlert(false),
    sendCommand,              // fn(cmd: string)
  }
}
```

---

## 5. Data Models Reference

### Catalog Item (from `GET /api/public/catalog/:machine_id`)

```typescript
interface CatalogItem {
  catalog_id:   string         // use this in order items — NOT product_id
  product_id:   string         // base product ObjectId
  product_name: string
  description:  string | null
  image_url:    string | null  // null → show placeholder
  price:        number         // INR (override if set, else base price)
  stock:        number         // 0 = out of stock
  slot_label:   string | null  // e.g. "A1", "B3"
}
```

### Order Status (from `GET /api/public/order/:id/status`)

```typescript
interface OrderStatus {
  success:        boolean
  order_id:       string
  payment_status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'
  order_status:   'PLACED' | 'DISPENSING' | 'COMPLETED' | 'CANCELLED'
  total_amount:   number        // INR
  paid_at:        string | null // ISO date string
}
```

---

## 6. Payment Flow Guide

### UPI Flow
```
1. Customer confirms cart
2. POST /api/public/order  { machine_id, items }
3. Backend creates Razorpay order → returns payment_link
4. Render QR code from payment_link
5. Start 3-minute countdown + poll /order/:id/status every 3s
6a. payment_status === 'PAID'   → Success screen
6b. Timer hits 00:00            → POST /api/public/order/:id/cancel → Timeout screen
6c. payment_status === 'FAILED' → Failed screen
```

### Cash Flow
```
1. Customer selects Cash
2. POST /api/public/order  { machine_id, items, payment_method: 'CASH' }
3. Backend returns order_id + total_amount (no QR)
4. Show Order ID on screen — customer hands cash to attendant
5. Start 10-minute countdown + poll /order/:id/status every 3s
6a. Admin confirms in Dashboard → payment_status = 'PAID' → Success
6b. Timer hits 00:00 → Cancel order → Timeout screen
```

---

## 7. Error Handling

### HTTP Error Shape
```json
{
  "success": false,
  "message": "Human-readable error"
}
```

### Error Strategy

| Scenario | Response | Kiosk Action |
|---|---|---|
| Missing `machine_id` | `400` | Should never happen — kiosk always has deviceVID from boot |
| No catalog entries | `catalog: []` (200) | Display "Nothing available right now" |
| Out of stock | `stock: 0` in catalog | Disable Add button — no order needed |
| Order stock error | `400` | Toast with message — user adjusts cart |
| Network error on poll | Fetch throws | Keep retrying — show "Verifying payment..." |
| Order not found on poll | `404` | Stop polling → Failed screen |

---

## 8. Backend Changes Checklist

Share with backend developer:

| # | Change | Priority | File |
|---|---|---|---|
| 1 | `POST /api/public/order/:id/cancel` — cancel PENDING order | ✅ Done | `orderRoutes.js`, `orderController.js`, `orderService.js` |
| 2 | `POST /api/public/order` — accept `payment_method: "CASH"`, skip Razorpay for cash | ✅ Done | `orderService.js`, `orderController.js` |

---

## 9. Kiosk Environment Setup

### `.env` file

```bash
# Hardware serial number (burned in / per-device)
VITE_SERIAL_NUMBER=SN-M9V-4820

# M9Vends SaaS Backend REST URL
VITE_API_URL=http://localhost:5000

# IoT Backend REST URL (wake-up, provision, connect)
VITE_IOT_API_URL=http://localhost:3001

# IoT MQTT WebSocket URL (for browser MQTT)
VITE_MQTT_BROKER_URL=ws://localhost:8083

# Timeouts (ms)
VITE_UPI_TIMEOUT_MS=180000     # 3 minutes
VITE_CASH_TIMEOUT_MS=600000    # 10 minutes
VITE_IDLE_TIMEOUT_MS=120000    # 2 minutes idle → attract screen
VITE_POLL_INTERVAL_MS=3000     # order status poll interval
```

### `vite.config.js`

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api/public':  { target: 'http://localhost:5000', changeOrigin: true },
      '/api/device':  { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
})
```

### Install dependencies
```bash
npm install axios zustand qrcode.react react-hot-toast mqtt
```

---

## Quick Reference

```
─── M9Vends REST (:5000) ─────────────────────────────────────────────
GET  /api/public/catalog/:deviceVID       → product list
POST /api/public/order                    → place order + UPI QR link
GET  /api/public/order/:id/status         → poll payment status
POST /api/public/order/:id/cancel         → cancel PENDING order
POST /api/public/order/webhook            → Razorpay only (no frontend)

─── IoT Service (:3001) ──────────────────────────────────────────────
POST /api/device/wake-up                  → boot registration
POST /api/device/provision                → admin app only
GET  /api/device/connect/:deviceVID       → MQTT JWT token

─── MQTT (:8083 WebSocket) ───────────────────────────────────────────
SUB  device/<deviceVID>/status            → "online" | "offline"
SUB  device/<deviceVID>/telemetry         → JSON or alert string
PUB  device/<deviceVID>/commands          → { "message": "cmd" }

─── machine_id = deviceVID ───────────────────────────────────────────
Same value. Lowercase hex from IoT backend. No uppercase normalization.
```
