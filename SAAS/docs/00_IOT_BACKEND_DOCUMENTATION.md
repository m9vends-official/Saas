# M9Vends IoT Backend — Full Documentation

> **Service:** M9Vends IoT Backend Service
> **Deployment:** `https://m9vends-iot-backend-service.onrender.com` (production)
> **Local Dev:** `http://localhost:3001`
> **MQTT Broker:** `<YOUR_MQTT_BROKER_HOST>` (AWS Sydney)
> **Last Updated:** October 2026

---

## Table of Contents

1. [Overview & Role in the System](#1-overview--role-in-the-system)
2. [Service Architecture](#2-service-architecture)
3. [Base URLs & Ports](#3-base-urls--ports)
4. [REST API Reference](#4-rest-api-reference)
   - [4.1 Wake-up API](#41-wake-up-api-post-apidevicewake-up)
   - [4.2 Provisioning API](#42-provisioning-api-post-apideviceprovision)
   - [4.3 Connect API — MQTT Credentials](#43-connect-api-mqtt-credentials-get-apideviceconnectid)
   - [4.4 Get Device by VID](#44-get-device-by-vid-get-apidevicedevicevid)
   - [4.5 Get Devices by User](#45-get-devices-by-user-get-apideviceuseruserid)
   - [4.6 Send Command to Device](#46-send-command-to-device-post-apidevicevidcommands)
5. [MQTT Broker Reference](#5-mqtt-broker-reference)
   - [5.1 Broker Details & Access Tiers](#51-broker-details--access-tiers)
   - [5.2 Topic Architecture](#52-topic-architecture)
   - [5.3 Telemetry Payload Formats](#53-telemetry-payload-formats)
   - [5.4 Alert Payload Formats](#54-alert-payload-formats)
   - [5.5 Command Payloads](#55-command-payloads)
6. [Device Identity System](#6-device-identity-system)
7. [Device Boot State Machine](#7-device-boot-state-machine)
8. [Integration Points with SaaS Backend](#8-integration-points-with-saas-backend)
9. [Integration Points with Kiosk Frontend](#9-integration-points-with-kiosk-frontend)
10. [Integration Points with Admin Panel](#10-integration-points-with-admin-panel)
11. [Error Reference](#11-error-reference)

---

## 1. Overview & Role in the System

The IoT Backend is a **separate, independently deployed service** that acts as the bridge between the physical vending machines and the rest of the M9Vends platform. It is responsible for:

- **Device Registration** — assigning a permanent unique ID (`deviceVID`) to each physical machine
- **Provisioning** — linking a machine to a company owner (admin user)
- **MQTT Brokering** — receiving real-time sensor data from machines and forwarding commands back
- **MQTT Token Issuance** — generating short-lived JWTs for browser clients to connect to the MQTT broker

The SaaS backend **never directly reads hardware data** — it proxies all device management through this IoT service and subscribes to the same MQTT broker server-side.

```
Physical Machine (Arduino + IoT unit)
       │
       │ MQTT over TCP :1883 (device credentials)
       ▼
 MQTT Broker (<YOUR_MQTT_BROKER_HOST>)
       │
       ├──────────────────────────────────────────────────────────┐
       │ device/+/telemetry, device/+/status                      │
       ▼                                                          ▼
SaaS Backend mqttService.js                          Admin Panel (Phase 2)
  (admin MQTT credentials)                         (browser WebSocket :8083)
  Relays → Socket.IO to admin panels               (short-lived JWT token)
       │
       │ IoT REST API calls
       ▼
 IoT Backend Service :3001
  - Device DB (MongoDB)
  - Provisioning logic
  - JWT token generation
```

---

## 2. Service Architecture

```
IoT Backend Service
├── Device Registry (MongoDB)
│   ├── Device documents: serialNumber, deviceVID, owner (userID), isProvisioned
│   └── Component lists: sensors, actuators, tanks
├── REST API
│   ├── /api/device/wake-up        ← Called by every kiosk on boot
│   ├── /api/device/provision      ← Called by admin to link machine to account
│   ├── /api/device/connect/:id    ← Returns MQTT JWT token for browser clients
│   ├── /api/device/device/:vid    ← Get device info by VID
│   └── /api/device/user/:userID   ← Get all devices owned by a user
└── MQTT Broker Connection
    └── Routes device/+/commands from SaaS backend → physical device
```

---

## 3. Base URLs & Ports

| Environment | Base URL | Notes |
|---|---|---|
| **Production** | `https://m9vends-iot-backend-service.onrender.com` | Render free tier — may sleep after 15 min inactivity |
| **Local Dev** | `http://localhost:3001` | Run alongside SaaS backend |
| **MQTT TCP** | `mqtt://<YOUR_MQTT_BROKER_HOST>:1883` | For devices and SaaS backend (admin credentials) |
| **MQTT WebSocket** | `ws://<YOUR_MQTT_BROKER_HOST>:8083` | For browser clients (JWT token from connect API) |
| **MQTT WebSocket TLS** | `wss://<YOUR_MQTT_BROKER_HOST>:8084` | Production browser clients |

> ⚠️ **Render free tier cold-start:** If the IoT service hasn't received a request in 15 minutes, the first request will take 30–60 seconds to wake up. The kiosk `BootScreen` should handle this with a retry loop.

---

## 4. REST API Reference

> **Base URL (prod):** `https://m9vends-iot-backend-service.onrender.com`
> **Content-Type:** `application/json`
> **Auth:** None required for kiosk-facing endpoints

---

### 4.1 Wake-up API (`POST /api/device/wake-up`)

**Called by:** Kiosk frontend on every boot.

This is the **first call** made by every kiosk. It either registers a new device or wakes up an existing one. The response drives the entire boot flow.

**Request:**
```http
POST /api/device/wake-up
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
    { "id": 1, "catagory": "sensor",   "name": "Temperature Sensor", "type": "sensor" },
    { "id": 2, "catagory": "tank",     "name": "Tank 1",              "type": "sensor" },
    { "id": 3, "catagory": "motor",    "name": "Steering Motor",      "type": "accutator" },
    { "id": 4, "catagory": "sensor",   "name": "Current Sensor",      "type": "sensor" }
  ]
}
```

**Request Fields:**

| Field | Required | Description |
|---|---|---|
| `serialNumber` | ✅ | Hardware serial — the **only hardcoded identifier** on the device |
| `model` | ✅ | Device model name (e.g. `"M9-Vending-Pro"`) |
| `mac` | ❌ | MAC address of the device |
| `ip` | ❌ | Current IP address |
| `status` | ❌ | `"online"` or `"offline"` |
| `components` | ❌ | Array of attached sensors/actuators (see structure below) |

**Component Object Structure:**

| Field | Type | Notes |
|---|---|---|
| `id` | number | Unique ID within this device |
| `catagory` | string | `"sensor"`, `"tank"`, `"motor"`, `"accutator"` (note the typo in the IoT backend — intentional) |
| `name` | string | Human-readable name for display in admin panel |
| `type` | string | `"sensor"` or `"accutator"` |

> ⚠️ `"catagory"` is intentionally misspelled in the IoT backend API. Use this exact spelling when parsing device data.

---

**Response — Case 1: Device not yet provisioned (new or unlinked)**

```json
{
  "message": "Created New Device",
  "deviceVID": "60d5ec49f3e4e9001f3b2e99",
  "mqtt": {
    "url": "<YOUR_MQTT_BROKER_HOST>",
    "port": 1883,
    "username": "<DEVICE_MQTT_USERNAME>",
    "password": "<DEVICE_MQTT_PASSWORD>"
  },
  "topics": {
    "pub": ["telemetry", "status"],
    "sub": ["commands"]
  },
  "isProvisioned": false
}
```

**Kiosk action:** Store `deviceVID`. Show **Provision Screen** (QR code). Poll every 10 seconds.

---

**Response — Case 2: Device provisioned ✅**

```json
{
  "message": "Wakeup Existing Device",
  "deviceVID": "60d5ec49f3e4e9001f3b2e99",
  "mqtt": {
    "url": "<YOUR_MQTT_BROKER_HOST>",
    "port": 1883,
    "username": "<DEVICE_MQTT_USERNAME>",
    "password": "<DEVICE_MQTT_PASSWORD>"
  },
  "topics": {
    "pub": ["telemetry", "status"],
    "sub": ["commands"]
  },
  "isProvisioned": true,
  "kioskBrowserURL": "https://kiosk.m9vends.com/60d5ec49f3e4e9001f3b2e99"
}
```

**Kiosk action:** Save `deviceVID` (= `machine_id` for all SaaS REST calls). Load **Catalog Screen**.

---

**What to persist after every wake-up:**
```js
// Save to localStorage (for reconnection resilience)
localStorage.setItem('m9v_device', JSON.stringify({
  deviceVID:       response.deviceVID,       // CRITICAL — this IS machine_id for SaaS API
  isProvisioned:   response.isProvisioned,
  kioskBrowserURL: response.kioskBrowserURL,
  mqttConfig:      response.mqtt,            // For Phase 2 MQTT connection
}))
```

**Errors:**
```json
{ "message": "Bad Request" }          // 400 — missing/empty body
{ "message": "Something Went Wrong" } // 500 — missing serialNumber/model or DB error
```

---

### 4.2 Provisioning API (`POST /api/device/provision`)

**Called by:** Admin Panel (when scanning the kiosk QR code). **NOT called by the kiosk.**

Links a physical machine (identified by serial number) to a company admin account (identified by `userID`).

**Request:**
```http
POST /api/device/provision
Content-Type: application/json
```

```json
{
  "serialNumber": "SN-M9V-4820",
  "userID": "60d5ec49f3e4e9001f3b2e75"
}
```

| Field | Required | Description |
|---|---|---|
| `serialNumber` | ✅ | Hardware serial (from QR code scan) |
| `userID` | ✅ | The admin's MongoDB user ID (from JWT payload `user_id`) |

**Success `200`:**
```json
{
  "vid": "60d5ec49f3e4e9001f3b2e99",
  "message": "Provisioning Successful"
}
```

> ⚠️ **Response field is `vid`, NOT `deviceVID`.** This differs from the wake-up response. Always extract `response.vid` here.

**The SaaS backend proxies this call:**
```
Admin Panel → POST /api/admin/machines/provision { serialNumber }
           → SaaS Backend machineService.js
           → POST [IoT] /api/device/provision { serialNumber, userID: req.user.user_id }
           → returns { vid, message }
```

**Error Responses:**
```json
{ "message": "Bad Request" }                                         // 400 — missing fields
{ "message": "Invalid User ID" }                                     // 400 — bad ObjectId format
{ "message": "User Not Found" }                                      // 400 — user doesn't exist in IoT DB
{ "message": "Device Not Configured" }                               // 400 — serialNumber not in IoT DB
{ "message": "Device Already Owned" }                                // 400 — already provisioned to another user
{ "message": "Couldn't Reach Device, Please try restarting it..." } // 500 — network/device offline
```

---

### 4.3 Connect API — MQTT Credentials (`GET /api/device/connect/:id`)

**Called by:** Kiosk frontend (Phase 2) and optionally Admin Panel browser clients.

Returns a **short-lived JWT token** (25 min) that allows a browser MQTT WebSocket client to connect to the broker. This is separate from the hardware MQTT credentials returned by wake-up.

**Request:**
```http
GET /api/device/connect/60d5ec49f3e4e9001f3b2e99
```

| Param | Description |
|---|---|
| `:id` | The `deviceVID` (MongoDB ObjectId string) |

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

**How to use the token:**
```js
import mqtt from 'mqtt'

const client = mqtt.connect('ws://<YOUR_MQTT_BROKER_HOST>:8083', {
  username: 'FrontendClient',   // Fixed string — all browser clients use this
  password: token,              // JWT from this API
  clientId: `kiosk_${Math.random().toString(16).substr(2, 8)}`,
  keepalive: 60,
  reconnectPeriod: 5000,
})
```

**Token Lifecycle:**
- Expires: **25 minutes**
- Recommended refresh: **every 20 minutes** (5-minute buffer before expiry)
- On refresh: disconnect current MQTT client, reconnect with new token

**Error Responses:**
```json
{ "message": "Invalid Device ID" }               // 400 — bad ObjectId format
{ "message": "Device doesn't exist, Invalid Id" } // 400 — not found / not provisioned
```

---

### 4.4 Get Device by VID (`GET /api/device/device/:vid`)

**Called by:** SaaS Backend (proxied to `/api/admin/machines/:machine_id`).

Returns full device information including component list.

**Request:**
```http
GET /api/device/device/60d5ec49f3e4e9001f3b2e99
```

**Success `200`:**
```json
{
  "device": {
    "_id": "60d5ec49f3e4e9001f3b2e99",
    "serialNumber": "SN-M9V-4820",
    "model": "M9-Vending-Pro",
    "mac": "00:1A:2B:3C:4D:5E",
    "ip": "192.168.1.55",
    "status": "online",
    "isProvisioned": true,
    "owner": "60d5ec49f3e4e9001f3b2e75",
    "components": [
      { "id": 1, "catagory": "sensor", "name": "Temperature Sensor", "type": "sensor" },
      { "id": 2, "catagory": "tank",   "name": "Tank 1",              "type": "sensor" },
      { "id": 3, "catagory": "motor",  "name": "Steering Motor",      "type": "accutator" },
      { "id": 4, "catagory": "sensor", "name": "Current Sensor",      "type": "sensor" }
    ],
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-10-17T00:00:00.000Z"
  }
}
```

The SaaS backend **enriches** this response with live telemetry from the MQTT cache before returning it to the admin panel:
```json
{
  ...device,
  "latestTelemetry": { "Steering Motor Temperature": 28, "Tank Levels": [25, 50, 40, 10] },
  "telemetryAt": "2026-10-17T12:34:56.000Z"
}
```

---

### 4.5 Get Devices by User (`GET /api/device/user/:userID`)

**Called by:** SaaS Backend (inside `getMachines()` for ADMIN role).

Returns all devices owned by a specific user (company admin).

**Request:**
```http
GET /api/device/user/60d5ec49f3e4e9001f3b2e75
```

**Success `200`:**
```json
{
  "device": [
    { "_id": "60d5ec49f3e4e9001f3b2e99", "serialNumber": "SN-M9V-4820", ... },
    { "_id": "60d5ec49f3e4e9001f3b2eAA", "serialNumber": "SN-M9V-4821", ... }
  ],
  "message": "Devices Found"
}
```

> ⚠️ Response key is `device` (array), not `devices`. Check for this when parsing.

**For SUPER_ADMIN:** The SaaS backend fetches all admin users from MongoDB, then calls `GET /api/device/user/:userId` for each admin in parallel, flattens and deduplicates the results.

---

### 4.6 Send Command to Device (`POST /api/device/:vid/commands`)

**Called by:** SaaS Backend (proxied from `/api/admin/machines/:machine_id/commands`).

Publishes a command message to the device's MQTT `commands` topic.

**Request:**
```http
POST /api/device/60d5ec49f3e4e9001f3b2e99/commands
Content-Type: application/json
```

```json
{ "message": "getDataFromHardware" }
```

**Available Commands:**

| Command | Effect |
|---|---|
| `"getDataFromHardware"` | Requests immediate telemetry snapshot from Arduino |
| `"toggleSteeringMotor"` | Toggles the steering motor ON ↔ OFF |

**Success `200`:**
```json
{ "message": "Command sent successfully" }
```

---

## 5. MQTT Broker Reference

### 5.1 Broker Details & Access Tiers

The MQTT broker runs on an AWS EC2 instance in Sydney (`<YOUR_MQTT_BROKER_HOST>`).

**Three credential tiers exist:**

| Tier | Username | Password | Used By | Port |
|---|---|---|---|---|
| **Device** | `<DEVICE_MQTT_USERNAME>` | `<DEVICE_MQTT_PASSWORD>` | Physical vending machines (Arduino/IoT unit) | `1883` (TCP) |
| **Admin** | `<ADMIN_MQTT_USERNAME>` | `<ADMIN_MQTT_PASSWORD>` | SaaS Backend `mqttService.js` (server-side only) | `1883` (TCP) |
| **Browser** | `FrontendClient` | JWT token (from `/api/device/connect/:id`) | Kiosk React app, Admin Panel browser | `8083` (WS), `8084` (WSS) |

> ⚠️ **Admin and Device credentials NEVER go into browser code.** The SaaS backend uses admin credentials server-side. Browsers always use the short-lived JWT token from the Connect API.

---

### 5.2 Topic Architecture

All topics are namespaced by `deviceVID`:

```
device/
└── <deviceVID>/
    ├── telemetry   ← Machine PUBLISHES (sensor data or alert string) — 1 Hz
    ├── status      ← Machine PUBLISHES ("online" | "offline")
    └── commands    ← SaaS backend/admin PUBLISHES → Machine subscribes
```

**SaaS Backend Wildcard Subscriptions (admin credentials):**
```
device/+/telemetry    ← All machines' telemetry
device/+/status       ← All machines' online/offline events
```

The `+` wildcard means the SaaS backend receives data from ALL machines, then routes to the correct company room via Socket.IO by looking up the `company_id` for each `deviceVID`.

**Kiosk Browser Subscriptions (JWT token, per-device):**
```
device/<deviceVID>/status     ← Only this machine's status
device/<deviceVID>/telemetry  ← Only this machine's sensor data
```

**Admin Panel Browser Subscriptions (via Socket.IO relay — NOT direct MQTT):**
Admin panel receives MQTT data relayed through the SaaS backend Socket.IO events — it does NOT connect to MQTT directly.

---

### 5.3 Telemetry Payload Formats

The machine publishes telemetry to `device/<deviceVID>/telemetry` approximately once per second.

**Format 1 — Normal JSON (most messages):**
```json
{
  "Steering Motor Temperature": 28,
  "Tank Levels": [25, 50, 40, 10],
  "Steering Motor": true,
  "Current Sensor": 250
}
```

| Field | Type | Unit | Description |
|---|---|---|---|
| `Steering Motor Temperature` | `number` | °C | Current motor temperature |
| `Tank Levels` | `number[]` | % fill (0–100) | Fill level of each tank. Array length = number of tanks in `components[]` |
| `Steering Motor` | `boolean` | — | `true` = running, `false` = idle/stopped |
| `Current Sensor` | `number` | mA | Motor current draw |

**Admin Panel Widget Thresholds:**

| Metric | Threshold | Color | Alert |
|---|---|---|---|
| Motor Temperature | < 50°C | 🟢 Green | None |
| Motor Temperature | 50–70°C | 🟡 Amber | None |
| Motor Temperature | > 70°C | 🔴 Red | Warning toast |
| Tank Level | > 30% | 🟢 Green | None |
| Tank Level | 15–30% | 🟡 Amber | Sidebar badge |
| Tank Level | < 15% | 🔴 Red | `WARNING` alert |

---

### 5.4 Alert Payload Formats

**Format 2 — Alert Strings (plain text, not JSON):**

The machine publishes plain text strings to the `telemetry` topic when there's a hardware fault:

| String | Meaning | Severity | Admin Panel Response |
|---|---|---|---|
| `"Anomaly Detected"` | Hardware fault / out-of-range sensor reading | **CRITICAL** | Full-screen red banner + looping alarm |
| `"Device(Arduino) Not Connected"` | Arduino board disconnected from IoT unit | **HIGH** | Toast notification + orange machine badge |

**Safe payload parsing (ALWAYS check for strings before JSON.parse):**
```js
client.on('message', (topic, payload) => {
  const raw = payload.toString()

  if (topic.endsWith('/telemetry')) {
    // ALWAYS check strings FIRST — these are NOT valid JSON
    if (raw === 'Anomaly Detected')              { handleCriticalAlert(raw); return }
    if (raw === 'Device(Arduino) Not Connected') { handleHighAlert(raw);     return }

    // Only then attempt JSON parse
    try {
      const telemetry = JSON.parse(raw)
      updateTelemetryDisplay(telemetry)
    } catch (e) {
      // Unknown format — ignore silently
    }
  }

  if (topic.endsWith('/status')) {
    const isOnline = raw === 'online'
    updateMachineStatus(isOnline)
  }
})
```

---

### 5.5 Command Payloads

Published by the SaaS Backend to `device/<deviceVID>/commands`:

```json
{ "message": "getDataFromHardware" }
```
```json
{ "message": "toggleSteeringMotor" }
```

Commands are published with **QoS 1** (at-least-once delivery) to ensure the machine receives them even if temporarily disconnected.

---

## 6. Device Identity System

This is the single most critical concept for understanding how the system works:

| Identifier | Example Value | Source | Where Used |
|---|---|---|---|
| `serialNumber` | `SN-M9V-4820` | Burned into hardware / `.env` file | QR code on unprovisioned screen ONLY |
| `deviceVID` | `60d5ec49f3e4e9001f3b2e99` | Assigned by IoT backend at registration | MQTT topic paths, IoT REST API calls |
| `machine_id` | `60d5ec49f3e4e9001f3b2e99` | **Same value as `deviceVID`** | All SaaS backend REST API calls |
| `userID` (IoT) | `60d5ec49f3e4e9001f3b2e75` | Admin user's MongoDB `_id` | Links device to company in IoT backend |

### Rules:
1. `deviceVID` = `machine_id` — they are always the same lowercase hex string
2. `serialNumber` is the ONLY identifier stored in hardware — everything else comes from the IoT backend response
3. `deviceVID` is a MongoDB ObjectId string generated by the IoT backend's device registry
4. Once assigned, `deviceVID` never changes, even if the machine is re-provisioned

---

## 7. Device Boot State Machine

```
Kiosk Powers On
      │
      ├─ Read VITE_SERIAL_NUMBER from .env
      │
      ▼
POST /api/device/wake-up (IoT Service)
  { serialNumber, model, status: "online", components }
      │
      ├── 400/500 ─────────────────────────► [ERROR SCREEN]
      │                                       Retry after 5s
      │
      ├── isProvisioned: false
      │         │
      │         ▼
      │   [PROVISION SCREEN]
      │   Show serialNumber as QR code
      │   Poll POST /api/device/wake-up every 10s
      │         │
      │         └── isProvisioned: true ─────────────────────┐
      │                                                       │
      └── isProvisioned: true ───────────────────────────────┤
                                                             │
                                                             ▼
                                            Save deviceVID to localStorage
                                            (deviceVID = machine_id for SaaS API)
                                                             │
                                                             ▼
                                                    [IDLE SCREEN]
                                            GET /api/public/catalog/:deviceVID
                                                             │
                                               (Phase 2 — connect MQTT)
                                               GET /api/device/connect/:deviceVID
                                               → JWT token → MQTT WebSocket connect
                                               Subscribe device/<deviceVID>/telemetry
                                               Subscribe device/<deviceVID>/status
```

---

## 8. Integration Points with SaaS Backend

The SaaS backend communicates with the IoT service in two ways:

### 8.1 REST API Proxy (via `machineService.js`)

| SaaS Route | IoT API Called | Purpose |
|---|---|---|
| `GET /api/admin/machines` | `GET /api/device/user/:userId` | List all company machines |
| `GET /api/admin/machines/:id` | `GET /api/device/device/:vid` | Get single machine detail |
| `POST /api/admin/machines/provision` | `POST /api/device/provision` | Link machine to company |
| `POST /api/admin/machines/:id/commands` | `POST /api/device/:vid/commands` | Send hardware command |

The SaaS backend's Axios client for IoT calls:
```js
// machineService.js — IoT client
const getIotClient = () => axios.create({
  baseURL: process.env.IOT_API_BASE_URL,  // IoT backend URL
  timeout: 8000,
})
```

### 8.2 MQTT Subscription (via `mqttService.js`)

The SaaS backend connects to the MQTT broker using **admin credentials** and subscribes to all device topics:

```js
// mqttService.js
mqtt.connect(`mqtt://${MQTT_BROKER_HOST}:${MQTT_BROKER_TCP_PORT}`, {
  username: process.env.MQTT_ADMIN_USERNAME,
  password: process.env.MQTT_ADMIN_PASSWORD,
})

client.subscribe('device/+/telemetry')
client.subscribe('device/+/status')
```

When a telemetry message arrives:
1. Parse `deviceVID` from topic: `"device/60d5ec.../telemetry".split('/')[1]`
2. Cache it: `telemetryCache.set(deviceVID, { data, updatedAt })`
3. Look up `company_id` for this `deviceVID` (via MachineCatalog)
4. Emit to company room: `io.to(company_id).emit('machine:telemetry', { deviceVID, data })`

### 8.3 SaaS Backend `.env` Required for IoT Integration

```env
MQTT_BROKER_HOST=your-mqtt-broker-host
MQTT_BROKER_TCP_PORT=1883
MQTT_ADMIN_USERNAME=your_mqtt_admin_username
MQTT_ADMIN_PASSWORD=your_mqtt_admin_password
IOT_API_BASE_URL=https://m9vends-iot-backend-service.onrender.com
```

---

## 9. Integration Points with Kiosk Frontend

The kiosk communicates with the IoT service via:

### 9.1 REST (HTTP)

| API Call | When | Purpose |
|---|---|---|
| `POST /api/device/wake-up` | Every boot | Register/wake device, get `deviceVID` |
| `POST /api/device/wake-up` | Every 10s (unprovisioned) | Poll until `isProvisioned: true` |
| `GET /api/device/connect/:id` | After boot (Phase 2) | Get MQTT JWT token |

### 9.2 MQTT WebSocket (Phase 2)

```js
// Kiosk connects using short-lived JWT token
const token = await fetch(`${IOT_API_URL}/api/device/connect/${deviceVID}`)
               .then(r => r.json())
               .then(d => d.mqttCredentials.token)

const client = mqtt.connect(import.meta.env.VITE_MQTT_BROKER_URL || 'ws://<YOUR_MQTT_BROKER_HOST>:8083', {
  username: 'FrontendClient',   // Fixed for all browser clients
  password: token,
})

client.subscribe(`device/${deviceVID}/status`)
client.subscribe(`device/${deviceVID}/telemetry`)
```

**Kiosk `.env` variables for IoT:**
```env
VITE_IOT_API_URL=https://m9vends-iot-backend-service.onrender.com
VITE_MQTT_BROKER_URL=ws://<YOUR_MQTT_BROKER_HOST>:8083
VITE_UPI_TIMEOUT_MS=180000    # 3 min
VITE_CASH_TIMEOUT_MS=600000   # 10 min
VITE_POLL_INTERVAL_MS=3000    # 3s polling
```

---

## 10. Integration Points with Admin Panel

The Admin Panel **never connects directly to the IoT backend or MQTT broker.** All IoT data flows through the SaaS backend:

```
Admin Panel Browser
    │
    │ (1) REST requests to SaaS backend
    ├─── GET /api/admin/machines         → SaaS proxies to IoT
    ├─── GET /api/admin/machines/:id     → SaaS proxies to IoT
    ├─── POST /api/admin/machines/provision → SaaS proxies to IoT
    ├─── POST /api/admin/machines/:id/commands → SaaS proxies to IoT
    │
    │ (2) Socket.IO connection to SaaS backend
    └─── machine:telemetry  ← SaaS relays from MQTT
         machine:status     ← SaaS relays from MQTT
         machine:alert      ← SaaS processes and emits
         order:cash_pending ← SaaS emits on new cash order
```

**Admin Panel `.env` — no IoT variables needed:**
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
# No MQTT_BROKER_HOST, no IoT credentials — never needed in browser
```

---

## 11. Error Reference

### IoT REST Errors

All IoT backend errors return plain JSON:

```json
{ "message": "Human-readable error description" }
```

| HTTP Code | Message | Cause |
|---|---|---|
| `400` | `"Bad Request"` | Missing or empty request body |
| `400` | `"Something Went Wrong"` | `serialNumber` or `model` missing |
| `400` | `"Invalid User ID"` | `userID` is not a valid MongoDB ObjectId |
| `400` | `"User Not Found"` | `userID` doesn't exist in IoT backend DB |
| `400` | `"Device Not Configured"` | `serialNumber` not in IoT device registry |
| `400` | `"Device Already Owned"` | Machine already provisioned to another user |
| `400` | `"Invalid Device ID"` | `:id` in connect API is not a valid ObjectId |
| `400` | `"Device doesn't exist, Invalid Id"` | Device not found or not provisioned |
| `500` | `"Couldn't Reach Device, Please try restarting it..."` | Machine offline during provisioning |
| `500` | `"Something Went Wrong"` | DB error or unhandled server exception |

### MQTT Connection Errors

| Error | Likely Cause | Fix |
|---|---|---|
| `Connection refused` | Wrong credentials or port | Check username/password tier; use port 8083 for WebSocket |
| `Not authorized` | Expired JWT token | Re-fetch token from `/api/device/connect/:id` and reconnect |
| `Bad Client ID` | Duplicate clientId | Ensure `clientId` is unique per connection (`kiosk_<random>`) |
| Token expired mid-session | Token is 25 min, reconnect cycle is 20 min | Ensure token refresh timer is running |

---

## Appendix — Complete IoT API Quick Reference

```
IoT Backend REST (:3001 local / Render prod)
────────────────────────────────────────────────────────────
POST  /api/device/wake-up               ← Every kiosk boot
POST  /api/device/provision             ← Admin provisioning
GET   /api/device/connect/:deviceVID    ← Browser MQTT token
GET   /api/device/device/:deviceVID     ← Device info (proxied by SaaS)
GET   /api/device/user/:userID          ← User's devices (proxied by SaaS)
POST  /api/device/:deviceVID/commands   ← Send command (proxied by SaaS)

MQTT Broker (<YOUR_MQTT_BROKER_HOST>)
────────────────────────────────────────────────────────────
TCP  :1883  — Device & SaaS backend (admin credentials)
WS   :8083  — Browser clients (JWT token)
WSS  :8084  — Browser clients TLS

Topics:
  device/<deviceVID>/telemetry   ← Machine publishes (JSON or alert string)
  device/<deviceVID>/status      ← Machine publishes ("online"|"offline")
  device/<deviceVID>/commands    ← Admin/SaaS publishes → machine subscribes

Credentials:
  Devices:        username=<DEVICE_MQTT_USERNAME>, password=<DEVICE_MQTT_PASSWORD>
  SaaS backend:   username=<ADMIN_MQTT_USERNAME>,  password=<ADMIN_MQTT_PASSWORD>
  Browser:        username=FrontendClient,        password=<JWT from connect API>
```
