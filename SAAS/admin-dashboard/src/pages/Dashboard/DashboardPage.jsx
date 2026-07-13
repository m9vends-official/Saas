import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import {
  CurrencyInr, ShoppingCart, Desktop, Clock,
  TrendUp, TrendDown, ArrowRight
} from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'
import {
  fetchSummary,
  fetchRevenueOverTime,
  fetchPaymentMethods,
  fetchRevenueByMachine,
} from '../../api/analytics.api.js'
import { fetchOrders } from '../../api/orders.api.js'
import { fetchDevices } from '../../api/devices.api.js'
import './DashboardPage.css'

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n ?? 0))
const fmtRs = (n) => `₹${fmt(n)}`
const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
const today = () =>
  new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'short', year:'numeric' })

// ── Custom Tooltip for line chart ─────────────────────────────────────────
const LineTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background:'#111e33', border:'1px solid #253655',
      borderRadius:8, padding:'10px 14px', fontSize:12,
    }}>
      <div style={{color:'#94a3b8', marginBottom:4, fontFamily:'monospace'}}>{label}</div>
      <div style={{color:'#38bdf8', fontFamily:'monospace', fontWeight:600}}>
        {fmtRs(payload[0]?.value)}
      </div>
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, iconClass, valueClass, trend, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <span className="stat-card-label">{label}</span>
        <div className={`stat-card-icon ${iconClass}`}>
          <Icon size={16} weight="duotone" />
        </div>
      </div>
      <div className={`stat-card-value ${valueClass ?? ''}`}>{value}</div>
      <div className="stat-card-footer">
        {trend != null && (
          <span className={`stat-trend ${trend >= 0 ? 'up' : 'down'}`}>
            {trend >= 0 ? <TrendUp size={11} /> : <TrendDown size={11} />}
            {Math.abs(trend)}%
          </span>
        )}
        <span>{sub}</span>
      </div>
    </div>
  )
}

// ── Status Badge ──────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    PAID:      'badge badge-green',
    PENDING:   'badge badge-amber',
    FAILED:    'badge badge-red',
    REFUNDED:  'badge badge-purple',
  }
  return <span className={map[status] ?? 'badge badge-muted'}>{status}</span>
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function DashboardPage() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState('7D')

  const periodParam = period === '7D' ? 7 : period === '30D' ? 30 : 90
  const fromDate = new Date(Date.now() - periodParam * 86400000).toISOString().split('T')[0]

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: summary, isLoading: loadSum } = useQuery({
    queryKey: ['summary', period],
    queryFn: () => fetchSummary({ from_date: fromDate }).then(r => r.data.data),
  })

  const { data: revenue = [], isLoading: loadRev } = useQuery({
    queryKey: ['revenue', period],
    queryFn: () =>
      fetchRevenueOverTime({ group_by: 'day', from_date: fromDate })
        .then(r => r.data.data.map(d => ({
          name: `${d.period.day}/${d.period.month}`,
          revenue: d.revenue,
        }))),
  })

  const { data: payMethods = [], isLoading: loadPay } = useQuery({
    queryKey: ['payMethods'],
    queryFn:  () => fetchPaymentMethods().then(r => r.data.data),
  })

  const { data: machines = [], isLoading: loadMach } = useQuery({
    queryKey: ['machineRevenue', period],
    queryFn:  () => fetchRevenueByMachine({ from_date: fromDate }).then(r => r.data.data),
  })

  const { data: ordersData, isLoading: loadOrders } = useQuery({
    queryKey: ['recentOrders'],
    queryFn:  () => fetchOrders({ limit: 6 }).then(r => r.data),
  })

  const { data: devicesData } = useQuery({
    queryKey: ['devices'],
    // FIX: return r.data.data (array) so the cache is consistent with DevicesPage
    queryFn:  () => fetchDevices().then(r => r.data.data),
  })

  const activeDevices = devicesData?.filter(d => d.status === 'ACTIVE').length ?? 0
  const totalDevices  = devicesData?.length ?? 0
  const recentOrders  = ordersData?.orders ?? []

  // ── Pie colors ───────────────────────────────────────────────────────────
  const PIE_COLORS = ['#38bdf8', '#f59e0b', '#22c55e', '#a78bfa']

  // ── Loading skeletons ────────────────────────────────────────────────────
  if (loadSum && loadRev) {
    return (
      <div className="dashboard">
        <div className="dash-stats">
          {[1,2,3,4].map(i => <div key={i} className="skeleton skeleton-stat" />)}
        </div>
        <div className="dash-charts">
          <div className="skeleton skeleton-chart" />
          <div className="skeleton skeleton-chart" />
        </div>
        <div className="dash-tables">
          <div className="skeleton skeleton-table" />
          <div className="skeleton skeleton-table" />
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="dash-header">
        <div>
          <div className="dash-title">Dashboard</div>
          <div className="dash-subtitle">Welcome back. Here's what's happening.</div>
        </div>
        <div className="dash-date">{today()}</div>
      </div>

      {/* ── Stat Cards ─────────────────────────────────────────────────── */}
      <div className="dash-stats">
        <StatCard
          label="Total Revenue"
          value={fmtRs(summary?.total_revenue)}
          icon={CurrencyInr}
          iconClass="green"
          valueClass="green"
          sub="from paid orders"
        />
        <StatCard
          label="Total Orders"
          value={fmt(summary?.total_orders)}
          icon={ShoppingCart}
          iconClass="cyan"
          sub={`${fmt(summary?.pending_orders)} pending`}
        />
        <StatCard
          label="Active Machines"
          value={`${activeDevices} / ${totalDevices}`}
          icon={Desktop}
          iconClass="purple"
          sub="machines online"
        />
        <StatCard
          label="Avg Order Value"
          value={fmtRs(summary?.avg_order_value)}
          icon={TrendUp}
          iconClass="amber"
          valueClass="amber"
          sub="per paid order"
        />
      </div>

      {/* ── Charts ─────────────────────────────────────────────────────── */}
      <div className="dash-charts">

        {/* Line Chart — Revenue over time */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <div className="chart-card-title">Revenue Over Time</div>
              <div className="chart-card-sub">Daily paid order revenue</div>
            </div>
            <div className="period-tabs">
              {['7D','30D','90D'].map(p => (
                <button
                  key={p}
                  className={`period-tab ${period === p ? 'active' : ''}`}
                  onClick={() => setPeriod(p)}
                >{p}</button>
              ))}
            </div>
          </div>
          {revenue.length === 0 ? (
            <div className="dash-empty">No revenue data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={revenue} margin={{ top:4, right:4, left:-20, bottom:0 }}>
                <CartesianGrid stroke="#1e2e47" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill:'#4e6280', fontSize:11, fontFamily:'JetBrains Mono' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fill:'#4e6280', fontSize:11, fontFamily:'JetBrains Mono' }}
                  axisLine={false} tickLine={false}
                  tickFormatter={v => `₹${v}`}
                />
                <Tooltip content={<LineTooltip />} />
                <Line
                  type="monotone" dataKey="revenue"
                  stroke="#38bdf8" strokeWidth={2}
                  dot={false} activeDot={{ r:4, fill:'#38bdf8', strokeWidth:0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie Chart — Payment Methods */}
        <div className="chart-card">
          <div className="chart-card-header">
            <div>
              <div className="chart-card-title">Payment Methods</div>
              <div className="chart-card-sub">UPI vs Cash split</div>
            </div>
          </div>
          {payMethods.length === 0 ? (
            <div className="dash-empty">No payment data yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={payMethods}
                    dataKey="total_revenue"
                    nameKey="method"
                    cx="50%" cy="50%"
                    innerRadius={45} outerRadius={65}
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {payMethods.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v, n) => [fmtRs(v), n]}
                    contentStyle={{
                      background:'#111e33', border:'1px solid #253655',
                      borderRadius:8, fontSize:12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-legend">
                {payMethods.map((m, i) => (
                  <div key={m.method} className="donut-legend-item">
                    <div className="donut-legend-left">
                      <div className="donut-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span>{m.method}</span>
                    </div>
                    <span className="donut-value">{fmtRs(m.total_revenue)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Tables ─────────────────────────────────────────────────────── */}
      <div className="dash-tables">

        {/* Top Machines */}
        <div className="table-card">
          <div className="table-card-header">
            <span className="table-card-title">Top Machines</span>
            <span className="table-card-link" onClick={() => navigate('/devices')}>
              View all <ArrowRight size={12} style={{display:'inline'}} />
            </span>
          </div>
          {machines.length === 0 ? (
            <div className="dash-empty">No machine data yet</div>
          ) : (
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Machine ID</th>
                  <th>Orders</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {machines.slice(0, 5).map(m => (
                  <tr key={m.machine_id}>
                    <td><span className="td-mono">{m.machine_id}</span></td>
                    <td>{m.total_orders}</td>
                    <td><span className="td-revenue">{fmtRs(m.total_revenue)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent Orders */}
        <div className="table-card">
          <div className="table-card-header">
            <span className="table-card-title">Recent Orders</span>
            <span className="table-card-link" onClick={() => navigate('/orders')}>
              View all <ArrowRight size={12} style={{display:'inline'}} />
            </span>
          </div>
          {recentOrders.length === 0 ? (
            <div className="dash-empty">No orders yet</div>
          ) : (
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Machine</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(o => (
                  <tr key={o._id}>
                    <td><span className="td-mono">{o.machine_id}</span></td>
                    <td><span className="td-revenue">{fmtRs(o.total_amount)}</span></td>
                    <td><StatusBadge status={o.payment_status} /></td>
                    <td style={{ fontFamily:'var(--font-mono)', fontSize:11 }}>
                      <Clock size={11} style={{marginRight:4, verticalAlign:'middle'}} />
                      {timeAgo(o.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
