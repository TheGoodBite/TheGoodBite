import React from "react";

export function BroccoliBiteLogo({ className = "w-8 h-8 text-black dark:text-white" }: { className?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 100 100" 
      fill="currentColor" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Stem */}
      <path d="M40 56C38 65 37 75 42 85C45 91 55 91 58 85C63 75 62 65 60 56Z" fill="currentColor" />
      <path d="M42 56L34 68M58 56L66 68" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      {/* Broccoli Florets with Bite Mark on Right */}
      <path 
        fillRule="evenodd" 
        clipRule="evenodd" 
        d="M50 18C41.7 18 34.6 22.5 31 29.2C27.5 28.1 23.6 29 20.8 31.8C16.8 35.8 16.8 42.2 20.8 46.2C19.6 49.5 20.2 53.3 22.5 56C25.8 59.8 31.2 60.8 35.6 58.7C40 60 45 60.5 50 60.5C54.5 60.5 59.2 60.1 63.5 58.9C67.8 60.8 73 59.9 76.3 56.4C77.5 55 78.3 53.3 78.6 51.5C76 51 73.8 49.5 72.5 47C70.5 43.1 71.5 38.3 75 35.5C73.8 30.5 69.8 26.8 64.7 26.2C61.3 21.2 55.9 18 50 18Z" 
        fill="currentColor" 
      />
    </svg>
  );
}
