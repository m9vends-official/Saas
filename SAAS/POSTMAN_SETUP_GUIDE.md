# M9Vends — Postman Setup Guide (Seed Kiosk Data in MongoDB Atlas)

> **Goal:** Call your live backend APIs in order to create all data the kiosk needs to show a product catalog and accept orders.
> **Backend URL:** `http://localhost:5000` (or your deployed URL)
> **Database:** MongoDB Atlas (already connected via `MONGO_URI` in `.env`)

---

## What You Will Create (in order)

```
Step 1  → Company         (the business account — root of everything)
Step 2  → Admin User      (the account you log in with)
Step 3  → Login           (get accessToken for all protected requests)
Step 4  → Products ×3     (items to sell — e.g. Pani Puri, Mango Lassi, Cold Brew)
Step 5  → MachineCatalog  (assign those products to your kiosk machine with stock + price)
Step 6  → Verify (Public) (call the public kiosk API to confirm everything works)
```

---

## Postman Collection Setup

### Step A — Create a Collection

1. Open Postman → **New Collection** → name it `M9Vends Kiosk Setup`

### Step B — Create Environment Variables

1. Click **Environments** → **New** → name it `M9Vends Dev`
2. Add these variables:

| Variable | Initial Value | Notes |
|---|---|---|
| `BASE_URL` | `http://localhost:5000` | Change to your deployed URL if live |
| `accessToken` | *(leave empty)* | Auto-filled by login response |
| `company_id` | *(leave empty)* | Filled from MongoDB Compass or Step 1 |
| `product_id_1` | *(leave empty)* | Filled from Step 4 |
| `product_id_2` | *(leave empty)* | Filled from Step 4 |
| `product_id_3` | *(leave empty)* | Filled from Step 4 |
| `machine_id` | *(your deviceVID)* | From IoT backend wake-up response |

3. Click **Save** → select this environment in the top-right dropdown

### Step C — Set Authorization for Protected Requests

For every request **except** Step 1 and Step 3 (login), set:
- **Auth tab** → Type: `Bearer Token` → Token: `{{accessToken}}`

---

## Step 1 — Create Company (MongoDB Compass or direct insert)

> The Company record has **no API endpoint** — it must be inserted directly into MongoDB Atlas.

### Option A — MongoDB Atlas UI (recommended)

1. Open [https://cloud.mongodb.com](https://cloud.mongodb.com)
2. Navigate to your cluster → **Browse Collections** → select your database
3. Click **companies** collection → **Insert Document**
4. Paste this document:

```json
{
  "company_name": "M9Vends Demo Co",
  "plan": "PRO",
  "contact_email": "admin@m9vends.com",
  "contact_phone": "+91-9876543210",
  "is_active": true,
  "plan_expires_at": null,
  "createdAt": { "$date": "2025-01-01T00:00:00.000Z" },
  "updatedAt": { "$date": "2025-01-01T00:00:00.000Z" }
}
```

5. Click **Insert**
6. Copy the `_id` that MongoDB assigned → paste it into your Postman environment as `company_id`

> Example `company_id`: `687e2d4f1a2b3c4d5e6f7890`

### Option B — MongoDB Compass

1. Open Compass → connect with your Atlas connection string
2. Navigate to your DB → `companies` collection → **Add Data** → **Insert Document**
3. Same JSON as above

---

## Step 2 — Register Admin User

**Request:** `POST {{BASE_URL}}/api/admin/auth/register`

**Headers:**
```
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "company_id": "{{company_id}}",
  "name": "Admin User",
  "email": "admin@m9vends.com",
  "password": "Admin@1234",
  "role": "SUPER_ADMIN"
}
```

> **Password rules:** minimum 8 characters, at least 1 uppercase letter, at least 1 number.
> **role** must be one of: `SUPER_ADMIN`, `ADMIN`, `TECHNICIAN`

**Expected Response `201`:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "_id": "687e2d4f1a2b3c4d5e6f7891",
    "name": "Admin User",
    "email": "admin@m9vends.com",
    "role": "SUPER_ADMIN",
    "company_id": "687e2d4f1a2b3c4d5e6f7890",
    "is_active": true,
    "createdAt": "2025-07-28T04:00:00.000Z"
  }
}
```

**If you get `409 Conflict`:** The email already exists — try a different email.

---

## Step 3 — Login (Get Access Token)

**Request:** `POST {{BASE_URL}}/api/admin/auth/login`

**Headers:**
```
Content-Type: application/json
```

**Body (raw JSON):**
```json
{
  "email": "admin@m9vends.com",
  "password": "Admin@1234"
}
```

**Expected Response `200`:**
```json
{
  "success": true,
  "message": "Login successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "687e2d4f1a2b3c4d5e6f7891",
    "name": "Admin User",
    "email": "admin@m9vends.com",
    "role": "SUPER_ADMIN",
    "company_id": "687e2d4f1a2b3c4d5e6f7890"
  }
}
```

**Save the token automatically** — add this to the **Tests** tab of the login request:
```js
const res = pm.response.json();
if (res.accessToken) {
  pm.environment.set("accessToken", res.accessToken);
  console.log("✅ Token saved:", res.accessToken.slice(0, 30) + "...");
}
```

> The `refreshToken` is set as an **httpOnly cookie** automatically — Postman handles it.

---

## Step 4 — Create Products

> All product requests require `Authorization: Bearer {{accessToken}}` header.
> The backend reads `company_id` from the JWT token — you don't send it in the body.

### Product 1 — Masala Pani Puri

**Request:** `POST {{BASE_URL}}/api/admin/products`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body (raw JSON):**
```json
{
  "product_name": "Masala Pani Puri",
  "description": "Tangy street-style pani puri with mint water",
  "price": 25,
  "category": "Street Food",
  "sku": "MPP-001",
  "tax_percent": 5,
  "is_available": true
}
```

**Expected Response `201`:**
```json
{
  "success": true,
  "data": {
    "_id": "687e2d4f1a2b3c4d5e6f7892",
    "company_id": "687e2d4f1a2b3c4d5e6f7890",
    "product_name": "Masala Pani Puri",
    "description": "Tangy street-style pani puri with mint water",
    "price": 25,
    "category": "Street Food",
    "sku": "MPP-001",
    "tax_percent": 5,
    "is_available": true,
    "is_deleted": false,
    "createdAt": "2025-07-28T04:00:00.000Z"
  }
}
```

**Save product_id** — add to **Tests** tab:
```js
const res = pm.response.json();
if (res.data?._id) pm.environment.set("product_id_1", res.data._id);
```

---

### Product 2 — Mango Lassi

**Request:** `POST {{BASE_URL}}/api/admin/products`

**Body (raw JSON):**
```json
{
  "product_name": "Mango Lassi",
  "description": "Thick and creamy mango lassi made fresh",
  "price": 40,
  "category": "Beverages",
  "sku": "MGL-001",
  "tax_percent": 0,
  "is_available": true
}
```

**Tests tab:**
```js
const res = pm.response.json();
if (res.data?._id) pm.environment.set("product_id_2", res.data._id);
```

---

### Product 3 — Cold Brew Coffee

**Request:** `POST {{BASE_URL}}/api/admin/products`

**Body (raw JSON):**
```json
{
  "product_name": "Cold Brew Coffee",
  "description": "Slow-brewed cold coffee — smooth and bold",
  "price": 60,
  "category": "Beverages",
  "sku": "CBC-001",
  "tax_percent": 5,
  "is_available": true
}
```

**Tests tab:**
```js
const res = pm.response.json();
if (res.data?._id) pm.environment.set("product_id_3", res.data._id);
```

---

### Verify Products Were Created

**Request:** `GET {{BASE_URL}}/api/admin/products`

**Expected Response:**
```json
{
  "success": true,
  "pagination": { "total": 3, "page": 1, "limit": 20 },
  "data": [ ... all 3 products ... ]
}
```

**Optional query params:**
- `?search=pani` — filter by name
- `?category=Beverages` — filter by category
- `?is_available=true` — only available products

---

## Step 5 — Add Products to Machine Catalog

> `machine_id` = `deviceVID` from the IoT backend wake-up response.
> This is a MongoDB ObjectId hex string like `60d5ec49f3e4e9001f3b2e99`.

**Set your machine_id** in the Postman environment:
```
machine_id = 60d5ec49f3e4e9001f3b2e99   ← replace with your actual deviceVID
```

---

### Catalog Entry 1 — Masala Pani Puri in Slot A1

**Request:** `POST {{BASE_URL}}/api/admin/catalog`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body (raw JSON):**
```json
{
  "machine_id":     "{{machine_id}}",
  "product_id":     "{{product_id_1}}",
  "stock":          48,
  "slot_label":     "A1",
  "price_override": 25
}
```

**Fields explained:**

| Field | Required | Description |
|---|---|---|
| `machine_id` | ✅ Yes | `deviceVID` from IoT backend |
| `product_id` | ✅ Yes | MongoDB `_id` of the product |
| `stock` | ✅ Yes | Current physical stock count |
| `slot_label` | Optional | Physical slot position (e.g. `A1`, `B3`) |
| `price_override` | Optional | Machine-specific price — if null, uses product base price |

**Expected Response `201`:**
```json
{
  "success": true,
  "data": {
    "_id": "687e2d4f1a2b3c4d5e6f7895",
    "company_id": "687e2d4f1a2b3c4d5e6f7890",
    "machine_id": "60d5ec49f3e4e9001f3b2e99",
    "product_id": "687e2d4f1a2b3c4d5e6f7892",
    "stock": 48,
    "slot_label": "A1",
    "price_override": 25,
    "is_enabled": true,
    "max_capacity": 50,
    "createdAt": "2025-07-28T04:00:00.000Z"
  }
}
```

**If you get `400 Conflict`:** That product is already in the machine catalog for that slot. Each product can only appear once per machine (unique constraint on `company_id + machine_id + product_id`).

---

### Catalog Entry 2 — Mango Lassi in Slot B2

**Request:** `POST {{BASE_URL}}/api/admin/catalog`

**Body:**
```json
{
  "machine_id":     "{{machine_id}}",
  "product_id":     "{{product_id_2}}",
  "stock":          2,
  "slot_label":     "B2",
  "price_override": 40
}
```

> Stock is `2` to show the "Only 2 left" amber warning on the kiosk.

---

### Catalog Entry 3 — Cold Brew in Slot C1 (Out of Stock)

**Request:** `POST {{BASE_URL}}/api/admin/catalog`

**Body:**
```json
{
  "machine_id":     "{{machine_id}}",
  "product_id":     "{{product_id_3}}",
  "stock":          0,
  "slot_label":     "C1",
  "price_override": 60
}
```

> Stock is `0` to demonstrate the "Out of Stock" grey state on the kiosk.

---

### Verify Catalog in Admin

**Request:** `GET {{BASE_URL}}/api/admin/catalog?machine_id={{machine_id}}`

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "machine_id": "60d5ec49f3e4e9001f3b2e99",
      "product_id": { "_id": "...", "product_name": "Masala Pani Puri", "price": 25 },
      "stock": 48,
      "slot_label": "A1",
      "price_override": 25,
      "is_enabled": true
    },
    ...
  ]
}
```

---

## Step 6 — Verify Kiosk Public API (No Auth)

This confirms the kiosk screen will work correctly.

**Request:** `GET {{BASE_URL}}/api/public/catalog/{{machine_id}}`

**No headers needed** — this is a public endpoint.

**Save catalog_ids for order testing** — add this to the **Tests** tab:
```js
const res = pm.response.json();
if (res.catalog && res.catalog.length > 0) {
  pm.environment.set("catalog_id_1", res.catalog[0].catalog_id);
  pm.environment.set("catalog_id_2", res.catalog[1]?.catalog_id || "");
  pm.environment.set("catalog_id_3", res.catalog[2]?.catalog_id || "");
  console.log("✅ catalog_id_1:", res.catalog[0].catalog_id);
}
```

> ⚠️ **CRITICAL:** The `catalog_id` you send when placing an order **must come from this response** (`catalog[n].catalog_id`). Never use hand-typed or mock values — they will fail with a `400 Invalid catalog_id` error.

**Expected Response `200`:**
```json
{
  "success": true,
  "machine_id": "60d5ec49f3e4e9001f3b2e99",
  "catalog": [
    {
      "catalog_id":   "687e2d4f1a2b3c4d5e6f7895",
      "product_id":   "687e2d4f1a2b3c4d5e6f7892",
      "product_name": "Masala Pani Puri",
      "description":  "Tangy street-style pani puri with mint water",
      "image_url":    null,
      "price":        25,
      "stock":        48,
      "slot_label":   "A1"
    },
    {
      "catalog_id":   "687e2d4f1a2b3c4d5e6f7896",
      "product_id":   "687e2d4f1a2b3c4d5e6f7893",
      "product_name": "Mango Lassi",
      "description":  "Thick and creamy mango lassi made fresh",
      "image_url":    null,
      "price":        40,
      "stock":        2,
      "slot_label":   "B2"
    },
    {
      "catalog_id":   "687e2d4f1a2b3c4d5e6f7897",
      "product_id":   "687e2d4f1a2b3c4d5e6f7894",
      "product_name": "Cold Brew Coffee",
      "description":  "Slow-brewed cold coffee — smooth and bold",
      "image_url":    null,
      "price":        60,
      "stock":        0,
      "slot_label":   "C1"
    }
  ]
}
```

✅ **If you see this response, the kiosk frontend is ready to use.**

---

## Catalog Management (Update Stock / Disable Products)

### Update Stock After Restocking

**Request:** `PUT {{BASE_URL}}/api/admin/catalog/:catalog_entry_id`

Replace `:catalog_entry_id` with the `_id` from the catalog entry.

**Body:**
```json
{
  "stock": 50
}
```

### Disable a Product (Hide from Kiosk)

**Body:**
```json
{
  "is_enabled": false
}
```

> `is_enabled: false` removes the product from the public catalog response immediately.

### Change Machine-Level Price

**Body:**
```json
{
  "price_override": 30
}
```

### Remove Product from Machine

**Request:** `DELETE {{BASE_URL}}/api/admin/catalog/:catalog_entry_id`

> This removes the slot — not the product itself. The product still exists in your product library.

---

## Add More Products (Repeat Step 4 + 5 Pattern)

Create as many products as your machine has slots. Common categories for a vending machine:

```json
{ "category": "Street Food" }    ← Pani Puri, Bhel, Sev Puri
{ "category": "Beverages" }      ← Lassi, Cold Brew, Nimbu Pani
{ "category": "Snacks" }         ← Chips, Namkeen, Biscuits
{ "category": "Desserts" }       ← Kulfi, Ice Cream
```

---

## Step 7 — Order API Flow (Test the Kiosk Order Cycle)

Add these extra environment variables first:

| Variable | Value | Notes |
|---|---|---|
| `catalog_id_1` | *(from Step 6 Tests script)* | Real ObjectId from catalog |
| `catalog_id_2` | *(from Step 6 Tests script)* | Real ObjectId from catalog |
| `order_id` | *(leave empty)* | Auto-filled from place-order response |

---

### 7a — Place Order with UPI

**Request:** `POST {{BASE_URL}}/api/public/order`

**Headers:**
```
Content-Type: application/json
```

> No auth token needed — this is a public endpoint.

**Body (raw JSON):**
```json
{
  "machine_id": "{{machine_id}}",
  "payment_method": "UPI",
  "items": [
    { "catalog_id": "{{catalog_id_1}}", "quantity": 2 },
    { "catalog_id": "{{catalog_id_2}}", "quantity": 1 }
  ]
}
```

> ⚠️ **`catalog_id` must be the real ObjectId from `GET /api/public/catalog/:machine_id`.**
> Copy it from the Step 6 verify response — never type a fake value.

**Expected Response `201`:**
```json
{
  "success": true,
  "data": {
    "order_id": "687e2d4f1a2b3c4d5e6f7900",
    "razorpay_order_id": "order_XXXXXXXXXX",
    "total_amount": 90,
    "payment_link": "upi://pay?pa=MERCHANT_UPI_ID&pn=M9Vends&tr=order_XXXXXX&am=90&cu=INR",
    "currency": "INR",
    "items": [
      { "product_name": "Masala Pani Puri", "quantity": 2, "unit_price": 25, "subtotal": 50 },
      { "product_name": "Mango Lassi",      "quantity": 1, "unit_price": 40, "subtotal": 40 }
    ]
  }
}
```

**Save order_id** — add to **Tests** tab:
```js
const res = pm.response.json();
if (res.data?.order_id) {
  pm.environment.set("order_id", res.data.order_id);
  console.log("✅ order_id saved:", res.data.order_id);
}
```

---

### 7b — Place Order with Cash

**Request:** `POST {{BASE_URL}}/api/public/order`

**Body (raw JSON):**
```json
{
  "machine_id": "{{machine_id}}",
  "payment_method": "CASH",
  "items": [
    { "catalog_id": "{{catalog_id_1}}", "quantity": 1 }
  ]
}
```

**Expected Response `201`:**
```json
{
  "success": true,
  "data": {
    "order_id": "687e2d4f1a2b3c4d5e6f7901",
    "total_amount": 25,
    "payment_method": "CASH",
    "items": [
      { "product_name": "Masala Pani Puri", "quantity": 1, "unit_price": 25, "subtotal": 25 }
    ]
  }
}
```

> No `payment_link` or `razorpay_order_id` — admin confirms cash manually (Step 7e).

**Tests tab** (save this order_id separately if you want to test cash confirm):
```js
const res = pm.response.json();
if (res.data?.order_id) pm.environment.set("cash_order_id", res.data.order_id);
```

---

### 7c — Poll Order Status

The kiosk polls this every 3 seconds until `payment_status` changes from `PENDING`.

**Request:** `GET {{BASE_URL}}/api/public/order/{{order_id}}/status`

**No headers needed** — public endpoint.

**Expected Response `200` (before payment):**
```json
{
  "success": true,
  "order_id": "687e2d4f1a2b3c4d5e6f7900",
  "payment_status": "PENDING",
  "order_status": "PLACED",
  "total_amount": 90,
  "paid_at": null
}
```

**After payment confirmed:**
```json
{
  "success": true,
  "order_id": "687e2d4f1a2b3c4d5e6f7900",
  "payment_status": "PAID",
  "order_status": "DISPENSING",
  "total_amount": 90,
  "paid_at": "2025-07-28T06:15:00.000Z"
}
```

**Kiosk logic:**
```
payment_status === 'PAID'   → go to SuccessScreen
payment_status === 'FAILED' → go to FailedScreen
payment_status === 'PENDING'→ keep polling
```

---

### 7d — Cancel Order (Kiosk timeout or customer cancel)

Call this when the UPI/Cash timer expires or customer presses ✕.

**Request:** `POST {{BASE_URL}}/api/public/order/{{order_id}}/cancel`

**No body, no headers needed.**

**Expected Response `200`:**
```json
{
  "success": true,
  "message": "Order cancelled",
  "order_id": "687e2d4f1a2b3c4d5e6f7900"
}
```

**Error if already paid/cancelled:**
```json
{
  "success": false,
  "message": "Order cannot be cancelled — not found or already processed"
}
```

---

### 7e — Admin Confirm Cash Payment

After the customer hands cash to the attendant, the admin presses confirm in the dashboard.

**Request:** `POST {{BASE_URL}}/api/admin/orders/{{cash_order_id}}/confirm-cash`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer {{accessToken}}
```

**Body (raw JSON):**
```json
{
  "collected_by": "Admin User"
}
```

**Expected Response `200`:**
```json
{
  "success": true,
  "message": "Cash payment confirmed",
  "data": {
    "_id": "687e2d4f1a2b3c4d5e6f7901",
    "payment_status": "PAID",
    "order_status": "DISPENSING",
    "payment_method": "CASH",
    "paid_at": "2025-07-28T06:20:00.000Z"
  }
}
```

> After the admin confirms, the kiosk's polling (`GET /status`) will pick up `payment_status: 'PAID'` on the next poll (within 3 seconds) and navigate to the SuccessScreen automatically.

---

### 7f — Admin: List Orders

**Request:** `GET {{BASE_URL}}/api/admin/orders`

**Headers:**
```
Authorization: Bearer {{accessToken}}
```

**Optional query params:**
```
?machine_id={{machine_id}}    → filter by machine
?status=PAID                  → filter by payment_status (PENDING, PAID, FAILED)
?page=1&limit=20              → pagination
```

**Example:** `GET {{BASE_URL}}/api/admin/orders?machine_id={{machine_id}}&status=PENDING`

**Expected Response `200`:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "_id": "687e2d4f1a2b3c4d5e6f7900",
        "machine_id": "60d5ec49f3e4e9001f3b2e99",
        "total_amount": 90,
        "payment_status": "PENDING",
        "order_status": "PLACED",
        "payment_method": "UPI",
        "createdAt": "2025-07-28T06:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20
  }
}
```

---

## Full Order Cycle Summary

```
Kiosk                            Backend                          Admin Dashboard
──────                           ───────                          ───────────────
GET /catalog/:machine_id  ──►   Returns catalog with real         (view catalog)
                                catalog_ids

POST /order               ──►   Creates Order (PENDING)
  { catalog_id, qty,              UPI → creates Razorpay order
    payment_method }              CASH → no Razorpay

GET /order/:id/status     ──►   Returns current payment_status
  (poll every 3s)               PENDING → keep polling
                                PAID    → go to success
                                FAILED  → go to failed

[UPI] Razorpay webhook    ──►   Marks order PAID automatically
  (customer pays via QR)

[CASH] Customer pays                                    POST /admin/orders/:id/confirm-cash
  attendant                                               → Marks order PAID
  (kiosk polls → detects PAID)

POST /order/:id/cancel    ──►   Marks order FAILED/CANCELLED
  (timer expired or ✕ pressed)  (only if still PENDING)
```

---

## Quick Reference — All API Calls in Order

```
No Auth Required (Public — Kiosk):
──────────────────────────────────────────────────────────────────
GET    /api/public/catalog/:machine_id     → kiosk product catalog
POST   /api/public/order                  → place order (UPI or CASH)
GET    /api/public/order/:id/status       → poll payment status
POST   /api/public/order/:id/cancel       → cancel pending order

No Auth Required (Admin Onboarding):
──────────────────────────────────────────────────────────────────
POST   /api/admin/auth/register           → create admin user
POST   /api/admin/auth/login              → get accessToken
POST   /api/admin/auth/refresh            → refresh expired token

Auth Required (Bearer {{accessToken}}):
──────────────────────────────────────────────────────────────────
POST   /api/admin/products                → create product
GET    /api/admin/products                → list products
GET    /api/admin/products/:id            → get one product
PUT    /api/admin/products/:id            → update product
DELETE /api/admin/products/:id            → soft-delete product

POST   /api/admin/catalog                 → add product to machine
GET    /api/admin/catalog?machine_id=     → list machine's catalog
PUT    /api/admin/catalog/:id             → update stock/price/enabled
DELETE /api/admin/catalog/:id             → remove from machine

GET    /api/admin/orders                  → list orders (filter by machine/status)
POST   /api/admin/orders/:id/confirm-cash → confirm cash payment
```

---

## Common Errors & Fixes

| Error | Cause | Fix |
|---|---|---|
| `401 Unauthorized` | Missing or expired token | Re-run login, save new token |
| `403 Forbidden` | Wrong role | Register as `SUPER_ADMIN` or `ADMIN` |
| `409 Conflict` on register | Email already exists | Use a different email |
| `400 Bad Request` on product | Missing required field | Check `product_name` and `price` are present |
| `400` on catalog | Duplicate product+machine combo | That product already exists on that machine |
| `500 CastError` on order | Sending mock/fake `catalog_id` | Use real ObjectId from `GET /api/public/catalog/:machine_id` |
| `400 Invalid catalog_id` on order | Non-ObjectId string (e.g. `mock-cat-001`) | Same as above — use the `catalog_id` field from the catalog API response |
| `400` on order — item not found | Wrong `machine_id` or disabled catalog entry | Check `machine_id` matches `deviceVID`, check `is_enabled: true` |
| `400 Insufficient stock` | Ordering more than available stock | Reduce quantity or restock via `PUT /api/admin/catalog/:id` |
| `200` but empty catalog `[]` | No enabled catalog entries | Check `is_enabled: true` on entries |
| `400` on confirm-cash | Order already PAID or not found | Check order `_id` and that it's still `PENDING` |

---

## Token Expiry

- **Access token** expires after ~15 minutes (configurable in `.env`)
- When you get `401` mid-session, call login again or use:

**Refresh Token Request:** `POST {{BASE_URL}}/api/admin/auth/refresh`
- No body needed — Postman sends the `refreshToken` cookie automatically
- Response gives a new `accessToken` — update your environment variable
