import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import './Components/XLogo/i18n'
import AOS from 'aos';
import 'aos/dist/aos.css';
// import './globals.css';

AOS.init({ duration: 700 });


const root = ReactDOM.createRoot(document.getElementById('root'));

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
  });
}

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

