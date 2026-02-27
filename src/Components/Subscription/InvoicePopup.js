import React, { useRef } from 'react';
import { useAuth } from '../../Context/Authorisation/AuthContext';
import html2pdf from 'html2pdf.js/dist/html2pdf.bundle.min.js';

const InvoicePopup = ({ show, onClose }) => {
  const { user } = useAuth();
  const printRef = useRef();

  if (!show || !user?.subscription?.active) return null;

  const { plan, paymentId, orderId, startDate, expiresAt } = user.subscription;
  const amount = plan === 'Basic' ? 2500 : plan === 'Standard' ? 3500 : 4500;

  const handleDownloadPDF = () => {
    const element = printRef.current;
    const opt = {
      margin: 0.5,
      filename: `Invoice_${user.name}_${orderId.slice(-6)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  };

  return (
    <div className="modal fade show d-block" tabIndex="-1" role="dialog" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content" ref={printRef}>
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title w-100 text-center">Blue Tick Subscription - Invoice</h5>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>

          <div className="modal-body p-4">
            {/* Invoice Header */}
            <div className="row mb-4">
              <div className="col-md-6">
                <p><strong>Invoice Date:</strong> {new Date(startDate).toLocaleDateString()}</p>
                <p><strong>Invoice No:</strong> #{orderId.slice(-6)}</p>
              </div>
              <div className="col-md-6 text-md-end">
                <h6 className="fw-bold">Billed To:</h6>
                <p className="mb-0">{user.name}</p>
                <small>Email: {user.email}</small><br />
                <small>Phone: {user.phone}</small>
              </div>
            </div>

            {/* Plan Details */}
            <div className="table-responsive mb-4">
              <table className="table table-bordered align-middle text-center">
                <thead className="table-light">
                  <tr>
                    <th>Plan</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Amount (INR)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{plan}</td>
                    <td>{new Date(startDate).toLocaleDateString()}</td>
                    <td>{new Date(expiresAt).toLocaleDateString()}</td>
                    <td>₹{amount}</td>
                    <td className="text-success fw-semibold">Paid</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Payment Details */}
            <div className="mb-4">
              <p><strong>Payment ID:</strong> {paymentId}</p>
              <p><strong>Order ID:</strong> {orderId}</p>
              <p><strong>Transaction Mode:</strong> Razorpay UPI / Card / Net Banking</p>
            </div>

            {/* Disclaimer */}
            <div className="alert alert-info small">
              <h6 className="fw-bold mb-2">Disclaimer / Customer Consent:</h6>
              <p className="mb-1">
                By completing this payment, you agree to subscribe to the selected plan for a period of 12 months, effective from the invoice date.
                No refunds will be processed unless stated otherwise by company policy.
              </p>
              <p className="mb-0">
                This invoice is computer-generated and does not require a physical signature.
                Please retain a copy for your records. For any disputes, contact support within 7 days from the date of invoice.
              </p>
            </div>
          </div>

          <div className="modal-footer justify-content-between">
            <button className="btn btn-primary" onClick={handleDownloadPDF}>
              <i className="bi bi-download me-1"></i> Download PDF
            </button>
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoicePopup;
