// src/components/Subscription.js
import React, { useEffect, useState } from 'react';
import { useSubscription } from '../../Context/Subscription/SubscriptionContext';
import { useAuth } from '../../Context/Authorisation/AuthContext';
import InvoicePopup from './InvoicePopup';
import AOS from 'aos';
import 'aos/dist/aos.css';
import '../../Subscription.css';
import { toast } from 'react-toastify';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_SERVER_URL;

const plans = [
  {
    name: "Basic",
    actualPackeg: 2999,
    discountedAmount: 2500,                // ✅ 250.00 INR = 25000 paise
    price: "₹ 250 / Month",               // display only
    save: 499,
    referral: ["3 Referral ₹ 2500", "6 Referral ₹ 2500", "10 Referral ₹ 3000"],
    post: ["30 To 150 Post ₹ 500/Slab", "300 Post ₹ 1000", "600 Post ₹ 1200", "1000 Post ₹ 1500"],
    streak: ["30 To 210 Streak ₹ 500/Slab", "240 To 360 Streak ₹ 1000/Slab"],
    utm: "basic_pricing"
  },
  {
    name: "Standard",
    actualPackeg: 4199,
    discountedAmount: 3500,
    price: "₹ 350 / Month",
    save: 699,
    referral: ["3 Referral ₹ 3500", "6 Referral ₹ 3500", "10 Referral ₹ 4000"],
    post: ["30 To 150 Post ₹ 1000/Slab", "300 Post ₹ 1500", "600 Post ₹ 1800", "1000 Post ₹ 2200"],
    streak: ["30 To 210 Streak ₹ 1000/Slab", "240 To 360 Streak ₹ 1500/Slab"],
    utm: "standard_pricing"
  },
  {
    name: "Premium",
    actualPackeg: 5499,
    discountedAmount: 4500,
    price: "₹ 450 / Month",
    save: 999,
    referral: ["3 Referral ₹ 4500", "6 Referral ₹ 4500", "10 Referral ₹ 5500"],
    post: ["30 To 150 Post ₹ 2000/Slab", "300 Post ₹ 5500", "600 Post ₹ 3000", "1000 Post ₹ 3500"],
    streak: ["30 To 210 Streak ₹ 1500/Slab", "240 To 360 Streak ₹ 2000/Slab"],
    utm: "premium_pricing"
  }
];

export default function Subscription() {
  const { showSubscription, closeSubscription } = useSubscription();
  const { user, authtoken } = useAuth();
  const [showInvoice, setShowInvoice] = useState(false);


  useEffect(() => {
    AOS.init({ duration: 800 });
  }, []);

  const handleSubscribe = async (plan) => {

    if (!user || !user.name || !user.email || !authtoken) {
      toast.error("User not authenticated. Please login again.");
      return;
    }

    if (!plan || !plan.amount || isNaN(Number(plan.amount))) {
      console.error("❌ Invalid plan or amount:", plan);
      toast.error("Invalid plan selected.");
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/payment/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authtoken}`
        },
        body: JSON.stringify({
          amount: Math.round(Number(plan.amount) * 100),
          planName: plan.name
        })
      });
      console.log("📦 Subscribing with plan:", plan);
      console.log("💰 Amount being sent:", plan.amount);

      const data = await res.json();
      if (!data.success) throw new Error("Order creation failed");

      const options = {
        key: "rzp_test_dRxYFu51QjtKuF", // Replace with your actual Razorpay key
        amount: data.order.discountedAmount,
        currency: "INR",
        name: "Social App",
        description: `${plan.name} Plan Subscription`,
        order_id: data.order.id,
        prefill: {
          name: user.name,
          email: user.email,
          contact: user.phone || ""
        },
        method: {
          upi: true,
          card: true,
          netbanking: true,
          wallet: true
        },
        handler: async function (response) {
          // Notify backend about successful payment
          await fetch(`${BACKEND_URL}/api/payment/verify`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${authtoken}`
            },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              planName: plan.name
            })
          });

          alert("Payment successful! Subscription activated.");
        },
        theme: {
          color: "#0d6efd"
        }
      };

      const razor = new window.Razorpay(options);
      razor.open();
    } catch (error) {
      console.error("Payment error:", error);
      alert("Payment failed. Please try again.");
    }
  };

  // add near the top
  const [progress, setProgress] = useState({ loading: true, referredCount: 0, target: 10, eligible: false, active: false, activationMethod: null });
  // fetch progress when modal opens or user changes
  useEffect(() => {
    if (!showSubscription || !authtoken) return;
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/payment/progress`, {
          headers: { "Authorization": `Bearer ${authtoken}` }
        });
        const data = await res.json();
        if (data.success) {
          setProgress({
            loading: false,
            referredCount: data.referredCount,
            target: data.target,
            eligible: data.eligible,
            active: data.active,
            activationMethod: data.activationMethod
          });
        } else {
          setProgress(p => ({ ...p, loading: false }));
        }
      } catch (e) {
        console.error('progress fetch failed', e);
        setProgress(p => ({ ...p, loading: false }));
      }
    })();
  }, [showSubscription, authtoken]);

  const handleActivateByReferrals = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/payment/activate-by-referrals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${authtoken}`
        }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.warn(data.message || "Not eligible yet");
        return;
      }
      toast.success("Activated via referrals! Enjoy your benefits.");
      // refresh progress
      const refresh = await fetch(`${BACKEND_URL}/api/payment/progress`, {
        headers: { "Authorization": `Bearer ${authtoken}` }
      });
      const pd = await refresh.json();
      if (pd.success) {
        setProgress({
          loading: false,
          referredCount: pd.referredCount,
          target: pd.target,
          eligible: pd.eligible,
          active: pd.active,
          activationMethod: pd.activationMethod
        });
      }
    } catch (e) {
      console.error(e);
      toast.error("Server error. Try again.");
    }
  };

  if (!showSubscription) return null;

  return (
    <div className="subscription-modal w-full px-4 md:px-16">
      <div className="container py-5 max-w-7xl mx-auto">
        <h1 className="text-center text-3xl md:text-4xl font-light mb-2" data-aos="fade-down">
          <span className="highlight">Pick your way of <strong className='text-primary'>INCOME</strong></span>
        </h1>
        <p className="lead text-center text-lg md:text-xl mb-8 text-gray-700" data-aos="fade-up">We have a plan for everyone whether you're a business or an individual.</p>

        {/* Activate by referrals card */}
        <div className="row justify-content-center mb-2" data-aos="fade-up">
          <div className="col-12 col-md-8">
            <div className="card rounded-4 shadow-sm">
              <div className="card-body d-flex flex-column gap-2">
                <h5 className="mb-1">Activate by Inviting Friends</h5>
                <div className="text-muted">
                  Refer <strong>{progress.target}</strong> new users and unlock your subscription benefits — no payment needed.
                </div>

                <div className="progress my-2" style={{ height: 10 }}>
                  <div
                    className="progress-bar"
                    role="progressbar"
                    style={{ width: `${Math.min(100, (progress.referredCount / progress.target) * 100)}%` }}
                    aria-valuenow={progress.referredCount}
                    aria-valuemin="0"
                    aria-valuemax={progress.target}
                  />
                </div>
                <div className="d-flex justify-content-between small">
                  <span>Progress: <strong>{progress.referredCount}</strong> / {progress.target}</span>
                  <span>Status: {progress.active ? <span className="text-success">Active ({progress.activationMethod})</span> : <span className="text-warning">Inactive</span>}</span>
                </div>

                <div className="mt-2">
                  {!progress.active && (
                    <button
                      className="btn btn-outline-success me-2"
                      disabled={!progress.eligible}
                      onClick={handleActivateByReferrals}
                      title={progress.eligible ? "Click to activate now" : "Invite more friends to reach the goal"}
                    >
                      {progress.eligible ? "Activate Now (Referrals)" : `Need ${Math.max(0, progress.target - progress.referredCount)} more`}
                    </button>
                  )}
                  {/* Optional: show/copy referral code */}
                  {user?.referralId && (
                    <button
                      className="btn btn-outline-secondary"
                      onClick={() => {
                        navigator.clipboard.writeText(user.referralId);
                        toast.info("Referral ID copied!");
                      }}
                    >
                      Copy My Referral ID: {user.referralId}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="row justify-content-center flex flex-wrap justify-center gap-8" //data-aos="zoom-in"
        >
          {plans.map((plan) => (
            <div className="col-12 col-md-4 mb-4" key={plan.name}>
              <div className="card h-100 rounded-4 text-center shadow">
                <div className="card-body d-flex flex-column">
                  <div>
                    <h4>{plan.name} Package</h4>
                    <h4>₹ {plan.actualPackeg}</h4>
                    <div>
                      <span className="display-6">₹ {plan.discountedAmount}</span>
                      <div className="text-secondary pb-1">Subscribe Annually</div>
                      <p className="text-sm text-success">Save ₹ {plan.save}</p>
                    </div>
                    <span className="display-8">{plan.price}</span>
                  </div>

                    <h6>Referral Income: (One Time)</h6>
                    <ul className="list-unstyled text-center">
                      {plan.referral.map((item, idx) => (
                        <li key={idx} className="mb-2 text-center justify-content-center">{item}</li>
                      ))}
                    </ul>


                    <h6>Streak Income: (One Time)</h6>
                    <ul className="list-unstyled text-center">
                      {plan.streak.map((item, idx) => (
                        <li key={idx} className="mb-2 text-center justify-content-center">{item}</li>
                      ))}
                    </ul>

                    <h6>Post Income: (Every Month)</h6>
                    <ul className="list-unstyled text-center">
                      {plan.post.map((item, idx) => (
                        <li key={idx} className="mb-2 text-center justify-content-center">{item}</li>
                      ))}
                    </ul>

                  <h6>Online Pay by UPI</h6>
                  <div className="mt-auto text-center">
                    <button className="btn btn-lg btn-outline-primary" onClick={() => handleSubscribe(plan)}>
                      Subscribe
                    </button>
                    {user?.subscription?.active && user?.subscription?.plan === plan.name && (
                      <button className="btn btn-outline-success mt-3" onClick={() => setShowInvoice(true)}>
                        View Invoice
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-4">
          <button className="btn btn-danger" onClick={closeSubscription}>Close</button>
        </div>
      </div>
      <InvoicePopup show={showInvoice} onClose={() => setShowInvoice(false)} />
    </div>
  );
}
