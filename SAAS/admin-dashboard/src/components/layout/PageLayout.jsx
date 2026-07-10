import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import './PageLayout.css'

export default function PageLayout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <Outlet />
      </div>
    </div>
  )
}
