# Frontend Integration Guide

This guide helps you integrate the frontend with the SaaS backend effectively.

## 1. Database Models (What you receive)

When you make API calls, you are essentially reading/writing to these models:

- **Company**: Represents the tenant. Includes `company_name`, `plan` (FREE, PRO, ENTERPRISE), `is_active`.
- **User**: The admin/technician. Has `name`, `email`, `role` (SUPER_ADMIN, ADMIN, TECHNICIAN).
- **Product**: Items sold in the machines. You get `product_name`, `price`, `image_url`, `category`, `sku`. (Note: `is_deleted` is used for soft deletes).
- **Device**: The physical vending machines. You get `device_id` (e.g., VM-001), `status` (ACTIVE/MAINTENANCE), `location` (city, state), `last_seen_at`.
- **MachineCatalog**: The linkage between a Device and a Product. Gives you `stock`, `max_capacity`, `slot_label` (e.g., A1), and `price_override` (if a machine sells something at a different price than the global product price).
- **Order**: A customer transaction. Includes `items`, `total_amount`, `payment_status` (PENDING/PAID), `order_status`, `payment_method` (UPI).

## 2. Environment Variables

Your React `.env` should have:

- `VITE_API_BASE_URL=http://localhost:5000` (The backend URL)
- `VITE_RAZORPAY_KEY_ID=rzp_test_xxxx` (Needed if you implement Razorpay checkout in the browser)

*Note: You do NOT need the DB URI, JWT secrets, etc. Those are backend-only.*

## 3. Error Handling

You must anticipate these HTTP status codes in your Axios `.catch()` blocks:

- **401 Unauthorized**: Token missing or expired. Action: Try refreshing token, or redirect to `/login`.
- **403 Forbidden**: Logged in, but wrong role. E.g., a Technician trying to delete a user. Action: Show "Access Denied" UI.
- **404 Not Found**: Endpoint or resource doesn't exist. Action: Show 404 page or toast.
- **409 Conflict**: Resource already exists (e.g., trying to create a device with a duplicate `device_id`). Action: Highlight the error on the specific form field.
- **422 Unprocessable Entity** (or 400 Bad Request): Zod validation failed (e.g., negative price). The response will include an `errors` array. Action: Display the error message under the respective input field.
- **500 Internal Server Error**: Backend crashed. Action: Show a generic "Something went wrong" toast.

## 4. Suggested Frontend Architecture

To keep things clean, use this folder structure in React (assuming Vite + React + Zustand + React Query):

```text
src/
├── api/             # Axios instances and interceptors (attach JWT here)
├── components/      # Reusable UI (Buttons, Modals, Cards)
├── hooks/           # Custom React hooks (e.g., useAuth, useProducts)
├── pages/           # Page-level components (Login, Dashboard, Catalog)
├── services/        # API call wrappers (e.g., productApi.js, authApi.js)
├── store/           # Zustand/Redux state (for user session/theme)
└── utils/           # Helper functions (date formatting, currency formatting)
```

### Best Practices:
- **Loading State**: Always show a spinner or skeleton loader when an API call is in progress.
- **Error State**: Use a toast library (like `react-hot-toast`) to show API errors globally.
- **Caching & Refetching**: Use `React Query` (or SWR) instead of standard `useEffect`. It handles caching, loading states, and automatic refetching for you perfectly!
