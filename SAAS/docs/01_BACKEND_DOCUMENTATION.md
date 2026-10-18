# M9Vends SaaS Backend — Full Technical Documentation

> **Version:** 1.0.0 | **Runtime:** Node.js + Express 5 | **Database:** MongoDB Atlas (Mongoose 9)
> **Author:** M9Vends Engineering | **Last Updated:** October 2026

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Tech Stack & Dependencies](#2-tech-stack--dependencies)
3. [Environment Variables](#3-environment-variables)
4. [Project Structure](#4-project-structure)
5. [Data Models (MongoDB Schemas)](#5-data-models-mongodb-schemas)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [API Reference — Public Routes](#7-api-reference--public-routes)
8. [API Reference — Admin Routes](#8-api-reference--admin-routes)
9. [Services Layer](#9-services-layer)
10. [Real-Time Layer (Socket.IO + MQTT)](#10-real-time-layer-socketio--mqtt)
11. [Error Handling](#11-error-handling)
12. [Running the Server](#12-running-the-server)

---

## 1. System Overview

M9Vends is a multi-tenant SaaS backend for smart vending machine management. It connects three distinct actors:

```
┌──────────────────────────────────────────────────────────────────────┐
│                       M9Vends Platform Overview                      │
│                                                                      │
│  ┌──────────────┐   REST (public)  ┌───────────────────────────┐    │
│  │  User Kiosk  │ ◄──────────────► │   SaaS Backend  :5000     │    │
│  │  React/Vite  │                  │   /api/public/*            │    │
│  └──────────────┘                  │   /api/admin/*             │    │
│                                    │                             │    │
│  ┌──────────────┐  REST + Socket.IO│   Socket.IO server         │    │
│  │ Admin Panel  │ ◄──────────────► │   MQTT client (server-side)│    │
│  │  Next.js 14  │                  └───────────┬───────────────┘    │
│  └──────────────┘                              │                     │
│                                          IoT REST proxy               │
│                                                │                     │
│                               ┌────────────────▼────────────────┐   │
│                               │   IoT Backend Service  :3001    │   │
│                               │   Device registry + provisioning│   │
│                               │   MQTT token issuance           │   │
│                               └────────────────┬────────────────┘   │
│                                                │                     │
│                                         MQTT :1883                   │
│                                                │                     │
│                               ┌────────────────▼────────────────┐   │
│                               │   MQTT Broker 13.239.132.146    │   │
│                               │   TCP :1883 | WS :8083          │   │
│                               └────────────────┬────────────────┘   │
│                                                │                     │
│                               ┌────────────────▼────────────────┐   │
│                               │   Physical Vending Machines      │   │
│                               │   (Arduino + IoT Unit)          │   │
│                               └─────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Details |
|---|---|
| `machine_id` = `deviceVID` | IoT backend assigns a MongoDB ObjectId string per device. SaaS backend stores it as a plain `String` — no Device collection exists in SaaS. |
| No auth on public routes | `/api/public/*` is fully open; security relies on `machine_id` (only provisioned machines know theirs). |
| Multi-tenant isolation | Every data model has `company_id`. All admin queries MUST filter by it via `tenantMiddleware`. |
| Cash payment flow | Creates order, admin confirms manually via `POST /api/admin/orders/:id/confirm-cash`. |
| Token strategy | Access token (1 day, in memory). Refresh token (7 days, httpOnly cookie). |
| IoT Backend is separate | Device registration, provisioning, and MQTT brokering live in the IoT service. SaaS backend proxies device calls and bridges MQTT → Socket.IO. |

> 📄 **See also:** [00_IOT_BACKEND_DOCUMENTATION.md](./00_IOT_BACKEND_DOCUMENTATION.md) for the full IoT backend reference.

---

## 2. Tech Stack & Dependencies

### Runtime & Framework

| Package | Version | Purpose |
|---|---|---|
| `express` | ^5.2.1 | HTTP server framework |
| `mongoose` | ^9.6.2 | MongoDB ODM |
| `socket.io` | ^4.8.3 | Real-time WebSocket events to admin panel |
| `mqtt` | ^5.15.2 | MQTT broker connection (IoT telemetry) |

### Security

| Package | Purpose |
|---|---|
| `jsonwebtoken` | JWT generation & verification |
| `bcrypt` | Password hashing (cost factor 10–12) |
| `helmet` | Secure HTTP response headers |
| `express-rate-limit` | Brute-force protection on auth routes |
| `cors` | CORS policy (credentials + specific origins) |
| `zod` | Runtime env-var validation on startup |

### Utilities

| Package | Purpose |
|---|---|
| `dotenv` | `.env` file loading |
| `morgan` | HTTP request logger |
| `compression` | Gzip compression |
| `cookie-parser` | Parse httpOnly refresh token cookie |
| `pino` | Structured JSON logger |
| `razorpay` | Razorpay payment gateway client |

### Dev Tools

| Package | Purpose |
|---|---|
| `nodemon` | Auto-restart on file change |

---

## 3. Environment Variables

All env vars are validated at startup using Zod. The server **exits immediately** if any required var is missing or invalid.

```env
# ── Server ────────────────────────────────────────
PORT=5000
NODE_ENV=development           # development | production | test

# ── Database ─────────────────────────────────────
MONGO_URI=mongodb+srv://...    # REQUIRED — MongoDB Atlas connection string

# ── JWT ──────────────────────────────────────────
JWT_ACCESS_SECRET=...          # REQUIRED — min 10 chars
JWT_REFRESH_SECRET=...         # REQUIRED — min 10 chars
ACCESS_TOKEN_EXPIRY=1d         # default: 1d
REFRESH_TOKEN_EXPIRY=7d        # default: 7d

# ── CORS Origins ─────────────────────────────────
FRONTEND_URL=http://localhost:3000   # Admin panel production URL
KIOSK_URL=http://localhost:5174      # Kiosk production URL

# ── Payment Gateway ───────────────────────────────
RAZORPAY_KEY_ID=rzp_test_...        # Razorpay Key ID
RAZORPAY_KEY_SECRET=...             # Razorpay Key Secret

# ── IoT / MQTT ────────────────────────────────────
MQTT_BROKER_HOST=13.239.132.146
MQTT_BROKER_TCP_PORT=1883
MQTT_ADMIN_USERNAME=Admin
MQTT_ADMIN_PASSWORD=Admin@123
IOT_API_BASE_URL=https://m9vends-iot-backend-service.onrender.com
```

> ⚠️ **Never commit `.env` to version control.**

---

## 4. Project Structure

```
backend/
├── .env                        # Environment variables (gitignored)
├── package.json
├── src/
│   ├── server.js               # Entry point: env validation, DB, Socket.IO, MQTT
│   ├── app.js                  # Express app: middleware, route registration
│   ├── config/
│   │   └── db.js               # MongoDB connection (connectDB function)
│   ├── models/                 # Mongoose schemas (6 models)
│   │   ├── Company.js
│   │   ├── User.js
│   │   ├── Product.js
│   │   ├── MachineCatalog.js
│   │   ├── MachineAssignment.js
│   │   └── Order.js
│   ├── services/               # Business logic (11 services)
│   │   ├── authService.js
│   │   ├── userService.js
│   │   ├── companyService.js
│   │   ├── productService.js
│   │   ├── catalogService.js
│   │   ├── orderService.js
│   │   ├── paymentService.js
│   │   ├── machineService.js
│   │   ├── analyticsService.js
│   │   ├── mqttService.js
│   │   └── socketService.js
│   ├── api/
│   │   ├── admin/
│   │   │   ├── controllers/    # 9 controller files
│   │   │   ├── routes/         # 10 route files
│   │   │   ├── middlewares/    # auth, tenant, RBAC, error
│   │   │   └── validators/     # Zod/Joi input validators
│   │   └── public/
│   │       ├── controllers/    # catalogController, orderController
│   │       └── routes/         # catalogRoutes, orderRoutes
│   └── utils/
│       ├── ApiError.js         # Custom error class with status codes
│       ├── logger.js           # Pino structured logger
│       ├── jwt.js              # Token generation helpers
│       └── validate.js         # Generic Zod validation middleware
└── docs/                       # Project documentation
```

---

## 5. Data Models (MongoDB Schemas)

### 5.1 Company

```javascript
// Collection: companies
{
  company_name:     String,       // REQUIRED
  plan:             "FREE" | "PRO" | "ENTERPRISE",  // default: FREE
  contact_email:    String | null,
  contact_phone:    String | null,
  is_active:        Boolean,       // default: true
  plan_expires_at:  Date | null,
  razorpay_key_id:  String | null, // BYOK Razorpay integration
  razorpay_key_secret: String | null,
  createdAt, updatedAt             // auto
}
```

> ⚠️ **No API endpoint to create Company yet.** First company must be inserted directly in MongoDB Atlas.

---

### 5.2 User

```javascript
// Collection: users
{
  company_id:    ObjectId → Company,  // REQUIRED — tenant key
  name:          String,              // REQUIRED
  email:         String,              // REQUIRED, unique, lowercase
  password_hash: String,              // bcrypt hash — never returned in responses
  role:          "SUPER_ADMIN" | "ADMIN" | "TECHNICIAN",
  is_active:     Boolean,             // default: true
  devices:       [ObjectId],          // reserved
  last_login_at: Date | null,
  refresh_token: String | null,       // stored for token rotation
  createdAt, updatedAt
}
```

**Role hierarchy:**
- `SUPER_ADMIN` — full access to all resources across the company
- `ADMIN` — manages day-to-day operations (products, catalog, orders)
- `TECHNICIAN` — limited to assigned machines only

---

### 5.3 Product

```javascript
// Collection: products
{
  company_id:   ObjectId → Company,  // tenant isolation
  product_name: String,              // REQUIRED
  description:  String | null,
  image_url:    String | null,       // S3/CDN URL (currently null)
  price:        Number,              // REQUIRED, ≥ 0 (base price in INR)
  is_available: Boolean,             // default: true
  category:     String,              // default: "General"
  sku:          String | null,       // unique per company (sparse index)
  tax_percent:  Number,              // 0–100, default: 0
  is_deleted:   Boolean,             // soft delete, default: false
  deleted_at:   Date | null,
  createdAt, updatedAt
}
```

**Indexes:**
- `{ company_id, sku }` — unique + sparse (SKU uniqueness per company)
- `{ company_id, category }` — fast category listing
- `{ company_id, product_name }` — fast name search

---

### 5.4 MachineCatalog

```javascript
// Collection: machinecatalogs
// Represents a single product slot in a specific machine.
{
  company_id:       ObjectId → Company,  // REQUIRED — tenant isolation
  machine_id:       String,              // REQUIRED — deviceVID from IoT
  product_id:       ObjectId → Product,  // REQUIRED
  stock:            Number,              // current slot stock count, ≥ 0
  max_capacity:     Number,              // slot capacity, default: 50
  is_enabled:       Boolean,             // show/hide on customer catalog
  price_override:   Number | null,       // machine-level price (overrides Product.price)
  slot_label:       String | null,       // physical slot label: "A1", "B3" etc.
  last_restocked_at: Date | null,        // auto-set when stock is updated
  createdAt, updatedAt
}
```

**Indexes:**
- `{ company_id, machine_id, product_id }` — unique (one product per machine slot)
- `{ company_id, machine_id }` — fast catalog lookups

---

### 5.5 MachineAssignment

```javascript
// Collection: machineassignments
// Links a Technician User to a specific machine.
// SUPER_ADMIN and ADMIN see all machines without an assignment record.
{
  company_id:    ObjectId → Company,  // tenant isolation
  machine_id:    String,              // deviceVID from IoT backend
  technician_id: ObjectId → User,     // must have role: TECHNICIAN
  assigned_by:   ObjectId → User,     // who made the assignment
  createdAt, updatedAt
}
```

**Index:** `{ machine_id, technician_id }` — unique (can't assign same technician twice)

---

### 5.6 Order

```javascript
// Collection: orders
{
  company_id:          ObjectId → Company,
  machine_id:          String,    // deviceVID — where the purchase was made
  items: [{
    catalog_id:   ObjectId → MachineCatalog,
    product_id:   ObjectId → Product,
    product_name: String,
    quantity:     Number,
    unit_price:   Number,    // INR — snapshot at order time
    subtotal:     Number,    // unit_price × quantity
  }],
  total_amount:        Number,    // INR, ≥ 1
  razorpay_order_id:   String | null,
  razorpay_payment_id: String | null,
  payment_status:      "PENDING" | "PAID" | "FAILED" | "REFUNDED",
  order_status:        "PLACED" | "DISPENSING" | "COMPLETED" | "CANCELLED",
  qr_code:             String | null,
  payment_link:        String | null,  // upi://pay?... deep link
  paid_at:             Date | null,
  payment_method:      "UPI" | "CASH" | "CARD" | "WALLET",
  createdAt, updatedAt
}
```

**Indexes:**
- `{ machine_id, payment_status }` — fast polling queries
- `{ company_id, createdAt: -1 }` — fast admin order listing

---

## 6. Authentication & Authorization

### 6.1 JWT Token Strategy

```
Login → generates:
  accessToken  (1 day)  — stored in memory by admin panel
  refreshToken (7 days) — stored in httpOnly cookie (auto-sent by browser)

On 401 response:
  POST /api/admin/auth/refresh → new accessToken + rotated refreshToken
  Retry original request
```

### 6.2 Middleware Stack (Admin Routes)

Every protected admin request passes through this chain:

```
Request
  ↓
authMiddleware        — Verifies Bearer token, attaches req.user
  ↓
tenantMiddleware      — Fetches Company record, attaches req.company
                        Returns 403 if company is inactive
  ↓
authorizeRoles(...)   — RBAC check: role must be in allowed list
  ↓
Controller
```

### 6.3 Roles & Permissions Summary

| Action | SUPER_ADMIN | ADMIN | TECHNICIAN |
|---|---|---|---|
| Register/manage users | ✅ All | ✅ Technicians only | ❌ |
| View all machines | ✅ | ✅ | Assigned only |
| Send IoT commands | ✅ | ✅ | ❌ |
| Manage products | ✅ | ✅ | ❌ |
| Manage catalog | ✅ | ✅ | Stock update only |
| View all orders | ✅ | ✅ | Assigned machines |
| Confirm cash payment | ✅ | ✅ | ✅ |
| View analytics | ✅ | ✅ | ❌ |
| Company settings | ✅ | View only | ❌ |

---

## 7. API Reference — Public Routes

> **Base URL:** `http://localhost:5000`
> **Auth:** None required
> **Content-Type:** `application/json`

All public routes live under `/api/public/` and are intended for the customer-facing kiosk.

---

### `GET /api/public/catalog/:machine_id`

Fetches all active, enabled products for a vending machine.

**Path Params:**

| Param | Type | Description |
|---|---|---|
| `machine_id` | String | The `deviceVID` from the IoT backend wake-up response |

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
      "description": "Tangy street-style pani puri",
      "image_url": null,
      "price": 25,
      "stock": 48,
      "slot_label": "A1"
    }
  ]
}
```

**Rules:**
- Only `is_enabled: true` AND `is_available: true` products appear
- `price` uses `price_override` if set, else falls back to `Product.price`
- `stock === 0` → out of stock (disable Add to Cart on kiosk)
- `image_url` can be `null` → kiosk should show placeholder emoji/image

**Errors:**
```json
{ "success": false, "message": "Machine ID is required" }      // 400
{ "success": false, "message": "Machine '...' not found" }     // 404
```

---

### `POST /api/public/order`

Creates a new order for a machine. Supports both UPI and Cash payment methods.

**Request Body:**
```json
{
  "machine_id": "60d5ec49f3e4e9001f3b2e99",
  "payment_method": "UPI",
  "items": [
    { "catalog_id": "64f1a2b3c4d5e6f7a8b9c0d1", "quantity": 2 },
    { "catalog_id": "64f1a2b3c4d5e6f7a8b9c0d3", "quantity": 1 }
  ]
}
```

| Field | Required | Default | Notes |
|---|---|---|---|
| `machine_id` | ✅ | — | `deviceVID` from IoT |
| `items` | ✅ | — | Array of catalog items |
| `items[].catalog_id` | ✅ | — | Must be a valid MongoDB ObjectId from catalog API |
| `items[].quantity` | ✅ | — | Integer ≥ 1 |
| `payment_method` | ❌ | `"UPI"` | `"UPI"` or `"CASH"` |

**Success `201` (UPI):**
```json
{
  "success": true,
  "data": {
    "order_id": "64f9a1b2c3d4e5f6a7b8c9d0",
    "razorpay_order_id": "order_NeFKQJQhA1ZWGb",
    "total_amount": 90,
    "currency": "INR",
    "payment_link": "upi://pay?pa=MERCHANT_UPI_ID&pn=M9Vends&tr=order_NeFKQJQhA1ZWGb&am=90&cu=INR",
    "items": [...]
  }
}
```

**Success `201` (CASH):**
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

**Validation errors (`400`):**
```json
{ "message": "Invalid catalog_id '...'. Must be a valid MongoDB ObjectId" }
{ "message": "Catalog item '...' not found or disabled" }
{ "message": "Insufficient stock for 'Masala Pani Puri'. Available: 3" }
{ "message": "'Mango Lassi' is not available" }
```

---

### `GET /api/public/order/:id/status`

Poll this endpoint every ~3 seconds after placing an order.

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

| Value | Kiosk Action |
|---|---|
| `"PENDING"` | Keep polling |
| `"PAID"` | Stop polling → navigate to Success screen |
| `"FAILED"` | Stop polling → navigate to Failed screen |
| `"REFUNDED"` | Stop polling → show refund message |

**`order_status` values:**

| Value | Meaning |
|---|---|
| `"PLACED"` | Created, awaiting payment |
| `"DISPENSING"` | Paid, machine is dispensing |
| `"COMPLETED"` | Items dispensed |
| `"CANCELLED"` | Order cancelled |

---

### `POST /api/public/order/:id/cancel`

Cancel a pending order (UPI timeout or user pressed Cancel).

```json
{ "success": true, "message": "Order cancelled successfully" }
```

Only cancels orders with `payment_status: "PENDING"`. Already-paid orders return a 400 error.

---

### `POST /api/public/payment/webhook/:company_id`

> 🚫 **Internal only.** Called by Razorpay automatically — not the kiosk.

Verifies Razorpay `payment.captured` webhook via HMAC-SHA256. On success, marks order `PAID` + `DISPENSING` and decrements stock.

---

## 8. API Reference — Admin Routes

> **Base URL:** `http://localhost:5000`
> **Auth:** All routes require `Authorization: Bearer <accessToken>` header
> **Content-Type:** `application/json`

---

### 8.1 Authentication (`/api/admin/auth`)

#### `POST /api/admin/auth/register`

Creates a new user account (rate-limited: 10 requests / 15 min).

**Request:**
```json
{
  "company_id": "64f1a2b3c4d5e6f7a8b9c0d1",
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepass123",
  "role": "ADMIN"
}
```

**Success `201`:** Returns user object (without `password_hash`).

---

#### `POST /api/admin/auth/login`

Rate-limited: 10 requests / 15 min.

**Request:**
```json
{ "email": "john@example.com", "password": "securepass123" }
```

**Success `200`:**
```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "...",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "ADMIN",
    "company_id": "..."
  }
}
```

The `refreshToken` is set as an **httpOnly cookie** (`refresh_token`) — not in the body.

---

#### `POST /api/admin/auth/refresh`

Rotates tokens using the httpOnly cookie. Browser sends cookie automatically.

**Success `200`:**
```json
{ "accessToken": "...", "refreshToken": "..." }
```

---

#### `POST /api/admin/auth/logout` 🔒

Requires valid access token. Invalidates refresh token in DB and clears cookie.

---

#### `GET /api/admin/auth/me` 🔒

Returns current user's profile and company name.

---

### 8.2 User Management (`/api/admin/users`) 🔒

All routes require auth + tenant middleware.

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/api/admin/users/me` | Any | Get own profile |
| `GET` | `/api/admin/users` | SUPER_ADMIN | List all company users |
| `POST` | `/api/admin/users` | SUPER_ADMIN, ADMIN | Invite new user |
| `POST` | `/api/admin/users/invite` | SUPER_ADMIN | Invite new user (alias) |
| `PATCH` | `/api/admin/users/:id/status` | SUPER_ADMIN | Activate/deactivate user |
| `PUT` | `/api/admin/users/:id` | SUPER_ADMIN | Update user details |
| `DELETE` | `/api/admin/users/:id` | SUPER_ADMIN | Delete user permanently |

**POST /api/admin/users — Invite User:**
```json
{
  "name": "Jane Tech",
  "email": "jane@example.com",
  "password": "temppass123",
  "role": "TECHNICIAN"
}
```

**PATCH /api/admin/users/:id/status — Toggle User Active State:**
```json
{ "is_active": false }
```

---

### 8.3 Products (`/api/admin/products`) 🔒

Requires role: `SUPER_ADMIN` or `ADMIN`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/admin/products` | Create a new product |
| `GET` | `/api/admin/products` | List all company products |
| `GET` | `/api/admin/products/:id` | Get a single product |
| `PUT` | `/api/admin/products/:id` | Update product |
| `DELETE` | `/api/admin/products/:id` | Soft-delete product |

**POST /api/admin/products — Create Product:**
```json
{
  "product_name": "Masala Pani Puri",
  "description": "Tangy street-style pani puri with mint water",
  "price": 25,
  "category": "Snacks",
  "sku": "PPU-001",
  "tax_percent": 5
}
```

> Products are **soft-deleted** — `is_deleted: true` + `deleted_at` timestamp. This preserves order history that references the product.

---

### 8.4 Machine Catalog (`/api/admin/catalog`) 🔒

Requires role: `SUPER_ADMIN` or `ADMIN`.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/admin/catalog` | Add a product to a machine's catalog |
| `GET` | `/api/admin/catalog?machine_id=...` | List catalog entries for a machine |
| `PUT` | `/api/admin/catalog/:id` | Update stock, price, slot, enabled status |
| `DELETE` | `/api/admin/catalog/:id` | Remove product from machine catalog |

**POST /api/admin/catalog — Add Product to Machine:**
```json
{
  "machine_id": "60d5ec49f3e4e9001f3b2e99",
  "product_id": "64f1a2b3c4d5e6f7a8b9c0d2",
  "stock": 50,
  "max_capacity": 50,
  "slot_label": "A1",
  "price_override": 30,
  "is_enabled": true
}
```

**PUT /api/admin/catalog/:id — Allowed update fields only:**
```json
{
  "stock": 45,
  "is_enabled": true,
  "price_override": 30,
  "slot_label": "A2",
  "max_capacity": 60
}
```

> Setting `stock` automatically updates `last_restocked_at` timestamp.

---

### 8.5 Orders (`/api/admin/orders`) 🔒

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/api/admin/orders` | Any | List orders (filtered by role) |
| `POST` | `/api/admin/orders/:id/confirm-cash` | SUPER_ADMIN, ADMIN | Confirm cash payment |

**GET /api/admin/orders — Query Params:**

| Param | Type | Description |
|---|---|---|
| `machine_id` | String | Filter by machine |
| `status` | String | `PENDING`, `PAID`, `FAILED`, `REFUNDED` |
| `page` | Number | Page number (default: 1) |
| `limit` | Number | Items per page (default: 20) |

```
GET /api/admin/orders?machine_id=60d5ec49f3e4e9001f3b2e99&status=PENDING&page=1
```

**POST /api/admin/orders/:id/confirm-cash:**

Marks a PENDING cash order as PAID + DISPENSING. Decrements stock. No request body needed.

**Success `200`:**
```json
{ "success": true, "message": "Cash payment confirmed", "order": { ... } }
```

---

### 8.6 Analytics (`/api/admin/analytics`) 🔒

All endpoints support optional `from_date` and `to_date` query params (ISO date strings).

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/analytics/summary` | KPI totals |
| `GET` | `/api/admin/analytics/revenue-by-machine` | Revenue per machine |
| `GET` | `/api/admin/analytics/top-products` | Top selling products |
| `GET` | `/api/admin/analytics/revenue-over-time` | Daily/weekly/monthly revenue |
| `GET` | `/api/admin/analytics/payment-methods` | UPI vs Cash breakdown |
| `GET` | `/api/admin/analytics/revenue-by-company` | Multi-company (SUPER_ADMIN only) |

**GET /api/admin/analytics/summary:**
```json
{
  "total_orders": 500,
  "total_revenue": 12500,
  "paid_orders": 480,
  "pending_orders": 10,
  "failed_orders": 10,
  "cash_orders": 100,
  "upi_orders": 380,
  "avg_order_value": 26.04
}
```

**GET /api/admin/analytics/revenue-over-time?group_by=day:**
```json
[
  { "period": { "year": 2026, "month": 10, "day": 17 }, "revenue": 500, "order_count": 20 }
]
```

`group_by` options: `day` | `week` | `month`

---

### 8.7 Machines (`/api/admin/machines`) 🔒

These routes proxy requests to the IoT backend REST service.

| Method | Path | Role | Description |
|---|---|---|---|
| `GET` | `/api/admin/machines` | Any | List all machines (TECHNICIAN sees assigned only) |
| `POST` | `/api/admin/machines/provision` | SUPER_ADMIN, ADMIN | Provision new machine via serial number |
| `GET` | `/api/admin/machines/:machine_id` | Any | Get machine detail + components |
| `GET` | `/api/admin/machines/:machine_id/telemetry` | Any | Latest cached MQTT telemetry |
| `POST` | `/api/admin/machines/:machine_id/commands` | SUPER_ADMIN, ADMIN | Send command to machine |

**POST /api/admin/machines/provision:**
```json
{ "serialNumber": "SN-M9V-4820" }
```

**POST /api/admin/machines/:machine_id/commands:**
```json
{ "message": "getDataFromHardware" }
// or
{ "message": "toggleSteeringMotor" }
```

**GET /api/admin/machines/:machine_id** returns the IoT device payload enriched with `latestTelemetry` from the in-memory MQTT cache.

---

### 8.8 Machine Assignments (`/api/admin/assignments`) 🔒

Requires role: `SUPER_ADMIN` or `ADMIN`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/assignments` | List all technician assignments |
| `POST` | `/api/admin/assignments` | Assign technician to a machine |
| `DELETE` | `/api/admin/assignments/:id` | Remove a technician assignment |

**POST /api/admin/assignments:**
```json
{
  "machine_id": "60d5ec49f3e4e9001f3b2e99",
  "technician_id": "64f1a2b3c4d5e6f7a8b9c0d1"
}
```

---

### 8.9 Company Management

#### Self-Management (`/api/admin/company`) 🔒 — ADMIN / SUPER_ADMIN

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/company` | Get own company profile |
| `PUT` | `/api/admin/company` | Update own company profile |

#### Global Management (`/api/admin/companies`) 🔒

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/companies` | List all companies |
| `POST` | `/api/admin/companies` | Create a new company |
| `PATCH` | `/api/admin/companies/:id` | Update a company |

---

## 9. Services Layer

Business logic is separated from controllers in the `services/` directory.

### 9.1 `authService.js`

| Function | Description |
|---|---|
| `loginUser({ email, password })` | Validates credentials, generates tokens, stores refresh token in DB |
| `registerUser({ company_id, name, email, password, role })` | Hashes password, creates user |
| `refreshTokenService(refreshToken)` | Rotates both tokens |
| `logoutUser(userId)` | Invalidates refresh token in DB |

### 9.2 `orderService.js`

| Function | Description |
|---|---|
| `placeOrder({ machine_id, items, payment_method })` | Validates catalog items, checks stock, creates Order, calls Razorpay (UPI) |
| `getOrderStatus(orderId)` | Returns order payment/delivery status |
| `markOrderPaid({ razorpay_order_id, razorpay_payment_id })` | Called by webhook — marks PAID + decrements stock |
| `confirmCashPayment({ company_id, orderId })` | Admin manually confirms cash — marks PAID + decrements stock |
| `cancelOrder(orderId)` | Sets FAILED + CANCELLED (only PENDING orders) |
| `getCompanyOrders({ company_id, machine_id, status, page, limit })` | Paginated order list for admin |

**Stock Decrement Logic:**

After payment confirmation (UPI or Cash), `decrementStock()` is called:
```js
// Uses bulkWrite for a single DB round-trip
// Safety guard: only decrements if stock >= quantity
MachineCatalog.bulkWrite([{
  updateOne: {
    filter: { _id: item.catalog_id, stock: { $gte: item.quantity } },
    update: { $inc: { stock: -item.quantity } }
  }
}])
```

### 9.3 `machineService.js`

Proxies all machine data to/from the IoT backend via Axios:

| Function | IoT API call |
|---|---|
| `getMachines(user)` | `GET /api/device/user/:userId` (ADMIN) or per-assignment (TECHNICIAN) |
| `getMachine(machine_id, user)` | `GET /api/device/device/:machine_id` |
| `provisionMachine({ serialNumber }, user)` | `POST /api/device/provision` |
| `sendCommand(machine_id, { message }, user)` | `POST /api/device/:machine_id/commands` |
| `getTelemetry(machine_id, user)` | Returns from in-memory `telemetryCache` Map |

### 9.4 `analyticsService.js`

All analytics functions use MongoDB aggregation pipelines:

| Function | Description |
|---|---|
| `getSummary({ company_id, from_date, to_date })` | KPI totals |
| `getRevenueByMachine(...)` | Revenue grouped by `machine_id` |
| `getTopProducts({ ..., limit })` | Top `n` products by quantity |
| `getRevenueOverTime({ ..., group_by })` | Time-series data |
| `getPaymentMethodBreakdown(...)` | UPI vs Cash vs other |
| `getRevenueByCompany(...)` | SUPER_ADMIN cross-company view |

---

## 10. Real-Time Layer (Socket.IO + MQTT)

### 10.1 Socket.IO Architecture

The backend runs a Socket.IO server on the same HTTP port as Express.

**Authentication:** Every socket connection requires a valid JWT access token:
```js
// Client connects with:
socket.connect({ auth: { token: accessToken } })
```

**Room isolation:** On connect, the socket joins a room named after `company_id`:
```js
socket.join(company_id)  // Company A never sees Company B's events
```

### 10.2 Socket.IO Events Emitted

| Event | Payload | Triggered By |
|---|---|---|
| `machine:telemetry` | `{ deviceVID, data }` | Every MQTT telemetry tick (1 Hz) |
| `machine:status` | `{ deviceVID, status }` | MQTT status topic |
| `machine:alert` | `{ deviceVID, type, message, severity }` | Text alert received |
| `order:cash_pending` | `{ orderId, machine_id, total_amount }` | New cash order from kiosk |
| `order:new` | `{ orderId, machine_id, payment_method }` | Any new order |

### 10.3 MQTT Integration (`mqttService.js`)

The backend connects to the MQTT broker using **admin credentials** (never browser-level):

```
Subscriptions (wildcard):
  device/+/telemetry  ← all machine sensor data
  device/+/status     ← all machine online/offline events
```

**Telemetry Payload — Normal JSON:**
```json
{
  "Steering Motor Temperature": 28,
  "Tank Levels": [25, 50, 40, 10],
  "Steering Motor": true,
  "Current Sensor": 250
}
```

**Telemetry Payload — Alert Strings:**
```
"Anomaly Detected"                → severity: CRITICAL
"Device(Arduino) Not Connected"   → severity: HIGH
```

The MQTT service maintains an in-memory `telemetryCache` (`Map<deviceVID, { data, updatedAt }>`). This cache is served via `GET /api/admin/machines/:machine_id/telemetry`.

---

## 11. Error Handling

### Custom `ApiError` Class

All services throw `ApiError` instances:

```js
ApiError.badRequest("message")    // 400
ApiError.unauthorized("message")  // 401
ApiError.forbidden("message")     // 403
ApiError.notFound("message")      // 404
ApiError.conflict("message")      // 409
ApiError.internal("message")      // 500
```

### Global Error Middleware

Catches all unhandled errors and returns consistent JSON:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "error": { ... }   // only in development
}
```

### Standard Success Response Shape

```json
{
  "success": true,
  "message": "Optional message",
  "data": { ... }
}
```

---

## 12. Running the Server

### Prerequisites

- Node.js 18+
- MongoDB Atlas account with a cluster
- Razorpay account (test or live)

### Installation

```bash
cd backend
npm install
```

### Configure environment

```bash
cp .env.example .env
# Fill in all required values
```

### Seed the first admin user

```bash
node seedAdmin.js
```

### Start development server

```bash
npm run dev       # nodemon — auto-restarts on change
```

### Start production server

```bash
npm start         # node src/server.js
```

### Health check

```
GET http://localhost:5000/health
→ { "success": true, "message": "Server is running", "timestamp": "..." }
```

### Docker

```bash
docker-compose up -d   # Starts backend + MongoDB
```

---

## Appendix — Complete Route Map

```
PUBLIC (no auth)
  GET    /api/public/catalog/:machine_id
  POST   /api/public/order
  GET    /api/public/order/:id/status
  POST   /api/public/order/:id/cancel
  POST   /api/public/payment/webhook/:company_id

ADMIN AUTH
  POST   /api/admin/auth/register
  POST   /api/admin/auth/login
  POST   /api/admin/auth/refresh
  POST   /api/admin/auth/logout        🔒
  GET    /api/admin/auth/me            🔒

USERS 🔒
  GET    /api/admin/users/me
  GET    /api/admin/users              (SUPER_ADMIN)
  POST   /api/admin/users              (SUPER_ADMIN, ADMIN)
  POST   /api/admin/users/invite       (SUPER_ADMIN)
  PATCH  /api/admin/users/:id/status   (SUPER_ADMIN)
  PUT    /api/admin/users/:id          (SUPER_ADMIN)
  DELETE /api/admin/users/:id          (SUPER_ADMIN)

PRODUCTS 🔒 (SUPER_ADMIN, ADMIN)
  POST   /api/admin/products
  GET    /api/admin/products
  GET    /api/admin/products/:id
  PUT    /api/admin/products/:id
  DELETE /api/admin/products/:id

CATALOG 🔒 (SUPER_ADMIN, ADMIN)
  POST   /api/admin/catalog
  GET    /api/admin/catalog
  PUT    /api/admin/catalog/:id
  DELETE /api/admin/catalog/:id

ORDERS 🔒
  GET    /api/admin/orders
  POST   /api/admin/orders/:id/confirm-cash  (SUPER_ADMIN, ADMIN)

ANALYTICS 🔒
  GET    /api/admin/analytics/summary
  GET    /api/admin/analytics/revenue-by-machine
  GET    /api/admin/analytics/top-products
  GET    /api/admin/analytics/revenue-over-time
  GET    /api/admin/analytics/payment-methods
  GET    /api/admin/analytics/revenue-by-company  (SUPER_ADMIN)

MACHINES 🔒
  GET    /api/admin/machines
  POST   /api/admin/machines/provision             (SUPER_ADMIN, ADMIN)
  GET    /api/admin/machines/:machine_id
  GET    /api/admin/machines/:machine_id/telemetry
  POST   /api/admin/machines/:machine_id/commands  (SUPER_ADMIN, ADMIN)

ASSIGNMENTS 🔒 (SUPER_ADMIN, ADMIN)
  GET    /api/admin/assignments
  POST   /api/admin/assignments
  DELETE /api/admin/assignments/:id

COMPANY SELF 🔒 (ADMIN, SUPER_ADMIN)
  GET    /api/admin/company
  PUT    /api/admin/company

COMPANIES 🔒
  GET    /api/admin/companies
  POST   /api/admin/companies
  PATCH  /api/admin/companies/:id
```
