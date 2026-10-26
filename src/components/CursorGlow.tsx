import React, { useEffect, useRef, useState } from 'react';

interface CursorGlowProps {
  containerRef: React.RefObject<HTMLElement | null>;
}

/**
 * Ambient Cursor Glow Component
 * Renders a high-performance, silky smooth ambient light following the cursor.
 * Confined strictly to the main content container and placed behind cards.
 * Active strictly on non-touch devices with fine pointers.
 */
export const CursorGlow: React.FC<CursorGlowProps> = ({ containerRef }) => {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const orbRef = useRef<HTMLDivElement | null>(null);

  // Position relative to container
  const targetPos = useRef({ x: -1000, y: -1000 });
  const currentPos = useRef({ x: -1000, y: -1000 });
  const isHovering = useRef(false);
  const rafId = useRef<number | null>(null);
  const isAnimating = useRef(false);

  useEffect(() => {
    // Check if device supports hover and has a fine pointer (Mouse/Trackpad)
    const mediaQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
    setIsSupported(mediaQuery.matches);

    const handleMediaChange = (e: MediaQueryListEvent) => {
      setIsSupported(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange);
    } else {
      mediaQuery.addListener(handleMediaChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleMediaChange);
      } else {
        mediaQuery.removeListener(handleMediaChange);
      }
    };
  }, []);

  useEffect(() => {
    if (!isSupported) return;

    const container = containerRef.current;
    const orb = orbRef.current;
    if (!container || !orb) return;

    // Linear interpolation loop with low latency (lerp factor ~0.4)
    const animate = () => {
      const dx = targetPos.current.x - currentPos.current.x;
      const dy = targetPos.current.y - currentPos.current.y;

      // Higher Lerp factor (0.4) for immediate yet smooth tracking with minimal delay
      currentPos.current.x += dx * 0.4;
      currentPos.current.y += dy * 0.4;

      if (orb) {
        // Center the 520px glow orb on the cursor coordinates relative to container
        orb.style.transform = `translate3d(${currentPos.current.x - 260}px, ${currentPos.current.y - 260}px, 0)`;
        orb.style.opacity = isHovering.current ? '1' : '0';
      }

      // If difference is greater than 0.1px or still hovering, continue animating; else sleep
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        rafId.current = requestAnimationFrame(animate);
      } else {
        isAnimating.current = false;
      }
    };

    const startAnimation = () => {
      if (!isAnimating.current) {
        isAnimating.current = true;
        rafId.current = requestAnimationFrame(animate);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const relY = e.clientY - rect.top;

      targetPos.current.x = relX;
      targetPos.current.y = relY;
      isHovering.current = true;

      // Snap on initial entry
      if (currentPos.current.x === -1000) {
        currentPos.current.x = relX;
        currentPos.current.y = relY;
      }

      startAnimation();
    };

    const handleMouseEnter = () => {
      isHovering.current = true;
      startAnimation();
    };

    const handleMouseLeave = () => {
      isHovering.current = false;
      startAnimation();
    };

    container.addEventListener('mousemove', handleMouseMove, { passive: true });
    container.addEventListener('mouseenter', handleMouseEnter, { passive: true });
    container.addEventListener('mouseleave', handleMouseLeave, { passive: true });

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, [isSupported, containerRef]);

  if (!isSupported) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none"
      aria-hidden="true"
    >
      <div
        ref={orbRef}
        className="cursor-glow-orb absolute top-0 left-0 w-[520px] h-[520px] rounded-full transition-opacity duration-200 ease-out will-change-transform"
        style={{
          opacity: 0,
        }}
      />
    </div>
  );
};
