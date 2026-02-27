import React, { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import getCroppedImg from './CropModal'; // Utility to crop image blob


const aspectRatios = [
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '16:9', value: 16 / 9 },
];

const MultiImageCropUpload = ({ onImagesCropped }) => {
  const [images, setImages] = useState([]);
  const [croppedImages, setCroppedImages] = useState([]);
  const [cropData, setCropData] = useState({ image: null, index: null });
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [aspect, setAspect] = useState(1);

  useEffect(() => {
    document.body.style.overflow = cropData.image ? 'hidden' : 'auto';
    return () => (document.body.style.overflow = 'auto');
  }, [cropData]);

  const onSelectImages = (e) => {
    const files = Array.from(e.target.files);
    const imageUrls = files.map(file => URL.createObjectURL(file));
    setImages(imageUrls);
    setCroppedImages(Array(files.length).fill(null));
    if (imageUrls.length > 0) setCropData({ image: imageUrls[0], index: 0 });
  };

  const onCropComplete = useCallback((_, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const applyCrop = async () => {
    try {
      const croppedImage = await getCroppedImg(cropData.image, croppedAreaPixels);
      const updated = [...croppedImages];
      updated[cropData.index] = croppedImage;
      setCroppedImages(updated);

      // Open next image if exists
      const nextIndex = cropData.index + 1;
      if (nextIndex < images.length) {
        setCropData({ image: images[nextIndex], index: nextIndex });
      } else {
        setCropData({ image: null, index: null });
        if (onImagesCropped) onImagesCropped(updated);
      }
    } catch (err) {
      console.error('Crop failed:', err);
    }
  };

  return (
    <div className="container my-4">
      <h5>Upload & Crop Multiple Images</h5>
      <input type="file" className="form-control mt-3" multiple accept="image/*" onChange={onSelectImages} />

      {/* Modal */}
      {cropData.image && (
        <div className="absolute left-0 top-0 w-full min-h-screen bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 w-[90vw] max-w-lg shadow-lg overflow-auto">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Crop Image {cropData.index + 1} of {images.length}</h5>
                <button type="button" className="btn-close" onClick={() => setCropData({ image: null, index: null })}></button>
              </div>

              <div className="modal-body" style={{ height: '400px', position: 'relative' }}>
                <Cropper
                  image={cropData.image}
                  crop={crop}
                  zoom={zoom}
                  aspect={aspect}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>

              <div className="modal-footer flex-column align-items-stretch">
                <div className="d-flex justify-content-between w-100 align-items-center mb-3">
                  <label className="form-label mb-0">Zoom</label>
                  <input
                    type="range"
                    className="form-range w-75"
                    min={1}
                    max={3}
                    step={0.1}
                    value={zoom}
                    onChange={(e) => setZoom(e.target.value)}
                  />
                </div>

                <div className="btn-group w-100 mb-3">
                  {aspectRatios.map((ratio) => (
                    <button
                      key={ratio.label}
                      className={`btn btn-outline-primary ${aspect === ratio.value ? 'active' : ''}`}
                      onClick={() => setAspect(ratio.value)}
                    >
                      {ratio.label}
                    </button>
                  ))}
                </div>

                <div className="d-flex justify-content-end w-100">
                  <button className="btn btn-secondary me-2" onClick={() => setCropData({ image: null, index: null })}>
                    Cancel
                  </button>
                  <button className="btn btn-success" onClick={applyCrop}>
                    Apply Crop
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview thumbnails */}
      <div className="row mt-4">
        {croppedImages.map((img, idx) => (
          img && (
            <div className="col-6 col-md-3 mb-3" key={idx}>
              <img src={img} alt={`Cropped ${idx}`} className="img-thumbnail" />
            </div>
          )
        ))}
      </div>
    </div>
  );
};

export default MultiImageCropUpload;
