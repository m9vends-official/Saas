# M9Vends Smart Vending Machine — Complete Setup & Onboarding Guide

> **Document:** `05_MACHINE_SETUP_DOCUMENTATION.md`  
> **Audience:** Hardware Engineers, Field Technicians, SaaS Admins, DevOps  
> **Status:** Production Reference  
> **Security:** Contains sanitized templates only — never commit real secrets or credentials

---

## Table of Contents

1. [Architecture & Machine Lifecycle](#1-architecture--machine-lifecycle)
2. [Prerequisites & Bill of Materials](#2-prerequisites--bill-of-materials)
3. [Step 1: Hardware Identity & Component Manifest](#3-step-1-hardware-identity--component-manifest)
4. [Step 2: Machine First Boot & Registration (Wake-Up)](#4-step-2-machine-first-boot--registration-wake-up)
5. [Step 3: Provisioning & Company Ownership Binding](#5-step-3-provisioning--company-ownership-binding)
6. [Step 4: Machine Catalog & Slot Inventory Setup](#6-step-4-machine-catalog--slot-inventory-setup)
7. [Step 5: Field Technician Assignment](#7-step-5-field-technician-assignment)
8. [Step 6: Live Telemetry & MQTT Monitoring Setup](#8-step-6-live-telemetry--mqtt-monitoring-setup)
9. [Step 7: Physical Kiosk Terminal Lockdown (Production OS)](#9-step-7-physical-kiosk-terminal-lockdown-production-os)
10. [Step 8: Simulating Machines (Testing & QA Without Hardware)](#10-step-8-simulating-machines-testing--qa-without-hardware)
11. [Step 9: End-to-End Verification Checklist](#11-step-9-end-to-end-verification-checklist)
12. [Step 10: Troubleshooting Matrix](#12-step-10-troubleshooting-matrix)

---

## 1. Architecture & Machine Lifecycle

A smart vending machine in the M9Vends platform connects three interconnected software layers:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Physical Vending Machine Unit                         │
│                                                                             │
│  ┌──────────────────────────────┐        ┌──────────────────────────────┐   │
│  │     Hardware Controller      │        │       Kiosk Touchscreen      │   │
│  │   (Arduino / ESP32 / PLC)    │        │    (Vite + React Kiosk App)  │   │
│  │                              │        │                              │   │
│  │  Sensors (Temp, Tanks, Current)       │  Touch UI, Cart, QR Payment  │   │
│  │  Actuators (Motors, Spiral slots)     │  Polls status, dispenses item│   │
│  └──────────────┬───────────────┘        └──────────────┬───────────────┘   │
└─────────────────┼───────────────────────────────────────┼───────────────────┘
                  │ MQTT (TCP :1883)                      │ REST (HTTP :5000 & :3001)
                  │                                       │
                  ▼                                       ▼
┌─────────────────────────────────┐      ┌────────────────────────────────────┐
│      IoT MQTT Broker            │      │       SaaS Backend Server          │
│   (<YOUR_MQTT_BROKER_HOST>)     │◄────►│           (Port 5000)              │
│                                 │      │                                    │
│  Topics:                        │      │  - /api/public/catalog/:machine_id │
│  device/<deviceVID>/telemetry   │      │  - /api/public/order               │
│  device/<deviceVID>/status      │      │  - /api/admin/machines/*           │
│  device/<deviceVID>/commands    │      │  - /api/admin/catalog/*            │
└────────────────┬────────────────┘      └─────────────────┬──────────────────┘
                 │                                         │
                 │ Server-side MQTT Sub                    │ Socket.IO (:5000)
                 └───────────────────┬─────────────────────┘
                                     ▼
                     ┌────────────────────────────────┐
                     │       Admin Web Panel          │
                     │         (Next.js 14)           │
                     │                                │
                     │  - Machine Health & Gauges     │
                     │  - Stock & Restocking Alert    │
                     │  - Remote Command Dispatch     │
                     └────────────────────────────────┘
```

### Machine Lifecycle Stages

```
   [FACTORY]  1. Manufacturer assigns unique Serial Number (e.g. SN-M9V-4820)
       ↓
    [BOOT]    2. Machine boots → calls POST /api/device/wake-up
                 IoT service registers deviceVID & issues device MQTT credentials
       ↓
  [UNLINKED]  3. isProvisioned: false → Kiosk screen displays Provisioning QR
       ↓
 [PROVISION]  4. Admin enters Serial Number in Admin Panel
                 IoT service binds machine to Company Owner userID
       ↓
  [CATALOG]   5. Admin configures physical slots (A1, A2...) and stocks inventory
       ↓
 [OPERATION]  6. Kiosk displays product grid → Customer orders → Machine dispenses
       ↓
[MONITORING]  7. Arduino streams 1 Hz telemetry to MQTT → Admin monitors health
```

---

## 2. Prerequisites & Bill of Materials

Before setting up a machine in production, ensure the following requirements are met:

### 2.1 Hardware Requirements
- **Industrial Controller:** Arduino Mega / ESP32 / Industrial ARM controller with serial or TCP bridge.
- **Display & Host Computer:**
  - 1080x1920 portrait (or 1920x1080 landscape) capacitive touchscreen.
  - Mini PC / Raspberry Pi 4 (4GB+) / Intel NUC running Ubuntu LTS or Windows IoT Enterprise.
- **Network Interface:** Stable 4G LTE router or hardwired Ethernet (WiFi is discouraged for retail machines).
- **Sensors & Actuators:**
  - Motor drivers (relays/FETs) for spirals/belts.
  - Temperature sensor (NTC thermistor / DS18B20).
  - Tank/Liquid level sensors (ultrasonic or float switches) if dispensing liquids.
  - Current sensor (ACS712 or Hall sensor) for motor stall/jam detection.

### 2.2 Server & Cloud Requirements
- **SaaS Backend:** Running and reachable (e.g., `https://api.yourdomain.com`).
- **IoT Backend Service:** Running (`https://m9vends-iot-backend-service.onrender.com` or self-hosted).
- **MQTT Broker:** Reachable on TCP `:1883` and WebSocket `:8083`.
- **Admin Account:** Active `ADMIN` or `SUPER_ADMIN` login in the SaaS Admin Panel.

---

## 3. Step 1: Hardware Identity & Component Manifest

Every machine must be assigned an immutable **Serial Number** before leaving the workshop.

### 3.1 Serial Number Naming Convention
Use the standard M9Vends serial format:
```
SN-<MODEL_CODE>-<BATCH_OR_INCREMENTAL_ID>
```
*Examples:* `SN-M9V-001`, `SN-M9V-4820`, `SN-BEV-0104`

### 3.2 Component Manifest Specification
When the machine wakes up, it reports its hardware manifest. Use the exact component names and categories recognized by the Admin Panel:

| Category (`catagory`)* | Component Name Example | Type (`type`) | Purpose in Dashboard |
|---|---|---|---|
| `motor` | `Steering Motor` / `Spiral Motor 1` | `accutator` | Motor health status, run/stop states |
| `tank` | `Water Tank` / `Syrup Tank 1` | `sensor` | Progress bar gauge (0–100%) |
| `sensor` | `Current Sensor` | `sensor` | Amperage gauge for jam/short detection |
| `sensor` | `Temperature Sensor` | `sensor` | Thermometer widget (°C) |

> ⚠️ **Notice on API Spelling:** In the IoT backend REST API, the JSON key is spelled `"catagory"` (with an 'a') and `"accutator"` (with double 'c'). You **must** keep this exact spelling in payloads.

---

## 4. Step 2: Machine First Boot & Registration (Wake-Up)

Upon power-on, the machine controller or the kiosk software makes its initial wake-up call to the IoT Backend.

### 4.1 First Boot Wake-Up Request
```http
POST https://m9vends-iot-backend-service.onrender.com/api/device/wake-up
Content-Type: application/json

{
  "serialNumber": "SN-M9V-4820",
  "model": "M9-SmartVendor-Pro",
  "mac": "B8:27:EB:A1:C2:E4",
  "ip": "192.168.1.150",
  "status": "online",
  "components": [
    { "id": 1, "catagory": "motor", "name": "Steering Motor", "type": "accutator" },
    { "id": 2, "catagory": "tank", "name": "Water Tank", "type": "sensor" },
    { "id": 3, "catagory": "sensor", "name": "Temperature Sensor", "type": "sensor" },
    { "id": 4, "catagory": "sensor", "name": "Current Sensor", "type": "sensor" }
  ]
}
```

### 4.2 Expected Response (Unprovisioned Machine)
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

### 4.3 Kiosk Action Upon Unprovisioned Status
1. **Store Identity:** Persist `deviceVID` (`60d5ec49f3e4e9001f3b2e99`) to local storage. In the SaaS platform, **`machine_id` is exactly equal to `deviceVID`**.
2. **Display QR Screen:** Show `ProvisionScreen` on the touchscreen. The screen displays the Serial Number (`SN-M9V-4820`) and a QR code containing the serial for quick scanning by the field operator.
3. **Polling Loop:** Kiosk automatically polls `POST /api/device/wake-up` every 10 seconds waiting for `isProvisioned: true`.

---

## 5. Step 3: Provisioning & Company Ownership Binding

Provisioning links the physical machine to the operating company's account in the SaaS database.

### 5.1 Option A: Via the Admin Panel Web UI
1. Log in to the Admin Panel (`https://admin.yourdomain.com`).
2. Navigate to **Machines** (`/machines`) from the sidebar.
3. Click **"+ Add / Provision Machine"**.
4. Enter the **Serial Number** displayed on the kiosk screen (`SN-M9V-4820`).
5. Click **Confirm Provisioning**.

### 5.2 Option B: Via Admin API (cURL / Postman)
```bash
curl -X POST https://api.yourdomain.com/api/admin/machines/provision \
  -H "Authorization: Bearer <ADMIN_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "serialNumber": "SN-M9V-4820"
  }'
```

**Expected Success Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Machine provisioned successfully",
  "data": {
    "vid": "60d5ec49f3e4e9001f3b2e99",
    "serialNumber": "SN-M9V-4820",
    "owner": "648a1b2c3d4e5f6789abcdef",
    "isProvisioned": true
  }
}
```

### 5.3 Automatic Transition on Kiosk
On the very next 10-second polling cycle, the kiosk wake-up request returns:
```json
{
  "message": "Wakeup Existing Device",
  "deviceVID": "60d5ec49f3e4e9001f3b2e99",
  "isProvisioned": true,
  "kioskBrowserURL": "https://kiosk.yourdomain.com/60d5ec49f3e4e9001f3b2e99"
}
```
The kiosk immediately transitions from the Provisioning QR screen to the **Catalog / Storefront screen**.

---

## 6. Step 4: Machine Catalog & Slot Inventory Setup

A newly provisioned machine has no items configured in its physical dispensers. You must map company products to the machine slots.

### 6.1 Creating Master Products First
If products do not yet exist under your company, create them:
```bash
curl -X POST https://api.yourdomain.com/api/admin/products \
  -H "Authorization: Bearer <ADMIN_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cold Brew Coffee 250ml",
    "price": 120,
    "category": "Beverages",
    "sku": "BEV-CB-250",
    "description": "Organic nitro cold brew"
  }'
```
*Note the returned `_id` as `<PRODUCT_ID>`.*

### 6.2 Assigning Products to Machine Slots (`MachineCatalog`)
Map the product to slot `A1`:
```bash
curl -X POST https://api.yourdomain.com/api/admin/catalog \
  -H "Authorization: Bearer <ADMIN_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "machine_id": "60d5ec49f3e4e9001f3b2e99",
    "product_id": "<PRODUCT_ID>",
    "slot_label": "A1",
    "stock": 20,
    "max_capacity": 25,
    "price_override": null,
    "is_enabled": true
  }'
```

### 6.3 Catalog Field Definitions

| Field | Type | Description |
|---|---|---|
| `machine_id` | String | The `deviceVID` of the vending machine |
| `product_id` | ObjectId | Reference to master Product document |
| `slot_label` | String | Physical rack position (`A1`, `A2`, `B1`, etc.) |
| `stock` | Number | Quantity loaded physically in that slot |
| `max_capacity` | Number | Maximum items slot can hold (for refill calculation) |
| `price_override` | Number/null | Optional custom price for this location (airport, hospital) |
| `is_enabled` | Boolean | `true` displays item on Kiosk; `false` hides it |

### 6.4 Restocking Stock in the Field
When field staff refilled slot `A1`:
```bash
curl -X PATCH https://api.yourdomain.com/api/admin/catalog/<CATALOG_ENTRY_ID> \
  -H "Authorization: Bearer <STAFF_OR_TECH_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "stock": 25
  }'
```
*The backend automatically timestamps `last_restocked_at: new Date()`.*

---

## 7. Step 5: Field Technician Assignment

Assign certified field technicians to the machine so they can view status, receive alerts, restock, and confirm cash payments.

### 7.1 Assigning a Technician
```bash
curl -X POST https://api.yourdomain.com/api/admin/assignments \
  -H "Authorization: Bearer <ADMIN_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "machine_id": "60d5ec49f3e4e9001f3b2e99",
    "technician_id": "<TECHNICIAN_USER_ID>"
  }'
```

### 7.2 Access Control Verification

| Action | Admin | Assigned Technician | Unassigned Technician |
|---|---|---|---|
| View Machine Telemetry | ✅ | ✅ | ❌ (403 Forbidden) |
| Update Stock / Restock | ✅ | ✅ | ❌ (403 Forbidden) |
| Confirm Cash Orders | ✅ | ✅ | ❌ (403 Forbidden) |
| Send Hardware Reboot Command | ✅ | ❌ (Role Guarded) | ❌ (403 Forbidden) |

---

## 8. Step 6: Live Telemetry & MQTT Monitoring Setup

The physical machine hardware controller streams real-time status and sensor readings over MQTT.

### 8.1 MQTT Connection Parameters
- **Host:** `<YOUR_MQTT_BROKER_HOST>`
- **Port:** `1883` (TCP)
- **Client ID:** `m9v_device_60d5ec49f3e4e9001f3b2e99`
- **Username:** `<DEVICE_MQTT_USERNAME>` (obtained from wake-up response)
- **Password:** `<DEVICE_MQTT_PASSWORD>` (obtained from wake-up response)
- **Keepalive:** `30` seconds

### 8.2 Publishing Online / Offline Status
- **Online Topic:** `device/60d5ec49f3e4e9001f3b2e99/status`
- **Payload:** `"online"`
- **LWT (Last Will and Testament):**
  - Topic: `device/60d5ec49f3e4e9001f3b2e99/status`
  - Payload: `"offline"`
  - QoS: `1`, Retain: `true`

### 8.3 Publishing 1 Hz Sensor Telemetry
- **Topic:** `device/60d5ec49f3e4e9001f3b2e99/telemetry`
- **Interval:** Every 1,000 ms
- **Payload Format (JSON):**
```json
{
  "Steering Motor Temperature": 27.5,
  "Tank Levels": [85, 40, 92, 15],
  "Steering Motor": true,
  "Current Sensor": 2.15
}
```

### 8.4 Triggering Hardware Alerts
When a sensor exceeds safe limits or hardware faults occur, publish an alert payload to `device/<deviceVID>/telemetry`:

| Alert String Payload | Severity in Admin Dashboard | Sound Alarm |
|---|---|---|
| `"Anomaly Detected"` | 🔴 CRITICAL | Yes (Continuous beep) |
| `"Device(Arduino) Not Connected"` | 🟠 HIGH | Yes (Alert chime) |
| `"Low Liquid Level"` | 🟡 WARNING | No (Banner only) |

### 8.5 Subscribing to Admin Remote Commands
The hardware controller must subscribe to:
- **Topic:** `device/60d5ec49f3e4e9001f3b2e99/commands`
- **Payload:**
```json
{
  "command": "reboot",
  "timestamp": 1729864200000
}
```

---

## 9. Step 7: Physical Kiosk Terminal Lockdown (Production OS)

To prevent customer tampering, the kiosk screen must run in a dedicated, locked-down environment.

### 9.1 Kiosk `.env` Configuration
On the machine's host computer, configure `kiosk-screen/.env`:
```env
VITE_SERIAL_NUMBER=SN-M9V-4820
VITE_SAAS_API_URL=https://api.yourdomain.com
VITE_IOT_API_URL=https://m9vends-iot-backend-service.onrender.com
VITE_MQTT_BROKER_URL=ws://<YOUR_MQTT_BROKER_HOST>:8083

VITE_UPI_TIMEOUT_MS=180000
VITE_CASH_TIMEOUT_MS=600000
VITE_POLL_INTERVAL_MS=3000
```

### 9.2 Linux / Ubuntu / Raspberry Pi Autostart Setup

1. **Install Chromium and Unclutter:**
```bash
sudo apt update && sudo apt install -y chromium-browser unclutter xdotool
```

2. **Create Systemd Service (`/etc/systemd/system/m9vends-kiosk.service`):**
```ini
[Unit]
Description=M9Vends Kiosk Display Service
After=network-online.target lightdm.service
Wants=network-online.target

[Service]
User=kiosk
Environment=DISPLAY=:0
ExecStart=/usr/bin/chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-translate \
  --no-first-run \
  --fast \
  --fast-start \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --check-for-update-interval=31536000 \
  --app=http://localhost:5174
Restart=always
RestartSec=5

[Install]
WantedBy=graphical.target
```

3. **Enable and Start the Service:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable m9vends-kiosk.service
sudo systemctl start m9vends-kiosk.service
```

### 9.3 Windows Kiosk Autostart Setup
Create an autostart batch file in `C:\Users\<User>\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\launch_kiosk.bat`:
```cmd
@echo off
timeout /t 5 /nobreak
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --noerrdialogs --disable-infobars --app=http://localhost:5174
```

---

## 10. Step 8: Simulating Machines (Testing & QA Without Hardware)

You can test the entire platform without a physical vending machine using the built-in simulator script.

### 10.1 Running the Simulation Script
Ensure the machine is provisioned with a `deviceVID` (e.g. `60d5ec49f3e4e9001f3b2e99`).

Run the simulation script:
```bash
cd SAAS/backend
node simulate_machine.js
```

### 10.2 Customizing Simulator Parameters
Edit `simulate_machine.js` with your environment variables:
```javascript
import mqtt from 'mqtt';
import dotenv from 'dotenv';
dotenv.config();

const brokerUrl = `mqtt://${process.env.MQTT_BROKER_HOST}:${process.env.MQTT_BROKER_TCP_PORT || 1883}`;
const deviceId  = '60d5ec49f3e4e9001f3b2e99'; // Your target machine deviceVID

const client = mqtt.connect(brokerUrl, {
  username: process.env.MQTT_ADMIN_USERNAME,
  password: process.env.MQTT_ADMIN_PASSWORD,
  clientId: `sim-${Date.now()}`
});

client.on('connect', () => {
  console.log('✅ Connected to MQTT broker');
  
  // 1. Status
  client.publish(`device/${deviceId}/status`, 'online', { qos: 1 });

  // 2. Continuous 1 Hz telemetry
  setInterval(() => {
    const payload = JSON.stringify({
      "Steering Motor Temperature": Math.round(25 + Math.random() * 8),
      "Tank Levels": [80, 65, 90, 45],
      "Steering Motor": true,
      "Current Sensor": Number((2.1 + Math.random() * 0.4).toFixed(2))
    });
    client.publish(`device/${deviceId}/telemetry`, payload);
  }, 1000);
});
```

---

## 11. Step 9: End-to-End Verification Checklist

Run through this test sequence before leaving the installation site:

```
[ ] 1. Wake-Up Check
       POST /api/device/wake-up returns 200 with matching serialNumber and deviceVID.

[ ] 2. Provisioning Check
       Admin panel lists machine under /machines with matching serial number.

[ ] 3. Catalog Visibility Check
       curl http://localhost:5000/api/public/catalog/<deviceVID>
       Returns array of enabled products with non-zero stock.

[ ] 4. Kiosk Catalog Render
       Kiosk screen displays product images, names, prices, and slot labels.

[ ] 5. Telemetry & Live Gauges
       Admin Panel machine detail page shows "ONLINE" badge and live-updating gauges.

[ ] 6. UPI Payment Test
       Order placed → QR code displays → customer scan → webhook updates order to PAID.

[ ] 7. Cash Payment Test
       Order placed → displays "ORDER # XXXXXXXX" → Admin confirms cash → Machine dispenses.

[ ] 8. Stock Auto-Decrement
       Verify stock count in MachineCatalog decreases by order quantity after successful payment.

[ ] 9. Power Cycle Recovery
       Cut power to machine → restore power → machine reboots straight to Catalog in < 45 seconds.
```

---

## 12. Step 10: Troubleshooting Matrix

| Problem / Symptom | Root Cause | Immediate Fix |
|---|---|---|
| **Kiosk stuck on "Wakeup in progress..."** | IoT service cold-start on Render (sleeps after 15 min inactivity) | Wait 30–60 seconds for Render container to boot. Verify `VITE_IOT_API_URL`. |
| **Kiosk stuck on "Awaiting Provisioning" QR** | Serial Number not yet entered in Admin Panel | Go to Admin Panel → `/machines` → Enter Serial Number and confirm provisioning. |
| **Admin Provisioning returns 400 "Device Not Configured"** | Machine has never called wake-up API | Power on physical machine / kiosk first so it registers its Serial Number with IoT backend. |
| **Admin Provisioning returns 400 "Device Already Owned"** | Machine is already linked to another company | Check if another user registered this serial. Contact Super Admin to reassign owner. |
| **Kiosk shows "No Products Available"** | No `MachineCatalog` entries created for this `machine_id` | Add products to machine in Admin Panel under `/catalog` and ensure `is_enabled: true` and `stock > 0`. |
| **Machine shows "OFFLINE" in Admin Dashboard** | Hardware MQTT client disconnected or wrong broker credentials | Check LTE connection. Check topic format `device/<deviceVID>/status`. Check MQTT credentials. |
| **Telemetry gauges freeze / don't update** | SaaS `mqttService.js` not connected to broker or Socket.IO dropped | Verify SaaS backend logs for `[MQTT] Connected`. Ensure browser didn't drop WebSocket. |
| **Dispense motor doesn't trigger on payment** | Hardware controller not subscribed to `commands` topic | Confirm Arduino/ESP32 is subscribed to `device/<deviceVID>/commands` with QoS 1. |
| **Technician cannot view machine** | Missing `MachineAssignment` document | Super Admin must assign the technician to the machine via `/api/admin/assignments`. |

---

*Document reference: M9Vends SaaS & IoT Platform — Machine Setup Guide*
