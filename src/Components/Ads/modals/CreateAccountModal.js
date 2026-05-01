/**
 * modals/CreateAccountModal.js
 *
 * Two-step ad account creation modal.
 *   Step 1 — Account basics (name, email, industry)
 *   Step 2 — Billing information (optional, for GST invoicing)
 *
 * Changes from original:
 *  ✅ All Tailwind-only classes removed (backdrop-blur-sm, bg-black/50,
 *     space-y-4, max-h-[60vh], animate-spin, w-8, h-8, max-w-lg, etc.)
 *     and replaced with inline styles referencing CSS custom properties.
 *  ✅ useRegisterModal(show) wired in — scroll lock coordinated through
 *     ModalContext instead of being absent entirely.
 *  ✅ Escape key handled via the existing useEffect pattern.
 *  ✅ ReactDOM.createPortal used so the overlay escapes any stacking context.
 *  ✅ globals.css utility classes kept where they already exist
 *     (text-muted, text-xs, border, rounded, bg-hover, bg-gradient,
 *      hover-lift, grid, grid-cols-2, grid-cols-3, gap-3, flex,
 *      items-center, justify-between, flex-col, gap-1, w-full,
 *      overflow-y-auto, spinner, text-danger, transition-base).
 */

import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useAds } from '../../../Context/Ads/AdsContext';
import { useRegisterModal } from '../../../Context/ModalContext';

// ── Shared input style (inline — bg-input class exists but focus ring
//    needs the CSS var directly since focus: pseudo-classes aren't in globals) ──
const inputStyle = {
  width:           '100%',
  padding:         '10px 12px',
  borderRadius:    'var(--radius-sm)',
  borderWidth:     '1px',
  borderStyle:     'solid',
  borderColor:     'var(--border)',
  background:      'var(--bg-input)',
  color:           'var(--text-primary)',
  fontSize:        'var(--text-sm)',
  fontFamily:      'var(--font-ui)',
  outline:         'none',
  transition:      'border-color var(--transition-base)',
};

const inputFocusStyle = { borderColor: 'var(--accent)' };

// ── Reusable focusable input ──────────────────────────────────────────────────

const Input = ({ type = 'text', value, onChange, placeholder, style }) => {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        ...inputStyle,
        ...(focused ? inputFocusStyle : {}),
        ...style,
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
};

const Select = ({ value, onChange, children }) => {
  const [focused, setFocused] = useState(false);
  return (
    <select
      value={value}
      onChange={onChange}
      style={{
        ...inputStyle,
        ...(focused ? inputFocusStyle : {}),
        cursor: 'pointer',
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {children}
    </select>
  );
};

// ── Field wrapper ─────────────────────────────────────────────────────────────

const Field = ({ label, required, error, hint, children }) => (
  <div className="flex flex-col gap-1">
    <label
      style={{
        fontSize:      'var(--text-xs)',
        fontWeight:    'var(--weight-semibold)',
        letterSpacing: 'var(--tracking-wide)',
        textTransform: 'uppercase',
        color:         'var(--text-muted)',
      }}
    >
      {label}
      {required && (
        <span style={{ color: 'var(--color-danger)', marginLeft: 3 }}>*</span>
      )}
    </label>

    {children}

    {error && (
      <p className="text-xs text-danger" style={{ margin: 0 }}>{error}</p>
    )}
    {hint && !error && (
      <p className="text-xs text-muted" style={{ margin: 0 }}>{hint}</p>
    )}
  </div>
);

// ── Industries list ───────────────────────────────────────────────────────────

const INDUSTRIES = [
  { value: 'ecommerce',       label: 'E-Commerce' },
  { value: 'food_beverage',   label: 'Food & Beverage' },
  { value: 'fashion',         label: 'Fashion' },
  { value: 'tech',            label: 'Technology' },
  { value: 'education',       label: 'Education' },
  { value: 'health_wellness', label: 'Health & Wellness' },
  { value: 'real_estate',     label: 'Real Estate' },
  { value: 'finance',         label: 'Finance' },
  { value: 'entertainment',   label: 'Entertainment' },
  { value: 'travel',          label: 'Travel' },
  { value: 'services',        label: 'Services' },
  { value: 'ngo',             label: 'NGO / Non-profit' },
  { value: 'other',           label: 'Other' },
];

// ── Default form state ────────────────────────────────────────────────────────

const DEFAULT_FORM = {
  accountName: '', email: '', industry: 'other',
  businessName: '', gstin: '', address: '',
  city: '', state: '', pincode: '', panNumber: '',
};

// ── Main modal ────────────────────────────────────────────────────────────────

const CreateAccountModal = ({ show, onClose }) => {
  // Wire into ModalContext for centralised scroll lock
  useRegisterModal(show);

  const { createAccount, isCreatingAccount } = useAds();

  const [step,   setStep]   = useState(1);
  const [form,   setForm]   = useState(DEFAULT_FORM);
  const [errors, setErrors] = useState({});

  // Escape key handler
  useEffect(() => {
    if (!show) return;
    const handler = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [show]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!show) return null;

  // ── Helpers ──────────────────────────────────────────────────────────────

  const set = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validateStep1 = () => {
    const errs = {};
    if (!form.accountName.trim()) errs.accountName = 'Account name is required.';
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email))
      errs.email = 'Enter a valid email address.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = () => { if (validateStep1()) setStep(2); };
  const handleBack = () => setStep(1);

  const handleClose = () => {
    setStep(1);
    setErrors({});
    onClose();
  };

  const handleSubmit = async () => {
    if (!validateStep1()) { setStep(1); return; }

    const billing = {
      businessName: form.businessName || undefined,
      gstin:        form.gstin        || undefined,
      address:      form.address      || undefined,
      city:         form.city         || undefined,
      state:        form.state        || undefined,
      pincode:      form.pincode      || undefined,
      panNumber:    form.panNumber    || undefined,
    };

    try {
      await createAccount({
        accountName: form.accountName.trim(),
        email:       form.email.trim() || undefined,
        industry:    form.industry,
        billing,
      });
      setForm(DEFAULT_FORM);
      setStep(1);
      onClose();
    } catch {
      // toast handled in AdsState
    }
  };

  // ── Render via portal ─────────────────────────────────────────────────────

  return ReactDOM.createPortal(
    <>
      {/* Keyframe for button spinner */}
      <style>{`@keyframes cam-spin { to { transform: rotate(360deg) } }`}</style>

      {/* Overlay */}
      <div
        onClick={handleClose}
        style={{
          position:        'fixed',
          inset:           0,
          zIndex:          'var(--z-modal)',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          padding:         16,
          background:      'rgba(6, 14, 26, 0.75)',
          backdropFilter:  'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      >
        {/* Panel */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position:     'relative',
            width:        '100%',
            maxWidth:     520,
            background:   'var(--bg-card-alt)',
            borderRadius: 'var(--radius-xl)',
            border:       '1px solid var(--border-subtle)',
            boxShadow:    'var(--shadow-xl)',
            overflow:     'hidden',
            display:      'flex',
            flexDirection:'column',
            maxHeight:    'calc(100vh - 48px)',
          }}
        >
          {/* ── Progress bar ── */}
          <div style={{ height: 3, background: 'var(--border)', flexShrink: 0 }}>
            <div
              style={{
                height:     '100%',
                width:      step === 1 ? '50%' : '100%',
                background: 'var(--accent-gradient)',
                transition: 'width 0.35s ease',
              }}
            />
          </div>

          {/* ── Header ── */}
          <div
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              padding:        '20px 24px 16px',
              borderBottom:   '1px solid var(--border)',
              flexShrink:     0,
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>Create Ad Account</h3>
              <p
                className="text-xs text-muted"
                style={{ marginTop: 4, marginBottom: 0 }}
              >
                Step {step} of 2 —{' '}
                {step === 1 ? 'Account Details' : 'Billing Information'}
              </p>
            </div>

            {/* Step indicators */}
            <div
              style={{
                display:    'flex',
                alignItems: 'center',
                gap:        8,
                marginRight: 12,
              }}
            >
              {[1, 2].map((s) => (
                <div
                  key={s}
                  style={{
                    width:        24,
                    height:       24,
                    borderRadius: '50%',
                    display:      'flex',
                    alignItems:   'center',
                    justifyContent: 'center',
                    fontSize:     'var(--text-xs)',
                    fontWeight:   'var(--weight-bold)',
                    background:   step >= s ? 'var(--accent)' : 'var(--bg-hover)',
                    color:        step >= s ? '#fff' : 'var(--text-muted)',
                    border:       step === s ? '2px solid var(--accent-alt)' : '2px solid transparent',
                    transition:   'all var(--transition-base)',
                    flexShrink:   0,
                  }}
                >
                  {step > s ? '✓' : s}
                </div>
              ))}
            </div>

            {/* Close button */}
            <button
              onClick={handleClose}
              aria-label="Close"
              style={{
                width:          32,
                height:         32,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                borderRadius:   '50%',
                border:         'none',
                background:     'transparent',
                color:          'var(--text-muted)',
                cursor:         'pointer',
                fontSize:       16,
                transition:     'var(--transition-base)',
                flexShrink:     0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-hover)';
                e.currentTarget.style.color = 'var(--text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              ✕
            </button>
          </div>

          {/* ── Body (scrollable) ── */}
          <div
            style={{
              padding:    '20px 24px',
              overflowY:  'auto',
              flex:       1,
              display:    'flex',
              flexDirection: 'column',
              gap:        16,
            }}
          >
            {/* ── STEP 1: Account basics ─────────────────────────────── */}
            {step === 1 && (
              <>
                <Field
                  label="Account Name"
                  required
                  error={errors.accountName}
                >
                  <Input
                    value={form.accountName}
                    onChange={set('accountName')}
                    placeholder="e.g. Rahul's Bakery Ads"
                  />
                </Field>

                <Field
                  label="Business Email"
                  error={errors.email}
                  hint="Leave blank to use your profile email."
                >
                  <Input
                    type="email"
                    value={form.email}
                    onChange={set('email')}
                    placeholder="business@example.com (optional)"
                  />
                </Field>

                <Field label="Industry">
                  <Select value={form.industry} onChange={set('industry')}>
                    {INDUSTRIES.map((ind) => (
                      <option key={ind.value} value={ind.value}>
                        {ind.label}
                      </option>
                    ))}
                  </Select>
                </Field>

                {/* Info banner */}
                <div
                  style={{
                    display:      'flex',
                    gap:          10,
                    padding:      '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    background:   'var(--bg-hover)',
                    border:       '1px solid var(--border)',
                    fontSize:     'var(--text-xs)',
                    color:        'var(--text-muted)',
                    lineHeight:   'var(--leading-relaxed)',
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>ℹ️</span>
                  <span>
                    Your account will be reviewed by our team before you can run
                    ads. This typically takes 1–2 business days.
                  </span>
                </div>
              </>
            )}

            {/* ── STEP 2: Billing info ───────────────────────────────── */}
            {step === 2 && (
              <>
                <p
                  className="text-xs text-muted"
                  style={{ margin: 0 }}
                >
                  Billing details are optional but recommended for GST-compliant
                  invoicing.
                </p>

                <Field label="Business Name">
                  <Input
                    value={form.businessName}
                    onChange={set('businessName')}
                    placeholder="Legal business name"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="GSTIN">
                    <Input
                      value={form.gstin}
                      onChange={set('gstin')}
                      placeholder="22AAAAA0000A1Z5"
                    />
                  </Field>
                  <Field label="PAN Number">
                    <Input
                      value={form.panNumber}
                      onChange={set('panNumber')}
                      placeholder="ABCDE1234F"
                    />
                  </Field>
                </div>

                <Field label="Address">
                  <Input
                    value={form.address}
                    onChange={set('address')}
                    placeholder="Street address"
                  />
                </Field>

                <div className="grid grid-cols-3 gap-3">
                  <Field label="City">
                    <Input
                      value={form.city}
                      onChange={set('city')}
                      placeholder="Mumbai"
                    />
                  </Field>
                  <Field label="State">
                    <Input
                      value={form.state}
                      onChange={set('state')}
                      placeholder="Maharashtra"
                    />
                  </Field>
                  <Field label="Pincode">
                    <Input
                      value={form.pincode}
                      onChange={set('pincode')}
                      placeholder="400001"
                    />
                  </Field>
                </div>
              </>
            )}
          </div>

          {/* ── Footer ── */}
          <div
            style={{
              display:        'flex',
              justifyContent: 'space-between',
              alignItems:     'center',
              padding:        '14px 24px',
              borderTop:      '1px solid var(--border)',
              background:     'var(--bg-hover)',
              flexShrink:     0,
            }}
          >
            {/* Left — Cancel or Back */}
            {step === 1 ? (
              <FooterBtn onClick={handleClose} variant="ghost">
                Cancel
              </FooterBtn>
            ) : (
              <FooterBtn onClick={handleBack} variant="ghost" disabled={isCreatingAccount}>
                ← Back
              </FooterBtn>
            )}

            {/* Right — Next or Submit */}
            {step === 1 ? (
              <FooterBtn onClick={handleNext} variant="primary">
                Next → Billing
              </FooterBtn>
            ) : (
              <FooterBtn
                onClick={handleSubmit}
                variant="primary"
                disabled={isCreatingAccount}
              >
                {isCreatingAccount ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Uses .spinner from globals.css § 16 */}
                    <span className="spinner spinner-sm" />
                    Creating…
                  </span>
                ) : (
                  'Create Account'
                )}
              </FooterBtn>
            )}
          </div>

        </div>
      </div>
    </>,
    document.body
  );
};

// ── FooterBtn — inline-styled to avoid undefined Tailwind classes ─────────────

const FooterBtn = ({ onClick, variant = 'ghost', disabled, children }) => {
  const [hovered, setHovered] = useState(false);

  const isPrimary = variant === 'primary';

  const base = {
    display:        'inline-flex',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            6,
    padding:        '9px 18px',
    borderRadius:   'var(--radius-sm)',
    fontSize:       'var(--text-sm)',
    fontFamily:     'var(--font-ui)',
    fontWeight:     'var(--weight-medium)',
    cursor:         disabled ? 'not-allowed' : 'pointer',
    opacity:        disabled ? 0.55 : 1,
    transition:     'all var(--transition-base)',
    border:         'none',
    outline:        'none',
  };

  const styles = isPrimary
    ? {
        ...base,
        background:  'var(--accent-gradient)',
        color:       '#fff',
        boxShadow:   hovered && !disabled ? 'var(--shadow-md)' : 'var(--shadow-sm)',
        transform:   hovered && !disabled ? 'translateY(-1px)' : 'none',
      }
    : {
        ...base,
        background:  hovered && !disabled ? 'var(--bg-card-alt)' : 'transparent',
        color:       'var(--text-secondary)',
        border:      '1px solid var(--border)',
      };

  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={styles}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
  );
};

export default CreateAccountModal;