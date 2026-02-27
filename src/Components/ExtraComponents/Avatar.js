// components/common/Avatar.js
import React from 'react';

const Avatar = ({ src, alt = 'User Avatar', size = 96 }) => {
  return (
    <div
      className={`rounded-full overflow-hidden ring-4 ring-white shadow-md`}
      style={{ width: size, height: size }}
    >
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
      />
    </div>
  );
};

export default Avatar;
