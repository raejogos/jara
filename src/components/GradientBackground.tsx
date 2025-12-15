import { useEffect, useState, useRef } from 'react';

export function GradientBackground() {
  const [scrollY, setScrollY] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      const scrollable = document.querySelector('.overflow-y-auto');
      if (scrollable) {
        setScrollY(scrollable.scrollTop);
      }
    };

    const scrollable = document.querySelector('.overflow-y-auto');
    if (scrollable) {
      scrollable.addEventListener('scroll', handleScroll);
    }

    handleScroll();

    const observer = new MutationObserver(() => {
      const newScrollable = document.querySelector('.overflow-y-auto');
      if (newScrollable && newScrollable !== containerRef.current) {
        containerRef.current?.removeEventListener('scroll', handleScroll);
        newScrollable.addEventListener('scroll', handleScroll);
        containerRef.current = newScrollable as HTMLDivElement;
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      scrollable?.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, []);

  const opacity = Math.max(0, 1 - scrollY / 400);

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    >
      <div
        className="absolute inset-0 transition-transform duration-300 ease-out"
        style={{
          background: `radial-gradient(ellipse 120% 60% at 50% -10%, rgba(100, 80, 160, ${0.35 * opacity}), transparent 60%)`,
          transform: `translateY(${-scrollY * 0.4}px)`,
        }}
      />

      <div
        className="absolute inset-0 transition-transform duration-300 ease-out"
        style={{
          background: `radial-gradient(ellipse 80% 50% at 20% 0%, rgba(160, 80, 120, ${0.2 * opacity}), transparent 50%)`,
          transform: `translateY(${-scrollY * 0.3}px)`,
        }}
      />

      <div
        className="absolute inset-0 transition-transform duration-300 ease-out"
        style={{
          background: `radial-gradient(ellipse 60% 40% at 80% 5%, rgba(80, 100, 180, ${0.15 * opacity}), transparent 45%)`,
          transform: `translateY(${-scrollY * 0.35}px)`,
        }}
      />
    </div>
  );
}
