import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/Login/LoginPage.jsx'
import ProtectedRoute from './components/guards/ProtectedRoute.jsx'
import PageLayout from './components/layout/PageLayout.jsx'
import DashboardPage from './pages/Dashboard/DashboardPage.jsx'
import DevicesPage from './pages/Devices/DevicesPage.jsx'
import ProductsPage from './pages/Products/ProductsPage.jsx'
import CatalogPage from './pages/Catalog/CatalogPage.jsx'
import OrdersPage from './pages/Orders/OrdersPage.jsx'
import AnalyticsPage from './pages/Analytics/AnalyticsPage.jsx'
import SettingsPage from './pages/Settings/SettingsPage.jsx'

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected — all admin pages */}
      <Route element={<ProtectedRoute />}>
        <Route element={<PageLayout />}>
          <Route path="/dashboard"  element={<DashboardPage />} />
          <Route path="/devices"    element={<DevicesPage />} />
          <Route path="/products"   element={<ProductsPage />} />
          <Route path="/catalog"    element={<CatalogPage />} />
          <Route path="/orders"     element={<OrdersPage />} />
          <Route path="/analytics"  element={<AnalyticsPage />} />
          <Route path="/settings"   element={<SettingsPage />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
