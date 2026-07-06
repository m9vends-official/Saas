# Complete API Documentation

Base URL (Local): `http://localhost:5000`

---

## 1. Authentication (`/api/admin/auth`)

### POST `/login`
- **Purpose**: Authenticate user and get access tokens.
- **Auth**: None
- **Body**: `{ "email": "admin@test.com", "password": "password123" }`
- **Response** (200 OK):
  ```json
  {
    "success": true,
    "data": {
      "user": { "_id": "...", "name": "Admin", "role": "ADMIN", "company_id": "..." },
      "accessToken": "eyJhbGciOiJIUzI1..."
    }
  }
  ```
  *(Note: `refreshToken` is set as an HTTP-only cookie automatically)*

### POST `/logout`
- **Purpose**: Logs out user and invalidates tokens.
- **Auth**: Bearer Token required.
- **Response** (200 OK): `{ "success": true, "message": "Logged out successfully" }`

---

## 2. Products (`/api/admin/products`)

### GET `/`
- **Purpose**: Fetch all products for the logged-in user's company.
- **Auth**: Bearer Token (ADMIN / SUPER_ADMIN / TECHNICIAN)
- **Response** (200 OK):
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "abc1234",
        "product_name": "Lays Chips",
        "price": 20,
        "category": "Snacks",
        "sku": "LAY001",
        "is_available": true
      }
    ]
  }
  ```

### POST `/`
- **Purpose**: Add a new product.
- **Auth**: Bearer Token (ADMIN / SUPER_ADMIN)
- **Body**: `{ "product_name": "Lays", "price": 20, "category": "Snacks", "sku": "LAY001" }`

*(Similar standard routes exist for `GET /:id`, `PUT /:id`, `DELETE /:id`)*

---

## 3. Catalog & Inventory (`/api/admin/catalog`)

### GET `/`
- **Purpose**: View inventory across machines.
- **Query Params**: `?machine_id=VM-001` (optional filter)
- **Auth**: Bearer Token
- **Response** (200 OK):
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "cat123",
        "machine_id": "VM-001",
        "product_id": { "_id": "prod1", "product_name": "Lays", "price": 20 },
        "stock": 15,
        "max_capacity": 20,
        "slot_label": "A1"
      }
    ]
  }
  ```

---

## 4. Public Vending Machine API (`/api/public`)

*These APIs are called by the vending machine screen or the customer's phone when scanning a QR. No JWT required.*

### GET `/catalog/:machine_id`
- **Purpose**: Get the menu for a specific machine to show the customer.
- **Auth**: None
- **Response**: Array of available products with their stock and machine-specific pricing.

### POST `/order`
- **Purpose**: Creates an order and returns a Razorpay intent or UPI link.
- **Body**:
  ```json
  {
    "machine_id": "VM-001",
    "items": [
      { "catalog_id": "cat123", "quantity": 1 }
    ],
    "payment_method": "UPI"
  }
  ```
- **Response** (201 Created):
  ```json
  {
    "success": true,
    "data": {
      "order_id": "ord_123",
      "razorpay_order_id": "order_abc",
      "payment_link": "upi://pay?pa=merchant@upi..."
    }
  }
  ```

---

## Common Response Formats

**Success Response**:
```json
{
  "success": true,
  "data": { ... } // or array
}
```

**Validation Error Response** (Zod):
```json
{
  "success": false,
  "message": "Validation Error",
  "errors": [
    { "field": "price", "message": "Price cannot be negative" }
  ]
}
```

**Standard Error Response** (4xx / 5xx):
```json
{
  "success": false,
  "message": "Product not found"
}
```
