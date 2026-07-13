import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  MagnifyingGlass, Plus, X, MapPin, Clock,
  Desktop, Wrench, Warning, CheckCircle
} from '@phosphor-icons/react'
import toast from 'react-hot-toast'
import { fetchDevices, registerDevice, updateDevice } from '../../api/devices.api.js'
import './DevicesPage.css'

// ── Helpers ────────────────────────────────────────────────────────────────
const timeAgo = (iso) => {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const isOnline = (iso) => {
  if (!iso) return false
  return Date.now() - new Date(iso).getTime() < 5 * 60 * 1000 // within 5 min
}

// ── Status badge ───────────────────────────────────────────────────────────
const STATUS_CLASS = {
  ACTIVE:      'badge badge-active',
  REGISTERED:  'badge badge-registered',
  MAINTENANCE: 'badge badge-maintenance',
  DISABLED:    'badge badge-disabled',
}
const STATUS_ICON = {
  ACTIVE:      CheckCircle,
  REGISTERED:  Desktop,
  MAINTENANCE: Wrench,
  DISABLED:    Warning,
}

function StatusBadge({ status }) {
  const Icon = STATUS_ICON[status] ?? Desktop
  return (
    <span className={STATUS_CLASS[status] ?? 'badge badge-muted'}>
      <Icon size={10} weight="fill" style={{ marginRight: 4 }} />
      {status}
    </span>
  )
}

// ── Register form schema — mirrors backend Zod exactly ────────────────────
const registerSchema = z.object({
  // FIX: .toUpperCase() does not exist in Zod — use .transform()
  device_id:    z.string().min(1, 'Machine ID is required').transform(v => v.toUpperCase()),
  machine_name: z.string().min(1, 'Machine name is required'),
  location: z.object({
    address: z.string().optional().default(''),
    city:    z.string().optional().default(''),
    state:   z.string().optional().default(''),
    pincode: z.string().optional().default(''),
  }),
})

// ── Update status schema ─────────────────────────────────────────────────
const STATUS_OPTIONS = ['REGISTERED','ACTIVE','MAINTENANCE','DISABLED']

// ── Register Modal ─────────────────────────────────────────────────────────
function RegisterModal({ onClose }) {
  const qc = useQueryClient()
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm({ resolver: zodResolver(registerSchema),
      defaultValues: { location: {} }
    })

  const mutation = useMutation({
    mutationFn: (data) => registerDevice(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devices'] })
      toast.success('Machine registered successfully!')
      onClose()
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Registration failed')
    },
  })

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">Register New Machine</span>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit((d) => mutation.mutate(d))} noValidate>
          {/* Machine ID & Name */}
          <div className="modal-row">
            <div className="input-group">
              <label className="input-label">Machine ID *</label>
              <input
                className={`input ${errors.device_id ? 'error' : ''}`}
                placeholder="VM-BPL-001"
                style={{ fontFamily: 'var(--font-mono)', textTransform:'uppercase' }}
                {...register('device_id')}
              />
              {errors.device_id && <span className="input-error">{errors.device_id.message}</span>}
            </div>
            <div className="input-group">
              <label className="input-label">Machine Name *</label>
              <input
                className={`input ${errors.machine_name ? 'error' : ''}`}
                placeholder="DB Mall Bhopal"
                {...register('machine_name')}
              />
              {errors.machine_name && <span className="input-error">{errors.machine_name.message}</span>}
            </div>
          </div>

          {/* Location section */}
          <div className="modal-section-label">Physical Location</div>
          <div className="input-group">
            <label className="input-label">Address</label>
            <input className="input" placeholder="Shop No. 12, Ground Floor" {...register('location.address')} />
          </div>
          <div className="modal-row">
            <div className="input-group">
              <label className="input-label">City</label>
              <input className="input" placeholder="Bhopal" {...register('location.city')} />
            </div>
            <div className="input-group">
              <label className="input-label">State</label>
              <input className="input" placeholder="Madhya Pradesh" {...register('location.state')} />
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Pincode</label>
            <input className="input" placeholder="462001" style={{ maxWidth: 160 }} {...register('location.pincode')} />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || mutation.isPending}>
              {(isSubmitting || mutation.isPending) ? <span className="spinner" /> : 'Register Machine'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Update Status Modal ────────────────────────────────────────────────────
function UpdateStatusModal({ device, onClose }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState(device.status)

  const mutation = useMutation({
    mutationFn: () => updateDevice(device._id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devices'] })
      toast.success(`Status updated to ${status}`)
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Update failed'),
  })

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 380 }}>
        <div className="modal-header">
          <span className="modal-title">Update Status</span>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ fontSize:12, color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>
            {device.device_id} — {device.machine_name}
          </div>
          <div className="input-group">
            <label className="input-label">New Status</label>
            <select
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{ cursor:'pointer' }}
            >
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || status === device.status}
          >
            {mutation.isPending ? <span className="spinner" /> : 'Save Status'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Device Card ────────────────────────────────────────────────────────────
function DeviceCard({ device, onUpdateStatus }) {
  const loc = device.location
  const locationStr = [loc?.city, loc?.state].filter(Boolean).join(', ') || 'Location not set'
  const online = isOnline(device.last_seen_at)

  return (
    <div className="device-card">
      {/* Top row: ID + status */}
      <div className="device-card-top">
        <span className="device-id">{device.device_id}</span>
        <StatusBadge status={device.status} />
      </div>

      {/* Name + location */}
      <div>
        <div className="device-name">{device.machine_name || '—'}</div>
        <div className="device-location" style={{ marginTop: 4 }}>
          <MapPin size={12} />
          {locationStr}
        </div>
      </div>

      <div className="device-divider" />

      {/* Last seen */}
      <div className="device-last-seen">
        <div className={`seen-dot ${online ? 'online' : 'offline'}`} />
        <Clock size={11} />
        Last seen: {timeAgo(device.last_seen_at)}
      </div>

      {/* Firmware */}
      {device.firmware_version && (
        <div style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>
          FW: {device.firmware_version}
        </div>
      )}

      {/* Action buttons */}
      <div className="device-actions">
        <button
          className="btn btn-outline btn-sm"
          onClick={() => onUpdateStatus(device)}
        >
          Update Status
        </button>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
const ALL_STATUSES = ['ALL', 'ACTIVE', 'REGISTERED', 'MAINTENANCE', 'DISABLED']

export default function DevicesPage() {
  const [search, setSearch]               = useState('')
  const [statusFilter, setStatusFilter]   = useState('ALL')
  const [showRegister, setShowRegister]   = useState(false)
  const [updatingDevice, setUpdatingDevice] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn:  () => fetchDevices().then(r => r.data.data),
  })

  const devices = data ?? []

  // ── Filter ──────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return devices.filter(d => {
      const matchSearch =
        !search ||
        d.device_id?.toLowerCase().includes(search.toLowerCase()) ||
        d.machine_name?.toLowerCase().includes(search.toLowerCase()) ||
        d.location?.city?.toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === 'ALL' || d.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [devices, search, statusFilter])

  const activeCount = devices.filter(d => d.status === 'ACTIVE').length
  const total       = devices.length

  return (
    <div className="devices-page">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="devices-header">
        <div>
          <div className="devices-title">Devices</div>
          <div className="devices-subtitle">
            {total} machines registered &middot; {activeCount} active
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowRegister(true)}>
          <Plus size={16} weight="bold" />
          Register Machine
        </button>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────── */}
      <div className="devices-filters">
        <div className="devices-search">
          <MagnifyingGlass size={15} className="devices-search-icon" />
          <input
            placeholder="Search by ID, name or city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="status-pills">
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              className={`status-pill ${statusFilter === s ? 'active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'ALL' ? `All (${total})` : s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Grid ─────────────────────────────────────────────────────── */}
      <div className="devices-grid">
        {isLoading ? (
          [1,2,3,4,5,6].map(i => <div key={i} className="device-skeleton" />)
        ) : filtered.length === 0 ? (
          <div className="devices-empty">
            <Desktop size={48} style={{ opacity: 0.2 }} />
            <p>
              {devices.length === 0
                ? 'No machines registered yet. Register your first machine.'
                : 'No machines match your search.'}
            </p>
            {devices.length === 0 && (
              <button className="btn btn-primary" onClick={() => setShowRegister(true)}>
                <Plus size={14} /> Register First Machine
              </button>
            )}
          </div>
        ) : (
          filtered.map(d => (
            <DeviceCard
              key={d._id}
              device={d}
              onUpdateStatus={(dev) => setUpdatingDevice(dev)}
            />
          ))
        )}
      </div>

      {/* ── Modals ───────────────────────────────────────────────────── */}
      {showRegister   && <RegisterModal    onClose={() => setShowRegister(false)} />}
      {updatingDevice && <UpdateStatusModal device={updatingDevice} onClose={() => setUpdatingDevice(null)} />}
    </div>
  )
}
