import React, { useEffect, useState } from 'react';
import { useSubscription } from '../Context/Subscription/SubscriptionContext';
import { useAuth } from '../Context/Authorisation/AuthContext';
import '../Subscription.css';

const plans = [/* ... same plan definitions ... */];
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function Subscription() {
  const { showSubscription, closeSubscription } = useSubscription();
  const { user } = useAuth();

  const [subscriptionStatus, setSubscriptionStatus] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/payment/subscription-status`, {
          headers: {
            "auth-token": localStorage.getItem("token")
          }
        });
        const data = await res.json();
        setSubscriptionStatus(data);
      } catch (err) {
        console.error("Failed to fetch subscription status:", err);
      }
    };

    if (user) fetchStatus();
  }, [user]);

  const handleSubscribe = async (plan) => {
    if (!user) {
      alert("Please login first.");
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/payment/create-order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "auth-token": localStorage.getItem("token")
        },
        body: JSON.stringify({
          amount: plan.amount,
          planName: plan.name
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error("Order creation failed");

      const options = {
        key: "testingKey2428", // Replace with your real key
        amount: data.order.amount,
        currency: "INR",
        name: "Social App",
        description: `${plan.name} Plan Subscription`,
        order_id: data.order.id,
        prefill: {
          name: user.name,
          email: user.email,
          contact: user.phone || ""
        },
        handler: async function (response) {
          await fetch(`${BACKEND_URL}/api/payment/verify`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "auth-token": localStorage.getItem("token")
            },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              planName: plan.name
            })
          });

          alert("Payment successful! Subscription activated.");
          // Re-fetch subscription status after activation
          const updated = await fetch(`${BACKEND_URL}/api/payment/subscription-status`, {
            headers: {
              "auth-token": localStorage.getItem("token")
            }
          });
          const updatedStatus = await updated.json();
          setSubscriptionStatus(updatedStatus);
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

  if (!showSubscription) return null;

  return (
    <div className="subscription-modal">
      <div className="container py-5">
        <h1 className="text-center fw-light display-5">
          <span className="highlight">Plans & Pricing</span>
        </h1>
        <p className="lead text-center mb-4">
          We have a plan for everyone whether you're a business or an individual.
        </p>

        {subscriptionStatus?.subscribed && (
          <div className="alert alert-success text-center mb-4">
            <strong>Subscribed:</strong> {subscriptionStatus.plan} &nbsp;|&nbsp;
            <strong>Expires:</strong> {new Date(subscriptionStatus.expiresAt).toLocaleDateString()}
          </div>
        )}

        <div className="row justify-content-center">
          {plans.map((plan) => (
            <div className="col-12 col-md-4 mb-4" key={plan.name}>
              <div className="card h-100 rounded-4 text-center shadow">
                <div className="card-body d-flex flex-column">
                  <div className="mb-3">
                    <h4>{plan.name}</h4>
                    <span className="display-6">{plan.price}</span>
                  </div>
                  <div className="text-secondary pb-1">Per user/month</div>
                  <div className="mb-3 text-secondary">Subscribe Annually</div>

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

                  <h6>Online Pay by UPI</h6>
                  <div className="mt-auto text-center">
                    <button className="btn btn-lg btn-outline-primary" onClick={() => handleSubscribe(plan)}>
                      Subscribe
                    </button>
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
    </div>
  );
}
