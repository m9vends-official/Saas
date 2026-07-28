# M9Vends Customer Kiosk — UX Specification

> **Purpose:** This document describes the layout, elements, states, and interactions for every screen in the M9Vends customer-facing kiosk.
> Use this document to generate UI designs or implement screens from scratch.
> No code. No colors. Structure and behaviour only.

---

## Global Constraints

- **Device:** Touchscreen display (portrait or landscape). All interactive elements must be large enough for finger touch — minimum ~56px height.
- **No keyboard input** — except the product search field which uses a soft keyboard.
- **Single screen at a time** — no overlapping modals, no side drawers. Each state is a full-screen view.
- **No back button from the OS** — all navigation is through on-screen buttons.
- **Session is always reset** when returning to the Idle screen.

---

## Screen Navigation Map

```
Boot
 ├─ Device not provisioned ──────► Provision ─── (admin activates) ──► Idle
 └─ Device provisioned ──────────────────────────────────────────────► Idle
                                                                         │
                                                                   Customer touch
                                                                         │
                                                                      Catalog ◄─── (Back)
                                                                         │
                                                                    Checkout button
                                                                         │
                                                                       Cart ◄──── (Back)
                                                                    ┌────┴─────┐
                                                              Pay UPI       Pay Cash
                                                                    │         │
                                                                  UPI       Cash
                                                              Payment     Payment
                                                                    └────┬─────┘
                                                                 ┌───────┴────────┐
                                                               Success          Failed
                                                            (auto 5s)        (auto 15s)
                                                                    └───────┬────────┘
                                                                           Idle

Boot failure ──► Error ──► (auto-retry after 10s) ──► Boot
```

---

## Screen 1 — Boot

### Purpose
Shown on app launch while the device identifies itself to the network.

### Layout
Full screen. Centered content, vertically and horizontally.

### Zones

**Center Block**
- Brand logo / wordmark
- Loading indicator (spinner or animated dots)
- Status text: "Connecting to machine..."

### States
| State | Display |
|---|---|
| Connecting | Show spinner + status text |
| Failed to connect | Continue showing spinner silently — auto-retry every 5 seconds (no error shown to customer) |

### Interactions
None. Customer cannot interact with this screen.

---

## Screen 2 — Provision (Device Setup)

### Purpose
Shown when the device has not yet been linked to a business account. An admin must scan a QR code using the admin app to activate this machine.

### Layout
Full screen. Centered content. Two clear sections: instructions at top, QR code in the middle.

### Zones

**Top Section**
- Status badge: "Setup Required"
- Heading: "Device Not Activated"
- Subtext: "Scan this QR code with the M9Vends Admin App to activate this machine"

**QR Code Section**
- Large QR code (minimum 240×240px, more on larger screens)
- The QR value encodes the device serial number

**Bottom Section**
- Serial number label: "Serial: [SN-XXXX-XXXX]"
- Pulsing status dot + text: "Waiting for activation..."

### States
| State | Display |
|---|---|
| Waiting | Show QR code + pulsing dot |
| Activated | Automatically navigate to Idle screen |

### Interactions
- Customer cannot interact with this screen
- Screen polls the server every ~10 seconds to check if device has been provisioned

---

## Screen 3 — Idle (Attract Screen)

### Purpose
The resting state of the kiosk. Attracts passing customers. Shown after every completed or cancelled session.

### Layout
Full screen. Content is centered and layered. Background has a subtle animated visual effect (gradient, particles, or ambient motion) to attract attention.

### Zones

**Background Layer**
- Full-screen animated background (not static — must feel alive)

**Center Content**
- Brand logo / wordmark
- Tagline: "Fresh Flavours, Instant Delivery" (or similar brand statement)
- Large prominent call-to-action: "Touch to Start"
  - This should pulse or animate to draw attention
  - The entire screen is tappable — not just the CTA button

### States
This screen has only one state. It always looks the same.

### Interactions
- **Any touch anywhere on screen** → navigate to Catalog screen (and begin fetching catalog data in the background)

---

## Screen 4 — Catalog (Product Browser)

### Purpose
The main shopping screen. Customer browses available products, adjusts quantities, and proceeds to checkout.

### Layout
Three vertical zones: fixed header, scrollable product grid, sticky bottom cart bar.

---

### Zone: Header (Fixed — does not scroll)

| Element | Description |
|---|---|
| Back button | "← Back" — returns to Idle screen |
| Brand logo | Centered — wordmark |
| Cart icon button | Shows cart item count badge — tapping it goes to Cart screen (only active when cart has items) |

---

### Zone: Search Bar (Below header)

- Single text input, full width
- Placeholder: "Search products..."
- Filters the product grid in real time as the customer types
- Soft keyboard appears on tap

---

### Zone: Product Grid (Scrollable)

- 2-column grid
- Each cell is a **Product Card**

**Product Card — Structure**

```
┌────────────────────────────────┐
│                                │
│         Product Image          │  ← square image or emoji fallback
│         [slot label chip]      │  ← e.g. "A1" — small badge on image corner
│                                │
├────────────────────────────────┤
│ Product Name                   │
│ Short description (optional)   │
│ ₹ Price          Stock status  │
│ [Cart control button area]     │
└────────────────────────────────┘
```

**Stock Status Label**
- `stock > 5` → "In stock"
- `stock > 0 and ≤ 5` → "Only N left" (urgency indicator)
- `stock === 0` → "Out of stock"

**Cart Control Area — 3 states**

| Condition | What shows |
|---|---|
| Product out of stock | "Unavailable" label — no button. Card appears visually dimmed. |
| Product not in cart | Single "Add" button |
| Product in cart | Quantity stepper: `[−]  [N]  [+]`. "+" is disabled if qty equals available stock. |

---

### Zone: Sticky Cart Bar (Fixed at bottom — only visible when cart has ≥ 1 item)

| Element | Description |
|---|---|
| Item count | "{N} item" / "{N} items" |
| Total amount | "₹{total}" |
| Checkout button | "Checkout →" — navigates to Cart screen |

---

### Error State (catalog fetch failed)
Full screen message replacing the grid:
- Warning icon
- Error message text
- "← Back to Start" button

### Loading State (catalog not yet received)
Full screen:
- Spinner
- "Loading products..."

### Empty Search State (search returns no matches)
Inside the grid area:
- Text: "No products found"

---

## Screen 5 — Cart (Order Review)

### Purpose
Customer reviews their order before paying. Can adjust quantities. Chooses payment method.

### Layout
Three vertical zones: fixed header, scrollable item list + total, fixed payment buttons at bottom.

---

### Zone: Header (Fixed)

| Element | Description |
|---|---|
| Back button | "← Back" — returns to Catalog screen |
| Screen title | "Review Order" (centered) |
| Spacer | Keeps title centered |

---

### Zone: Order Items (Scrollable)

Each item row contains:

| Element | Description |
|---|---|
| Product image / icon | Small image or emoji placeholder |
| Product name | Full name |
| Unit price | "₹{price} each" |
| Quantity stepper | `[−]  [N]  [+]` — same as catalog. "+" disabled at stock limit. Decreasing to 0 removes item. |
| Line total | "₹{price × quantity}" right-aligned |

---

### Zone: Order Total

- Label: "Total"
- Amount: "₹{sum of all line totals}" — large, bold

---

### Zone: Error Message (conditional)
- Only visible if the order placement API call fails
- Inline message below the total, above payment buttons
- Shows the API error message or a generic fallback

---

### Zone: Payment Buttons (Fixed at bottom)

Two full-width stacked buttons:

1. **UPI Button** (primary — more prominent)
   - Label: "⚡ Pay ₹{total} with UPI"
   - While processing: shows spinner + "Processing..."

2. **Cash Button** (secondary — less prominent than UPI)
   - Label: "💵 Pay with Cash"

Both buttons are disabled while an order is being placed.

---

### Redirect Behaviour
If customer reaches this screen with an empty cart, they are silently redirected back to Catalog.

---

## Screen 6 — UPI Payment

### Purpose
Customer scans the QR code using any UPI app. Screen waits for payment confirmation.

### Layout
Two vertical zones: top bar (cancel + countdown), scrollable body with QR and instructions.

---

### Zone: Top Bar (Fixed)

| Element | Description |
|---|---|
| Cancel button | "✕ Cancel" — cancels the order and goes to Failed screen |
| Countdown timer | "MM:SS ⏱" — counts down from 3 minutes. Becomes visually urgent (e.g. flashes or changes appearance) when under 30 seconds |

---

### Zone: Body (Centered)

| Element | Description |
|---|---|
| Screen title | "Scan to Pay" |
| QR code | Large, centered. Value = UPI payment link. Has a soft glow effect. |
| Amount | "₹{total}" — large |
| App hint | "GPay · PhonePe · Paytm · Any UPI app" |
| Waiting indicator | Pulsing dot + "Waiting for payment..." |

---

### Behaviour
- Polls order status from the server every 3 seconds
- `payment_status === PAID` → navigate to Success screen
- `payment_status === FAILED` → navigate to Failed screen
- Timer reaches 0 → auto-cancel order → navigate to Failed screen
- Customer taps Cancel → cancel order → navigate to Failed screen

---

## Screen 7 — Cash Payment

### Purpose
Customer takes their device-generated order number to the attendant and pays cash. Screen waits for the attendant to confirm.

### Layout
Two vertical zones: top bar (cancel + countdown), body with order ID and instructions.

---

### Zone: Top Bar (Fixed)

| Element | Description |
|---|---|
| Cancel button | "✕ Cancel" |
| Countdown timer | "MM:SS ⏱" — counts down from 10 minutes |

---

### Zone: Body (Centered)

| Element | Description |
|---|---|
| Screen title | "Pay with Cash" |
| Order ID box | Prominent box (bordered, stands out). Contains: label "Show this to the attendant" + large monospaced order number "ORDER # {last 8 chars of order ID}" |
| Amount | "₹{total}" — large |
| Instruction text | "Hand ₹{N} cash to the attendant. They will confirm your order on the dashboard." |
| Animated waiting dots | 3 bouncing dots |
| Waiting subtext | "Waiting for attendant confirmation..." |

---

### Behaviour
- Polls order status from the server every 3 seconds
- `payment_status === PAID` → navigate to Success screen
- Timer reaches 0 → auto-cancel order → navigate to Failed screen
- Customer taps Cancel → cancel order → navigate to Failed screen

---

## Screen 8 — Success

### Purpose
Confirms the payment was received and the order is being prepared.

### Layout
Full screen. Centered content. Celebratory visual treatment.

### Zones

**Top Visual**
- Large success icon / checkmark (animated pop-in)
- Ambient glow effect behind the icon

**Message Section**
- Heading: "Payment Successful!"
- Subheading: "Your order is being prepared 🎉"

**Order Summary Section**
- List of purchased items: "{Product Name}  ×  {Qty}" — one per row
- Divider line
- Total row: "Total paid  ₹{amount}"

**Footer Section**
- Thank you message: "Thank you for your purchase! 🙏"
- Auto-return progress bar (fills over 5 seconds)
- Auto-return text: "Returning to start in {N}s"
- Manual button: "↩ Back to Start"

### Behaviour
- Automatically navigates to Idle after 5 seconds
- Customer can tap "Back to Start" to return immediately

---

## Screen 9 — Failed / Timed Out

### Purpose
Informs the customer that payment failed or the session expired. Gives them a path to retry or exit.

### Layout
Full screen. Centered content. Two variants: failure and timeout.

### Zones

**Icon**
- Failure: ❌
- Timeout: ⏰

**Message**
- Failure heading: "Payment Failed"
- Timeout heading: "Session Timed Out"
- Subtext: "Please try again or contact staff for assistance"

**Action Buttons** (stacked)
1. "🔄 Try Again" — returns to Catalog screen
2. "↩ Back to Start" — returns to Idle screen

**Auto-return text**
- "Auto-returning in {N}s..."

### Behaviour
- Determines variant based on whether the order was cancelled by timeout (`orderStatus === CANCELLED`) or by a genuine payment failure
- Automatically navigates to Idle after 15 seconds
- Customer can tap either button to navigate immediately

---

## Screen 10 — Error (Connection Failure)

### Purpose
Shown when the boot process fails completely — the device cannot reach the server at all.

### Layout
Full screen. Centered content.

### Zones

**Icon**
- Warning symbol ⚠️

**Message**
- Heading: "Connection Error"
- Body: "Unable to connect to the M9Vends network."
- Retry text: "Retrying automatically..."

**Loading indicator**
- Spinner

### Behaviour
- Automatically retries boot after 10 seconds (loops back to Boot screen)
- No customer interaction possible on this screen

---

## Shared Patterns

### Quantity Stepper
Used in: Catalog, Cart

```
[ − ]  [ N ]  [ + ]
```
- `−` removes 1 unit. If quantity reaches 0, removes the item from cart.
- `+` adds 1 unit. Disabled when quantity equals available stock.
- All three elements are the same height. Touch targets are large.

### Waiting Indicator
Used in: Provision, UPI Payment

```
●  Waiting for [X]...
```
- Filled circle that pulses (fades in/out or scales)
- Followed by a short status text

### Countdown Timer
Used in: UPI Payment, Cash Payment

```
MM:SS ⏱
```
- Monospaced digits for stable layout
- Becomes visually urgent (e.g. different treatment) when under 30 seconds

### Payment Screen Header
Used in: UPI Payment, Cash Payment

```
[ ✕ Cancel ]          [ MM:SS ⏱ ]
```
- Cancel on the left, timer on the right
- Full width, fixed at top

### Back Navigation
Used in: Catalog, Cart

- Button positioned top-left: "← Back"
- Always visible, never disabled

### Auto-return
Used in: Success (5s), Failed (15s)

- Timer counts down visibly
- At 0: automatically navigates to Idle
- Customer can skip by tapping a button


---

## Navigation Flow

```
boot
 ├── isProvisioned: false ──► provision ──(poll detects provisioned)──► idle
 └── isProvisioned: true  ──► idle
                                │
                           customer touch
                                │
                             catalog
                                │
                           checkout →
                                │
                              cart
                         ┌──────┴──────┐
                        UPI          CASH
                         │             │
                        upi           cash
                         │             │
                    PAID/FAILED   PAID/TIMEOUT
                         └──────┬──────┘
                        ┌───────┴────────┐
                      success          failed
                      (5s → idle)    (15s → idle)

boot error ──► error ──(10s)──► boot
```

---

## 1. BootScreen

**File:** `BootScreen.jsx`
**Trigger:** App first load
**Logic:** Calls IoT `POST /api/device/wake-up`. Retries every 5s on failure.

```
<div.boot-screen>
  <div.boot-logo-text>
    <span.boot-logo-m>  "M9"
    <span.boot-logo-v>  "Vends"
  <div.spinner />
  <p.boot-text>  "Connecting to machine..."
```

---

## 2. ProvisionScreen

**File:** `ProvisionScreen.jsx`
**Trigger:** `isProvisioned: false` after boot
**Logic:** Polls IoT wake-up every 10s. Navigates to `idle` when `isProvisioned: true`.

```
<div.provision-screen>
  <div.provision-badge>       "Setup Required"
  <h1.provision-title>        "Device Not Activated"
  <p.provision-subtitle>      "Scan this QR code with the M9Vends Admin App..."

  <div.qr-wrapper>
    <QRCodeSVG>               value = serialNumber

  <p.serial-label>            "Serial: {serialNumber}"

  <div.waiting-indicator>
    <span.pulse-dot />
    <span>                    "Waiting for activation..."

  [DEV ONLY]
  <button.dev-skip-btn>       "⚡ Skip to Idle (Dev Only)"
```

---

## 3. IdleScreen

**File:** `IdleScreen.jsx`
**Trigger:** After provisioning or any session reset
**Logic:** Calls `resetSession()` on mount. On any touch → fetches catalog → navigates to `catalog`.

```
<div.idle-screen>             (onClick = handleTouch, role="button")
  <div.idle-bg-animation />   (animated gradient background)

  <div.idle-logo>
    <span.boot-logo-m>        "M9"
    <span.boot-logo-v>        "Vends"

  <div.idle-tagline>          "Fresh Flavours, Instant Delivery"

  <div.idle-cta-wrapper>
    <div.idle-cta-ring />     (pulsing ring animation)
    <h1.idle-cta>             "Touch to Start"

  <div.idle-particles>
    <div.particle.particle-1 /> ... <div.particle.particle-6 />
```

---

## 4. CatalogScreen

**File:** `CatalogScreen.jsx`
**Trigger:** After customer touches idle screen
**Logic:** Catalog data already in Zustand store (fetched on idle touch).

### Error state (catalogError)
```
<div.catalog-error-screen>
  <div.error-icon>            "⚠️"
  <p.catalog-error-msg>       {catalogError}
  <button.btn-home>           "← Back to Start"
```

### Loading state (catalog.length === 0)
```
<div.catalog-loading-screen>
  <div.spinner />
  <p>                         "Loading products..."
```

### Main state
```
<div.catalog-screen>

  <header.catalog-header>
    <button.btn-back>         "← Back"
    <div.catalog-header-logo>
      <span.boot-logo-m>      "M9"
      <span.boot-logo-v>      "Vends"
    <button.cart-badge-btn>   "🛒 {cartItemCount()}"

  <div.search-wrapper>
    <input.catalog-search>    placeholder="🔍 Search products..."

  <div.product-grid>
    [if no results]
      <div.catalog-empty>     "No products found"

    [for each item]
    <div.product-card>        (.out-of-stock if stock === 0)

      <div.product-image-wrapper>
        [if image_url]  <Image />
        [else]          <div.product-img-placeholder>  "🥤"
        [if slot_label] <span.slot-chip>  {slot_label}

      <div.product-info>
        <h3.product-name>     {product_name}
        [if description]
          <p.product-desc>    {description}
        <div.product-bottom-row>
          <span.product-price>        "₹{price}"
          <div.stock-indicator>       "In stock" / "Only N left" / "Out of stock"
                              (.high / .low / .none)

      [if out of stock]
        <div.oos-label>       "Unavailable"
      [if qty === 0]
        <button.btn-add>      "Add"
      [else]
        <div.qty-control>
          <button>            "−"
          <span>              {qty}
          <button disabled?>  "+"

  [if cartItemCount() > 0]
  <div.cart-bar>
    <div.cart-bar-info>
      <span.cart-bar-count>   "{N} item(s)"
      <span.cart-bar-total>   "₹{total}"
    <button.btn-checkout>     "Checkout →"
```

---

## 5. CartScreen

**File:** `CartScreen.jsx`
**Trigger:** Customer taps "Checkout →"
**Logic:** Empty cart → redirects back to `catalog`. On pay → calls `POST /api/public/order`.

```
<div.cart-screen>

  <header.cart-header>
    <button.btn-back>         "← Back"
    <h2.cart-header-title>    "Review Order"
    <div.cart-header-spacer />

  <div.cart-items>
    [for each item]
    <div.cart-item>
      <div.cart-item-left>
        <div.cart-item-img-placeholder>   "🥤"
        <div.cart-item-info>
          <span.cart-item-name>   {product_name}
          <span.cart-item-unit>   "₹{price} each"
      <div.cart-item-right>
        <div.qty-control>
          <button>            "−"
          <span>              {quantity}
          <button disabled?>  "+"
        <span.cart-item-subtotal>  "₹{price × qty}"

  <div.cart-total-row>
    <span.cart-total-label>   "Total"
    <strong.cart-total-value> "₹{cartTotal()}"

  [if error]
  <div.cart-error>            {error message}

  <div.payment-buttons>
    <button#btn-pay-upi.btn-pay-upi>
      [if loading]  <span.btn-loading> <span.spinner-sm /> "Processing..."
      [else]        "⚡ Pay ₹{total} with UPI"
    <button#btn-pay-cash.btn-pay-cash>
      "💵 Pay with Cash"
```

---

## 6. UpiPaymentScreen

**File:** `UpiPaymentScreen.jsx`
**Trigger:** Customer selects UPI in CartScreen
**Logic:** 3-minute countdown + polls `GET /order/:id/status` every 3s. Cancel → calls `POST /order/:id/cancel`.

```
<div.upi-screen>

  <div.payment-header>
    <button.btn-cancel>       "✕ Cancel"
    <div.countdown>           "MM:SS ⏱"   (.urgent when < 30s)

  <div.upi-body>
    <h2.upi-title>            "Scan to Pay"

    <div.qr-container>
      <QRCodeSVG>             value = currentOrder.payment_link
      <div.qr-glow />

    <div.upi-amount>          "₹{total_amount}"

    <p.upi-hint>              "GPay · PhonePe · Paytm · Any UPI app"

    <div.waiting-indicator>
      <span.pulse-dot />
      <span.waiting-text>     "Waiting for payment..."
```

---

## 7. CashPaymentScreen

**File:** `CashPaymentScreen.jsx`
**Trigger:** Customer selects Cash in CartScreen
**Logic:** 10-minute countdown + polls `GET /order/:id/status` every 3s. Cancel → calls `POST /order/:id/cancel`.

```
<div.cash-screen>

  <div.payment-header>
    <button.btn-cancel>       "✕ Cancel"
    <div.countdown>           "MM:SS ⏱"

  <div.cash-body>
    <h2.cash-title>           "Pay with Cash"

    <div.order-id-box>
      <p.order-id-label>      "Show this to the attendant"
      <div.order-id-number>   "ORDER # {last 8 chars of order_id, uppercased}"

    <div.cash-amount>         "₹{totalAmount}"

    <p.cash-hint>             "Hand ₹{N} cash to the attendant.
                               They will confirm your order on the dashboard."

    <div.waiting-dots>
      <span /> <span /> <span />
    <p.waiting-sub>           "Waiting for attendant confirmation..."
```

---

## 8. SuccessScreen

**File:** `SuccessScreen.jsx`
**Trigger:** `payment_status === 'PAID'` detected by polling
**Logic:** Auto-returns to idle after 5 seconds.

```
<div.success-screen>
  <div.success-glow />

  <div.success-icon-wrapper>
    <div.success-icon>        "✓"

  <h1.success-title>          "Payment Successful!"
  <p.success-subtitle>        "Your order is being prepared 🎉"

  <div.order-summary>
    [for each item in cart]
    <div.summary-item>
      <span>    {product_name}
      <span>    "× {quantity}"
    <div.summary-divider />
    <div.summary-total>
      <span>    "Total paid"
      <strong>  "₹{total_amount}"

  <p.thank-you>               "Thank you for your purchase! 🙏"

  <div.auto-return-bar>
    <div.auto-return-progress />   (animates over 5s)
    <p.auto-return-text>           "Returning to start in {countdown}s"

  <button.btn-home>           "↩ Back to Start"
```

---

## 9. FailedScreen

**File:** `FailedScreen.jsx`
**Trigger:** `payment_status === 'FAILED'` or UPI/cash timer expired (`orderStatus === 'CANCELLED'`)
**Logic:** Auto-returns to idle after 15 seconds.

```
<div.failed-screen>
  <div.failed-icon>
    [if timeout]  "⏰"
    [else]        "❌"

  <h1.failed-title>
    [if timeout]  "Session Timed Out"
    [else]        "Payment Failed"

  <p.failed-subtitle>         "Please try again or contact staff for assistance"

  <div.failed-actions>
    <button#btn-retry.btn-retry>   "🔄 Try Again"     (→ catalog)
    <button.btn-home>              "↩ Back to Start"  (→ idle)

  <p.auto-return>             "Auto-returning in {countdown}s..."
```

---

## 10. ErrorScreen

**File:** `ErrorScreen.jsx`
**Trigger:** Critical boot failure (IoT service unreachable on first load)
**Logic:** Auto-retries boot after 10 seconds.

```
<div.error-screen>
  <div.error-icon>            "⚠️"
  <h1.error-title>            "Connection Error"
  <p.error-subtitle>          "Unable to connect to the M9Vends network."
  <p.error-retry>             "Retrying automatically..."
  <div.spinner />
```

---

## Shared Element Summary

| Element | Used in |
|---|---|
| `<div.spinner />` | Boot, Catalog (loading), Error |
| `<div.payment-header>` | UPI, Cash (identical header: cancel + countdown) |
| `<div.qty-control>` | Catalog, Cart |
| `<button.btn-back>` | Catalog, Cart |
| `<button.btn-cancel>` | UPI, Cash |
| `<button.btn-home>` | Catalog error, Success, Failed |
| `<span.pulse-dot />` | Provision, UPI |
| `<span.boot-logo-m/v>` | Boot, Idle, Catalog header |
| `<div.waiting-indicator>` | Provision, UPI |
