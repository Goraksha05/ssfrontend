import React, { useState, useEffect } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import useScrollLock from "../../hooks/useScrollLock";
import 'react-toastify/dist/ReactToastify.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ForgotPasswordModal = ({ show, onClose }) => {
  useScrollLock(show);
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [timeLeft, setTimeLeft] = useState(300);
  const [otpExpired, setOtpExpired] = useState(false);
  const [resending, setResending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const resetAll = () => {
    setStep(1); setPhone(''); setOtp(''); setNewPassword('');
    setConfirmPassword(''); setTimeLeft(300); setOtpExpired(false);
    setResending(false); setLoading(false);
  };

  const handleClose = () => { resetAll(); onClose(); };

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  useEffect(() => {
    let timer;
    if (step === 2 && timeLeft > 0) timer = setInterval(() => setTimeLeft(p => p - 1), 1000);
    else if (step === 2 && timeLeft === 0) setOtpExpired(true);
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    if (show) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show]);

  const sendOTP = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/otp/send-for-reset`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (data.success) { toast.success('OTP sent!'); setTimeLeft(300); setOtpExpired(false); }
      else toast.error('Failed to send OTP: ' + data.message);
    } catch { toast.error('Network error while sending OTP.'); }
  };

  const verifyPhoneAndSendOTP = async () => {
    if (!/^\d{10}$/.test(phone)) { toast.error('Enter a valid 10-digit phone number.'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/check-phone`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!data.success) { toast.error('Phone not registered.'); return; }
      await sendOTP();
      setStep(2);
    } catch { toast.error('Server error verifying phone.'); }
    finally { setLoading(false); }
  };

  const handleResendOTP = async () => { setResending(true); await sendOTP(); setResending(false); };

  const verifyOTP = async () => {
    if (otpExpired) return;
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/otp/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otpCode: otp }),
      });
      const data = await res.json();
      if (data.success) { toast.success('OTP verified!'); setStep(3); }
      else toast.error('Invalid OTP.');
    } catch { toast.error('Server error verifying OTP.'); }
    finally { setLoading(false); }
  };

  const submitNewPassword = async () => {
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match.'); return; }
    if (newPassword.length < 5 || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      toast.error('Password must be 5+ chars, include a capital letter and a number.'); return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/reset-password-with-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp, newPassword }),
      });
      const data = await res.json();
      if (data.success) { toast.success('Password reset! Please login.'); setTimeout(handleClose, 1500); }
      else toast.error(data.message || 'Failed to reset password.');
    } catch { toast.error('Server error resetting password.'); }
    finally { setLoading(false); }
  };

  if (!show) return null;

  const timerPct = (timeLeft / 300) * 100;
  const timerColor = timeLeft < 60 ? '#ef4444' : timeLeft < 120 ? '#f59e0b' : '#0ea5e9';

  const steps = [
    { label: 'Phone', icon: '📱' },
    { label: 'OTP', icon: '🔐' },
    { label: 'Reset', icon: '🔑' },
  ];

  return (
    <>
      <ToastContainer position="top-center" theme="dark" />
      <div className="fpm-overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
        <div className="fpm-panel" role="dialog" aria-modal="true" aria-label="Forgot Password">

          {/* Decorative glow */}
          <div className="fpm-glow" />

          {/* Header */}
          <div className="fpm-header">
            <div className="fpm-header-inner">
              <div className="fpm-icon">
                {step === 1 ? '🔓' : step === 2 ? '📲' : '🔑'}
              </div>
              <div>
                <h2 className="fpm-title">
                  {step === 1 ? 'Forgot Password' : step === 2 ? 'Verify OTP' : 'New Password'}
                </h2>
                <p className="fpm-subtitle">
                  {step === 1 && 'Enter your registered phone number'}
                  {step === 2 && `Code sent to +91 ${phone}`}
                  {step === 3 && 'Create a strong new password'}
                </p>
              </div>
            </div>
            <button className="fpm-close" onClick={handleClose} aria-label="Close">✕</button>
          </div>

          {/* Step progress */}
          <div className="fpm-steps">
            {steps.map((s, i) => (
              <React.Fragment key={i}>
                <div className={`fpm-step ${i + 1 < step ? 'done' : i + 1 === step ? 'active' : ''}`}>
                  <div className="fpm-step-dot">
                    {i + 1 < step ? '✓' : <span>{i + 1}</span>}
                  </div>
                  <span className="fpm-step-label">{s.label}</span>
                </div>
                {i < 2 && <div className={`fpm-step-line ${i + 1 < step ? 'done' : ''}`} />}
              </React.Fragment>
            ))}
          </div>

          {/* Body */}
          <div className="fpm-body">
            {step === 1 && (
              <div className="fpm-field-group">
                <label className="fpm-label">Phone Number</label>
                <div className="fpm-input-wrap">
                  <span className="fpm-input-prefix">+91</span>
                  <input
                    type="tel" className="fpm-input" value={phone} maxLength={10}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/, ''))}
                    placeholder="10-digit mobile number"
                    onKeyDown={(e) => e.key === 'Enter' && verifyPhoneAndSendOTP()}
                  />
                </div>
                <p className="fpm-hint">We'll send a one-time code to verify your account.</p>
              </div>
            )}

            {step === 2 && (
              <div className="fpm-field-group">
                <div className="fpm-otp-timer-bar">
                  <div className="fpm-otp-timer-fill" style={{ width: `${timerPct}%`, background: timerColor }} />
                </div>
                <div className="fpm-otp-timer-text" style={{ color: timerColor }}>
                  {otpExpired ? '⏰ OTP expired' : `⏱ ${formatTime(timeLeft)} remaining`}
                </div>
                <label className="fpm-label" style={{ marginTop: 16 }}>One-Time Password</label>
                <input
                  type="text" className="fpm-input fpm-otp-input" value={otp} maxLength={6}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/, ''))}
                  placeholder="· · · · · ·" disabled={otpExpired}
                  onKeyDown={(e) => e.key === 'Enter' && !otpExpired && verifyOTP()}
                />
                <div className="fpm-resend-row">
                  Didn't receive it?{' '}
                  <button className="fpm-link-btn" onClick={handleResendOTP} disabled={resending}>
                    {resending ? 'Sending…' : 'Resend OTP'}
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="fpm-field-group">
                <label className="fpm-label">New Password</label>
                <div className="fpm-input-wrap">
                  <input
                    type={showPass ? 'text' : 'password'} className="fpm-input"
                    value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 5 chars, 1 capital, 1 number"
                  />
                  <button className="fpm-eye-btn" onClick={() => setShowPass(p => !p)}>
                    {showPass ? '🙈' : '👁'}
                  </button>
                </div>
                <label className="fpm-label" style={{ marginTop: 14 }}>Confirm Password</label>
                <div className="fpm-input-wrap">
                  <input
                    type={showPass ? 'text' : 'password'} className="fpm-input"
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    onKeyDown={(e) => e.key === 'Enter' && submitNewPassword()}
                  />
                </div>
                {newPassword && confirmPassword && (
                  <p className="fpm-match-hint" style={{ color: newPassword === confirmPassword ? '#22c55e' : '#ef4444' }}>
                    {newPassword === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="fpm-footer">
            {step > 1 && (
              <button className="fpm-btn-secondary" onClick={() => setStep(s => s - 1)} disabled={loading}>
                ← Back
              </button>
            )}
            <button className="fpm-btn-ghost" onClick={handleClose} disabled={loading}>Cancel</button>

            {step === 1 && (
              <button className="fpm-btn-primary" onClick={verifyPhoneAndSendOTP} disabled={loading || phone.length !== 10}>
                {loading ? <span className="fpm-spinner" /> : 'Send OTP →'}
              </button>
            )}
            {step === 2 && (
              <button className="fpm-btn-primary" onClick={verifyOTP} disabled={loading || otpExpired || otp.length < 4}>
                {loading ? <span className="fpm-spinner" /> : 'Verify →'}
              </button>
            )}
            {step === 3 && (
              <button className="fpm-btn-success" onClick={submitNewPassword} disabled={loading}>
                {loading ? <span className="fpm-spinner" /> : '✓ Reset Password'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ForgotPasswordModal;