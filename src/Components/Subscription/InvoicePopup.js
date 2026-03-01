// src/components/Subscription/InvoicePopup.js
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

const InvoicePopup = ({ show, onClose }) => {
  const { user } = useAuth();
  const printRef = useRef();

  const handleDownloadPDF = useCallback(() => {
    const element = printRef.current;
    if (!element) return;
    const { orderId } = user.subscription;
    html2pdf()
      .set({
        margin: 0.5,
        filename: `Invoice_${user.name.replace(/\s+/g, '_')}_${orderId?.slice(-6) || 'NA'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
      })
      .from(element)
      .save();
  }, [user]);

  // Guard conditions
  if (!show) return null;
  if (!user?.subscription?.active) return null;

  const { plan, paymentId, orderId, startDate, expiresAt } = user.subscription;
  const amount = PLAN_AMOUNTS[plan] ?? 0;
  const gst = Math.round(amount * 0.18);
  const baseAmount = amount - gst;

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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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
          {/* Header band */}
          <div className="inv-document__header">
            <div className="inv-document__brand">
              <div className="inv-document__brand-name">SoShoLife</div>
              <div className="inv-document__brand-tagline">Social Subscription Invoice</div>
            </div>
            <div className="inv-document__meta">
              <div className="inv-meta-row">
                <span className="inv-meta-label">Invoice No</span>
                <span className="inv-meta-value">#{orderId?.slice(-8)?.toUpperCase() ?? 'NA'}</span>
              </div>
              <div className="inv-meta-row">
                <span className="inv-meta-label">Issue Date</span>
                <span className="inv-meta-value">{fmt(startDate)}</span>
              </div>
              <div className="inv-meta-row">
                <span className="inv-meta-label">Status</span>
                <span className="inv-meta-badge">✓ Paid</span>
              </div>
            </div>
          </div>

          {/* Billed to */}
          <div className="inv-parties">
            <div className="inv-party">
              <div className="inv-party__label">Billed To</div>
              <div className="inv-party__name">{user.name}</div>
              <div className="inv-party__detail">{user.email}</div>
              {user.phone && <div className="inv-party__detail">{user.phone}</div>}
            </div>
            <div className="inv-party inv-party--right">
              <div className="inv-party__label">Payment Method</div>
              <div className="inv-party__name">Razorpay</div>
              <div className="inv-party__detail">UPI / Card / Net Banking</div>
              <div className="inv-party__detail inv-party__detail--mono">{paymentId ?? '—'}</div>
            </div>
          </div>

          {/* Line items table */}
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
              <tr>
                <td>
                  <div className="inv-table__item-name">{plan} Plan — Annual Subscription</div>
                  <div className="inv-table__item-sub">Full access to income features</div>
                </td>
                <td>{fmt(startDate)} — {fmt(expiresAt)}</td>
                <td>12 months</td>
                <td className="inv-table__right">₹ {baseAmount.toLocaleString('en-IN')}</td>
              </tr>
              <tr className="inv-table__sub-row">
                <td colSpan={3}>GST (18%)</td>
                <td className="inv-table__right">₹ {gst.toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="inv-table__total">
                <td colSpan={3}>Total Paid</td>
                <td className="inv-table__right">₹ {amount.toLocaleString('en-IN')}</td>
              </tr>
            </tfoot>
          </table>

          {/* Disclaimer */}
          <div className="inv-disclaimer">
            <strong>Terms & Consent:</strong> By completing this payment you agreed to a 12-month annual subscription
            commencing on the invoice date. Refunds are subject to company policy. Contact support within 7 days
            of this invoice for any disputes. This document is computer-generated and valid without a physical signature.
          </div>

          {/* Footer */}
          <div className="inv-document__footer">
            <span>SoShoLife · support@sosholife.com</span>
            <span>Thank you for your subscription!</span>
          </div>
        </div>
      </div>

      <style>{`
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

        .inv-document__meta {
          text-align: right;
        }
        .inv-meta-row {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          margin-bottom: 4px;
        }
        .inv-meta-label {
          font-size: 12px;
          color: #94A3B8;
        }
        .inv-meta-value {
          font-size: 13px;
          font-weight: 600;
          color: #0F172A;
        }
        .inv-meta-badge {
          font-size: 11px;
          font-weight: 700;
          background: #F0FDF4;
          color: #166534;
          border: 1px solid #BBF7D0;
          padding: 2px 10px;
          border-radius: 100px;
        }

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
        .inv-party__name {
          font-size: 16px;
          font-weight: 700;
          color: #0F172A;
          margin-bottom: 3px;
        }
        .inv-party__detail {
          font-size: 13px;
          color: #475569;
          line-height: 1.5;
        }
        .inv-party__detail--mono {
          font-family: 'SF Mono', 'Courier New', monospace;
          font-size: 12px;
          color: #94A3B8;
          word-break: break-all;
        }
        .inv-party--right {
          text-align: right;
        }

        .inv-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
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
        }
        .inv-table__right { text-align: right; }
        .inv-table__item-name {
          font-weight: 600;
          color: #0F172A;
          margin-bottom: 2px;
        }
        .inv-table__item-sub {
          font-size: 12px;
          color: #94A3B8;
        }
        .inv-table__sub-row td {
          color: #94A3B8;
          font-size: 13px;
          padding-top: 6px;
          padding-bottom: 6px;
          border-bottom: none;
        }
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

        @media (max-width: 600px) {
          .inv-document { padding: 20px 16px; margin: 0 12px 12px; }
          .inv-document__header { flex-direction: column; }
          .inv-document__meta { text-align: left; }
          .inv-meta-row { justify-content: flex-start; }
          .inv-party--right { text-align: left; }
          .inv-table { font-size: 12px; }
          .inv-table th, .inv-table td { padding: 8px 8px; }
          .inv-document__footer { flex-direction: column; text-align: center; }
        }
      `}</style>
    </div>
  );
};

export default InvoicePopup;