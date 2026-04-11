// WelcomePage.js — Improved UI/UX with Theme Palette Picker
// Styles are in App.css (welcome-root, welcome-hero, feature-card, cta-section, etc.)
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Logo from './XLogo/Logo';
import groceryCart from '../Assets/grocery-cart.png';
import { useTranslation } from 'react-i18next';
import LogBtnIcon from '../Assets/LoginCreateAccount.png';
import { useModal } from '../Context/ModalContext';
import TodayOfferModal from './TodayOffer/TodayOfferModal';
import ModalContent from './TodayOffer/ModalContent';
// import ThemePalettePicker from './Theme/ThemePalettePicker';
import { useTheme } from '../Context/ThemeUI/ThemeContext';
import OpportunityModal from './IncomePossibility'; // ← new

const FEATURES = [
  {
    icon: '✔',
    color: '#00c853',
    title: 'Verified Membership',
    titleKey: '✔ Verified Membership',
    en: 'Get a blue tick for authenticity and boost your credibility online.',
    mr: 'ऑनलाइन विश्वसनीयता वाढवण्यासाठी ब्लू टिक मिळवा आणि खात्रीशीर सदस्य बना.',
  },
  {
    icon: '₹',
    color: '#ff6d00',
    title: 'Referral Rewards',
    titleKey: '✔ Referral Rewards',
    en: 'Invite friends and earn approx ₹2,000 Grocery coupons as you grow your network.',
    mr: 'मित्रांना आमंत्रित करा आणि नेटवर्क वाढवल्यानंतर ₹2,000 च्या ग्रोसरी कूपन्स मिळवा.',
  },
  {
    icon: '★',
    color: '#2979ff',
    title: 'Membership Plans',
    titleKey: '✔ Membership Plans',
    en: 'Choose from Basic, Standard, or Premium to unlock exclusive features and income potential.',
    mr: 'बेसिक, स्टँडर्ड किंवा प्रीमियम योजना निवडा आणि कमाईच्या संधी उघडा.',
  },
  {
    icon: '🔒',
    color: '#6200ea',
    title: 'Safe & Secure',
    titleKey: '✔ Safe & Secure',
    en: 'Your privacy matters. We ensure complete data protection and confidentiality.',
    mr: 'तुमची गोपनीयता आमच्यासाठी महत्त्वाची आहे — आम्ही संपूर्ण डेटा सुरक्षा आणि गोपनीयता हमी देतो.',
  },
];

const WelcomePage = () => {
  const { t } = useTranslation();
  // const [showModal, setShowModal] = useState(false);
  const [showOpportunity, setShowOpportunity] = useState(false);
  const [visible, setVisible] = useState(false);
  const { isDark } = useTheme();
  const { openModal } = useModal();

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="welcome-root">
      {/* Hero */}
      <div className="welcome-hero">

        {/* <div className="d-flex justify-content-between align-items-end">
          <ThemePalettePicker />
        </div> */}

        {/* ── Top action bar: Today's Offer  +  Theme Picker ── */}
        <div
          className="d-flex justify-content-between align-items-center position-relative"
          style={{ zIndex: 2, gap: '10px', flexWrap: 'wrap' }}
        >
          <button
            className="offer-btn"
            title="Only for you"
            onClick={() =>
              openModal(TodayOfferModal, {
                title: "Today's Special Offer 🎁",
                children: <ModalContent />,
                onConfirm: () => {
                  alert("Offer claimed! 🎉");
                },
              })
            }
          >
            🎁 Today's Offer
          </button>

          {/* ── Opportunity Button ── */}
          <button
            className="offer-btn opportunity-btn"
            title="Income Opportunity"
            onClick={() => setShowOpportunity(true)}
            style={{
              background: 'linear-gradient(90deg, #ff6d00, #ffd600)',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              boxShadow: '0 2px 12px rgba(255,109,0,0.35)',
            }}
          >
            💼 Opportunity
          </button>

        </div>

        <img src={groceryCart} alt="" className="grocery-img" />

        <div className={`text-center position-relative fade-up ${visible ? 'visible' : ''}`} style={{ zIndex: 2 }}>
          <Link to="/login" title="Login / Create Account">
            <img src={LogBtnIcon} alt="Login / Create Account" className="login-btn-img" />
          </Link>

          <div className="d-flex flex-column align-items-center">
            <h1 className="align-items-center justify-content-center hero-title">
              {t('Welcome to')}<Logo />
            </h1>
          </div>
          <p
            className="hero-tagline"
            style={{
              color: isDark ? '#ffffff' : '#1a2031',
              transition: 'color 0.3s ease',
            }}
          >
            {t("Your digital identity deserves more — engage, earn, and grow with India's most rewarding social platform.")}
          </p>

          <p
            className="hero-marathi"
            style={{
              color: isDark ? '#ffffff' : '#1a2031',
              transition: 'color 0.3s ease',
            }}
          >
            तुमची डिजिटल ओळख अधिक मूल्यवान व्हावी यासाठी — कनेक्ट व्हा, कमवा आणि भारताच्या सर्वात फायदेशीर सोशल प्लॅटफॉर्मसोबत तुमचे आर्थिक भविष्य घडवा.
          </p>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="features-grid">
        {FEATURES.map((f, i) => (
          <div
            key={f.title}
            className={`feature-card fade-up ${visible ? 'visible' : ''} delay-${i + 1}`}
            style={{ '--accent': f.color }}
          >
            <div className="feature-icon">{f.icon}</div>
            <div className="feature-title">{t(f.titleKey)}</div>
            <p className="feature-en">{t(f.en)}</p>
            <p className="feature-mr">{f.mr}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className={`cta-section fade-up ${visible ? 'visible' : ''} delay-5`}>
        <p className="cta-text-en">{t("Turn your social presence into a powerful income stream.")}</p>
        <p className="cta-text-mr">तुमची सोशल उपस्थिती कमाईच्या एका जबरदस्त संधीमध्ये रूपांतरित करा.</p>
        <Link className="cta-join-btn" to="/login" title="Login / Create Account">
          Join SoShoLife Now 🚀
        </Link>
      </div>

      <div style={{ height: '1.5rem' }} />

      {/* Offer Modal */}
      {/* <ModalContent show={showModal} onClose={() => setShowModal(false)} /> */}

      {/* Opportunity Modal ← new */}
      <OpportunityModal show={showOpportunity} onClose={() => setShowOpportunity(false)} />
    </div>
  );
};

export default WelcomePage;