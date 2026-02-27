import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../Context/Authorisation/AuthContext';
import AuthService from '../../Services/AuthService';
import ForgotPasswordModal from './ForgotPasswordModal';
import Logo from '../XLogo/Logo';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { BadgeCheck } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const LogSignNewModel = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [role] = useState('user');

  // State for toggling between login and signup forms
  const [isLogin, setIsLogin] = useState(true);

  // Login state
  const [loginData, setLoginData] = useState({
    identifier: '',
    password: '',
  });

  // Signup state including OTP functionality
  const [signupData, setSignupData] = useState({
    name: '',
    username: '',
    email: '',
    phone: '',
    password: '',
    cpassword: '',
    referralno: '',
  });
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');

  //Forgot Password Modal visibility state
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Handler for login submission
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    const { identifier, password } = loginData;

    if (!identifier.trim() || !password.trim()) {
      alert("Please enter both identifier and password.");
      return;
    }

    if (!identifier || !password) {
      toast.error("Please enter both username/email/phone and password.");
      return;
    }

    try {
      // const response = await AuthService.login({
      //   identifier: loginData.identifier,
      //   password: loginData.password,
      //   role,
      // });

      const credentials = {
        identifier: loginData.identifier,
        password: loginData.password
      };

      const response = isAdminLogin
        ? await AuthService.loginAdmin(credentials)
        : await AuthService.login(credentials);

      console.log("Login payload:", loginData);

      if (response?.success && response.authtoken) {
        localStorage.setItem('token', response.authtoken);
        await login(response.authtoken);
        alert('Login successful!');
        // ✅ Clear login form
        setLoginData({ identifier: '', password: '' });
        // navigate('/');

        // Redirect based on role
        if (response.user?.isAdmin) {
          navigate('/admin/dashboard');
        } else {
          navigate('/');
        }
      } else {
        alert(response?.error || "Login failed. Check your credentials.");
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed!');
    }
  };

  const isPasswordMatch = (pass, confirm) => {
    return pass === confirm;
  };
  // Handler to send OTP for signup
  const handleSendOTP = async () => {
    // Validate inputs before sending OTP
    const { name, username, email, phone, password, cpassword } = signupData;
    if (
      name.trim().length < 3 ||
      username.trim().length < 3 ||
      username.includes(' ') ||
      !/\S+@\S+\.\S+/.test(email) ||
      !/^\d{10}$/.test(phone) ||
      password.trim().length < 5
    ) {
      alert('Please fill all fields correctly.');
      return;
    }

    if (!isPasswordMatch(password, cpassword)) {
      alert('Please re-enter confirm password with password matching');
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: signupData.phone }),
      });
      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
        alert('OTP sent successfully!');
      } else {
        alert('Failed to send OTP: ' + data.message);
      }
      console.log(data)
    } catch (error) {
      console.error('OTP sending error:', error);
      alert('Could not send OTP. Please try again.');
    }
  };

  // Handler for OTP verification and final signup
  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    const { name, username, email, phone, password, referralno } = signupData;
    try {
      // Step 1: Verify OTP
      const verifyRes = await fetch(`${BACKEND_URL}/api/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: signupData.phone, otpCode: otp }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyData.success) {
        alert('Invalid OTP. Please try again.');
        return;
      }

      // Step 2: Call signup API (backend will check for verified phone via VerifiedPhone schema)
      const result = await AuthService.signup({
        name,
        username,
        email,
        phone,
        password,
        referralno: referralno,
        role,
      });
      if (result.success && result.authtoken) {
        localStorage.setItem('token', result.authtoken);
        login(result.authtoken);
        alert('Signup successful! You are now logged in.');

        // Step 3: If referralno is present, record referral activity
        // if (referralno) {
        //   const token = localStorage.getItem("token");
        //   const referralRes = await fetch(`${BACKEND_URL}/api/activity/referral`, {
        //     method: 'POST',
        //     headers: {
        //       'Content-Type': 'application/json',
        //       'Authorization': `Bearer ${token}`,
        //     },
        //     body: JSON.stringify({
        //       referralNumber: referralno,
        //       newUserId: result.user?._id
        //     })
        //   });
        //   console.log("Submitting referral for:", referralno); //Temporarily
        //   const referralData = await referralRes.json();
        //   if (referralRes.ok) {
        //     console.log('Referral activity logged:', referralData);
        //   } else {
        //     console.warn('Referral activity failed:', referralData.message);
        //   }
        // }

        // ✅ Clear signup form
        navigate('/');
        setSignupData({
          name: '',
          username: '',
          email: '',
          phone: '',
          password: '',
          cpassword: '',
          referralno: '',
        });
      } else {
        alert('Signup failed: ' + (result.error || 'Unknown error.'));
      }
    } catch (error) {
      console.error('Signup error:', error);
      alert('Signup process failed. Please try again.');
    }
  };

  // Common input change handler for both forms
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (isLogin) {
      setLoginData({ ...loginData, [name]: value });
    } else {
      setSignupData({ ...signupData, [name]: value });
    }
  };

  return (
    <div className="container d-flex flex-column align-items-center justify-content-center">
      <div className="text-center mt-3">
        <h1 className="logo"><Logo /></h1>
        <p className="tagline"><b>Your own digital platform "To Get Recognition"</b></p>
      </div>

      <div className="form-container mt-3 w-100">
        <div className="form-toggle d-flex mb-3">
          <button className={`btn ${isLogin ? 'btn-primary' : 'btn-light'} w-50`} onClick={() => setIsLogin(true)}>Login</button>
          <button className={`btn ${!isLogin ? 'btn-primary' : 'btn-light'} w-50`} onClick={() => setIsLogin(false)}>Signup</button>
        </div>

        <form className="form" onSubmit={isLogin ? handleLoginSubmit : (otpSent ? handleSignupSubmit : (e) => { e.preventDefault(); handleSendOTP(); })}>
          <div className="row">
            {isLogin ? (
              <>
                <h4 className="text-center mb-3">Login</h4>
                <div className="form-check mb-2">
                  <input type="checkbox" className="form-check-input" checked={isAdminLogin} onChange={() => setIsAdminLogin(!isAdminLogin)} id="adminCheck" />
                  <label className="form-check-label" htmlFor="adminCheck">Login as Admin</label>
                </div>
                <input type="text" name="identifier" value={loginData.identifier} onChange={handleInputChange} className="form-control mb-2" placeholder="Username, Email or Phone" required />
                <input type="password" name="password" value={loginData.password} onChange={handleInputChange} className="form-control mb-2" placeholder="Password" required />
                <div className="d-flex justify-content-end mb-3">
                  <a href="/" onClick={(e) => { e.preventDefault(); setShowForgotModal(true); }}>Forgot Password?</a>
                </div>
                <button type="submit" className="btn btn-primary w-100">Login</button>
              </>
            ) : (
              <>
                <h4 className="text-center mb-3">Signup</h4>
                <input type="text" name="referralno" value={signupData.referralno} onChange={handleInputChange} className="form-control mb-2" placeholder="Referral Number" required />
                <input type="text" name="name" value={signupData.name} onChange={handleInputChange} className="form-control mb-2" placeholder="Full Name" required />
                <input type="text" name="username" value={signupData.username} onChange={handleInputChange} className="form-control mb-2" placeholder="Username" required />
                <input type="email" name="email" value={signupData.email} onChange={handleInputChange} className="form-control mb-2" placeholder="Email" required />
                <input type="text" name="phone" value={signupData.phone} onChange={handleInputChange} className="form-control mb-2" placeholder="Phone Number" required />
                <input type="password" name="password" value={signupData.password} onChange={handleInputChange} className="form-control mb-2" placeholder="Password" required />
                <input type="password" name="cpassword" value={signupData.cpassword} onChange={handleInputChange} className="form-control mb-2" placeholder="Confirm Password" required />

                {signupData.cpassword && (
                  <p className={`mb-2 small ${signupData.password === signupData.cpassword ? 'text-success' : 'text-danger'}`}>
                    {signupData.password === signupData.cpassword ? '✓ Passwords match' : '✕ Passwords do not match'}
                  </p>
                )}

                {otpSent && (
                  <>
                    <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} className="form-control mb-2" placeholder="Enter OTP" required />
                    <div className="text-end mb-2">
                      <a href="/" onClick={(e) => { e.preventDefault(); handleSendOTP(); }}>Resend OTP</a>
                    </div>
                  </>
                )}

                <div className="d-flex gap-2">
                  <button type="submit" className="btn btn-success w-100">{otpSent ? 'Verify & Signup' : 'Send OTP'}</button>
                  <button type="button" className="btn btn-secondary w-100" onClick={() => { setSignupData({ name: '', username: '', email: '', phone: '', password: '', cpassword: '', referralno: '' }); setOtp(''); setOtpSent(false); }}>Cancel</button>
                </div>
              </>
            )}
            <div className="text-center mt-3">
              {isLogin ? (
                <p>Not a member? <a href="/" onClick={(e) => { e.preventDefault(); setIsLogin(false); }}>Signup Now</a></p>
              ) : (
                <p>Already a member? <a href="/" onClick={(e) => { e.preventDefault(); setIsLogin(true); }}>Login Now</a></p>
              )}
            </div>
          </div>
        </form>
      </div>

      <ForgotPasswordModal show={showForgotModal} onClose={() => setShowForgotModal(false)} />
    </div>
  );
};

export default LogSignNewModel;
