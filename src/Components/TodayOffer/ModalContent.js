import React from "react";

/* ─────────────────────────────────────────────
   ModalContent
   Passed as {children} into TodayOfferModal.
   Only renders if you need extra body copy
   beyond the built-in step cards.
   You can leave this empty or remove it from
   the call-site if the steps are enough.
───────────────────────────────────────────── */
const ModalContent = () => {
  return (
    <div className="tom2-extra-note">
      🎉 Don't miss this limited-time offer — start inviting friends and unlock amazing rewards!
    </div>
  );
};

export default ModalContent;