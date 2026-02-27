import React from 'react';
import { useTranslation } from 'react-i18next';
import logoImage from '../../Assets/logo.png';

const Logo = ({ className = 'bg-transparent rounded py-4 px-2', style = {}, imageSize = 100 }) => {
    const { t } = useTranslation();
    const name = t('app.name');

    if (name === 'SoShoLife') {
        return (
            <span className={`flex items-center ${className}`} style={style}>
                {/* Logo Image */}
                <img
                    src={logoImage}
                    alt="SoShoLife Logo"
                    className="mr-2"
                    style={{ height: imageSize, width: imageSize }}
                />
                {/* Brand Name */}
                <span className="fw-bold" style={{ fontSize: '4rem', color: '#005cbb', textShadow: '2px 2px 2px #ffffff' }}>So</span>
                <span className="fw-bold" style={{ fontSize: '4rem', color: '#ff4200', textShadow: '2px 2px 2px #ffffff' }}>Sho</span>
                <span className="fw-bold" style={{ fontSize: '4rem', color: '#005cbb', textShadow: '2px 2px 2px #ffffff' }}>Life</span>
            </span>
        );
    }

    // For any other app name
    return (
        <span className={`flex items-center ${className}`} style={style}>
            <img
                src={logoImage}
                alt="Logo"
                // className="mr-2"
                style={{ height: imageSize, width: imageSize }}
            />
            <span>{name}</span>
        </span>
    );
};

export default Logo;