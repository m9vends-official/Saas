# M9Vends Admin Dashboard — Frontend Collaborator Guide

> **Last Updated:** July 2026  
> **Stack:** React 18 + Vite · React Query · Zustand · React Hook Form + Zod · React Router v6 · Recharts · Phosphor Icons  
> **Theme:** Dark Navy · Cyan Accent · DM Sans + JetBrains Mono

---

## 1. Project Overview

M9Vends is a **multi-tenant SaaS platform** for vending machine operators. Each company (tenant) logs in and manages their fleet of vending machines — products, stock, orders, payments, and analytics.

### Architecture

```
SAAS/
├── backend/           ← Node.js + Express + MongoDB  (Port 5000)
├── admin-dashboard/   ← React + Vite admin panel     (Port 5173)
└── kiosk-screen/      ← React kiosk UI (NOT STARTED) (Port 5174)
```

### Key Architectural Rules
1. **Tenant isolation** — every API call is scoped to the logged-in company. Never expose cross-company data.
2. **Auth:** Access token stored in Zustand (memory only). Refresh token in httpOnly cookie. The `axios.js` interceptor handles silent refresh on 401.
3. **No baseURL in axios** — Vite proxies `/api/*` → `http://localhost:5000`. Never hardcode the backend URL.
4. **All data through React Query** — no `useEffect` + `useState` for API calls. Use `useQuery` + `useMutation` everywhere.

---

## 2. Setup & Running

```bash
# 1. Install dependencies
cd SAAS/admin-dashboard
npm install

# 2. Environment
# .env already configured. Don't touch VITE_API_URL in dev (proxy handles it).

# 3. Start backend first (required for Vite proxy)
cd ../backend && npm run dev     # runs on :5000

# 4. Start frontend
cd ../admin-dashboard && npm run dev   # runs on :5173
```

**Login credentials** (create via Postman `POST /api/admin/auth/register` first):
```
Email:    admin@test.com
Password: Test1234
```

---

## 3. File Structure

```
src/
├── api/                        ← One file per resource (no Axios logic here)
│   ├── axios.js                ← Axios instance + auth interceptors (DO NOT MODIFY)
│   ├── analytics.api.js        ✅ Done
│   ├── catalog.api.js          ✅ Done
│   ├── devices.api.js          ✅ Done
│   ├── orders.api.js           ✅ Done
│   └── products.api.js         ✅ Done
│
├── components/
│   ├── guards/
│   │   └── ProtectedRoute.jsx  ← Redirects to /login if no auth
│   └── layout/
│       ├── Sidebar.jsx         ← Left navigation (all routes)
│       ├── Sidebar.css
│       ├── PageLayout.jsx      ← Sidebar + <Outlet />
│       └── PageLayout.css
│
├── pages/
│   ├── Login/                  ✅ Done
│   ├── Dashboard/              ✅ Done  (KPI cards, charts, top machines, recent orders)
│   ├── Devices/                ✅ Done  (grid, register modal, status update modal)
│   ├── Products/               ✅ Done  (table, add/edit drawer, delete modal)
│   ├── Catalog/                ✅ Done  (machine selector, per-machine catalog, inline editing)
│   ├── Orders/                 ❌ TODO  (table, filter by status, confirm cash)
│   ├── Analytics/              ❌ TODO  (5 chart types connected to analytics API)
│   └── Settings/               ❌ TODO  (profile, password change)
│
├── store/
│   └── authStore.js            ← Zustand: { user, accessToken, setAuth, logout }
│
├── App.jsx                     ← All routes defined here
├── main.jsx                    ← QueryClient + BrowserRouter + Toaster
└── index.css                   ← ENTIRE design system lives here ← READ THIS FIRST
```

---

## 4. Design System

All design tokens are CSS variables defined in `src/index.css`. **Never use hardcoded colors or sizes.**

### 4.1 Color Palette

#### Background Layers (dark → light)
| Variable | Value | Usage |
|---|---|---|
| `--bg-base` | `#080e1a` | Deepest background, page chrome |
| `--bg-primary` | `#0d1526` | Main page background |
| `--bg-surface` | `#111e33` | Cards, panels, table rows |
| `--bg-elevated` | `#162340` | Modals, dropdowns, table headers |
| `--bg-input` | `#0a1220` | Input fields |
| `--bg-hover` | `#1a2a45` | Row hover, button hover states |

#### Borders
| Variable | Value | Usage |
|---|---|---|
| `--border-subtle` | `#1e2e47` | Card borders, dividers |
| `--border-default` | `#253655` | Input borders, separators |
| `--border-strong` | `#2e4268` | Focused borders, scrollbars |

#### Brand Colors
| Variable | Value | Usage |
|---|---|---|
| `--cyan` | `#38bdf8` | Primary accent, highlighted values, active states |
| `--cyan-dim` | `#0ea5e9` | Slightly deeper cyan, focus rings |
| `--cyan-glow` | `rgba(56,189,248,0.15)` | Input focus glow |
| `--blue-btn` | `#2563eb` | Primary CTA button background |
| `--blue-btn-hover` | `#1d4ed8` | Primary button hover |

#### Status Colors
| Variable | Color | Dim (background) | Usage |
|---|---|---|---|
| `--green` | `#22c55e` | `--green-dim` rgba(34,197,94,0.12) | Active, success, revenue |
| `--amber` | `#f59e0b` | `--amber-dim` rgba(245,158,11,0.12) | Warning, maintenance, pending |
| `--red` | `#ef4444` | `--red-dim` rgba(239,68,68,0.12) | Error, failed, disabled, danger |
| `--purple` | `#a78bfa` | `--purple-dim` rgba(167,139,250,0.12) | Secondary stats, special badges |

#### Text
| Variable | Value | Usage |
|---|---|---|
| `--text-primary` | `#f1f5f9` | Headings, important values |
| `--text-secondary` | `#94a3b8` | Body text, descriptions |
| `--text-muted` | `#4e6280` | Labels, placeholders, timestamps |
| `--text-cyan` | `#38bdf8` | Highlighted text, links |

### 4.2 Typography

```css
--font-sans: 'DM Sans', system-ui, sans-serif;   /* All UI text */
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;  /* IDs, prices, code, timestamps */
```

**Rules:**
- Body text: 13–14px, `var(--font-sans)`
- Machine IDs, prices, SKUs, timestamps: **always** `var(--font-mono)`
- Page titles: 22px, 700 weight
- Section labels: 11px, 700 weight, uppercase, `letter-spacing: 0.08em`
- Table headers: 10px, 700 weight, uppercase, `letter-spacing: 0.09em`

### 4.3 Spacing Scale

```css
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;   ← standard page padding
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

### 4.4 Border Radius

```css
--radius-sm:   6px;   /* inputs, small buttons */
--radius-md:   10px;  /* medium cards */
--radius-lg:   14px;  /* main cards, table wrappers */
--radius-xl:   20px;  /* modals, large drawers */
--radius-pill: 999px; /* badges, pill buttons */
```

### 4.5 Transitions

```css
--transition:    150ms ease;   /* hover effects, color changes */
--transition-md: 250ms ease;   /* modals, drawers opening */
```

### 4.6 Layout Constants

```css
--sidebar-width:  240px;
--sidebar-mini:   68px;
--header-height:  60px;
```

---

## 5. Component Library (Global Classes in `index.css`)

### 5.1 Buttons

```jsx
/* Primary CTA — blue, always visible */
<button className="btn btn-primary">Add Product</button>

/* Outline — secondary action */
<button className="btn btn-outline">Cancel</button>

/* Ghost — for icon-only or subtle actions */
<button className="btn btn-ghost">...</button>

/* Danger — destructive actions */
<button className="btn btn-danger">Delete</button>

/* Sizes */
<button className="btn btn-primary btn-sm">Small</button>   {/* 6px 12px, 12px font */}
<button className="btn btn-primary">Default</button>         {/* 9px 18px, 14px font */}
<button className="btn btn-primary btn-lg">Large</button>    {/* 12px 24px, 15px font */}
```

**Loading state:** Replace button text with `<span className="spinner" />` while `mutation.isPending`.

### 5.2 Status Badges

```jsx
<span className="badge badge-green">ACTIVE</span>
<span className="badge badge-amber">MAINTENANCE</span>
<span className="badge badge-red">DISABLED</span>
<span className="badge badge-blue">REGISTERED</span>
<span className="badge badge-purple">REFUNDED</span>
<span className="badge badge-muted">GENERAL</span>
```

Badges auto-apply: `font-family: mono`, uppercase, letter-spacing. **Do not add extra styling.**

### 5.3 Form Inputs

```jsx
/* Standard input group */
<div className="input-group">
  <label className="input-label">Field Name *</label>
  <input className="input" placeholder="..." {...register('field')} />
  {errors.field && <span className="input-error">{errors.field.message}</span>}
</div>

/* Error state — add 'error' class */
<input className="input error" />

/* Select — dark themed (arrow icon built in) */
<select className="input">
  <option value="">— Select —</option>
</select>

/* Textarea */
<textarea className="input" />
```

### 5.4 Cards

```jsx
<div className="card">
  {/* surface bg + subtle border + 14px radius + 24px padding */}
</div>
```

### 5.5 Spinner

```jsx
<span className="spinner" />  {/* 18x18 cyan spinning ring */}
```

### 5.6 Divider

```jsx
<div className="divider" />  {/* 1px horizontal line */}
```

### 5.7 Utility Classes

```
.mono            → font-family: monospace
.text-primary    → color: var(--text-primary)
.text-secondary  → color: var(--text-secondary)
.text-muted      → color: var(--text-muted)
.text-cyan       → color: var(--cyan)
.text-green      → color: var(--green)
.text-amber      → color: var(--amber)
.text-red        → color: var(--red)
.flex / .flex-col / .items-center / .justify-between
.gap-2 / .gap-3 / .gap-4 / .gap-6
.w-full / .h-full
```

---

## 6. Page Anatomy

Every page follows this exact structure:

```jsx
// MyPage.jsx
import './MyPage.css'

export default function MyPage() {
  return (
    <div className="my-page">          {/* padding: 32px, flex-col, gap: 24px */}

      {/* 1. Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Page Title</div>
          <div className="page-subtitle">Description of the page</div>
        </div>
        <button className="btn btn-primary">Primary Action</button>
      </div>

      {/* 2. Filters / Search bar */}

      {/* 3. Main content (table or grid or charts) */}

      {/* 4. Modals / Drawers (conditional rendering) */}
      {showModal && <MyModal onClose={() => setShowModal(false)} />}
    </div>
  )
}
```

---

## 7. API Layer Patterns

### Query (read data)
```jsx
const { data, isLoading } = useQuery({
  queryKey: ['resource', filters],           // unique key — include all variables
  queryFn:  () => fetchResource(params).then(r => r.data.data),
  enabled:  !!requiredParam,                  // only run when ready
})
const items = data ?? []
```

### Mutation (write data)
```jsx
const qc = useQueryClient()
const mutation = useMutation({
  mutationFn: (data) => createResource(data),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ['resource'] })  // refresh the list
    toast.success('Created!')
    onClose()
  },
  onError: (err) => toast.error(err.response?.data?.message || 'Error'),
})
```

### Backend Response Shapes

| Endpoint | Response shape | How to access |
|---|---|---|
| `GET /api/admin/devices` | `{ success, data: [] }` | `r.data.data` |
| `GET /api/admin/products` | `{ success, pagination, data: [] }` | `r.data.data` |
| `GET /api/admin/catalog` | `{ success, data: [] }` | `r.data.data` |
| `GET /api/admin/orders` | `{ success, orders: [], pagination }` | `r.data.orders` |
| `GET /api/admin/analytics/*` | `{ success, data: ... }` | `r.data.data` |
| `POST /api/admin/auth/login` | `{ success, accessToken, user }` | `r.data` (flat!) |

> ⚠️ **Critical:** The login and refresh endpoints return flat objects — **not** nested under `data`. All others use `{ success, data }`.

### React Query Key Conventions

```
['devices']                  ← device list (shared across Dashboard + Devices pages)
['products']                 ← product list (shared across Dashboard + Catalog + Products pages)
['catalog', machineId]       ← catalog for a specific machine
['recentOrders']             ← last 6 orders on Dashboard
['orders', filters]          ← Orders page with pagination/filters
['summary', period]          ← analytics summary KPIs
['revenue', period]          ← revenue over time chart
['machineRevenue', period]   ← per-machine revenue
['payMethods']               ← payment method split
```

> **Rule:** If two pages need the same data, use the **same queryKey** and the **same queryFn** returning the **same shape**. Mismatched shapes cause cache bugs.

---

## 8. Auth & State

### Zustand Store (`src/store/authStore.js`)

```js
// Shape
{
  user: { name, email, role, company_id } | null,
  accessToken: string | null,
  setAuth: (user, accessToken) => void,
  setToken: (accessToken) => void,
  logout: () => void,
}

// Usage in a component
const { user, logout } = useAuthStore()
const token = useAuthStore(s => s.accessToken)
```

### Roles

```
SUPER_ADMIN  → Platform owner (M9Vends)
ADMIN        → Business owner / manager
TECHNICIAN   → Field staff (limited access)
```

Access `user.role` to conditionally show/hide UI elements.

### Auth Flow
1. Login → backend returns `{ accessToken, user }` → store in Zustand
2. Backend sets httpOnly cookie with refreshToken
3. Every request → `axios.js` interceptor attaches `Authorization: Bearer <token>`
4. On 401 → interceptor calls `POST /api/admin/auth/refresh` silently → updates Zustand → retries original request

---

## 9. What's Done vs TODO

### ✅ Completed Pages

| Page | Route | Key Features |
|---|---|---|
| Login | `/login` | Dark theme, form validation, toast |
| Dashboard | `/dashboard` | 4 KPI cards, revenue line chart, payment methods donut, top machines table, recent orders table, period selector |
| Devices | `/devices` | 3-col card grid, search + status filter, register machine modal, update status modal, online indicator |
| Products | `/products` | Table with image/emoji, search, availability filter, add/edit slide-in drawer, soft-delete modal |
| Catalog | `/catalog` | Machine selector, catalog table, inline stock edit (click bar), inline price override, add product modal, remove modal |

### ❌ TODO Pages

| Page | Route | What to Build |
|---|---|---|
| **Orders** | `/orders` | Orders table with pagination, filter by status (PAID/PENDING/FAILED), filter by machine_id, confirm cash payment button |
| **Analytics** | `/analytics` | Full dashboard: revenue over time (period selector), top products bar chart, revenue by machine, payment methods donut, summary KPI row |
| **Settings** | `/settings` | Profile info display, change password form, company info |

---

## 10. Orders Page — Spec

### Backend
- `GET /api/admin/orders?status=&machine_id=&page=&limit=20`
- Response: `{ success, orders: [], pagination: { total, page, totalPages } }`
- `POST /api/admin/orders/:id/confirm-cash` — for CASH payment orders awaiting confirmation

### Fields to Display
| Field | Source | Notes |
|---|---|---|
| Order ID | `order._id` | `mono` font, truncate to last 8 chars |
| Machine | `order.machine_id` | `mono`, cyan color |
| Items | `order.items.length` | e.g. "3 items" |
| Amount | `order.total_amount` | `fmtRs(n)`, green mono |
| Payment | `order.payment_method` | ONLINE / CASH badge |
| Status | `order.payment_status` | PAID/PENDING/FAILED badge |
| Time | `order.createdAt` | timeAgo() format |

### Confirm Cash Button
Show only when `payment_method === 'CASH'` and `payment_status === 'PENDING'`.

---

## 11. Analytics Page — Spec

### Available API endpoints (all in `src/api/analytics.api.js`)

```js
fetchSummary({ from_date })             → { total_revenue, total_orders, pending_orders, avg_order_value }
fetchRevenueOverTime({ group_by: 'day', from_date })  → [{ period: { day, month }, revenue }]
fetchTopProducts({ from_date })         → [{ product_name, total_quantity, total_revenue }]
fetchRevenueByMachine({ from_date })    → [{ machine_id, total_orders, total_revenue }]
fetchPaymentMethods()                   → [{ method, total_orders, total_revenue }]
```

### Layout Suggestion

```
Row 1: 4 KPI stat cards (same as Dashboard)
Row 2: Revenue line chart (full width, period selector: 7D/30D/90D)
Row 3: [Top Products bar chart] + [Payment methods donut]
Row 4: Revenue by machine — bar chart or table
```

### Chart Library
Using **Recharts** (already installed). All charts in the codebase use Recharts. Match the style from `DashboardPage.jsx`.

---

## 12. Shared UI Patterns

### Loading Skeleton
```jsx
@keyframes shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position:  400px 0; }
}
.skeleton {
  background: linear-gradient(90deg,
    var(--bg-elevated) 25%,
    var(--bg-hover)    50%,
    var(--bg-elevated) 75%
  );
  background-size: 800px 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-lg);
}
```
Show for every page while `isLoading === true`.

### Empty State
```jsx
<div style={{ display:'flex', flexDirection:'column', alignItems:'center', 
              gap:12, padding:'60px 20px', color:'var(--text-muted)' }}>
  <IconComponent size={40} style={{ opacity: 0.2 }} />
  <p>Descriptive message about what's missing</p>
  <button className="btn btn-primary">Primary CTA</button>
</div>
```

### Modal Pattern
```jsx
function MyModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Title</span>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        {/* content */}
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary">Confirm</button>
        </div>
      </div>
    </div>
  )
}
```

### Right Drawer Pattern
```jsx
function MyDrawer({ onClose }) {
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-header">...</div>
        <div className="drawer-body">...</div>
        <div className="drawer-footer">...</div>
      </div>
    </>
  )
}
```
`.drawer` has `animation: slideIn 200ms ease` from the right.

### Price Formatting
```js
const fmtRs = (n) => `₹${new Intl.NumberFormat('en-IN').format(Math.round(n ?? 0))}`
```
Always use this. Never use `.toFixed()` for display.

### Time Ago
```js
const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
```

---

## 13. Icon Library

Using **Phosphor Icons** (`@phosphor-icons/react`). Weight: `"duotone"` for nav, `"fill"` for status icons, default for general use.

```jsx
import { SquaresFour, Desktop, Package, GridFour,
         ShoppingCart, ChartLine, Gear, SignOut,
         Plus, X, MagnifyingGlass, Trash, PencilSimple,
         FloppyDisk, Warning, CheckCircle, Wrench,
         CurrencyInr, TrendUp, TrendDown, ArrowRight,
         MapPin, Clock, ListBullets } from '@phosphor-icons/react'
```

**Rule:** Match size to context — `size={16}` for buttons, `size={18}` for sidebar, `size={13}` for table action buttons.

---

## 14. Installed Dependencies

```json
{
  "@phosphor-icons/react": "^2.x",
  "@tanstack/react-query": "^5.x",
  "@hookform/resolvers": "^3.x",
  "axios": "^1.x",
  "react-hook-form": "^7.x",
  "react-hot-toast": "^2.x",
  "react-router-dom": "^6.x",
  "recharts": "^2.x",
  "zod": "^3.x",
  "zustand": "^4.x"
}
```

Do **not** add TailwindCSS. Do **not** add a component library (Material UI, Chakra, etc.). All styling is vanilla CSS with the design system tokens.

---

## 15. Common Mistakes to Avoid

| ❌ Wrong | ✅ Correct |
|---|---|
| `r.data.data.orders` | `r.data.orders` (orders endpoint is flat) |
| `r.data.data` on login | `r.data.accessToken` (login is flat) |
| Mismatched `queryKey` shapes | Use same key + same shape across all pages |
| Hardcoded `http://localhost:5000` | Use `/api/...` (Vite proxy) |
| `z.string().toUpperCase()` | `z.string().transform(v => v.toUpperCase())` |
| `useEffect` for data fetching | `useQuery` always |
| Hard delete in UI | Backend uses soft delete — show confirm modal first |
| `useState` for access token | `useAuthStore` (Zustand) |

---

## 16. Git & Branching

- **Repo:** `github.com/Sanjay452656/Saas`
- **Branch:** `main` (push directly or via PR)
- **Commit convention:** `feat: <page name> completed` / `fix: <what was broken>`

When you finish a page, commit these files:
```
src/pages/<PageName>/PageName.jsx
src/pages/<PageName>/PageName.css
src/api/<resource>.api.js    (if new)
```
