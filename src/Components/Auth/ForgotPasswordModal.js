import React, { useState, useEffect } from 'react';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ForgotPasswordModal = ({ show, onClose }) => {
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [timeLeft, setTimeLeft] = useState(300);
  const [otpExpired, setOtpExpired] = useState(false);
  const [resending, setResending] = useState(false);

  const resetAll = () => {
    setStep(1);
    setPhone('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeLeft(300);
    setOtpExpired(false);
    setResending(false);
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  const formatTime = (seconds) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    let timer;
    if (step === 2 && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (step === 2 && timeLeft === 0) {
      setOtpExpired(true);
    }
    return () => clearInterval(timer);
  }, [step, timeLeft]);

  const sendOTP = async () => {
    try {
      console.log("Sending OTP for:", phone)
      const otpRes = await fetch(`${BACKEND_URL}/api/otp/send-for-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const otpData = await otpRes.json();
      console.log("OTP response:", otpData);

      if (otpData.success) {
        toast.success("OTP sent successfully!");
        setTimeLeft(300);
        setOtpExpired(false);
      } else {
        toast.error("Failed to send OTP: " + otpData.message);
      }
    } catch (err) {
      console.error("Network or server error in sendOTP:", err);
      toast.error("Network error while sending OTP.");
    }
  };

  const verifyPhoneAndSendOTP = async () => {
    if (!/^\d{10}$/.test(phone)) {
      toast.error("Enter a valid 10-digit phone number.");
      return;
    }

    try {
      console.log("Sending /check-phone for:", phone);
      const res = await fetch(`${BACKEND_URL}/api/auth/check-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();
      console.log("Phone check response:", data);

      if (!data.success) {
        toast.error("Phone not registered.");
        return;
      }

      console.log("Phone verified. Sending OTP now...");
      await sendOTP();
      setStep(2);
    } catch (err) {
      console.error("verifyPhoneAndSendOTP error:", err);
      toast.error("Server error verifying phone.");
    }
  };

  const handleResendOTP = async () => {
    setResending(true);
    await sendOTP();
    setResending(false);
  };

  const verifyOTP = async () => {
    if (otpExpired) return;

    try {
      const res = await fetch(`${BACKEND_URL}/api/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otpCode: otp }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("OTP verified. Proceed to reset password.");
        setStep(3);
      } else {
        toast.error("Invalid OTP.");
      }
    } catch (err) {
      toast.error("Server error verifying OTP.");
    }
  };

  const submitNewPassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    if (newPassword.length < 5 || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      toast.error("Password must be at least 5 characters, include a capital letter and a number.");
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/reset-password-with-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp, newPassword }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Password reset successful. Please login.");
        setTimeout(() => handleClose(), 1500);
      } else {
        toast.error(data.message || "Failed to reset password.");
      }
    } catch (err) {
      toast.error("Server error resetting password.");
    }
  };

  return (
    <>
      <ToastContainer />
      <Modal show={show} onHide={handleClose} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {step === 1 && "Forgot Password"}
            {step === 2 && "Enter OTP"}
            {step === 3 && "Reset Password"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {step === 1 && (
            <>
              <label className="form-label">Registered Phone Number</label>
              <input
                type="text"
                className="form-control"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your 10-digit phone number"
              />
            </>
          )}

          {step === 2 && (
            <>
              <label className="form-label">OTP</label>
              <input
                type="text"
                className="form-control mb-2"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter the OTP"
                disabled={otpExpired}
              />
              <div style={{ fontSize: '0.9rem', color: otpExpired ? 'red' : 'gray' }}>
                {otpExpired
                  ? "OTP expired. Please resend."
                  : `OTP expires in ${formatTime(timeLeft)}`}
              </div>
              <div style={{ fontSize: '0.9rem' }}>
                Didn't receive OTP?{" "}
                <button
                  className="btn btn-link p-0"
                  style={{ fontSize: '0.9rem' }}
                  onClick={handleResendOTP}
                  disabled={resending}
                >
                  {resending ? "Resending..." : "Resend OTP"}
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <label className="form-label">New Password</label>
              <input
                type="password"
                className="form-control mb-3"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
              <label className="form-label">Confirm Password</label>
              <input
                type="password"
                className="form-control"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
              />
            </>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>Cancel</Button>

          {step === 1 && (
            <Button
              variant="primary"
              onClick={() => {
                console.log("Send OTP clicked");
                verifyPhoneAndSendOTP();
              }}
            >
              Send OTP
            </Button>

          )}

          {step === 2 && (
            <>
              <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
              <Button variant="primary" onClick={verifyOTP} disabled={otpExpired}>Verify OTP</Button>
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
