# SaaS Admin Dashboard

This is the frontend Admin Dashboard for the SaaS application. It provides a secure, intuitive interface for administrators to manage devices, products, orders, analytics, and settings.

## 🚀 Tech Stack

- **Framework**: [React 19](https://react.dev/) with [Vite](https://vitejs.dev/)
- **Routing**: [React Router DOM](https://reactrouter.com/) (v7)
- **State Management**: [Zustand](https://zustand-demo.pmnd.rs/)
- **API & Networking**: [Axios](https://axios-http.com/)
- **Forms & Validation**: [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)
- **Data Visualization**: [Recharts](https://recharts.org/)
- **Icons**: [Phosphor Icons](https://phosphoricons.com/)
- **Styling**: Plain CSS with CSS Modules / Variables
- **Notifications**: [React Hot Toast](https://react-hot-toast.com/)

## 📂 Project Structure

```text
src/
├── api/          # Axios instances and API route definitions
├── assets/       # Static assets (images, SVGs)
├── components/   # Reusable UI components (layout, guards, UI elements)
├── pages/        # Route-level page components (Dashboard, Devices, Products, etc.)
├── store/        # Zustand state stores (e.g., authStore)
├── App.jsx       # Main application component and routing configuration
└── main.jsx      # React entry point
```

## 🔑 Key Features

- **Authentication System**: Secure login flow with access tokens and automated token refresh via Axios interceptors on `401` errors.
- **Protected Routes**: Route guards ensuring only authenticated administrators can access dashboard pages.
- **Data Management**: Full CRUD interfaces for managing:
  - **Devices**: Monitor and manage IoT/SaaS devices.
  - **Products**: Manage product catalog and inventory.
  - **Orders**: View and process customer orders.
- **Analytics & Dashboard**: Real-time data visualization and aggregated metrics using Recharts.

## ⚙️ Setup & Installation

1. **Install Dependencies**
   Navigate to the `admin-dashboard` directory and run:
   ```bash
   npm install
   ```

2. **Environment Variables**
   Create a `.env` file in the root of `admin-dashboard` if required (though most API URLs are proxied).
   
3. **Run Development Server**
   ```bash
   npm run dev
   ```
   The dashboard will be available at `http://localhost:5173`.

## 🌐 API Proxy Setup

In development, Vite is configured to proxy all `/api` requests to the backend server (typically running on `http://localhost:5000`). This eliminates CORS issues during local development.

```javascript
// vite.config.js proxy snippet
proxy: {
  '/api': {
    target: 'http://localhost:5000',
    changeOrigin: true,
    secure: false,
  },
}
```

## 🛡️ Authentication Flow

The application uses an Access Token (Bearer) + HTTP-Only Refresh Token flow:
1. User logs in, backend returns an `accessToken` and sets an `httpOnly` cookie with the `refreshToken`.
2. The `accessToken` is stored in the **Zustand `authStore`** and automatically attached to all Axios requests via an interceptor.
3. If an API request returns `401 Unauthorized`, an Axios response interceptor pauses pending requests, calls `/api/admin/auth/refresh` to get a new `accessToken`, and resumes the queued requests seamlessly.

## 🛠️ Available Scripts

- `npm run dev`: Starts the Vite development server.
- `npm run build`: Builds the application for production.
- `npm run preview`: Locally preview the production build.
- `npm run lint`: Runs Oxlint to check for code quality and linting errors.
