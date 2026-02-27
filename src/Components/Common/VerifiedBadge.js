// src/components/Common/VerifiedBadge.js
import { BadgeCheck } from "lucide-react";

const VerifiedBadge = ({ show, size = 4 }) =>
  show ? (
    <BadgeCheck className={`inline text-blue-500 h-${size} w-${size}`} />
  ) : null;

export default VerifiedBadge;
