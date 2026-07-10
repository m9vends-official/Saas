import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeSlash, ArrowRight, Lock, ShieldCheck, GlobeHemisphereEast } from '@phosphor-icons/react'
import toast from 'react-hot-toast'
import api from '../../api/axios.js'
import { useAuthStore } from '../../store/authStore.js'
import './LoginPage.css'

// logo from public folder
const LOGO = '/logo.png'

const schema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth  = useAuthStore((s) => s.setAuth)
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError]   = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async (data) => {
    setServerError('')
    try {
      const res = await api.post('/api/admin/auth/login', data)
      // Backend returns { success, accessToken, user } — NOT nested under .data
      const { accessToken, user } = res.data
      setAuth(user, accessToken)
      toast.success(`Welcome back, ${user.name}!`)
      navigate('/dashboard')
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid email or password'
      setServerError(msg)
    }
  }


  return (
    <div className="login-page">
      {/* ── Left panel ────────────────────────────────────────────────────── */}
      <div className="login-left">
        {/* Logo */}
        <div className="login-logo">
          <img src={LOGO} alt="M9Vends logo" />
          <div className="login-logo-text">
            <span className="login-logo-name">M9Vends</span>
            <span className="login-logo-tagline">Smart Vend Platform</span>
          </div>
        </div>

        {/* Hero */}
        <div className="login-hero">
          <h1 className="login-headline">
            Manage every<br />
            <span className="cyan">vending machine</span><br />
            from one place.
          </h1>
          <p className="login-subtext">
            Real-time monitoring, revenue analytics, and fleet control
            — built for India's fastest-growing vend operators.
          </p>

          {/* Stats */}
          <div className="login-stats">
            <div>
              <div className="login-stat-value">10K+</div>
              <div className="login-stat-label">Machines</div>
            </div>
            <div>
              <div className="login-stat-value">₹2Cr+</div>
              <div className="login-stat-label">Daily revenue</div>
            </div>
            <div>
              <div className="login-stat-value">99.2%</div>
              <div className="login-stat-label">Uptime</div>
            </div>
          </div>

          {/* Pills */}
          <div className="login-pills">
            <span className="login-pill">Live fleet monitoring</span>
            <span className="login-pill">UPI &amp; cash tracking</span>
            <span className="login-pill">Temperature alerts</span>
            <span className="login-pill">Multi-city support</span>
          </div>
        </div>

        {/* Footer */}
        <div className="login-footer">
          © 2025 M9Vends Technologies Pvt. Ltd. · India
        </div>
      </div>

      {/* ── Right panel ───────────────────────────────────────────────────── */}
      <div className="login-right">
        <div className="login-card">
          <h2 className="login-card-title">Sign in</h2>
          <p className="login-card-subtitle">
            Enter your credentials to access your <span>dashboard</span>.
          </p>

          <form className="login-form" onSubmit={handleSubmit(onSubmit)} noValidate>
            {/* Server error */}
            {serverError && (
              <div className="login-error">{serverError}</div>
            )}

            {/* Email */}
            <div className="input-group">
              <label className="input-label">Email Address</label>
              <input
                className={`input ${errors.email ? 'error' : ''}`}
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                {...register('email')}
              />
              {errors.email && (
                <span className="input-error">{errors.email.message}</span>
              )}
            </div>

            {/* Password */}
            <div className="input-group">
              <label className="input-label">Password</label>
              <div className="input-wrapper">
                <input
                  className={`input ${errors.password ? 'error' : ''}`}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••"
                  autoComplete="current-password"
                  {...register('password')}
                />
                <button
                  type="button"
                  className="input-reveal"
                  onClick={() => setShowPassword((p) => !p)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && (
                <span className="input-error">{errors.password.message}</span>
              )}
            </div>

            {/* Forgot */}
            <div className="login-forgot">Forgot password?</div>

            {/* Submit */}
            <button className="login-btn" type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="spinner" />
              ) : (
                <>Sign In <ArrowRight size={16} weight="bold" /></>
              )}
            </button>
          </form>

          {/* Contact */}
          <p className="login-contact">
            Having trouble?{' '}
            <strong>Contact your administrator</strong>
          </p>

          {/* Trust */}
          <div className="login-trust">
            <div className="login-trust-item">
              <Lock size={12} />
              256-bit SSL
            </div>
            <div className="login-trust-item">
              <GlobeHemisphereEast size={12} />
              India-hosted
            </div>
            <div className="login-trust-item">
              <ShieldCheck size={12} />
              ISO 27001
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
