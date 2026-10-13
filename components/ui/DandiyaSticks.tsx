/**
 * Two crossed dandiya sticks, drawn for small sizes (the cursor ships at
 * 20 px). The crimson-led stick points: its gold tip is the hotspot at
 * DANDIYA_HOTSPOT. Only the emerald-led stick moves: it swings open on
 * hover and strikes the crimson one on press.
 */

export type DandiyaState = 'default' | 'hover' | 'press';

/** Hotspot in viewBox units (0–56). */
export const DANDIYA_HOTSPOT = 3;
const VIEWBOX = 56;
/** Where the sticks cross; the emerald stick pivots here. */
const CROSS = 25.7;
const SWING: Record<DandiyaState, number> = { default: 0, hover: 12, press: -8 };

const CRIMSON = '#B23A2E';
const EMERALD = '#1D6A4C';
const GOLD = '#D8A23A';
const INK = '#1A1410';
const PAPER = '#F3EADB';

// [from, to, width] along a stick, 0 = tip, 60 = handle end. Bands are wide
// enough to survive at 20 px; the dotted motifs and tassels of the large
// artwork are left out because they render below a pixel.
const WRAPS: [number, number, number][] = [
  [2, 16, 4.8],
  [16, 18, 5.2],
  [18, 30.4, 5.2],
  [30.4, 32.4, 5.6],
  [32.4, 44.6, 5.5],
  [44.6, 46.6, 5.9],
  [46.6, 57.6, 5.8],
];

function Stick({ main }: { main: string }) {
  const other = main === CRIMSON ? EMERALD : CRIMSON;
  const colors = [main, GOLD, other, GOLD, main, GOLD, other];
  return (
    <>
      {/* Paper halo and ink rim keep the sticks readable on dark and light sections. */}
      <line y1={1} y2={59} stroke={PAPER} strokeWidth={10.5} strokeLinecap="round" />
      <line y1={1} y2={59} stroke={INK} strokeWidth={7.4} strokeLinecap="round" />
      {WRAPS.map(([from, to, width], i) => (
        <line key={i} y1={from} y2={to} stroke={colors[i]} strokeWidth={width} />
      ))}
      <circle cy={1.9} r={2.6} fill={GOLD} />
      <circle cy={58} r={3} fill={GOLD} />
      <line x1={1.7} y1={3} x2={2.1} y2={57} stroke={INK} strokeOpacity={0.3} strokeWidth={1.3} />
    </>
  );
}

export function DandiyaSticks({ size, state = 'default', animate = true }: { size: number; state?: DandiyaState; animate?: boolean }) {
  const transition = animate ? 'transform 120ms ease-out, opacity 120ms ease-out' : 'none';
  return (
    <svg viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} width={size} height={size} aria-hidden focusable="false" style={{ display: 'block', overflow: 'visible' }}>
      <g
        style={{
          transform: `rotate(${SWING[state]}deg)`,
          transformBox: 'view-box',
          transformOrigin: `${CROSS}px ${CROSS}px`,
          transition,
        }}
      >
        <g transform="translate(47.9 3.5) rotate(45)">
          <Stick main={EMERALD} />
        </g>
      </g>
      <g transform="translate(3.5 3.5) rotate(-45)">
        <Stick main={CRIMSON} />
      </g>
      {/* The "clack": three gold ticks between the raised sticks, shown only on press. */}
      <g stroke={GOLD} strokeWidth={2} strokeLinecap="round" style={{ opacity: state === 'press' ? 1 : 0, transition }}>
        <line x1={25.7} y1={17.2} x2={25.7} y2={12.6} />
        <line x1={30} y1={18.4} x2={32.3} y2={14.4} />
        <line x1={21.4} y1={18.4} x2={19.1} y2={14.4} />
      </g>
    </svg>
  );
}

/** Hotspot offset in CSS px for a given rendered size. */
export const dandiyaHotspotPx = (size: number) => (DANDIYA_HOTSPOT / VIEWBOX) * size;
