import React from 'react';

interface CorelyLogoProps {
  className?: string;
}

export default function CorelyLogo({ className = 'w-6 h-6' }: CorelyLogoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <rect x="3" y="3" width="7.92" height="5.72" rx="1.6" fill="currentColor" />
      <rect x="3" y="10.92" width="7.92" height="10.08" rx="1.6" fill="currentColor" />
      <rect x="13.08" y="3" width="7.92" height="10.08" rx="1.6" fill="currentColor" />
      <rect x="13.08" y="15.28" width="7.92" height="5.72" rx="1.6" fill="currentColor" />
    </svg>
  );
}
