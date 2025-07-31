import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';

const Confetti: React.FC = () => {
  useEffect(() => {
    const duration = 1 * 1000;
    const animationEnd = Date.now() + duration;
    // A celebratory color palette that matches the app's theme
    const colors = ['#60a5fa', '#5eead4', '#a78bfa', '#fde047', '#f9fafb'];
    
    const defaults = { 
        startVelocity: 30, 
        spread: 360, 
        ticks: 90, 
        zIndex: 99,
        colors: colors
    };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval = window.setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      // since particles fall down, start a bit higher than random
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);

    // Cleanup
    return () => {
        clearInterval(interval);
        // Tell confetti to remove its canvas to prevent memory leaks
        confetti.reset();
    };
  }, []);

  return null; // This component doesn't render anything itself
};

export default Confetti;