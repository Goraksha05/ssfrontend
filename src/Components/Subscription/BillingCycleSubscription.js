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
    price: { monthly: "₹ 250", yearly: "₹ 2500" },
    amount: { monthly: 250, yearly: 2500 },
    referral: ["3 Referral ₹ 2500", "6 Referral ₹ 2500", "10 Referral ₹ 3000"],
    post: ["30 To 150 Post ₹ 500/Slab", "300 Post ₹ 1000", "600 Post ₹ 1200", "1000 Post ₹ 1500"],
    streak: ["30 To 210 Streak ₹ 500/Slab", "240 To 360 Streak ₹ 1000/Slab"],
    utm: "basic_pricing"
  },
  {
    name: "Standard",
    price: { monthly: "₹ 350", yearly: "₹ 3500" },
    amount: { monthly: 350, yearly: 3500 },
    referral: ["3 Referral ₹ 3500", "6 Referral ₹ 3500", "10 Referral ₹ 4000"],
    post: ["30 To 150 Post ₹ 1000/Slab", "300 Post ₹ 1500", "600 Post ₹ 1800", "1000 Post ₹ 2200"],
    streak: ["30 To 210 Streak ₹ 1000/Slab", "240 To 360 Streak ₹ 1500/Slab"],
    utm: "standard_pricing"
  },
  {
    name: "Premium",
    price: { monthly: "₹ 450", yearly: "₹ 4500" },
    amount: { monthly: 450, yearly: 4500 },
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
  const [billingCycle, setBillingCycle] = useState("yearly");

  useEffect(() => {
    AOS.init({ duration: 800 });
  }, []);

  const handleSubscribe = async (plan) => {
    const selectedAmount = plan.amount?.[billingCycle];

    if (!user || !user.name || !user.email || !authtoken) {
      toast.error("User not authenticated. Please login again.");
      return;
    }

    if (!selectedAmount || isNaN(Number(selectedAmount))) {
      toast.error("Invalid plan amount.");
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
          amount: Math.round(Number(selectedAmount) * 100), // paise
          planName: `${plan.name} (${billingCycle})`
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error("Order creation failed");

      const options = {
        key: "rzp_test_dRxYFu51QjtKuF",
        amount: data.order.amount,
        currency: "INR",
        name: "Social App",
        description: `${plan.name} Plan (${billingCycle})`,
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
              planName: plan.name,
              billingCycle
            })
          });

          alert("Payment successful! Subscription activated.");
        },
        theme: { color: "#0d6efd" }
      };

      const razor = new window.Razorpay(options);
      razor.open();
    } catch (error) {
      console.error("Payment error:", error);
      alert("Payment failed. Please try again.");
    }
  };

  if (!showSubscription) return null;

  return (
    <div className="subscription-modal w-full px-4 py-8 md:px-16">
      <div className="container py-5 max-w-7xl mx-auto">
        <h1 className="text-center text-3xl md:text-4xl font-light mb-2" data-aos="fade-down">
          <span className="highlight">Plans & Pricing</span>
        </h1>
        <p className="lead text-center text-lg md:text-xl mb-4 text-gray-700" data-aos="fade-up">
          Choose monthly or yearly billing as per your need.
        </p>

        {/* Billing Cycle Toggle */}
        <div className="flex justify-center gap-4 mb-6 mx-2">
          <button
            className={`btn ${billingCycle === 'monthly' ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setBillingCycle("monthly")}
          >
            Monthly Billing
          </button>
          <button
            className={`btn ${billingCycle === 'yearly' ? 'btn-primary' : 'btn-outline-primary'} mx-2`}
            onClick={() => setBillingCycle("yearly")}
          >
            Yearly Billing
          </button>
        </div>

        <div className="row justify-content-center flex flex-wrap gap-6" data-aos="zoom-in">
          {plans.map((plan) => (
            <div className="col-12 col-md-4 mb-4" key={plan.name}>
              <div className="card h-100 rounded-4 text-center shadow">
                <div className="card-body d-flex flex-column">
                  <h4>{plan.name}</h4>
                  <span className="display-6">{plan.price[billingCycle]}</span>
                  <div className="text-secondary pb-1 mb-3">
                    {billingCycle === 'monthly' ? "Per user/month" : "Billed annually"}
                  </div>

                  <h6>Referral Income: (One Time)</h6>
                  <ul className="list-unstyled text-center">
                    {plan.referral.map((item, idx) => (
                      <li key={idx} className="mb-2 text-center">{item}</li>
                    ))}
                  </ul>

                  <h6>Streak Income: (One Time)</h6>
                  <ul className="list-unstyled text-center">
                    {plan.streak.map((item, idx) => (
                      <li key={idx} className="mb-2 text-center">{item}</li>
                    ))}
                  </ul>

                  <h6>Post Income: (Every Month)</h6>
                  <ul className="list-unstyled text-center">
                    {plan.post.map((item, idx) => (
                      <li key={idx} className="mb-2 text-center">{item}</li>
                    ))}
                  </ul>

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
