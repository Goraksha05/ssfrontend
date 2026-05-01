// src/components/Subscription/InvoicePopup.js
//
// UPGRADE: Credit-aware invoice.
//
// When a subscription was activated via Special Offer credit
// (activationMethod === 'special_offer_credit' OR paymentId is absent
// and credit info is available), the invoice now shows:
//
//   Line 1 — Base subscription fee          ₹ planAmount (excl. GST)
//   Line 2 — GST (18%)                      ₹ gstAmount
//   Line 3 — Special Offer Credit applied   −₹ creditApplied   ← new
//   ─────────────────────────────────────────────────────────
//   Total You Paid                           ₹ paidAmount
//
// Props (all optional, for callers that want to pass post-purchase data):
//   creditApplied {number}  — INR credit that was consumed (default: 0)
//   paidAmount    {number}  — actual INR paid via Razorpay (default: planAmount)
//
// When neither prop is passed the component reads activationMethod from
// user.subscription and falls back to the original full-payment layout.
//
// Also fixes:
//   • handleDownloadPDF now works when orderId is absent (credit-only path has
//     no Razorpay orderId — was crashing with `Cannot read property 'slice'`).
//   • Payment method section now reads "Special Offer Credit" when applicable.
//   • Status badge reads "✓ Activated" (not "✓ Paid") on the credit-only path.

import React, { useRef, useCallback } from 'react';
import { useAuth } from '../../Context/Authorisation/AuthContext';
import html2pdf from 'html2pdf.js/dist/html2pdf.bundle.min.js';

const PLAN_AMOUNTS = { Basic: 2500, Standard: 3500, Premium: 4500 };

const fmt = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

// ── Activation method → human label ──────────────────────────────────────────
function resolvePaymentLabel(activationMethod, paymentId) {
  if (activationMethod === 'special_offer_credit') {
    return { method: 'Special Offer Credit', detail: 'Rewards redeemed at activation', ref: null };
  }
  if (activationMethod === 'referrals') {
    return { method: 'Referral Activation', detail: 'Activated via referral milestones', ref: null };
  }
  return { method: 'Razorpay', detail: 'UPI / Card / Net Banking', ref: paymentId ?? '—' };
}

// ── InvoicePopup ──────────────────────────────────────────────────────────────

/**
 * @param {object}  props
 * @param {boolean} props.show
 * @param {func}    props.onClose
 * @param {number}  [props.creditApplied=0]   INR credit consumed at purchase time
 * @param {number}  [props.paidAmount]        Actual INR paid (derived if omitted)
 */
const InvoicePopup = ({ show, onClose, creditApplied = 0, paidAmount: paidAmountProp }) => {
  const { user } = useAuth();
  const printRef = useRef();

  const handleDownloadPDF = useCallback(() => {
    const element = printRef.current;
    if (!element) return;

    const sub = user?.subscription ?? {};
    // BUG FIX: orderId may be absent on the credit-only path — fall back to timestamp
    const refSlug = sub.orderId?.slice(-6)?.toUpperCase() ?? Date.now().toString(36).toUpperCase();

    html2pdf()
      .set({
        margin: 0.5,
        filename: `Invoice_${(user?.name ?? 'User').replace(/\s+/g, '_')}_${refSlug}.pdf`,
        image:    { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF:    { unit: 'in', format: 'a4', orientation: 'portrait' },
      })
      .from(element)
      .save();
  }, [user]);

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!show) return null;
  if (!user?.subscription?.active) return null;

  const { plan, paymentId, orderId, startDate, expiresAt, activationMethod } = user.subscription;

  const planAmount = PLAN_AMOUNTS[plan] ?? 0;
  const gst        = Math.round(planAmount * 0.18);
  const baseAmount = planAmount - gst;

  // Credit applied: prefer the explicit prop (just-purchased), else try to
  // infer from activationMethod for already-active subscriptions.
  const effectiveCredit = creditApplied > 0
    ? creditApplied
    : (activationMethod === 'special_offer_credit' ? planAmount : 0);

  // Paid amount = plan price minus credit applied, minimum ₹0
  const effectivePaid = paidAmountProp !== undefined
    ? paidAmountProp
    : Math.max(0, planAmount - effectiveCredit);

  const isCreditOnly   = effectivePaid === 0 && effectiveCredit >= planAmount;
  const hasCredit      = effectiveCredit > 0;

  // GST only applies to the cash portion actually paid via Razorpay
  // const cashBase = Math.max(0, effectivePaid - Math.round(effectivePaid * 0.18));
  // const cashGst  = effectivePaid - cashBase;

  const { method: payMethod, detail: payDetail, ref: payRef } =
    resolvePaymentLabel(activationMethod, paymentId);

  // Invoice number: use Razorpay orderId tail if available, else timestamp
  const invoiceNo = orderId?.slice(-8)?.toUpperCase() ?? Date.now().toString(36).toUpperCase().slice(-8);

  const statusBadgeText = isCreditOnly ? '✓ Activated' : '✓ Paid';

  return (
    <div
      className="inv-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Subscription Invoice"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="inv-modal mt-5 pt-5">

        {/* Actions bar */}
        <div className="inv-actions">
          <button className="inv-btn inv-btn--download" onClick={handleDownloadPDF}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Download PDF
          </button>
          <button className="inv-btn inv-btn--close" onClick={onClose} aria-label="Close invoice">
            ✕
          </button>
        </div>

        {/* Invoice Document */}
        <div className="inv-document" ref={printRef}>

          {/* ── Header ─────────────────────────────────────────────────────── */}
          <div className="inv-document__header">
            <div className="inv-document__brand">
              <div className="inv-document__brand-name">SoShoLife</div>
              <div className="inv-document__brand-tagline">Social Subscription Invoice</div>
            </div>
            <div className="inv-document__meta">
              <div className="inv-meta-row">
                <span className="inv-meta-label">Invoice No</span>
                <span className="inv-meta-value">#{invoiceNo}</span>
              </div>
              <div className="inv-meta-row">
                <span className="inv-meta-label">Issue Date</span>
                <span className="inv-meta-value">{fmt(startDate)}</span>
              </div>
              <div className="inv-meta-row">
                <span className="inv-meta-label">Valid Until</span>
                <span className="inv-meta-value">{fmt(expiresAt)}</span>
              </div>
              <div className="inv-meta-row">
                <span className="inv-meta-label">Status</span>
                <span className={`inv-meta-badge ${isCreditOnly ? 'inv-meta-badge--credit' : ''}`}>
                  {statusBadgeText}
                </span>
              </div>
              {hasCredit && (
                <div className="inv-meta-row">
                  <span className="inv-meta-label">Credit Applied</span>
                  <span className="inv-meta-value inv-meta-value--credit">
                    🎁 ₹{effectiveCredit.toLocaleString('en-IN')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Special Offer credit banner (credit-only path) ────────────── */}
          {isCreditOnly && (
            <div className="inv-credit-banner">
              <span className="inv-credit-banner__icon">🎁</span>
              <div className="inv-credit-banner__body">
                <strong>Activated with Special Offer Rewards</strong>
                <span>
                  This subscription was activated entirely using your approved Special Offer
                  earnings. No payment was charged to your bank or card.
                </span>
              </div>
              <span className="inv-credit-banner__amount">
                ₹{effectiveCredit.toLocaleString('en-IN')} credit
              </span>
            </div>
          )}

          {/* ── Parties ────────────────────────────────────────────────────── */}
          <div className="inv-parties">
            <div className="inv-party">
              <div className="inv-party__label">Billed To</div>
              <div className="inv-party__name">{user.name}</div>
              <div className="inv-party__detail">{user.email}</div>
              {user.phone && <div className="inv-party__detail">{user.phone}</div>}
            </div>
            <div className="inv-party inv-party--right">
              <div className="inv-party__label">Payment Method</div>
              <div className="inv-party__name">{payMethod}</div>
              <div className="inv-party__detail">{payDetail}</div>
              {payRef && (
                <div className="inv-party__detail inv-party__detail--mono">{payRef}</div>
              )}
            </div>
          </div>

          {/* ── Line-items table ────────────────────────────────────────────── */}
          <table className="inv-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Period</th>
                <th>Duration</th>
                <th className="inv-table__right">Amount</th>
              </tr>
            </thead>
            <tbody>

              {/* Base subscription row */}
              <tr>
                <td>
                  <div className="inv-table__item-name">
                    {plan} Plan — Annual Subscription
                  </div>
                  <div className="inv-table__item-sub">Full access to income features</div>
                </td>
                <td>{fmt(startDate)} — {fmt(expiresAt)}</td>
                <td>12 months</td>
                <td className="inv-table__right">
                  ₹ {baseAmount.toLocaleString('en-IN')}
                </td>
              </tr>

              {/* GST row */}
              <tr className="inv-table__sub-row">
                <td colSpan={3}>GST (18%)</td>
                <td className="inv-table__right">₹ {gst.toLocaleString('en-IN')}</td>
              </tr>

              {/* Special Offer credit row — only shown when credit was applied */}
              {hasCredit && (
                <tr className="inv-table__credit-row">
                  <td colSpan={3}>
                    <span className="inv-table__credit-label">
                      🎁 Special Offer Reward Credit
                    </span>
                    <span className="inv-table__credit-sub">
                      {isCreditOnly
                        ? 'Subscription fully covered by earned rewards'
                        : 'Partial discount from approved rewards'}
                    </span>
                  </td>
                  <td className="inv-table__right inv-table__credit-amount">
                    −₹ {effectiveCredit.toLocaleString('en-IN')}
                  </td>
                </tr>
              )}
            </tbody>

            <tfoot>
              <tr className="inv-table__total">
                <td colSpan={3}>
                  {isCreditOnly ? 'Total (Fully Covered by Rewards)' : 'Total Paid'}
                </td>
                <td className="inv-table__right">
                  {isCreditOnly
                    ? <span className="inv-table__free-label">FREE 🎉</span>
                    : `₹ ${effectivePaid.toLocaleString('en-IN')}`
                  }
                </td>
              </tr>
            </tfoot>
          </table>

          {/* ── Credit savings callout (partial credit) ─────────────────────── */}
          {hasCredit && !isCreditOnly && (
            <div className="inv-savings-row">
              <span>💰 You saved</span>
              <strong>₹ {effectiveCredit.toLocaleString('en-IN')}</strong>
              <span>using Special Offer rewards on this subscription.</span>
            </div>
          )}

          {/* ── Disclaimer ──────────────────────────────────────────────────── */}
          <div className="inv-disclaimer">
            <strong>Terms &amp; Consent:</strong> By activating this subscription you agreed to
            a 12-month annual plan commencing on the invoice date. Special Offer reward credits
            are non-refundable and non-transferable. Refunds on any cash portion paid are subject
            to company policy. Contact support within 7 days of this invoice for any disputes.
            This document is computer-generated and valid without a physical signature.
          </div>

          {/* ── Footer ──────────────────────────────────────────────────────── */}
          <div className="inv-document__footer">
            <span>SoShoLife · support@sosholife.com</span>
            <span>Thank you for your subscription!</span>
          </div>
        </div>
      </div>

      <style>{INV_CSS}</style>
    </div>
  );
};

export default InvoicePopup;

// ── Scoped CSS ────────────────────────────────────────────────────────────────
const INV_CSS = `
  .inv-overlay {
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: rgba(10,15,40,0.75);
    backdrop-filter: blur(5px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    overflow-y: auto;
    animation: inv-fade-in 0.2s ease;
  }
  @keyframes inv-fade-in { from { opacity:0 } to { opacity:1 } }

  .inv-modal {
    width: 100%;
    max-width: 660px;
    background: #F8FAFF;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 24px 60px rgba(0,0,0,0.22);
    animation: inv-slide-in 0.3s cubic-bezier(0.34,1.56,0.64,1);
  }
  @keyframes inv-slide-in {
    from { opacity:0; transform:translateY(20px) scale(0.97) }
    to   { opacity:1; transform:translateY(0) scale(1) }
  }

  .inv-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 18px;
    background: white;
    border-bottom: 1px solid rgba(0,0,0,0.07);
  }

  .inv-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 16px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    font-family: 'DM Sans', sans-serif;
    transition: 0.2s ease;
  }
  .inv-btn--download {
    background: #3B82F6;
    color: white;
    box-shadow: 0 4px 12px rgba(59,130,246,0.3);
  }
  .inv-btn--download:hover { background: #2563EB; transform: translateY(-1px); }
  .inv-btn--close {
    background: #F1F5F9;
    color: #64748B;
    border: 1px solid rgba(0,0,0,0.08);
    width: 38px;
    height: 38px;
    padding: 0;
    justify-content: center;
    font-size: 15px;
    border-radius: 50%;
  }
  .inv-btn--close:hover { background: #EF4444; color: white; transform: rotate(90deg); }

  .inv-document {
    padding: 32px 32px 28px;
    font-family: 'DM Sans', 'Helvetica Neue', sans-serif;
    background: white;
    margin: 0 18px 18px;
    border-radius: 14px;
    border: 1px solid rgba(0,0,0,0.07);
  }

  /* ── Header ── */
  .inv-document__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: 20px;
    border-bottom: 2px solid #3B82F6;
    margin-bottom: 24px;
    flex-wrap: wrap;
    gap: 16px;
  }
  .inv-document__brand-name {
    font-size: 22px;
    font-weight: 800;
    color: #3B82F6;
    letter-spacing: -0.02em;
    font-family: 'Syne', sans-serif;
  }
  .inv-document__brand-tagline {
    font-size: 13px;
    color: #94A3B8;
    margin-top: 2px;
  }
  .inv-document__meta { text-align: right; }
  .inv-meta-row {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    margin-bottom: 4px;
  }
  .inv-meta-label { font-size: 12px; color: #94A3B8; }
  .inv-meta-value { font-size: 13px; font-weight: 600; color: #0F172A; }
  .inv-meta-value--credit { color: #059669; }
  .inv-meta-badge {
    font-size: 11px;
    font-weight: 700;
    background: #F0FDF4;
    color: #166534;
    border: 1px solid #BBF7D0;
    padding: 2px 10px;
    border-radius: 100px;
  }
  .inv-meta-badge--credit {
    background: #ECFDF5;
    color: #065F46;
    border-color: #6EE7B7;
  }

  /* ── Credit-only activation banner ── */
  .inv-credit-banner {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    background: linear-gradient(135deg, #ECFDF5, #D1FAE5);
    border: 1.5px solid #6EE7B7;
    border-radius: 12px;
    padding: 14px 16px;
    margin-bottom: 20px;
  }
  .inv-credit-banner__icon { font-size: 24px; flex-shrink: 0; }
  .inv-credit-banner__body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 13px;
    color: #065F46;
    font-family: 'DM Sans', sans-serif;
  }
  .inv-credit-banner__body strong { font-size: 14px; }
  .inv-credit-banner__amount {
    font-size: 15px;
    font-weight: 800;
    color: #059669;
    white-space: nowrap;
    font-family: 'DM Mono', 'Courier New', monospace;
    align-self: center;
  }

  /* ── Parties ── */
  .inv-parties {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }
  .inv-party__label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #94A3B8;
    margin-bottom: 6px;
  }
  .inv-party__name { font-size: 16px; font-weight: 700; color: #0F172A; margin-bottom: 3px; }
  .inv-party__detail { font-size: 13px; color: #475569; line-height: 1.5; }
  .inv-party__detail--mono {
    font-family: 'SF Mono', 'Courier New', monospace;
    font-size: 12px;
    color: #94A3B8;
    word-break: break-all;
  }
  .inv-party--right { text-align: right; }

  /* ── Table ── */
  .inv-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
    font-size: 14px;
  }
  .inv-table thead tr {
    background: #F8FAFF;
    border-top: 1px solid #E2E8F0;
    border-bottom: 1px solid #E2E8F0;
  }
  .inv-table th {
    padding: 9px 12px;
    text-align: left;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #94A3B8;
  }
  .inv-table td {
    padding: 13px 12px;
    color: #475569;
    border-bottom: 1px solid #F1F5F9;
    vertical-align: middle;
  }
  .inv-table__right { text-align: right; }
  .inv-table__item-name { font-weight: 600; color: #0F172A; margin-bottom: 2px; }
  .inv-table__item-sub  { font-size: 12px; color: #94A3B8; }

  /* GST sub-row */
  .inv-table__sub-row td {
    color: #94A3B8;
    font-size: 13px;
    padding-top: 5px;
    padding-bottom: 5px;
    border-bottom: none;
  }

  /* Credit row ── green tinted */
  .inv-table__credit-row td {
    background: #F0FDF4;
    border-bottom: 1px solid #BBF7D0;
    padding: 10px 12px;
  }
  .inv-table__credit-label {
    display: block;
    font-weight: 700;
    color: #065F46;
    font-size: 13px;
    margin-bottom: 2px;
  }
  .inv-table__credit-sub {
    display: block;
    font-size: 12px;
    color: #6B7280;
  }
  .inv-table__credit-amount {
    font-weight: 800;
    color: #059669;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 14px;
  }

  /* Total row */
  .inv-table__total {
    background: #F8FAFF;
    border-top: 2px solid #E2E8F0;
  }
  .inv-table__total td {
    padding: 12px;
    font-weight: 800;
    font-size: 16px;
    color: #0F172A;
    border-bottom: none;
  }
  .inv-table__free-label {
    font-size: 18px;
    font-weight: 900;
    color: #059669;
    font-family: 'DM Mono', 'Courier New', monospace;
    letter-spacing: 0.5px;
  }

  /* Savings callout (partial credit) */
  .inv-savings-row {
    display: flex;
    align-items: center;
    gap: 6px;
    background: #ECFDF5;
    border: 1px solid #A7F3D0;
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 13px;
    color: #065F46;
    font-family: 'DM Sans', sans-serif;
    margin-bottom: 16px;
  }
  .inv-savings-row strong {
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 15px;
    font-weight: 800;
  }

  /* Disclaimer */
  .inv-disclaimer {
    font-size: 12px;
    color: #94A3B8;
    line-height: 1.6;
    background: #F8FAFF;
    border: 1px solid #E2E8F0;
    border-radius: 8px;
    padding: 12px 14px;
    margin-bottom: 20px;
  }

  /* Footer */
  .inv-document__footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    padding-top: 16px;
    border-top: 1px solid #F1F5F9;
    font-size: 12px;
    color: #94A3B8;
  }

  /* Responsive */
  @media (max-width: 600px) {
    .inv-document        { padding: 20px 16px; margin: 0 12px 12px; }
    .inv-document__header { flex-direction: column; }
    .inv-document__meta  { text-align: left; }
    .inv-meta-row        { justify-content: flex-start; }
    .inv-party--right    { text-align: left; }
    .inv-table           { font-size: 12px; }
    .inv-table th,
    .inv-table td        { padding: 8px 8px; }
    .inv-document__footer { flex-direction: column; text-align: center; }
    .inv-credit-banner   { flex-direction: column; }
    .inv-savings-row     { flex-wrap: wrap; }
  }
`;