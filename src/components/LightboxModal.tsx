/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface LightboxModalProps {
  isOpen: boolean;
  src: string;
  onClose: () => void;
}

export default function LightboxModal({ isOpen, src, onClose }: LightboxModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[1000] bg-black/85 flex items-center justify-center cursor-zoom-out p-4"
      onClick={onClose}
    >
      <button 
        className="fixed top-6 left-6 bg-white/10 hover:bg-white/20 text-white rounded-full w-10 h-10 flex items-center justify-center text-lg cursor-pointer transition-colors"
        aria-label="بستن"
      >
        ✕
      </button>
      <img 
        src={src} 
        alt="" 
        className="max-w-[90vw] max-h-[90vh] rounded-xl object-contain shadow-2xl transition-transform"
      />
    </div>
  );
}
