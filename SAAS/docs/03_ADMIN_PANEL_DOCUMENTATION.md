# M9Vends Admin Panel — Complete Documentation

> **Stack:** Next.js 14 (App Router) + TypeScript | **State:** Zustand | **Real-time:** Socket.IO
> **Data fetching:** TanStack Query | **Charts:** Recharts | **Styling:** Tailwind CSS + shadcn/ui
> **Last Updated:** October 2026

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [System Architecture](#3-system-architecture)
4. [The Three Roles](#4-the-three-roles)
5. [Permission Matrix](#5-permission-matrix)
6. [Project Structure](#6-project-structure)
7. [Environment Variables](#7-environment-variables)
8. [Authentication Flow](#8-authentication-flow)
9. [Real-Time System (Socket.IO + MQTT)](#9-real-time-system-socketio--mqtt)
10. [Page-by-Page Reference](#10-page-by-page-reference)
11. [Zustand Store Design](#11-zustand-store-design)
12. [API Map per Page](#12-api-map-per-page)
13. [TanStack Query Polling Strategy](#13-tanstack-query-polling-strategy)
14. [Alert System](#14-alert-system)
15. [Build Plan (Phase by Phase)](#15-build-plan-phase-by-phase)
16. [IoT Telemetry Widgets](#16-iot-telemetry-widgets)

---

## 1. Overview

The M9Vends Admin Panel is a **Next.js 14 web application** used by operators to:

- Monitor all vending machines in real time via live IoT telemetry
- Manage the product catalog (add/update/remove products per machine)
- View and manage orders (confirm cash payments, filter by machine/status)
- Analyze revenue and sales data via charts
- Manage staff (invite Admins and Technicians, assign them to machines)
- Receive and respond to IoT alerts (hardware anomalies, disconnections)

---

## 2. Tech Stack

| Concern | Choice | Reason |
|---|---|---|
| Framework | Next.js 14 (App Router) | SSR for protected pages, built-in routing |
| Language | TypeScript | Type safety for IoT payload parsing |
| State | Zustand | Auth state, alert store, machine telemetry cache |
| Data fetching | TanStack Query | Caching, polling, optimistic updates |
| Charts | Recharts | Lightweight, composable, works with React |
| Tables | TanStack Table | Sorting, filtering, pagination |
| Real-time | Socket.IO client | Receives MQTT telemetry relayed by SaaS backend |
| Styling | Tailwind CSS | Utility-first, fast to build |
| UI Components | shadcn/ui | Accessible, customizable, built on Radix |
| HTTP client | Axios | Interceptors for token refresh |
| Auth | JWT access token (memory) + refresh token (httpOnly cookie) | Implemented in backend |

---

## 3. System Architecture

```
Physical Vending Machine
    │ MQTT (device credentials)
    ▼
IoT MQTT Broker  <MQTT_BROKER_HOST>:1883
    │
    │  device/<deviceVID>/telemetry → JSON or alert string (1 Hz)
    │  device/<deviceVID>/status    → "online" or "offline"
    ▼
SaaS Backend mqttService.js
    │  (admin-level MQTT credentials)
    │  Parses payload → identifies deviceVID from topic
    │  Caches latest telemetry per device in memory Map
    │
    ├── Socket.IO → emits to admin panel clients (per company_id room)
    └── REST Proxy → /api/admin/machines/:deviceVID (from IoT REST)

Admin Panel Browser
    ├── Socket.IO client → receives real-time telemetry + alerts
    ├── TanStack Query   → polls SaaS REST APIs
    └── Zustand          → stores auth, alert queue, machine status map
```

> **MQTT never touches the browser directly.** All MQTT data flows through the SaaS backend, which relays it via Socket.IO.

---

## 4. The Three Roles

| Role | Who They Are | Core Responsibility |
|---|---|---|
| **SUPER_ADMIN** | Business owner | Owns the company; controls all machines, staff, data, billing; full IoT visibility |
| **ADMIN** | Operations manager | Day-to-day operations: products, catalog, orders, reports; monitors all machines |
| **TECHNICIAN** | Field maintenance staff | Visits machines physically; restocks, confirms cash; sees IoT alerts for assigned machines only |

---

## 5. Permission Matrix

### Company & Users

| Action | SUPER_ADMIN | ADMIN | TECHNICIAN |
|---|---|---|---|
| View company profile | ✅ | View only | ❌ |
| Edit company profile | ✅ | ❌ | ❌ |
| View billing / plan | ✅ | ❌ | ❌ |
| Create Admin users | ✅ | ❌ | ❌ |
| Create Technician users | ✅ | ✅ | ❌ |
| Edit any user | ✅ | Own profile only | Own profile only |
| Deactivate a user | ✅ | Technicians only | ❌ |
| View user list | ✅ | Technicians only | ❌ |

### Machines & Catalog

| Action | SUPER_ADMIN | ADMIN | TECHNICIAN |
|---|---|---|---|
| View all machines | ✅ | ✅ | Assigned only |
| View IoT telemetry live | ✅ | ✅ | Assigned only |
| Send IoT commands | ✅ | ✅ | ❌ |
| Add product to catalog | ✅ | ✅ | ❌ |
| Edit catalog entry | ✅ | ✅ | ❌ |
| Update stock (restock) | ✅ | ✅ | ✅ |
| Disable/enable product | ✅ | ✅ | ❌ |

### Orders & Payments

| Action | SUPER_ADMIN | ADMIN | TECHNICIAN |
|---|---|---|---|
| View all orders | ✅ | ✅ | Assigned machines only |
| See revenue / amounts | ✅ | ✅ | ❌ |
| Confirm cash payment | ✅ | ✅ | ✅ |
| Export orders / reports | ✅ | ✅ | ❌ |

### Analytics

| Action | SUPER_ADMIN | ADMIN | TECHNICIAN |
|---|---|---|---|
| Revenue charts | ✅ | ✅ | ❌ |
| Top-selling products | ✅ | ✅ | ❌ |
| Machine-level sales | ✅ | ✅ | ❌ |
| Stock level alerts | ✅ | ✅ | ✅ |

---

## 6. Project Structure

```
admin-panel/
├── .env.local                          # NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SOCKET_URL
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # Root: fonts, QueryClientProvider
│   │   ├── page.tsx                    # Redirect → /dashboard or /login
│   │   ├── login/
│   │   │   └── page.tsx                # Login form
│   │   └── (dashboard)/
│   │       ├── layout.tsx              # Sidebar + Header + Socket.IO init
│   │       ├── dashboard/page.tsx      # KPIs + chart + machine grid + alerts
│   │       ├── machines/
│   │       │   ├── page.tsx            # Machine list with IoT status badges
│   │       │   ├── new/page.tsx        # QR scanner + provisioning
│   │       │   └── [deviceVID]/page.tsx # Machine detail + live telemetry
│   │       ├── products/page.tsx       # Product library CRUD
│   │       ├── catalog/page.tsx        # Machine → product assignment
│   │       ├── orders/page.tsx         # All orders, filters, cash confirm
│   │       ├── analytics/page.tsx      # Revenue charts
│   │       ├── users/
│   │       │   ├── page.tsx            # User list (role-filtered)
│   │       │   └── new/page.tsx        # Create user form
│   │       └── settings/
│   │           ├── page.tsx            # Company profile (SUPER_ADMIN only)
│   │           └── account/page.tsx    # Own profile (all roles)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx             # Role-aware navigation
│   │   │   ├── Header.tsx              # Notifications bell + user menu
│   │   │   └── ProtectedRoute.tsx      # Role guard: allowedRoles[]
│   │   ├── dashboard/
│   │   │   ├── KPICard.tsx
│   │   │   ├── RevenueChart.tsx        # Recharts LineChart
│   │   │   ├── MachineStatusGrid.tsx   # Live status from Zustand machineStore
│   │   │   └── RecentOrders.tsx
│   │   ├── machines/
│   │   │   ├── MachineCard.tsx         # Status badge + telemetry summary
│   │   │   ├── TelemetryPanel.tsx      # Dynamic widgets from components[]
│   │   │   ├── TankLevelBar.tsx        # Fill bar: green>30%, amber 15-30%, red<15%
│   │   │   ├── MotorStatus.tsx         # Gauge: green<50°C, amber 50-70°C, red>70°C
│   │   │   └── CommandPanel.tsx        # Admin only: Force Read, Toggle Motor
│   │   ├── alerts/
│   │   │   ├── AlertBanner.tsx         # Full-width CRITICAL banner with dismiss
│   │   │   ├── AlertToast.tsx          # HIGH and WARNING toast notifications
│   │   │   └── AlertSound.tsx          # Looping alarm audio on CRITICAL alert
│   │   ├── orders/
│   │   │   ├── OrderTable.tsx          # TanStack Table with sorting + pagination
│   │   │   └── CashConfirmButton.tsx
│   │   └── common/
│   │       ├── Badge.tsx
│   │       ├── Modal.tsx
│   │       └── Spinner.tsx
│   ├── hooks/
│   │   ├── useAuth.ts                  # login(), logout(), token refresh
│   │   ├── useSocket.ts                # Socket.IO connection + event listeners
│   │   └── useMachineMonitor.ts        # Subscribes to telemetry for one deviceVID
│   ├── store/
│   │   ├── authStore.ts                # user, role, accessToken, company_id
│   │   ├── alertStore.ts               # Alert queue, sound trigger, dismiss
│   │   └── machineStore.ts             # Map<deviceVID, { status, telemetry }>
│   ├── lib/
│   │   ├── api.ts                      # Axios: baseURL + Bearer + 401 refresh
│   │   ├── socket.ts                   # Socket.IO singleton
│   │   └── queryClient.ts              # TanStack Query client
│   └── types/
│       ├── auth.ts
│       ├── machine.ts                  # TelemetryData, DeviceInfo, MachineStatus
│       └── order.ts
```

---

## 7. Environment Variables

```env
# .env.local (admin-panel)
NEXT_PUBLIC_API_URL=http://localhost:5000         # SaaS backend URL
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000      # Socket.IO (same server)
```

> ⚠️ **MQTT credentials are NEVER in the admin panel `.env`.** All MQTT is handled server-side by the SaaS backend. Browsers connect via Socket.IO only.

---

## 8. Authentication Flow

```
1. User opens /login → submits email + password
   POST /api/admin/auth/login
   ← { accessToken, user: { id, role, company_id } }
   ← httpOnly cookie: refresh_token (set automatically by browser)

2. Store in Zustand authStore (in memory ONLY — not localStorage):
   { user, role, company_id, accessToken }

3. Axios interceptor on every request:
   → adds Authorization: Bearer <accessToken>
   On 401 response:
   → POST /api/admin/auth/refresh (browser sends cookie automatically)
   ← new accessToken → authStore.setToken() → retry original request

4. Socket.IO connection (in dashboard layout.tsx):
   socket.connect() with { auth: { token: accessToken } }
   Server verifies JWT → socket.join(company_id)
   All real-time events now flow into this company room

5. Logout:
   POST /api/admin/auth/logout → clear authStore → redirect to /login
```

### Axios Client (`src/lib/api.ts`)

```typescript
import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,  // required for httpOnly cookie
})

// Add Bearer token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 — refresh token and retry
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true
      const { data } = await api.post('/api/admin/auth/refresh')
      useAuthStore.getState().setToken(data.accessToken)
      err.config.headers.Authorization = `Bearer ${data.accessToken}`
      return api(err.config)
    }
    return Promise.reject(err)
  }
)

export default api
```

---

## 9. Real-Time System (Socket.IO + MQTT)

### Socket.IO Singleton (`src/lib/socket.ts`)

```typescript
import { io } from 'socket.io-client'
import { useAuthStore } from '../store/authStore'

let socket: ReturnType<typeof io> | null = null

export const getSocket = () => {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
      autoConnect: false,
      withCredentials: true,
    })
  }
  return socket
}

export const connectSocket = (accessToken: string) => {
  const s = getSocket()
  s.auth = { token: accessToken }
  s.connect()
}
```

### Socket.IO Event Listeners (`src/hooks/useSocket.ts`)

```typescript
useEffect(() => {
  const socket = getSocket()

  socket.on('machine:telemetry', ({ deviceVID, data }) => {
    machineStore.updateTelemetry(deviceVID, data)
  })

  socket.on('machine:status', ({ deviceVID, status }) => {
    machineStore.updateStatus(deviceVID, status)
  })

  socket.on('machine:alert', ({ deviceVID, type, message, severity }) => {
    alertStore.addAlert({ deviceVID, type, message, severity, timestamp: Date.now() })
    if (severity === 'CRITICAL') playAlarmSound()
  })

  socket.on('order:cash_pending', ({ orderId, machine_id, total_amount }) => {
    alertStore.addAlert({ type: 'cash', orderId, machine_id, total_amount })
  })

  return () => {
    socket.off('machine:telemetry')
    socket.off('machine:status')
    socket.off('machine:alert')
    socket.off('order:cash_pending')
  }
}, [])
```

### All Socket.IO Events

| Event Name | Payload | Source |
|---|---|---|
| `machine:telemetry` | `{ deviceVID, data: TelemetryData }` | MQTT tick from IoT machine |
| `machine:status` | `{ deviceVID, status: 'online'│'offline' }` | MQTT status topic |
| `machine:alert` | `{ deviceVID, type, message, severity }` | Text alert from machine |
| `order:cash_pending` | `{ orderId, machine_id, total_amount }` | New cash order from kiosk |
| `order:new` | `{ orderId, machine_id, payment_method }` | Any new order |

---

## 10. Page-by-Page Reference

### `/login`

- Form: email + password
- On submit: `POST /api/admin/auth/login`
- On success: store `accessToken` in Zustand, redirect to `/dashboard`
- Also: call `POST /api/admin/auth/refresh` on mount (restores session from cookie)

---

### `/dashboard`

Role-specific dashboard layouts:

**SUPER_ADMIN Dashboard:**
```
┌──────────────────────────────────────────────────────────────┐
│  HEADER: Company name — Plan PRO — Notifications Bell        │
├──────────────┬───────────────────┬───────────────────────────┤
│  KPI Cards   │  Revenue Chart    │   Machine Status Grid     │
│  Total Rev   │  (last 30 days)   │   [M1 ONLINE] [M2 WARN]  │
│  Today Rev   │  Recharts line    │   [M3 CRITICAL]           │
│  Orders Today│                   │                           │
│  Active Mach │                   │                           │
├──────────────┴───────────────────┴───────────────────────────┤
│  IoT Alerts (live from Socket.IO)                            │
│  CRITICAL: Machine M2 — Anomaly Detected at 14:32            │
│  HIGH: Machine M3 — Arduino Not Connected at 14:28           │
├──────────────────────────────────────────────────────────────┤
│  Pending Cash Orders  [ORDER A8F3 — M2 — ₹40 — CONFIRM]    │
├──────────────────────────────────────────────────────────────┤
│  Low Stock Alerts  [Masala Puri — M1 — 3 left — RESTOCK]   │
├──────────────────────────────────────────────────────────────┤
│  Recent Orders (last 10 across all machines)                 │
└──────────────────────────────────────────────────────────────┘
```

**TECHNICIAN Dashboard:**
```
┌──────────────────────────────────────────────────────────────┐
│  HEADER: Name — Role Technician — Notifications Bell         │
├──────────────────────────────────────────────────────────────┤
│  My Assigned Machines                                        │
│  [Machine A — ONLINE — Temp 32°C]                           │
│  [Machine B — LOW STOCK — Tank 10%]                         │
│  [Machine C — CRITICAL ALERT — Anomaly]                      │
├──────────────────────────────────────────────────────────────┤
│  My Alerts: CRITICAL Machine C — Anomaly Detected            │
├──────────────────────────────────────────────────────────────┤
│  Pending Cash Orders  [ORDER A8F3 — Machine B — CONFIRM]    │
├──────────────────────────────────────────────────────────────┤
│  Low Stock  [Masala Puri — Machine A — 3 left — RESTOCK]   │
└──────────────────────────────────────────────────────────────┘
```

---

### `/machines`

- Lists all machines with live status badges (`online` / `offline` / `alert`)
- Status badges read from `machineStore` (updated by Socket.IO)
- TECHNICIAN sees only assigned machines (backend filters automatically)

---

### `/machines/new`

- Opens camera QR scanner (`html5-qrcode` or `react-qr-reader`)
- Scans hardware serial number from the kiosk's `ProvisionScreen`
- Calls `POST /api/admin/machines/provision` with `{ serialNumber }`
- On success: machine is linked to this company in IoT backend

---

### `/machines/[deviceVID]`

Machine detail page layout:

```
┌──────────────────────────────────────────────────────────────┐
│  Machine VID   Status: ONLINE   Firmware: 1.2.3             │
├────────────────────────────┬─────────────────────────────────┤
│  LIVE TELEMETRY            │  TANK LEVELS                    │
│  Motor Temp:   32°C  🟢   │  Tank 1: 80%  ████████░░ 🟢   │
│  Motor Status: RUNNING     │  Tank 2: 40%  ████░░░░░░ 🟡   │
│  Current:      250 mA      │  Tank 3: 20%  ██░░░░░░░░ 🔴   │
│                            │  Tank 4: 75%  ███████░░░ 🟢   │
├────────────────────────────┴─────────────────────────────────┤
│  COMMANDS (Admin and Super Admin only)                       │
│  [Force Read Telemetry]  [Toggle Steering Motor]            │
├──────────────────────────────────────────────────────────────┤
│  STOCK / CATALOG                                             │
│  Slot A1: Masala Puri  Stock 3  [RESTOCK ▲]  ₹25           │
│  Slot B2: Mango Lassi  Stock 0  [OUT OF STOCK] ₹40         │
├──────────────────────────────────────────────────────────────┤
│  RECENT ORDERS for this machine                              │
│  [#64f9a — ₹90 — UPI — PAID — 2m ago]                      │
└──────────────────────────────────────────────────────────────┘
```

---

### `/products`

- Product library CRUD (company-scoped)
- List with search/filter by name, category, availability
- Modal form: create and update products
- Soft-delete confirmation dialog

---

### `/catalog`

- Machine selector dropdown (all machines)
- Lists MachineCatalog entries for selected machine
- Add product to machine (POST /api/admin/catalog)
- Inline stock update (PUT /api/admin/catalog/:id)
- Enable/disable toggle
- Remove from machine (DELETE /api/admin/catalog/:id)

---

### `/orders`

- TanStack Table: sortable + paginated
- Filter bar: machine, payment status, date range
- CONFIRM CASH button on each PENDING cash order
- Live badge on sidebar showing count of pending cash orders (from Socket.IO)

---

### `/analytics`

- KPI row: total revenue, orders, paid, avg order value
- Revenue over time: Recharts LineChart (day/week/month toggle)
- Top products: Recharts BarChart (by quantity sold)
- Revenue by machine: Recharts BarChart
- Payment methods breakdown: Recharts PieChart (UPI vs Cash)

---

### `/users`

- SUPER_ADMIN: sees all users (admins + technicians)
- ADMIN: sees technicians only
- Create user modal form with role selector
- Deactivate/activate user toggle
- Machine assignment section

---

### `/settings`

- Company profile: name, contact email, phone (SUPER_ADMIN only)
- Razorpay credentials (BYOK) per company
- Subscription plan display

### `/settings/account`

- Own profile: name, email (all roles)
- Change password form

---

## 11. Zustand Store Design

### `authStore.ts`

```typescript
interface AuthState {
  user: { id: string; email: string; role: Role; company_id: string } | null
  accessToken: string | null
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
  setToken: (token: string) => void
}
```

### `machineStore.ts`

```typescript
interface MachineStatus {
  status: 'online' | 'offline' | 'unknown'
  telemetry: TelemetryData | null
  hardwareAlert: string | null
  anomalyDetected: boolean
  lastUpdated: number
}

interface MachineStore {
  machines: Map<string, MachineStatus>   // key: deviceVID
  updateStatus: (deviceVID: string, status: string) => void
  updateTelemetry: (deviceVID: string, data: TelemetryData) => void
  setAlert: (deviceVID: string, alert: string) => void
  clearAnomaly: (deviceVID: string) => void
}
```

### `alertStore.ts`

```typescript
interface Alert {
  id: string
  deviceVID?: string
  severity: 'CRITICAL' | 'HIGH' | 'WARNING' | 'INFO'
  type: string
  message: string
  timestamp: number
  resolved: boolean
}

interface AlertStore {
  alerts: Alert[]
  unreadCount: number
  addAlert: (alert: Omit<Alert, 'id' | 'resolved'>) => void
  resolveAlert: (alertId: string) => void
  clearAll: () => void
}
```

---

## 12. API Map per Page

| Page | API Calls | Method |
|---|---|---|
| `/login` | `POST /api/admin/auth/login` | fetch |
| `/login` (on mount) | `POST /api/admin/auth/refresh` | fetch |
| `/dashboard` | `GET /api/admin/analytics/summary` | TanStack Query |
| `/dashboard` | `GET /api/admin/analytics/revenue-over-time` | TanStack Query |
| `/dashboard` | `GET /api/admin/orders?limit=10` | TanStack Query |
| `/dashboard` | `machine:status`, `machine:alert`, `order:cash_pending` | Socket.IO |
| `/machines` | `GET /api/admin/machines` | TanStack Query |
| `/machines` | `machine:status`, `machine:telemetry` | Socket.IO |
| `/machines/new` | `POST /api/admin/machines/provision` | useMutation |
| `/machines/[id]` | `GET /api/admin/machines/:id` | TanStack Query |
| `/machines/[id]` | `GET /api/admin/catalog?machine_id=:id` | TanStack Query |
| `/machines/[id]` | `GET /api/admin/orders?machine_id=:id` | TanStack Query |
| `/machines/[id]` | `PUT /api/admin/catalog/:catalogId` (stock) | useMutation |
| `/machines/[id]` | `POST /api/admin/machines/:id/commands` | useMutation |
| `/machines/[id]` | `machine:telemetry` filtered | Socket.IO |
| `/products` | `GET /api/admin/products` | TanStack Query |
| `/products` | `POST /api/admin/products` | useMutation |
| `/products` | `PUT /api/admin/products/:id` | useMutation |
| `/products` | `DELETE /api/admin/products/:id` | useMutation |
| `/catalog` | `GET /api/admin/catalog?machine_id=:id` | TanStack Query |
| `/catalog` | `POST /api/admin/catalog` | useMutation |
| `/catalog` | `PUT /api/admin/catalog/:id` | useMutation |
| `/catalog` | `DELETE /api/admin/catalog/:id` | useMutation |
| `/orders` | `GET /api/admin/orders?machine_id=&status=&page=` | TanStack Query |
| `/orders` | `POST /api/admin/orders/:id/confirm-cash` | useMutation |
| `/analytics` | `GET /api/admin/analytics/summary` | TanStack Query |
| `/analytics` | `GET /api/admin/analytics/revenue-by-machine` | TanStack Query |
| `/analytics` | `GET /api/admin/analytics/top-products` | TanStack Query |
| `/analytics` | `GET /api/admin/analytics/revenue-over-time` | TanStack Query |
| `/analytics` | `GET /api/admin/analytics/payment-methods` | TanStack Query |
| `/users` | `GET /api/admin/users` | TanStack Query |
| `/users` | `POST /api/admin/users` | useMutation |
| `/users` | `PUT /api/admin/users/:id` | useMutation |
| `/users` | `PATCH /api/admin/users/:id/status` | useMutation |
| `/users` | `DELETE /api/admin/users/:id` | useMutation |
| `/users` | `GET /api/admin/assignments` | TanStack Query |
| `/users` | `POST /api/admin/assignments` | useMutation |
| `/users` | `DELETE /api/admin/assignments/:id` | useMutation |
| `/settings` | `GET /api/admin/company` | TanStack Query |
| `/settings` | `PUT /api/admin/company` | useMutation |

---

## 13. TanStack Query Polling Strategy

| Data | Cache Time | Refetch Trigger |
|---|---|---|
| Dashboard analytics | 5 minutes | Every 5 min |
| Orders list | On window focus | After confirm-cash mutation |
| Catalog / stock | 2 minutes | On PUT mutation invalidate |
| Machine telemetry | NOT POLLED | Socket.IO only |
| User list | 10 minutes | On POST/PATCH mutation |
| Analytics charts | 5 minutes | Time range change |

```typescript
// Example: Orders with refetch on focus
const { data } = useQuery({
  queryKey: ['orders', filters],
  queryFn: () => api.get('/api/admin/orders', { params: filters }),
  staleTime: 0,
  refetchOnWindowFocus: true,
})

// After confirming cash, invalidate the orders query:
const mutation = useMutation({
  mutationFn: (id) => api.post(`/api/admin/orders/${id}/confirm-cash`),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders'] }),
})
```

---

## 14. Alert System

### Alert Severity Levels

| Severity | Trigger | Sound | UI Effect |
|---|---|---|---|
| **CRITICAL** | `"Anomaly Detected"` MQTT string | Looping alarm until dismissed | Full-screen red banner + red machine badge |
| **HIGH** | `"Device(Arduino) Not Connected"` MQTT string | Single chime | Toast notification + orange badge |
| **WARNING** | Tank level < 15% | None | Sidebar badge + inline warning |
| **INFO** | Machine came online | None | Status badge update only |

### Alert Flow

```
MQTT text payload → SaaS backend mqttService.js
  → Looks up company_id for this deviceVID
  → io.to(company_id).emit('machine:alert', { deviceVID, type, message, severity })

Admin Panel socket listener (useSocket.ts)
  → alertStore.addAlert({ ...alertData, timestamp: Date.now() })
  → If CRITICAL: AlertBanner renders + AlertSound plays loop
  → If HIGH: AlertToast shows + single chime plays
  → machineStore badge updates color
```

### Alert Dismissal

```
Admin clicks Dismiss on CRITICAL banner
  → alertStore.resolveAlert(alertId)
  → Sound stops
  → Banner disappears
  → Machine badge stays colored until device sends normal telemetry again
```

### Route-level Access Control

```typescript
// components/layout/ProtectedRoute.tsx
interface Props {
  allowedRoles: Role[]
  children: React.ReactNode
}

export function ProtectedRoute({ allowedRoles, children }: Props) {
  const { role, isAuthenticated } = useAuthStore()

  if (!isAuthenticated) return <Navigate to="/login" />
  if (!allowedRoles.includes(role)) return <Navigate to="/dashboard" />

  return <>{children}</>
}
```

---

## 15. Build Plan (Phase by Phase)

### Phase 1 — Foundation + Auth

**Goal:** Login works. Protected routing. Role-based sidebar renders.

```bash
npx create-next-app@latest admin-panel --typescript --tailwind --app
npm i zustand @tanstack/react-query axios socket.io-client recharts lucide-react
npx shadcn-ui@latest init
```

Files to build:
1. `.env.local` — API URLs
2. `src/lib/api.ts` — Axios instance + Bearer token + 401 refresh interceptor
3. `src/store/authStore.ts` — user, role, company_id, accessToken
4. `src/hooks/useAuth.ts` — login(), logout() wrapping authStore
5. `src/app/login/page.tsx` — email + password form
6. `src/app/(dashboard)/layout.tsx` — Sidebar + Header + auth guard + Socket.IO init
7. `src/components/layout/Sidebar.tsx` — role-aware nav links + alert badge
8. `src/components/layout/ProtectedRoute.tsx` — allowedRoles[] prop + redirect

**APIs needed:** `POST /api/admin/auth/login`, `POST /api/admin/auth/refresh`

---

### Phase 2 — Dashboard + Socket.IO Real-time

**Goal:** Dashboard loads KPIs. Machine status updates live.

**PREREQUISITE:** SaaS backend mqttService.js + Socket.IO must be running.

Files to build:
1. `src/lib/socket.ts` — Socket.IO singleton
2. `src/hooks/useSocket.ts` — event listeners → update stores
3. `src/store/machineStore.ts` + `src/store/alertStore.ts`
4. `src/components/alerts/AlertBanner.tsx` — CRITICAL full-screen banner
5. `src/components/alerts/AlertSound.tsx` — play/stop alarm audio
6. `src/app/(dashboard)/dashboard/page.tsx` — KPIs + chart + machine grid
7. `src/components/dashboard/MachineStatusGrid.tsx` — reads machineStore, live badges

---

### Phase 3 — Machines + IoT Telemetry

**Goal:** Machine list and detail with live telemetry panels.

Files to build:
1. `src/app/(dashboard)/machines/page.tsx` — TanStack Query + machineStore overlay
2. `src/app/(dashboard)/machines/new/page.tsx` — QR scanner + POST provision
3. `src/components/machines/MachineCard.tsx` — status badge + motor temp
4. `src/app/(dashboard)/machines/[deviceVID]/page.tsx` — device info + catalog + orders
5. `src/components/machines/TelemetryPanel.tsx` — dynamic widgets from components[]
6. `src/components/machines/TankLevelBar.tsx` — fill bar with color thresholds
7. `src/components/machines/MotorStatus.tsx` — gauge with temp color thresholds
8. `src/components/machines/CommandPanel.tsx` — ADMIN only buttons

---

### Phase 4 — Products, Catalog, Orders

Files to build:
1. `src/app/(dashboard)/products/page.tsx` — full CRUD with modal forms
2. `src/app/(dashboard)/catalog/page.tsx` — machine selector + add/update/remove
3. `src/app/(dashboard)/orders/page.tsx` — TanStack Table + CONFIRM CASH button

---

### Phase 5 — Analytics

Files to build:
1. `src/app/(dashboard)/analytics/page.tsx`
   - KPI row (summary endpoint)
   - Revenue over time: Recharts LineChart
   - Top products: Recharts BarChart
   - Revenue by machine: Recharts BarChart
   - Payment methods: Recharts PieChart

---

### Phase 6 — Users + Machine Assignment

Files to build:
1. `src/app/(dashboard)/users/page.tsx` — role-filtered user list
2. `src/app/(dashboard)/users/new/page.tsx` — create user with role selector
3. Assignment UI on `/machines/[deviceVID]` — assign/unassign technicians

---

## 16. IoT Telemetry Widgets

All telemetry arrives via Socket.IO → `machine:telemetry` event.

### Telemetry Data Shape

```typescript
interface TelemetryData {
  'Steering Motor Temperature': number    // °C
  'Tank Levels': number[]                 // array of % fill values (0-100)
  'Steering Motor': boolean               // true = running
  'Current Sensor': number               // mA
}
```

### Widget Color Thresholds

**Motor Temperature Gauge:**
| Temperature | Color | State |
|---|---|---|
| < 50°C | 🟢 Green | Normal |
| 50–70°C | 🟡 Amber | Warning |
| > 70°C | 🔴 Red | CRITICAL |

**Tank Level Bar:**
| Fill % | Color | State |
|---|---|---|
| > 30% | 🟢 Green | Normal |
| 15–30% | 🟡 Amber | Low |
| < 15% | 🔴 Red | Critical — trigger restock alert |

### Dynamic Widget Rendering

Use `components[]` from the IoT device info endpoint to determine which widgets to show:

```typescript
// GET /api/admin/machines/:deviceVID returns:
// { ..., components: [{ catagory: 'tank', name: 'Tank 1', type: 'sensor' }, ...] }

// Render fill bars only for entries with catagory === 'tank'
const tanks = device.components.filter(c => c.catagory === 'tank')
// Each tank maps to a Tank Level from TelemetryData['Tank Levels'][index]
```

No hardcoding of widget count. A machine with 2 tanks shows 2 fill bars; a machine with 4 shows 4.

### Page Routes by Role

```
SUPER_ADMIN:
  /login, /dashboard, /machines, /machines/new, /machines/[deviceVID],
  /products, /catalog, /orders, /analytics, /users, /users/new,
  /settings, /settings/account

ADMIN:
  /dashboard, /machines, /machines/new, /machines/[deviceVID],
  /products, /catalog, /orders, /analytics,
  /users (technicians only), /users/new (technician only),
  /settings/account

TECHNICIAN:
  /dashboard (assigned machines task board),
  /machines (assigned only), /machines/[deviceVID] (stock + telemetry, no pricing, no commands),
  /orders (pending cash for assigned machines only),
  /settings/account
```
