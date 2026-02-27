// components/ShareModal.js
import React from 'react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const ShareModal = ({ inviteLink, onClose, title = "Share Referral Link" }) => {
    const encodedLink = encodeURIComponent(inviteLink);

    const handleShare = (platform) => {
        try {
            if (platform === 'native') {
                if (navigator.share) {
                    navigator.share({
                        title: 'Join me on this app!',
                        text: 'Here’s the invite link:',
                        url: inviteLink,
                    }).then(() => {
                        toast.success('Shared successfully!');
                        onClose();
                    }).catch(() => toast.error('Share cancelled or failed.'));
                    return;
                } else {
                    toast.warning('Native sharing not supported.');
                    return;
                }
            }

            let shareUrl = '';
            switch (platform) {
                case 'whatsapp':
                    shareUrl = `https://wa.me/?text=${encodedLink}`;
                    break;
                case 'facebook':
                    shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedLink}`;
                    break;
                case 'email':
                    shareUrl = `mailto:?subject=Join%20me%20on%20this%20app&body=${encodedLink}`;
                    break;
                case 'sms':
                    shareUrl = `sms:?body=${encodedLink}`;
                    break;
                case 'clipboard':
                    navigator.clipboard.writeText(inviteLink);
                    toast.success('Link copied to clipboard!');
                    onClose();
                    return;
                case 'instagram':
                    toast.info("Instagram sharing requires app integration.");
                    return;
                default:
                    return;
            }

            if (shareUrl) {
                window.open(shareUrl, '_blank');
                toast.success('Redirecting to share...');
                onClose();
            }
        } catch (err) {
            toast.error('Failed to share.');
        }
    };

    return (
        <div className="modal show fade d-block" tabIndex="-1" role="dialog" style={{ background: 'rgba(0,0,0,0.5)' }}>
            <div className="modal-dialog modal-dialog-centered" role="document">
                <div className="modal-content border-0 shadow-lg rounded-4">
                    <div className="modal-header border-0">
                        <h5 className="modal-title fw-bold">
                            📤 {title}
                        </h5>
                        <button type="button" className="btn-close" aria-label="Close" onClick={onClose}></button>
                    </div>
                    <div className="modal-body text-center">
                        <div className="row g-3">
                            <div className="col-12">
                                <button onClick={() => handleShare('native')} className="btn btn-outline-primary w-100 py-2">
                                    <i className="fas fa-share-alt fa-lg me-2"></i> Native Share
                                </button>
                            </div>

                            <div className="col-4">
                                <button onClick={() => handleShare('whatsapp')} className="btn btn-light w-100 shadow-sm">
                                    <i className="fab fa-whatsapp fa-2x text-success"></i>
                                    <div className="small mt-1">WhatsApp</div>
                                </button>
                            </div>

                            <div className="col-4">
                                <button onClick={() => handleShare('facebook')} className="btn btn-light w-100 shadow-sm">
                                    <i className="fab fa-facebook fa-2x text-primary"></i>
                                    <div className="small mt-1">Facebook</div>
                                </button>
                            </div>

                            <div className="col-4">
                                <button onClick={() => handleShare('email')} className="btn btn-light w-100 shadow-sm">
                                    <i className="fas fa-envelope fa-2x text-warning"></i>
                                    <div className="small mt-1">Email</div>
                                </button>
                            </div>

                            <div className="col-4">
                                <button onClick={() => handleShare('sms')} className="btn btn-light w-100 shadow-sm">
                                    <i className="fas fa-sms fa-2x text-danger"></i>
                                    <div className="small mt-1">SMS</div>
                                </button>
                            </div>

                            <div className="col-4">
                                <button onClick={() => handleShare('clipboard')} className="btn btn-light w-100 shadow-sm">
                                    <i className="fas fa-link fa-2x text-secondary"></i>
                                    <div className="small mt-1">Copy</div>
                                </button>
                            </div>

                            <div className="col-4">
                                <button onClick={() => handleShare('instagram')} className="btn btn-light w-100 shadow-sm">
                                    <i className="fab fa-instagram fa-2x text-danger"></i>
                                    <div className="small mt-1">Instagram</div>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer border-0">
                        <button type="button" className="btn btn-outline-secondary w-100" onClick={onClose}>
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShareModal;
