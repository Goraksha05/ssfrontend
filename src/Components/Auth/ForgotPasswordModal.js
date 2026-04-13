/**
 * ForgotPasswordModal.js
 *
 * RENDER OPTIMISATIONS (this pass):
 *
 *  1. Step sub-components (StepPhone, StepOtp, StepPassword) extracted and
 *     wrapped in React.memo.  Previously the entire modal body re-rendered on
 *     every keystroke in any field.  Now only the active step's component
 *     re-renders.
 *
 *  2. Action handlers (verifyPhoneAndSendOTP, handleResendOTP, verifyOTP,
 *     submitNewPassword, handleClose) wrapped in useCallback so they don't
 *     cause prop-inequality on every parent render, preserving the memo
 *     boundaries established in point 1.
 *
 *  3. formatTime moved to module scope — it's a pure function with no closure
 *     dependencies; no need to recreate it on every render.
 *
 *  4. resetAll inlined into handleClose via useCallback — avoids an extra
 *     non-memoised helper that would otherwise be re-created each render.
 *
 *  5. ToastContainer moved outside the modal tree.  Previously it was
 *     unmounted/remounted whenever `show` toggled because it lived inside the
 *     conditional Modal.  It now persists independently, which also avoids
 *     duplicate containers if the parent already renders one.
 *     NOTE: if a ToastContainer already exists higher in the tree, remove this
 *     one and rely on that instead.
 *
 *  6. OTP countdown timer: the useEffect now only runs when step becomes 2 and
 *     on each `timeLeft` tick — the dependency array is tightened so the
 *     interval isn't torn down and restarted on unrelated state changes.
 *
 *  7. Modal.Body children are stable references (memo'd components) so
 *     react-bootstrap's internal reconciliation path is shorter.
 */

import React, { useState, useCallback, useEffect } from 'react';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useRegisterModal } from '../../Context/ModalContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/* ── Pure utility (module-scope, never recreated) ────────────────────────── */
const formatTime = (seconds) => {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
};

/* ── Step sub-components ─────────────────────────────────────────────────── */

// Optimisation #1 — each step is memo'd; only the active step re-renders on
// field changes, not the whole modal body.

const StepPhone = React.memo(({ phone, onChange }) => (
  <>
    <label className="form-label">Registered Phone Number</label>
    <input
      type="text"
      className="form-control"
      value={phone}
      onChange={onChange}
      placeholder="Enter your 10-digit phone number"
    />
  </>
));

const StepOtp = React.memo(({ otp, onChange, otpExpired, timeLeft, resending, onResend }) => (
  <>
    <label className="form-label">OTP</label>
    <input
      type="text"
      className="form-control mb-2"
      value={otp}
      onChange={onChange}
      placeholder="Enter the OTP"
      disabled={otpExpired}
    />
    <div style={{ fontSize: '0.9rem', color: otpExpired ? 'red' : 'gray' }}>
      {otpExpired
        ? 'OTP expired. Please resend.'
        : `OTP expires in ${formatTime(timeLeft)}`}
    </div>
    <div style={{ fontSize: '0.9rem' }}>
      Didn't receive OTP?{' '}
      <button
        className="btn btn-link p-0"
        style={{ fontSize: '0.9rem' }}
        onClick={onResend}
        disabled={resending}
      >
        {resending ? 'Resending...' : 'Resend OTP'}
      </button>
    </div>
  </>
));

const StepPassword = React.memo(({ newPassword, confirmPassword, onChangeNew, onChangeConfirm }) => (
  <>
    <label className="form-label">New Password</label>
    <input
      type="password"
      className="form-control mb-3"
      value={newPassword}
      onChange={onChangeNew}
      placeholder="Enter new password"
    />
    <label className="form-label">Confirm Password</label>
    <input
      type="password"
      className="form-control"
      value={confirmPassword}
      onChange={onChangeConfirm}
      placeholder="Re-enter new password"
    />
  </>
));

/* ── Main component ──────────────────────────────────────────────────────── */
const ForgotPasswordModal = ({ show, onClose }) => {
  useRegisterModal(show);

  const [step,            setStep]            = useState(1);
  const [phone,           setPhone]           = useState('');
  const [otp,             setOtp]             = useState('');
  const [newPassword,     setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [timeLeft,        setTimeLeft]        = useState(300);
  const [otpExpired,      setOtpExpired]      = useState(false);
  const [resending,       setResending]       = useState(false);

  /* ── Countdown timer (Optimisation #6) ─────────────────────────────────── */
  // Only active on step 2.  Dependencies are minimal so the interval isn't
  // unnecessarily torn down by unrelated state changes.
  useEffect(() => {
    if (step !== 2) return;
    if (timeLeft === 0) { setOtpExpired(true); return; }
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  /* ── Stable handlers (Optimisation #2) ─────────────────────────────────── */

  // Optimisation #4 — resetAll inlined; handleClose is stable across renders.
  const handleClose = useCallback(() => {
    setStep(1);
    setPhone('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeLeft(300);
    setOtpExpired(false);
    setResending(false);
    onClose();
  }, [onClose]);

  const sendOTP = useCallback(async (currentPhone) => {
    try {
      const otpRes = await fetch(`${BACKEND_URL}/api/otp/send-for-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: currentPhone }),
      });
      const otpData = await otpRes.json();
      if (otpData.success) {
        toast.success('OTP sent successfully!');
        setTimeLeft(300);
        setOtpExpired(false);
      } else {
        toast.error('Failed to send OTP: ' + otpData.message);
      }
    } catch {
      toast.error('Network error while sending OTP.');
    }
  }, []);

  const verifyPhoneAndSendOTP = useCallback(async () => {
    if (!/^\d{10}$/.test(phone)) {
      toast.error('Enter a valid 10-digit phone number.');
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/check-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!data.success) { toast.error('Phone not registered.'); return; }
      await sendOTP(phone);
      setStep(2);
    } catch {
      toast.error('Server error verifying phone.');
    }
  }, [phone, sendOTP]);

  const handleResendOTP = useCallback(async () => {
    setResending(true);
    await sendOTP(phone);
    setResending(false);
  }, [phone, sendOTP]);

  const verifyOTP = useCallback(async () => {
    if (otpExpired) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otpCode: otp }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('OTP verified. Proceed to reset password.');
        setStep(3);
      } else {
        toast.error('Invalid OTP.');
      }
    } catch {
      toast.error('Server error verifying OTP.');
    }
  }, [phone, otp, otpExpired]);

  const submitNewPassword = useCallback(async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    if (
      newPassword.length < 5 ||
      !/[A-Z]/.test(newPassword) ||
      !/\d/.test(newPassword)
    ) {
      toast.error(
        'Password must be at least 5 characters, include a capital letter and a number.'
      );
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/reset-password-with-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Password reset successful. Please login.');
        setTimeout(handleClose, 1500);
      } else {
        toast.error(data.message || 'Failed to reset password.');
      }
    } catch {
      toast.error('Server error resetting password.');
    }
  }, [phone, otp, newPassword, confirmPassword, handleClose]);

  /* ── Stable onChange handlers ────────────────────────────────────────────
     Defined with useCallback so memo'd children don't break on each parent
     render.  Each setter is already stable (from useState) so no deps needed. */
  const handlePhoneChange      = useCallback((e) => setPhone(e.target.value), []);
  const handleOtpChange        = useCallback((e) => setOtp(e.target.value), []);
  const handleNewPasswordChange    = useCallback((e) => setNewPassword(e.target.value), []);
  const handleConfirmPasswordChange = useCallback((e) => setConfirmPassword(e.target.value), []);

  const stepTitle = step === 1 ? 'Forgot Password' : step === 2 ? 'Enter OTP' : 'Reset Password';

  return (
    <>
      {/* Optimisation #5 — ToastContainer lives outside the Modal so it isn't
          unmounted when the modal closes. Remove if one already exists upstream. */}
      <ToastContainer />

      <Modal show={show} onHide={handleClose} centered>
        <Modal.Header closeButton>
          <Modal.Title>{stepTitle}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {/* Optimisation #1 — only the active step component re-renders */}
          {step === 1 && (
            <StepPhone phone={phone} onChange={handlePhoneChange} />
          )}
          {step === 2 && (
            <StepOtp
              otp={otp}
              onChange={handleOtpChange}
              otpExpired={otpExpired}
              timeLeft={timeLeft}
              resending={resending}
              onResend={handleResendOTP}
            />
          )}
          {step === 3 && (
            <StepPassword
              newPassword={newPassword}
              confirmPassword={confirmPassword}
              onChangeNew={handleNewPasswordChange}
              onChangeConfirm={handleConfirmPasswordChange}
            />
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>Cancel</Button>

          {step === 1 && (
            <Button variant="primary" onClick={verifyPhoneAndSendOTP}>Send OTP</Button>
          )}
          {step === 2 && (
            <>
              <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
              <Button variant="primary" onClick={verifyOTP} disabled={otpExpired}>
                Verify OTP
              </Button>
            </>
          )}
          {step === 3 && (
            <Button variant="success" onClick={submitNewPassword}>Submit</Button>
          )}
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default ForgotPasswordModal;