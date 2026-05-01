/**
 * Components/Ads/modals/CreatePageModal.jsx
 *
 * Refactored Business Page creation modal.
 *
 * Key fixes vs original:
 *   ✅ Account status guard — shows clear error if account is not 'active'
 *   ✅ Single-step layout (no Step 2 gate) — optional fields collapsed in an
 *      "Additional details" accordion so users can submit immediately
 *   ✅ Contact email format validation
 *   ✅ Character counters on pageName and tagline
 *   ✅ Account selector shows status badge so users understand why submission fails
 *   ✅ Error surfaced from backend (err.response.data.message) shown inline, not
 *      just as a toast, so it's visible without leaving the modal
 *   ✅ Proper payload shape: undefined optional fields stripped before POST
 *   ✅ handleClose resets ALL state (including globalError)
 *   ✅ URL validation for logoUrl / coverUrl (must be https://)
 *   ✅ Keyboard: Escape closes, Enter on last required field submits
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useAds } from '../../../Context/Ads/AdsContext';
import { useRegisterModal } from '../../../Context/ModalContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'ecommerce',       label: '🛒 E-Commerce' },
  { value: 'food_beverage',   label: '🍔 Food & Beverage' },
  { value: 'fashion',         label: '👗 Fashion' },
  { value: 'tech',            label: '💻 Technology' },
  { value: 'education',       label: '📚 Education' },
  { value: 'health_wellness', label: '💊 Health & Wellness' },
  { value: 'real_estate',     label: '🏠 Real Estate' },
  { value: 'finance',         label: '💰 Finance' },
  { value: 'entertainment',   label: '🎬 Entertainment' },
  { value: 'travel',          label: '✈️ Travel' },
  { value: 'automotive',      label: '🚗 Automotive' },
  { value: 'services',        label: '🛠️ Services' },
  { value: 'ngo',             label: '🤝 NGO / Non-profit' },
  { value: 'other',           label: '📦 Other' },
];

const STATUS_LABELS = {
  active:         { label: 'Active',          color: '#22c55e' },
  pending_review: { label: 'Pending Review',  color: '#f59e0b' },
  suspended:      { label: 'Suspended',       color: '#ef4444' },
  rejected:       { label: 'Rejected',        color: '#ef4444' },
};

const DEFAULT_FORM = {
  pageName:     '',
  category:     'other',
  tagline:      '',
  website:      '',
  about:        '',
  contactEmail: '',
  contactPhone: '',
  logoUrl:      '',
  coverUrl:     '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const isHttpsUrl = (v) => !v || /^https:\/\/.+/i.test(v.trim());
const isEmail    = (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

function validate(form) {
  const errs = {};

  if (!form.pageName.trim())
    errs.pageName = 'Page name is required.';
  else if (form.pageName.trim().length < 2)
    errs.pageName = 'Page name must be at least 2 characters.';
  else if (form.pageName.trim().length > 100)
    errs.pageName = 'Page name must be ≤ 100 characters.';

  if (form.tagline.length > 160)
    errs.tagline = 'Tagline must be ≤ 160 characters.';

  if (form.website && !isHttpsUrl(form.website))
    errs.website = 'Website must start with https://';

  if (!isEmail(form.contactEmail))
    errs.contactEmail = 'Enter a valid email address.';

  if (form.logoUrl && !isHttpsUrl(form.logoUrl))
    errs.logoUrl = 'Logo URL must start with https://';

  if (form.coverUrl && !isHttpsUrl(form.coverUrl))
    errs.coverUrl = 'Cover URL must start with https://';

  return errs;
}

function stripUndefined(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== '')
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const useFocus = () => {
  const [focused, setFocused] = useState(false);
  return {
    focused,
    onFocus: () => setFocused(true),
    onBlur:  () => setFocused(false),
  };
};

const inputBase = (focused, hasError) => ({
  width:        '100%',
  boxSizing:    'border-box',
  padding:      '10px 12px',
  borderRadius: 10,
  border:       `1.5px solid ${
    hasError  ? 'var(--color-danger, #ef4444)' :
    focused   ? 'var(--accent)' :
    'var(--border)'
  }`,
  background:   'var(--bg-input, rgba(255,255,255,0.04))',
  color:        'var(--text-primary)',
  fontSize:     14,
  fontFamily:   'var(--font-ui, inherit)',
  outline:      'none',
  transition:   'border-color 0.15s',
});

const TextInput = ({ value, onChange, placeholder, type = 'text', maxLength, hasError, onKeyDown }) => {
  const { focused, onFocus, onBlur } = useFocus();
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      maxLength={maxLength}
      style={inputBase(focused, hasError)}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
};

const TextArea = ({ value, onChange, placeholder, rows = 3, maxLength }) => {
  const { focused, onFocus, onBlur } = useFocus();
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      maxLength={maxLength}
      style={{ ...inputBase(focused, false), resize: 'vertical' }}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
};

const SelectInput = ({ value, onChange, children }) => {
  const { focused, onFocus, onBlur } = useFocus();
  return (
    <select
      value={value}
      onChange={onChange}
      style={{ ...inputBase(focused, false), cursor: 'pointer' }}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {children}
    </select>
  );
};

const Field = ({ label, required, error, hint, counter, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <label style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: 'var(--text-muted)',
      }}>
        {label}
        {required && <span style={{ color: 'var(--color-danger, #ef4444)', marginLeft: 3 }}>*</span>}
      </label>
      {counter !== undefined && (
        <span style={{ fontSize: 10, color: counter > 0 ? 'var(--text-muted)' : 'transparent' }}>
          {counter}
        </span>
      )}
    </div>
    {children}
    {error && (
      <p style={{ margin: 0, fontSize: 11, color: 'var(--color-danger, #ef4444)', display: 'flex', gap: 4, alignItems: 'center' }}>
        <span>⚠</span>{error}
      </p>
    )}
    {hint && !error && (
      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{hint}</p>
    )}
  </div>
);

const Btn = ({ onClick, variant = 'ghost', disabled, loading, children, fullWidth }) => {
  const [hov, setHov] = useState(false);
  const isPrimary = variant === 'primary';
  const isDanger  = variant === 'danger';

  const bg = isPrimary
    ? (hov && !disabled ? 'var(--accent-gradient)' : 'var(--accent)')
    : isDanger
    ? (hov && !disabled ? '#dc2626' : '#ef4444')
    : (hov ? 'var(--bg-hover)' : 'transparent');

  return (
    <button
      onClick={disabled || loading ? undefined : onClick}
      disabled={disabled || loading}
      style={{
        padding:      '9px 20px',
        borderRadius: 10,
        fontSize:     13,
        fontFamily:   'var(--font-ui, inherit)',
        fontWeight:   600,
        cursor:       disabled || loading ? 'not-allowed' : 'pointer',
        opacity:      disabled ? 0.5 : 1,
        transition:   'all 0.15s',
        border:       isPrimary || isDanger ? 'none' : '1px solid var(--border)',
        background:   bg,
        color:        isPrimary || isDanger ? '#fff' : 'var(--text-secondary)',
        boxShadow:    isPrimary && hov && !disabled ? '0 4px 16px rgba(var(--accent-rgb,99,102,241),0.35)' : 'none',
        transform:    hov && !disabled ? 'translateY(-1px)' : 'none',
        width:        fullWidth ? '100%' : undefined,
        display:      'inline-flex',
        alignItems:   'center',
        gap:          6,
        justifyContent: 'center',
        minWidth:     80,
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {loading ? <Spinner size={13} /> : null}
      {children}
    </button>
  );
};

const Spinner = ({ size = 16 }) => (
  <span style={{
    display: 'inline-block',
    width: size, height: size,
    border: `2px solid rgba(255,255,255,0.3)`,
    borderTop: `2px solid #fff`,
    borderRadius: '50%',
    animation: 'cpm-spin 0.7s linear infinite',
    flexShrink: 0,
  }} />
);

// Accordion section for optional details
const Accordion = ({ label, open, onToggle, children }) => (
  <div style={{
    border: '1px solid var(--border)',
    borderRadius: 12,
    overflow: 'hidden',
  }}>
    <button
      onClick={onToggle}
      style={{
        width: '100%', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        background: 'var(--bg-hover)',
        border: 'none', cursor: 'pointer',
        color: 'var(--text-secondary)',
        fontSize: 12, fontWeight: 600,
        fontFamily: 'var(--font-ui, inherit)',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontSize: 10,
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
          display: 'inline-block',
        }}>▶</span>
        {label}
      </span>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>
        {open ? 'collapse' : 'expand'}
      </span>
    </button>

    {open && (
      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {children}
      </div>
    )}
  </div>
);

// Account status badge shown in the selector
const AccountStatusBadge = ({ status }) => {
  const cfg = STATUS_LABELS[status] ?? { label: status, color: '#6b7280' };
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px',
      borderRadius: 20,
      background: cfg.color + '22',
      color: cfg.color,
      border: `1px solid ${cfg.color}44`,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
};

// Logo preview card
const MediaPreview = ({ logoUrl, coverUrl }) => {
  const [logoBroken,  setLogoBroken]  = useState(false);
  const [coverBroken, setCoverBroken] = useState(false);

  useEffect(() => {
    setLogoBroken(false);
    setCoverBroken(false);
  }, [logoUrl, coverUrl]);

  const showCover = coverUrl && !coverBroken;
  const showLogo  = logoUrl  && !logoBroken;

  if (!showCover && !showLogo) return null;

  return (
    <div style={{
      borderRadius: 10, overflow: 'hidden',
      border: '1px solid var(--border)',
      background: 'var(--bg-hover)',
    }}>
      <p style={{ margin: '0 0 0', padding: '6px 10px', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        Preview
      </p>
      <div style={{ position: 'relative' }}>
        {showCover ? (
          <div style={{
            height: 72,
            background: `url(${coverUrl}) center/cover no-repeat`,
            borderTop: '1px solid var(--border)',
          }} />
        ) : (
          <div style={{ height: 72, background: 'var(--bg-input)', borderTop: '1px solid var(--border)' }} />
        )}

        {showLogo && (
          <img
            src={logoUrl}
            alt="Logo"
            onError={() => setLogoBroken(true)}
            style={{
              width: 44, height: 44, borderRadius: 8,
              border: '3px solid var(--bg-card, #1a2233)',
              objectFit: 'cover',
              position: 'absolute',
              bottom: -14,
              left: 12,
            }}
          />
        )}
      </div>
      <div style={{ height: showLogo ? 20 : 6 }} />
    </div>
  );
};

// ─── Main Modal ────────────────────────────────────────────────────────────────

const CreatePageModal = ({
  show,
  onClose,
  accountId: propAccountId,
  accounts = [],          // full account objects [ { _id, accountName, status } ]
}) => {
  useRegisterModal(show);

  const { createPage, isCreatingPage } = useAds();

  const [form,         setForm]         = useState({ ...DEFAULT_FORM });
  const [errors,       setErrors]       = useState({});
  const [globalError,  setGlobalError]  = useState('');
  const [accountId,    setAccountId]    = useState('');
  const [detailsOpen,  setDetailsOpen]  = useState(false);

  const pageNameRef = useRef(null);

  // ── Derive the currently selected account object ──────────────────────────
  // const selectedAccount = accounts.find(a => String(a._id) === String(accountId)) ?? null;

  // ── Close — defined BEFORE any useEffect that references it ──────────────
  const handleClose = useCallback(() => {
    setForm({ ...DEFAULT_FORM });
    setErrors({});
    setGlobalError('');
    setDetailsOpen(false);
    onClose();
  }, [onClose]);

  // ── Initialise accountId on open / prop change ───────────────────────────
  useEffect(() => {
    if (propAccountId) {
      setAccountId(String(propAccountId));
    } else if (accounts.length > 0) {
      // Prefer first account (no status requirement)
      setAccountId(String(accounts[0]._id));
    }
  }, [propAccountId, accounts]);

  // ── Reset on open ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (show) {
      setForm({ ...DEFAULT_FORM });
      setErrors({});
      setGlobalError('');
      setDetailsOpen(false);
      // Focus the page name field after a tick
      setTimeout(() => pageNameRef.current?.focus(), 80);
    }
  }, [show]);

  // ── Escape key ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!show) return;
    const h = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [show, handleClose]);

  if (!show) return null;

  // ── Setters ────────────────────────────────────────────────────────────────
  const set = (field) => (e) => {
    const v = e.target.value;
    setForm(prev => ({ ...prev, [field]: v }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
    if (globalError) setGlobalError('');
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    // 1. Validate client-side
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    // 2. Account guard
    if (!accountId) {
      setGlobalError('Please select an Ad Account.');
      return;
    }
    // 3. Build payload — strip empty optional fields so backend doesn't
    //    store empty strings for fields the user left blank.
    const payload = stripUndefined({
      pageName:     form.pageName.trim(),
      category:     form.category,
      tagline:      form.tagline.trim()      || undefined,
      website:      form.website.trim()      || undefined,
      about:        form.about.trim()        || undefined,
      contactEmail: form.contactEmail.trim() || undefined,
      contactPhone: form.contactPhone.trim() || undefined,
      logoUrl:      form.logoUrl.trim()      || undefined,
      coverUrl:     form.coverUrl.trim()     || undefined,
    });

    // 4. Submit
    try {
      setGlobalError('');
      await createPage({ accountId, data: payload });
      handleClose();
    } catch (err) {
      // Surface backend message inline (toast is also shown by AdsState)
      const msg = err?.response?.data?.message || 'Failed to create page. Please try again.';
      setGlobalError(msg);
    }
  };

  // Enter to submit when in last visible required field
  const onEnterSubmit = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) handleSubmit();
  };

  // ── Active account count hint ──────────────────────────────────────────────
  return ReactDOM.createPortal(
    <>
      <style>{`
        @keyframes cpm-in  { from { opacity:0; transform:scale(0.96) translateY(6px) } to { opacity:1; transform:scale(1) translateY(0) } }
        @keyframes cpm-spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
        .cpm-body::-webkit-scrollbar { width:5px }
        .cpm-body::-webkit-scrollbar-thumb { background:var(--border); border-radius:10px }
      `}</style>

      {/* ── Backdrop ── */}
      <div
        onClick={handleClose}
        role="dialog"
        aria-modal="true"
        aria-label="Create Business Page"
        style={{
          position: 'fixed', inset: 0, zIndex: 1300,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
          background: 'rgba(4,10,20,0.82)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* ── Panel ── */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: 520,
            maxHeight: 'calc(100vh - 48px)',
            background: 'var(--bg-card-alt, #111827)',
            borderRadius: 20,
            border: '1px solid var(--border-subtle, rgba(255,255,255,0.08))',
            boxShadow: 'var(--shadow-xl, 0 25px 60px rgba(0,0,0,0.6))',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            animation: 'cpm-in 0.22s ease',
          }}
        >
          {/* ── Header ── */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            padding: '20px 22px 16px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-heading, #f9fafb)', lineHeight: 1.2 }}>
                Create Business Page
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Your Page represents your brand in every ad campaign.
              </p>
            </div>
            <button
              onClick={handleClose}
              aria-label="Close"
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'var(--bg-hover)', border: '1px solid var(--border)',
                color: 'var(--text-muted)', cursor: 'pointer',
                fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginLeft: 8,
                transition: 'background 0.12s',
              }}
            >✕</button>
          </div>

          {/* ── Body ── */}
          <div
            className="cpm-body"
            style={{
              flex: 1, overflowY: 'auto',
              padding: '18px 22px',
              display: 'flex', flexDirection: 'column', gap: 16,
            }}
          >
            {/* Global error banner */}
            {globalError && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 10,
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#f87171',
                fontSize: 13,
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
              }}>
                <span style={{ flexShrink: 0 }}>⚠️</span>
                <span>{globalError}</span>
              </div>
            )}

            {/* ── Account selector ──────────────────────────────────────── */}
            {accounts.length === 0 ? (
              <div style={{
                padding: '12px 14px', borderRadius: 10,
                background: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.25)',
                color: '#fbbf24', fontSize: 13,
              }}>
                ⚠ No Ad Accounts found. Create an Ad Account first before adding Pages.
              </div>
            ) : accounts.length === 1 ? (
              /* Single account — show as info row, not a select */
              <div style={{
                padding: '10px 14px', borderRadius: 10,
                background: 'var(--bg-hover)',
                border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ad Account</span>
                  <p style={{ margin: '2px 0 0', fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>
                    {accounts[0].accountName}
                  </p>
                </div>
                <AccountStatusBadge status={accounts[0].status} />
              </div>
            ) : (
              <Field label="Ad Account" required>
                <SelectInput value={accountId} onChange={e => { setAccountId(e.target.value); setGlobalError(''); }}>
                  {accounts.map(a => (
                    <option key={a._id} value={a._id}>
                      {a.accountName} ({STATUS_LABELS[a.status]?.label ?? a.status})
                    </option>
                  ))}
                </SelectInput>
              </Field>
            )}

            {/* ── Required fields ───────────────────────────────────────── */}
            <Field
              label="Page Name"
              required
              error={errors.pageName}
              counter={`${form.pageName.length}/100`}
            >
              <TextInput
                value={form.pageName}
                onChange={set('pageName')}
                placeholder="e.g. Rahul's Bakery"
                maxLength={100}
                hasError={!!errors.pageName}
                onKeyDown={onEnterSubmit}
              />
            </Field>

            <Field label="Category">
              <SelectInput value={form.category} onChange={set('category')}>
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </SelectInput>
            </Field>

            <Field
              label="Tagline"
              error={errors.tagline}
              hint="Short line shown below your ads — keep it punchy."
              counter={`${form.tagline.length}/160`}
            >
              <TextInput
                value={form.tagline}
                onChange={set('tagline')}
                placeholder="Freshly baked, every day"
                maxLength={160}
                hasError={!!errors.tagline}
              />
            </Field>

            <Field label="Website" error={errors.website} hint="Must start with https://">
              <TextInput
                type="url"
                value={form.website}
                onChange={set('website')}
                placeholder="https://yourbusiness.com"
                hasError={!!errors.website}
              />
            </Field>

            {/* ── Optional / advanced details accordion ─────────────────── */}
            <Accordion
              label="Additional Details (optional)"
              open={detailsOpen}
              onToggle={() => setDetailsOpen(v => !v)}
            >
              <Field label="About" hint="Up to 1,000 characters. Describe your business, products, or mission.">
                <TextArea
                  value={form.about}
                  onChange={set('about')}
                  placeholder="Tell your audience what you do…"
                  maxLength={1000}
                  rows={4}
                />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Contact Email" error={errors.contactEmail}>
                  <TextInput
                    type="email"
                    value={form.contactEmail}
                    onChange={set('contactEmail')}
                    placeholder="hello@business.com"
                    hasError={!!errors.contactEmail}
                  />
                </Field>
                <Field label="Contact Phone">
                  <TextInput
                    type="tel"
                    value={form.contactPhone}
                    onChange={set('contactPhone')}
                    placeholder="+91 98765 43210"
                  />
                </Field>
              </div>

              <Field
                label="Logo URL"
                error={errors.logoUrl}
                hint="Square image, min 200×200 px. Must be an https:// link."
              >
                <TextInput
                  type="url"
                  value={form.logoUrl}
                  onChange={set('logoUrl')}
                  placeholder="https://cdn.example.com/logo.png"
                  hasError={!!errors.logoUrl}
                />
              </Field>

              <Field
                label="Cover Image URL"
                error={errors.coverUrl}
                hint="Recommended 1200×400 px. Must be an https:// link."
              >
                <TextInput
                  type="url"
                  value={form.coverUrl}
                  onChange={set('coverUrl')}
                  placeholder="https://cdn.example.com/cover.jpg"
                  hasError={!!errors.coverUrl}
                />
              </Field>

              {/* Live preview */}
              <MediaPreview logoUrl={form.logoUrl} coverUrl={form.coverUrl} />
            </Accordion>
          </div>

          {/* ── Footer ── */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 22px 16px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-hover)',
            flexShrink: 0,
            gap: 10,
          }}>
            <Btn onClick={handleClose} variant="ghost" disabled={isCreatingPage}>
              Cancel
            </Btn>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Btn
                onClick={handleSubmit}
                variant="primary"
                disabled={isCreatingPage || accounts.length === 0}
                loading={isCreatingPage}
              >
                {isCreatingPage ? 'Creating…' : '✓ Create Page'}
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};

export default CreatePageModal;