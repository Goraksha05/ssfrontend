import React from "react";

// Simple className combiner
function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function Skeleton({ className, ...props }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-gray-200", className)} {...props} />
  );
}

export { Skeleton };
