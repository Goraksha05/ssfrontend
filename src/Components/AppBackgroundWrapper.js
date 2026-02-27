// src/components/AppBackgroundWrapper.js
import React from 'react';
import backgroundImage from '../Assets/Background.jpg';

const AppBackgroundWrapper = ({ children }) => {
  const wrapperStyle = {
    minHeight: '100vh',
    backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${backgroundImage})`,
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingTop: '58px',
    color: '#f0f8ff',
  };

  return <div style={wrapperStyle}>{children}</div>;
};

export default AppBackgroundWrapper;
