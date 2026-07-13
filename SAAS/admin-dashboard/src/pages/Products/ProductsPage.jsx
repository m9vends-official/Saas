import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  MagnifyingGlass, Plus, X, PencilSimple,
  Trash, Package, Warning
} from '@phosphor-icons/react'
import toast from 'react-hot-toast'
import { fetchProducts, createProduct, updateProduct, deleteProduct } from '../../api/products.api.js'
import './ProductsPage.css'

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtRs = (n) => `₹${new Intl.NumberFormat('en-IN').format(n ?? 0)}`

// ── Category emoji map ─────────────────────────────────────────────────────
const CATEGORY_EMOJI = {
  Beverages:  '🥤',
  Snacks:     '🍟',
  'Pani Puri':'🍲',
  Sweets:     '🍬',
  General:    '📦',
}

// ── Form schema — mirrors productValidator on backend ──────────────────────
const productSchema = z.object({
  product_name: z.string().min(1, 'Product name is required'),
  description:  z.string().optional(),
  price:        z.coerce.number().min(0.01, 'Price must be greater than 0'),
  category:     z.string().default('General'),
  sku:          z.string().optional(),
  tax_percent:  z.coerce.number().min(0).max(100).default(0),
  is_available: z.boolean().default(true),
  image_url:    z.string().url('Must be a valid URL').optional().or(z.literal('')),
})

// ── Toggle Switch ──────────────────────────────────────────────────────────
function Toggle({ checked, onChange }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <div className="toggle-track" />
      <div className="toggle-thumb" />
    </label>
  )
}

// ── Product Form Drawer ────────────────────────────────────────────────────
function ProductDrawer({ product, onClose }) {
  const qc       = useQueryClient()
  const isEdit   = !!product

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } =
    useForm({
      resolver: zodResolver(productSchema),
      defaultValues: isEdit ? {
        ...product,
        price:       product.price,
        tax_percent: product.tax_percent ?? 0,
        is_available: product.is_available ?? true,
        image_url:   product.image_url ?? '',
      } : {
        is_available: true,
        tax_percent:  0,
        category:     'General',
      },
    })

  const isAvailable = watch('is_available')

  const mutation = useMutation({
    mutationFn: (data) =>
      isEdit ? updateProduct(product._id, data) : createProduct(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success(isEdit ? 'Product updated!' : 'Product created!')
      onClose()
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Something went wrong')
    },
  })

  const CATEGORIES = ['General','Beverages','Snacks','Pani Puri','Sweets','Other']

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-header">
          <span className="drawer-title">{isEdit ? 'Edit Product' : 'Add New Product'}</span>
          <button className="drawer-close" onClick={onClose}><X size={18} /></button>
        </div>

        <form
          className="drawer-body"
          id="product-form"
          onSubmit={handleSubmit((d) => mutation.mutate(d))}
          noValidate
        >
          {/* Name */}
          <div className="input-group">
            <label className="input-label">Product Name *</label>
            <input
              className={`input ${errors.product_name ? 'error' : ''}`}
              placeholder="e.g. Masala Pani Puri"
              {...register('product_name')}
            />
            {errors.product_name && <span className="input-error">{errors.product_name.message}</span>}
          </div>

          {/* Description */}
          <div className="input-group">
            <label className="input-label">Description</label>
            <input className="input" placeholder="Short description (optional)" {...register('description')} />
          </div>

          {/* Price + Tax */}
          <div className="form-row">
            <div className="input-group">
              <label className="input-label">Price (₹) *</label>
              <input
                className={`input ${errors.price ? 'error' : ''}`}
                type="number" step="0.01" min="0"
                placeholder="25.00"
                {...register('price')}
              />
              {errors.price && <span className="input-error">{errors.price.message}</span>}
            </div>
            <div className="input-group">
              <label className="input-label">Tax %</label>
              <input
                className="input"
                type="number" step="0.5" min="0" max="100"
                placeholder="0"
                {...register('tax_percent')}
              />
            </div>
          </div>

          {/* Category + SKU */}
          <div className="form-row">
            <div className="input-group">
              <label className="input-label">Category</label>
              <select className="input" {...register('category')} style={{ cursor:'pointer' }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">SKU</label>
              <input
                className="input"
                placeholder="PNP-001"
                style={{ fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}
                {...register('sku')}
              />
            </div>
          </div>

          {/* Image URL */}
          <div className="input-group">
            <label className="input-label">Image URL (optional)</label>
            <input
              className={`input ${errors.image_url ? 'error' : ''}`}
              placeholder="https://..."
              {...register('image_url')}
            />
            {errors.image_url && <span className="input-error">{errors.image_url.message}</span>}
          </div>

          {/* Is Available toggle */}
          <div className="form-toggle-row">
            <span className="form-toggle-label">Available for sale</span>
            <Toggle
              checked={isAvailable}
              onChange={(v) => setValue('is_available', v)}
            />
          </div>
        </form>

        <div className="drawer-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button
            type="submit"
            form="product-form"
            className="btn btn-primary"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? <span className="spinner" /> : isEdit ? 'Save Changes' : 'Add Product'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Delete Confirm Modal ───────────────────────────────────────────────────
function DeleteModal({ product, onClose }) {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => deleteProduct(product._id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      toast.success('Product deleted')
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Delete failed'),
  })

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sm">
        <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
          <Warning size={22} color="var(--amber)" weight="fill" style={{ flexShrink:0, marginTop:2 }} />
          <div>
            <div className="modal-sm-title">Delete Product?</div>
            <div className="modal-sm-sub" style={{ marginTop:6 }}>
              <strong style={{ color:'var(--text-primary)' }}>{product.product_name}</strong> will be
              soft-deleted. Machine catalogs referencing it remain intact.
            </div>
          </div>
        </div>
        <div className="modal-sm-footer">
          <button className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? <span className="spinner" /> : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function ProductsPage() {
  const [search, setSearch]           = useState('')
  const [availFilter, setAvailFilter] = useState('ALL')
  const [drawerProduct, setDrawerProduct] = useState(undefined) // undefined=closed, null=new, obj=edit
  const [deleteTarget, setDeleteTarget]   = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn:  () => fetchProducts().then(r => r.data.data),
  })

  const products = data ?? []

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchSearch =
        !search ||
        p.product_name?.toLowerCase().includes(search.toLowerCase()) ||
        p.category?.toLowerCase().includes(search.toLowerCase()) ||
        p.sku?.toLowerCase().includes(search.toLowerCase())
      const matchAvail =
        availFilter === 'ALL' ||
        (availFilter === 'AVAILABLE' && p.is_available) ||
        (availFilter === 'UNAVAILABLE' && !p.is_available)
      return matchSearch && matchAvail
    })
  }, [products, search, availFilter])

  const availCount   = products.filter(p => p.is_available).length
  const unavailCount = products.filter(p => !p.is_available).length

  return (
    <div className="products-page">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="products-header">
        <div>
          <div className="products-title">Products</div>
          <div className="products-subtitle">
            {products.length} products · {availCount} available · {unavailCount} unavailable
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setDrawerProduct(null)}>
          <Plus size={16} weight="bold" /> Add Product
        </button>
      </div>

      {/* ── Filters ────────────────────────────────────────────────── */}
      <div className="products-filters">
        <div className="products-search">
          <MagnifyingGlass size={15} className="products-search-icon" />
          <input
            placeholder="Search name, category, SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="avail-filter">
          {[
            { key: 'ALL', label: `All (${products.length})` },
            { key: 'AVAILABLE',   label: `Available (${availCount})` },
            { key: 'UNAVAILABLE', label: `Unavailable (${unavailCount})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`avail-pill ${availFilter === key ? 'active' : ''}`}
              onClick={() => setAvailFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────── */}
      <div className="products-table-wrap">
        {isLoading ? (
          [1,2,3,4,5].map(i => <div key={i} className="prod-skeleton-row" />)
        ) : filtered.length === 0 ? (
          <div className="products-empty">
            <Package size={40} style={{ opacity: 0.2 }} />
            <p>
              {products.length === 0
                ? 'No products yet. Add your first product.'
                : 'No products match your search.'}
            </p>
            {products.length === 0 && (
              <button className="btn btn-primary" onClick={() => setDrawerProduct(null)}>
                <Plus size={14} /> Add First Product
              </button>
            )}
          </div>
        ) : (
          <table className="products-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Price</th>
                <th>Tax %</th>
                <th>SKU</th>
                <th>Available</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p._id}>
                  {/* Name + description */}
                  <td>
                    <div className="prod-name-cell">
                      <div className="prod-img">
                        {p.image_url
                          ? <img src={p.image_url} alt={p.product_name} />
                          : <span>{CATEGORY_EMOJI[p.category] ?? '📦'}</span>
                        }
                      </div>
                      <div className="prod-name-text">
                        <strong>{p.product_name}</strong>
                        {p.description && <span>{p.description}</span>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-muted">{p.category ?? 'General'}</span>
                  </td>
                  <td>
                    <span className="prod-price">{fmtRs(p.price)}</span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    {p.tax_percent > 0 ? `${p.tax_percent}%` : '—'}
                  </td>
                  <td>
                    <span className="prod-sku">{p.sku ?? '—'}</span>
                  </td>
                  <td>
                    <span className={`badge ${p.is_available ? 'badge-green' : 'badge-red'}`}>
                      {p.is_available ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td>
                    <div className="prod-actions">
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setDrawerProduct(p)}
                        title="Edit"
                      >
                        <PencilSimple size={13} />
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => setDeleteTarget(p)}
                        title="Delete"
                      >
                        <Trash size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Drawer & Modals ────────────────────────────────────────── */}
      {drawerProduct !== undefined && (
        <ProductDrawer
          product={drawerProduct}
          onClose={() => setDrawerProduct(undefined)}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          product={deleteTarget}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
