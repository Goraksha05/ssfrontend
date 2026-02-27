import React, { useState } from "react";
import { toast } from "react-toastify";
import apiRequest from "../../utils/apiRequest";

const MAX_SIZE_MB = {
  image: 5,
  video: 100,
  document: 10,
};

const allowedTypes = {
  image: ["image/jpeg", "image/png", "image/webp"],
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

    const formData = new FormData();
    formData.append("chatId", chatId);
    formData.append("media", file);

    try {
      setLoading(true);
      const res = await apiRequest.post("/message", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Upload successful");
      onUpload?.(res.data); // Pass new message object
    } catch (err) {
      console.error(err);
      toast.error("Upload failed");
    } finally {
      setLoading(false);
      e.target.value = ""; // reset file input
    }
  };

  return (
    <div className="relative">
      <label className="btn btn-outline-primary cursor-pointer">
        {loading ? "Uploading..." : "Attach File"}
        <input
          type="file"
          accept={Object.values(allowedTypes).flat().join(",")}
          className="hidden"
          onChange={handleFileChange}
          disabled={loading}
        />
      </label>
    </div>
  );
};

export default UploadInput;
