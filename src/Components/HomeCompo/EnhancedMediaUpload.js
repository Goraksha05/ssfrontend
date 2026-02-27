// EnhancedMediaUpload.js (Production-Ready & Optimized)
import React, { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../../utils/cropImage';
import Lightbox from 'react-image-lightbox';
import 'react-image-lightbox/style.css';
import { toast } from 'react-toastify';

const EnhancedMediaUpload = forwardRef(({ onFilesPrepared, postContent }, ref) => {
  const [mediaFiles, setMediaFiles] = useState([]); // { file, preview }
  const [croppingIndex, setCroppingIndex] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const inputRef = useRef();

  const maxSize = 500 * 1024 * 1024; // 500MB

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files);

    const filtered = newFiles.filter(file => {
      if (file.size > maxSize) {
        toast.error(`${file.name} exceeds 500MB limit.`);
        return false;
      }
      return true;
    });

    const withPreviews = filtered.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));

    setMediaFiles(prev => [...prev, ...withPreviews]);
  };

  const handleRemoveFile = (index) => {
    const updated = [...mediaFiles];
    URL.revokeObjectURL(updated[index].preview);
    updated.splice(index, 1);
    setMediaFiles(updated);
  };

  const handleReorder = (index, direction) => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= mediaFiles.length) return;
    const updated = [...mediaFiles];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    setMediaFiles(updated);
  };

  const handleCropComplete = (_, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  };

  const applyCrop = async () => {
    try {
      const { file, preview } = mediaFiles[croppingIndex];
      const croppedBlob = await getCroppedImg(preview, croppedAreaPixels);
      const croppedFile = new File([croppedBlob], `cropped-${file.name}`, { type: 'image/jpeg' });
      const croppedPreview = URL.createObjectURL(croppedFile);
      URL.revokeObjectURL(preview);

      const updated = [...mediaFiles];
      updated[croppingIndex] = { file: croppedFile, preview: croppedPreview };
      setMediaFiles(updated);
      setCroppingIndex(null);
    } catch (err) {
      console.error('Crop error:', err);
      toast.error('Failed to crop image.');
    }
  };

  const resetForm = () => {
    mediaFiles.forEach(media => URL.revokeObjectURL(media.preview));
    setMediaFiles([]);
    setCroppingIndex(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setLightboxIndex(-1);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleSubmit = () => {
    if (mediaFiles.length === 0 && !postContent?.trim()) {
      toast.warning("⚠️ Please type at least 1 character or emoji in the text");
      return;
    }

    const filesOnly = mediaFiles.map(media => media.file);
    onFilesPrepared(filesOnly);
    resetForm();
  };


  // ✅ Expose `handleSubmit` to parent (Home.js)
  useImperativeHandle(ref, () => ({
    submitMediaPost: handleSubmit,
    hasMedia: () => mediaFiles.length > 0,
    openFilePicker: () => inputRef.current && inputRef.current.click(),
  }));

  return (
    <div>
      <input
        type="file"
        accept="image/*,video/*"
        multiple
        ref={inputRef}
        onChange={handleFileChange}
        style={{ display: "none" }}   // 👈 hidden input
      />

      <div className="d-flex flex-wrap gap-2">
        {mediaFiles.map((media, index) => {
          const { file, preview } = media;
          const isImage = file.type.startsWith('image');

          return (
            <div key={index} className="position-relative border p-1 rounded" style={{ width: '110px' }}>
              <div className="mb-1 text-center text-truncate small">{file.name}</div>
              {isImage ? (
                <img
                  src={preview}
                  alt="preview"
                  className="img-thumbnail"
                  style={{ width: '100px', height: '100px', objectFit: 'cover', cursor: 'pointer' }}
                  onClick={() => setLightboxIndex(index)}
                />
              ) : (
                <video
                  src={preview}
                  controls
                  className="w-100"
                  style={{ height: '100px', objectFit: 'cover' }}
                />
              )}
              <div className="d-flex justify-content-between mt-1">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => handleRemoveFile(index)}
                >✕</button>
                <div>
                  {isImage && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-warning me-1"
                      onClick={() => setCroppingIndex(index)}
                    >Crop</button>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary me-1"
                    onClick={() => handleReorder(index, 'up')}
                    disabled={index === 0}
                  >↑</button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => handleReorder(index, 'down')}
                    disabled={index === mediaFiles.length - 1}
                  >↓</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* {mediaFiles.length > 0 && (
        <button className="btn btn-primary mt-3" onClick={handleSubmit}>
          Upload Post
        </button>
      )} */}

      {croppingIndex !== null && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Crop Image</h5>
                <button className="btn-close" onClick={() => setCroppingIndex(null)}></button>
              </div>
              <div className="modal-body" style={{ height: '400px', position: 'relative' }}>
                <Cropper
                  image={mediaFiles[croppingIndex].preview}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={handleCropComplete}
                />
              </div>
              <div className="modal-footer">
                <button className="btn btn-success" onClick={applyCrop}>Apply Crop</button>
                <button className="btn btn-secondary" onClick={() => setCroppingIndex(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {lightboxIndex >= 0 && (
        <Lightbox
          mainSrc={mediaFiles[lightboxIndex].preview}
          onCloseRequest={() => setLightboxIndex(-1)}
          nextSrc={mediaFiles[(lightboxIndex + 1) % mediaFiles.length].preview}
          prevSrc={mediaFiles[(lightboxIndex + mediaFiles.length - 1) % mediaFiles.length].preview}
          onMovePrevRequest={() =>
            setLightboxIndex((lightboxIndex + mediaFiles.length - 1) % mediaFiles.length)
          }
          onMoveNextRequest={() =>
            setLightboxIndex((lightboxIndex + 1) % mediaFiles.length)
          }
        />
      )}
    </div>
  );
});

export default EnhancedMediaUpload;
