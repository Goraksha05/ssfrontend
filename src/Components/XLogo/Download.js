import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import logoImage from '../../Assets/logo.png';
import { toPng, toJpeg } from 'html-to-image';
import download from 'downloadjs';

const Logo = ({ className = 'bg-transparent rounded', style = {}, imageSize = 100 }) => {
    const { t } = useTranslation();
    const name = t('app.name');
    const logoRef = useRef();

    const handleDownloadPng = async () => {
        if (logoRef.current) {
            try {
                const dataUrl = await toPng(logoRef.current, {
                    cacheBust: true,
                    quality: 1,
                    backgroundColor: '#ffffff',
                    pixelRatio: 3,
                });
                download(dataUrl, 'SoShoLifeLogo.png', 'image/png');
            } catch (error) {
                console.error('Failed to download logo as PNG', error);
            }
        }
    };

    const handleDownloadJpg = async () => {
        if (logoRef.current) {
            try {
                const dataUrl = await toJpeg(logoRef.current, {
                    cacheBust: true,
                    quality: 0.95, // good balance size vs quality
                    backgroundColor: '#ffffff',
                    pixelRatio: 3,
                });
                download(dataUrl, 'SoShoLifeLogo.jpg', 'image/jpeg');
            } catch (error) {
                console.error('Failed to download logo as JPG', error);
            }
        }
    };

    if (name === 'SoShoLife') {
        return (
            <div>
                <span
                    ref={logoRef}
                    className={`flex items-center ${className}`}
                    style={{
                        ...style,
                        backgroundColor: 'white',
                        padding: '10px',
                        borderRadius: '8px',
                    }}
                >
                    {/* Logo Image */}
                    <img
                        src={logoImage}
                        alt="SoShoLife Logo"
                        className="mr-2"
                        style={{ height: imageSize, width: imageSize }}
                    />
                    {/* Brand Name */}
                    <span className="fw-bold" style={{ fontSize: '4rem', color: '#007FFF', textShadow: '2px 2px 2px #ffffff' }}>So</span>
                    <span className="fw-bold" style={{ fontSize: '4rem', color: '#FF671F', textShadow: '2px 2px 2px #ffffff' }}>Sho</span>
                    <span className="fw-bold" style={{ fontSize: '4rem', color: '#007FFF', textShadow: '2px 2px 2px #ffffff' }}>Life</span>
                </span>

                {/* Download buttons */}
                <div className="mt-4 flex gap-2">
                    <button
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                        onClick={handleDownloadPng}
                    >
                        Download PNG
                    </button>
                    <button
                        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                        onClick={handleDownloadJpg}
                    >
                        Download JPG
                    </button>
                </div>
            </div>
        );
    }

    // For any other app name
    return (
        <span ref={logoRef} className={`flex items-center ${className}`} style={style}>
            <img
                src={logoImage}
                alt="Logo"
                style={{ height: imageSize, width: imageSize }}
            />
            <span>{name}</span>
        </span>
    );
};

export default Logo;
