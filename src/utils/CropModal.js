// src/utils/CropModal.js
import React, { useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import PropTypes from 'prop-types';

const aspectOptions = {
  '1:1': 1,
  '4:3': 4 / 3,
  '16:9': 16 / 9,
};

const CropModal = ({
  image,
  onClose,
  onApply,
  crop,
  setCrop,
  zoom,
  setZoom,
  onCropComplete,
}) => {
  const [aspect, setAspect] = useState(1);

  useEffect(() => {
    document.body.style.overflow = image ? 'hidden' : 'auto';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [image]);

  if (!image) return null;

  return (
    <div className="modal d-block" tabIndex="-1" role="dialog" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Crop Image</h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>

          <div className="modal-body" style={{ height: '400px', position: 'relative' }}>
            <Cropper
              image={image}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          <div className="px-4 py-2">
            <label className="form-label fw-bold">Zoom</label>
            <input
              type="range"
              className="form-range"
              min="1"
              max="3"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </div>

          <div className="px-4 pb-3">
            <label className="form-label fw-bold">Aspect Ratio</label>
            <div className="btn-group w-100">
              {Object.keys(aspectOptions).map((key) => (
                <button
                  key={key}
                  className={`btn btn-outline-primary ${aspect === aspectOptions[key] ? 'active' : ''}`}
                  onClick={() => setAspect(aspectOptions[key])}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>

          <div className="modal-footer">
            <button className="btn btn-success" onClick={() => onApply(aspect)}>
              Apply Crop
            </button>
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

CropModal.propTypes = {
  image: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onApply: PropTypes.func.isRequired,
  crop: PropTypes.object.isRequired,
  setCrop: PropTypes.func.isRequired,
  zoom: PropTypes.number.isRequired,
  setZoom: PropTypes.func.isRequired,
  onCropComplete: PropTypes.func.isRequired,
};

export default CropModal;
