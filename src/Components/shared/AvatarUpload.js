// components/shared/AvatarUpload.js
import React, { useState } from 'react';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../../utils/cropImage';
import { toast } from 'react-toastify';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || process.env.REACT_APP_BACKEND_URL;

const AvatarUpload = ({ label, endpoint, onUploadComplete }) => {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [showCropper, setShowCropper] = useState(false);

    const handleFileChange = (e) => {
        const selected = e.target.files[0];
        if (!selected || !selected.type.startsWith('image/')) {
            toast.error("Only image files are allowed");
            return;
        }

        setFile(selected);
        const reader = new FileReader();
        reader.onload = () => {
            setPreview(reader.result);
            setShowCropper(true);
        };
        reader.readAsDataURL(selected);
    };

    const onCropComplete = (_, croppedPixels) => {
        setCroppedAreaPixels(croppedPixels);
    };

    const handleUpload = async () => {
        try {
            const blob = await getCroppedImg(preview, croppedAreaPixels);
            if (!blob) {
                toast.error("Failed to prepare cropped image.");
                return;
            }

            // ✅ Convert blob into proper File object
            const filename = file?.name || 'avatar.jpg';
            const fileFromBlob = new File([blob], filename, { type: 'image/jpeg' });

            const formData = new FormData();
            formData.append('media', fileFromBlob);

            const token = localStorage.getItem('token');
            const res = await fetch(`${SERVER_URL}/api/profile/${endpoint}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData,
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Upload failed");
            }

            const data = await res.json();

            toast.success(`${label} uploaded successfully`);

            // ✅ send the new avatar URL (if endpoint is avatar)
            if (endpoint === "avatar") {
                const avatarUrl = data?.updated?.profileavatar?.URL;
                onUploadComplete?.(avatarUrl);
            } else {
                onUploadComplete?.();
            }
            //      onUploadComplete?.();

            setShowCropper(false);
            setFile(null);
            setPreview(null);
        } catch (err) {
            console.error("Upload error:", err);
            toast.error(err.message || "Upload failed");
        }
    };

    return (
        <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <input type="file" accept="image/*" onChange={handleFileChange} className="input input-bordered w-full" />

            {showCropper && preview && (
                <div className="relative w-full h-64 mt-4">
                    <Cropper
                        image={preview}
                        crop={crop}
                        zoom={zoom}
                        aspect={endpoint === 'cover' ? 3 : 1}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={onCropComplete}
                    />
                    <div className="flex justify-center mt-3 gap-2">
                        <button type="button" className="btn btn-sm btn-outline-primary" onClick={handleUpload}>
                            Upload
                        </button>
                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => {
                            setFile(null);
                            setPreview(null);
                            setShowCropper(false);
                        }}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AvatarUpload;