import React from 'react';
import { CheckCircleFill } from 'react-bootstrap-icons'; // Optional if you're using Bootstrap Icons

const VerifiedProfileCard = () => {
  return (
    <div className="d-flex align-items-center p-3 bg-white shadow-sm rounded">
      <div className="me-3">
        <CheckCircleFill color="#0d6efd" size={40} />
      </div>
      <div>
        <h5 className="mb-1 text-success">Verified Profile</h5>
        <p className="mb-0 text-muted">Get a blue tick to increase your online trust and authenticity.</p>
      </div>
    </div>
  );
};

export default VerifiedProfileCard;
