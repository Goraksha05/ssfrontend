import React from 'react';
import logoImage from '../../Assets/logo.png'; // Adjust the path as needed

const Logo = ({ className = '', style = {}, imageSize = 40 }) => {
  return (
    <img
      src={logoImage}
      alt="App Logo"
      className={className}
      style={{ height: imageSize, width: imageSize, ...style }}
    />
  );
};

export default Logo;
