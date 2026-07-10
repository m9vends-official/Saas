import { NavLink, useNavigate } from 'react-router-dom'
import {
  SquaresFour, Desktop, Package, GridFour,
  ShoppingCart, ChartLine, Gear, SignOut
} from '@phosphor-icons/react'
import { useAuthStore } from '../../store/authStore.js'
import api from '../../api/axios.js'
import toast from 'react-hot-toast'
import './Sidebar.css'

const LOGO = '/logo.png'

const navItems = [
  { to: '/dashboard',  icon: SquaresFour,  label: 'Dashboard' },
  { to: '/devices',    icon: Desktop,       label: 'Devices' },
  { to: '/products',   icon: Package,       label: 'Products' },
  { to: '/catalog',    icon: GridFour,      label: 'Catalog' },
  { to: '/orders',     icon: ShoppingCart,  label: 'Orders' },
  { to: '/analytics',  icon: ChartLine,     label: 'Analytics' },
  { to: '/settings',   icon: Gear,          label: 'Settings' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const handleLogout = async () => {
    try {
      await api.post('/api/admin/auth/logout')
    } catch (_) { /* ignore */ }
    logout()
    navigate('/login')
    toast.success('Logged out')
  }

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <img src={LOGO} alt="M9Vends" />
        <div>
          <div className="sidebar-logo-name">M9Vends</div>
          <div className="sidebar-logo-sub">{user?.company_name || 'Admin'}</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `sidebar-item ${isActive ? 'active' : ''}`
            }
          >
            <Icon size={18} weight="duotone" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="sidebar-footer">
        <button className="sidebar-logout" onClick={handleLogout}>
          <SignOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}
