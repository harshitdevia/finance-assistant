import React from 'react';
import { useTheme } from '../context/ThemeContext';

/**
 * AnimatedBackground — Global background layer
 *
 * Flat navy (dark) / slate (light) base with a faint grid texture and
 * edge vignettes — no animation, no glow. Placed once in App.jsx.
 */
export default function AnimatedBackground() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 pointer-events-none select-none ${
        isDark ? 'bg-animated-dark' : 'bg-animated-light'
      }`}
      style={{ zIndex: 0 }}
    >
      {/* Grid lines overlay */}
      <div className={`absolute inset-0 ${isDark ? 'bg-grid-dark' : 'bg-grid-light'}`} />

      {/* Top edge vignette */}
      <div className={`absolute inset-x-0 top-0 h-32 pointer-events-none ${isDark ? 'vignette-dark-top' : 'vignette-light-top'}`} />
      {/* Bottom edge vignette */}
      <div className={`absolute inset-x-0 bottom-0 h-32 pointer-events-none ${isDark ? 'vignette-dark-bottom' : 'vignette-light-bottom'}`} />
    </div>
  );
}
