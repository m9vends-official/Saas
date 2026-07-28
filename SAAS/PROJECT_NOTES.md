# M9Vends — Project Notes

> A running record of what has been built and what needs attention before / after launch.

---

## What Was Done

### Backend Changes

| File | What Changed |
|---|---|
| `backend/src/services/orderService.js` | Added `cancelOrder()` + `payment_method: 'CASH'` support in `placeOrder()` + `mongoose.isValidObjectId()` guard (fixes `CastError 500` crash when mock IDs are sent) |
| `backend/src/api/public/controllers/orderController.js` | Added `cancelOrderHandler` + updated `createOrder` to accept `payment_method` |
| `backend/src/api/public/routes/orderRoutes.js` | Registered `POST /:id/cancel` |
| `backend/src/api/public/controllers/catalogController.js` | Fixed: `device_id` removed — `machine_id` now comes from URL param (`:machine_id`) as a plain string — no Device model lookup |

### Documentation Created

| File | Purpose |
|---|---|
| `KIOSK_BACKEND_INTEGRATION.md` | Full REST API reference for the kiosk frontend — all endpoints, request/response shapes, auth rules |
| `KIOSK_SCREENS.md` | Screen-by-screen build guide — all 10 screens with wireframes, full component code, Zustand store, API layer, CSS tokens |
| `POSTMAN_SETUP_GUIDE.md` | Step-by-step guide to seed MongoDB Atlas with all kiosk data + complete order API test flow (7 steps including full Order cycle) |

---

## Architecture Decisions

- **`machine_id` = `deviceVID`** — comes from the IoT backend wake-up response. The SaaS backend stores and queries it as a plain `String`. No Device model exists in the SaaS backend — all device management is handled by the IoT backend.
- **No auth on public routes** — `/api/public/*` is fully open. Security relies on `machine_id` (only provisioned machines know their ID).
- **Cash payment flow** — creates an order with `payment_method: 'CASH'`, kiosk polls status every 3s, admin manually confirms via `POST /api/admin/orders/:id/confirm-cash`.
- **Kiosk has no router** — a single `currentScreen` Zustand state variable drives all 10 screens. No `react-router` needed.
- **Token flow** — admin access token lives in memory. Refresh token is an `httpOnly` cookie (7-day expiry). Kiosk itself uses no tokens.

---

## Future Action Items

### 🔴 Critical — Must Do Before Production

- [ ] **Replace placeholder UPI ID in `orderService.js` (~line 88)**
  ```js
  // Change this:
  const payment_link = `upi://pay?pa=MERCHANT_UPI_ID&pn=M9Vends...`
  // To your real Razorpay merchant VPA, or use the Razorpay Payment Links API
  ```

- [ ] **Verify Razorpay webhook signature**
  The webhook at `POST /api/public/payment/webhook` must validate the `X-Razorpay-Signature` header before marking any order as `PAID`. Without this, anyone can send a fake webhook and get free products.

- [ ] **Decrement stock after a paid order**
  When an order is confirmed (`PAID`), `MachineCatalog.stock` is never reduced. Add stock decrement logic in:
  - `markOrderPaid()` — UPI, called from the webhook handler
  - `confirmCashPayment()` — Cash, called from admin confirm route

- [ ] **`catalog_id` must always come from the real API**
  Never hardcode or mock `catalog_id` in the kiosk frontend. Always use the value returned by:
  ```
  GET /api/public/catalog/:machine_id  →  catalog[n].catalog_id
  ```
  The mock catalog has been removed from `CatalogScreen.jsx` — keep it that way.

---

### 🟡 Important — Do Before Launch

- [ ] **Company creation has no API endpoint**
  The first `Company` document must be inserted directly into MongoDB Atlas. No admin route exists for it. Consider a one-time seed script or a protected bootstrap endpoint.

- [ ] **`VITE_SERIAL_NUMBER` must be unique per physical device**
  Every kiosk machine needs its own `.env` file with its unique serial number. Never share `.env` files across machines — all IoT provisioning is tied to this value.

- [ ] **MQTT (Phase 2) is not yet wired up**
  `mqttConfig` is returned by the IoT wake-up response and stored in Zustand, but no MQTT subscription is implemented in the kiosk frontend. Dispensing events currently rely on polling. Connect MQTT for real-time hardware confirmation.

- [ ] **Kiosk device must be physically locked down**
  The kiosk runs with no auth token — anyone with device URL access can call public endpoints. Run the browser in kiosk/locked mode (e.g. Chrome `--kiosk` flag, or a dedicated kiosk OS).

---

### 🟢 Nice to Have — Post-Launch

- [ ] **Product image uploads**
  `image_url` is `null` for all products currently. Integrate S3 or Cloudinary, store the public URL in `Product.image_url`. The kiosk catalog screen already handles `null` gracefully with an emoji fallback.

- [ ] **Analytics routes**
  `GET /api/admin/analytics/*` endpoints exist in the backend but are not in the Postman guide or tested. Add them to the test suite once orders start flowing.

- [ ] **Idle timeout edge case**
  `useIdleTimeout` correctly excludes `upi` and `cash` screens. Those screens manage their own countdown timers. Verify `clearInterval()` runs on every unmount path (cancel button, hot reload) to avoid timer leaks.

- [ ] **Empty catalog state on kiosk**
  After removing mock data, if the backend returns 0 items (all products disabled or no catalog entries), the kiosk shows a spinner indefinitely. Add a "Nothing available right now" empty state with a Back button.

- [ ] **Admin dashboard frontend**
  The backend has full admin API coverage (products, catalog, orders, analytics, user management). The admin web dashboard UI has not been built yet.

---

## Key IDs — Fill in When You Set Up

| Thing | Value |
|---|---|
| MongoDB Atlas DB Name | *(fill in)* |
| Company `_id` | *(fill in after Atlas insert)* |
| Admin email | *(fill in)* |
| Machine `deviceVID` / `machine_id` | *(fill in from IoT backend wake-up response)* |
| Razorpay Key ID | *(fill in `.env` → `RAZORPAY_KEY_ID`)* |
| Razorpay Key Secret | *(fill in `.env` → `RAZORPAY_KEY_SECRET`)* |
| Razorpay Merchant UPI VPA | *(fill in `orderService.js` line ~88)* |

---

*Last updated: 2026-07-28*
