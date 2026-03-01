import React, { useState } from "react";
import { toast } from "react-toastify";
import { Image, FileText, X, Upload } from "lucide-react";
import apiRequest from "../../utils/apiRequest";

const MAX_SIZE_MB = {
  image: 5,
  video: 100,
  document: 10,
};

const allowedTypes = {
  image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  document: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
};

const getType = (mime) => {
  if (allowedTypes.image.includes(mime)) return "image";
  if (allowedTypes.video.includes(mime)) return "video";
  if (allowedTypes.document.includes(mime)) return "document";
  return "unknown";
};

const UploadInput = ({ chatId, onUpload }) => {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileInputRef = React.useRef(null);

  const validateFile = (file) => {
    const type = getType(file.type);
    const sizeMB = file.size / (1024 * 1024);

    if (type === "unknown") {
      toast.error("Unsupported file type");
      return false;
    }

    if (sizeMB > MAX_SIZE_MB[type]) {
      toast.error(`File too large. Max ${MAX_SIZE_MB[type]}MB for ${type}s.`);
      return false;
    }

    return true;
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !validateFile(file)) return;

    // Show preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(file);
    }

    const formData = new FormData();
    formData.append("chatId", chatId);
    formData.append("media", file);

    try {
      setLoading(true);
      const res = await apiRequest.post("/api/message", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("File uploaded successfully");
      onUpload?.(res.data);
      setPreview(null);
    } catch (err) {
      console.error(err);
      toast.error("Upload failed");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const clearPreview = () => {
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div style={{ 
      background: 'var(--bg-tertiary)', 
      borderRadius: '12px', 
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      {/* Preview Area */}
      {preview && (
        <div style={{ 
          position: 'relative',
          borderRadius: '8px',
          overflow: 'hidden',
          maxWidth: '200px'
        }}>
          <img 
            src={preview} 
            alt="Preview" 
            style={{ 
              width: '100%', 
              height: 'auto',
              display: 'block'
            }}
          />
          <button
            onClick={clearPreview}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              background: 'rgba(0,0,0,0.6)',
              border: 'none',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'white'
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Upload Options */}
      <div style={{ 
        display: 'flex', 
        gap: '8px',
        flexWrap: 'wrap'
      }}>
        <input
          ref={fileInputRef}
          type="file"
          accept={Object.values(allowedTypes).flat().join(",")}
          style={{ display: 'none' }}
          onChange={handleFileChange}
          disabled={loading}
        />
        
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          style={{
            background: 'var(--accent-primary)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.background = 'var(--accent-hover)'}
          onMouseLeave={(e) => e.target.style.background = 'var(--accent-primary)'}
        >
          {loading ? (
            <>
              <Upload size={16} />
              Uploading...
            </>
          ) : (
            <>
              <Image size={16} />
              Photo/Video
            </>
          )}
        </button>

        <button
          onClick={() => {
            fileInputRef.current?.click();
          }}
          disabled={loading}
          style={{
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.background = 'var(--bg-hover)'}
          onMouseLeave={(e) => e.target.style.background = 'var(--bg-primary)'}
        >
          <FileText size={16} />
          Document
        </button>
      </div>

      {loading && (
        <div style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
          fontStyle: 'italic'
        }}>
          Processing upload...
        </div>
      )}
    </div>
  );
};

export default UploadInput;