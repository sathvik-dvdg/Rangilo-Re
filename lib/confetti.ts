import confetti from 'canvas-confetti';

/**
 * Fires a grand Navratri / Garba party celebration with party poppers
 * from both corners and a central fireworks starburst in festive colors:
 * Haldi Gold, Kumkum Red, Mehndi Green, Gulal Pink, and Khadi White.
 */
export function fireCelebration() {
  const colors = ['#D8A23A', '#B23A2E', '#7FB069', '#FF7597', '#F3EADB', '#5B85AA'];

  // Left corner popper
  confetti({
    particleCount: 60,
    angle: 60,
    spread: 65,
    origin: { x: 0, y: 0.85 },
    colors,
    startVelocity: 55,
    ticks: 250,
    gravity: 0.9,
    scalar: 1.1,
  });

  // Right corner popper
  confetti({
    particleCount: 60,
    angle: 120,
    spread: 65,
    origin: { x: 1, y: 0.85 },
    colors,
    startVelocity: 55,
    ticks: 250,
    gravity: 0.9,
    scalar: 1.1,
  });

  // Center star & ribbon burst delayed by 250ms
  window.setTimeout(() => {
    confetti({
      particleCount: 90,
      spread: 100,
      origin: { x: 0.5, y: 0.45 },
      colors,
      startVelocity: 40,
      ticks: 300,
      shapes: ['star', 'circle'],
      scalar: 1.25,
    });
  }, 250);

  // Second celebratory shower at 600ms
  window.setTimeout(() => {
    confetti({
      particleCount: 40,
      angle: 70,
      spread: 50,
      origin: { x: 0.15, y: 0.75 },
      colors,
      startVelocity: 45,
    });
    confetti({
      particleCount: 40,
      angle: 110,
      spread: 50,
      origin: { x: 0.85, y: 0.75 },
      colors,
      startVelocity: 45,
    });
  }, 600);
}
