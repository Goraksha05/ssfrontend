import { useState } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const useForgotPassword = () => {
  const [formData, setFormData] = useState({
    phone: '',
    lastPassword: '',
    otp: '',
    newPassword: '',
    otpSent: false,
  });

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const sendOTP = async () => {
    const { phone, lastPassword } = formData;

    if (!lastPassword || !/^\d{10}$/.test(phone)) {
      return { success: false, message: 'Please enter a valid last password and phone number.' };
    }

    const check = await checkPhoneExists(phone);
    if (!check.success) {
      return { success: false, message: check.message };
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/otp/send-for-reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();
      if (data.success) {
        setFormData((prev) => ({ ...prev, otpSent: true }));
        return { success: true, message: "OTP sent." };
      }
      return { success: false, message: data.message || "Failed to send OTP." };
    } catch (err) {
      console.error("OTP send error:", err);
      return { success: false, message: "Something went wrong." };
    }
  };

  const resetPassword = async () => {
    const { phone, otp, newPassword } = formData;
    if (!otp || newPassword.length < 5) {
      return { success: false, message: "Enter valid OTP and password (min 5 chars)." };
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/reset-password-with-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp, newPassword }),
      });

      const data = await res.json();
      if (data.success) {
        return { success: true, message: "Password reset successful." };
      }
      return { success: false, message: data.message || "Failed to reset password." };
    } catch (err) {
      console.error("Reset error:", err);
      return { success: false, message: "Something went wrong." };
    }
  };

  const resetState = () => {
    setFormData({
      phone: '',
      lastPassword: '',
      otp: '',
      newPassword: '',
      otpSent: false,
    });
  };

  return {
    formData,
    handleChange,
    sendOTP,
    resetPassword,
    resetState,
  };
};

const checkPhoneExists = async (phone) => {
  if (!/^\d{10}$/.test(phone)) {
    return { success: false, message: "Enter a valid 10-digit number" };
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/check-phone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });

    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Phone check error:", err);
    return { success: false, message: "Something went wrong while verifying phone." };
  }
};


export default useForgotPassword;