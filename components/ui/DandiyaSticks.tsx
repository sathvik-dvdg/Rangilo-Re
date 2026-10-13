/**
 * A single dandiya stick, drawn for cursor size: it ships at 18 px, where one
 * viewBox unit is one CSS pixel. Flat palette fills only: kumkum body, two
 * haldi bands at the grip and a hairline ink edge. The outer edge of the tip
 * is the hotspot at DANDIYA_HOTSPOT; hover and press scale the stick about
 * that point, so the tip never leaves the click point.
 */

export type DandiyaState = 'default' | 'hover' | 'press';

/** Hotspot in viewBox units (0–18), on both axes. */
export const DANDIYA_HOTSPOT = 2;
const VIEWBOX = 18;
/** Degrees from vertical; the tip points up and to the left. */
const TILT = 35;
const SCALE: Record<DandiyaState, number> = { default: 1, hover: 1.15, press: 0.9 };

// Stick geometry along its own axis: 0 is the outer edge of the tip (the
// hotspot), so the fill starts half the 1 px edge stroke further in.
const TOP = 0.5;
const END = 18.2;
const R_TIP = 1.1;
const R_END = 1.6;
const C_TIP = TOP + R_TIP;
const C_END = +(END - R_END).toFixed(2);
const TIP_TO = 4.4;
const BANDS: [number, number][] = [
  [11, 12.2],
  [14.2, 15.4],
];

/** Half-width at a point along the stick; it tapers slightly towards the tip. */
const halfWidth = (at: number) => +(R_TIP + ((at - C_TIP) / (C_END - C_TIP)) * (R_END - R_TIP)).toFixed(2);
const slice = (from: number, to: number) =>
  `M${-halfWidth(from)} ${from}L${halfWidth(from)} ${from}L${halfWidth(to)} ${to}L${-halfWidth(to)} ${to}Z`;

const OUTLINE = `M${-R_TIP} ${C_TIP}A${R_TIP} ${R_TIP} 0 0 1 ${R_TIP} ${C_TIP}L${R_END} ${C_END}A${R_END} ${R_END} 0 0 1 ${-R_END} ${C_END}Z`;
const TIP = `M${-R_TIP} ${C_TIP}A${R_TIP} ${R_TIP} 0 0 1 ${R_TIP} ${C_TIP}L${halfWidth(TIP_TO)} ${TIP_TO}L${-halfWidth(TIP_TO)} ${TIP_TO}Z`;

export function DandiyaSticks({ size, state = 'default', animate = true }: { size: number; state?: DandiyaState; animate?: boolean }) {
  const transition = animate ? 'transform 140ms ease-out, fill 140ms ease-out' : 'none';
  return (
    <svg viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} width={size} height={size} aria-hidden focusable="false" style={{ display: 'block', overflow: 'visible' }}>
      <g
        style={{
          transform: `scale(${SCALE[state]})`,
          transformBox: 'view-box',
          transformOrigin: `${DANDIYA_HOTSPOT}px ${DANDIYA_HOTSPOT}px`,
          transition,
        }}
      >
        <g transform={`translate(${DANDIYA_HOTSPOT} ${DANDIYA_HOTSPOT}) rotate(${-TILT})`}>
          <path d={OUTLINE} className="fill-kumkum" />
          {/* The tip lights up on hover and stays lit through the press. */}
          <path d={TIP} className={state === 'default' ? 'fill-kumkum' : 'fill-haldi'} style={{ transition }} />
          {BANDS.map(([from, to]) => (
            <path key={from} d={slice(from, to)} className="fill-haldi" />
          ))}
          {/* One hairline edge instead of a halo: it separates the stick from paper and kumkum surfaces. */}
          <path d={OUTLINE} className="fill-none stroke-ink/60" strokeWidth={1} />
        </g>
      </g>
    </svg>
  );
}

// Spark ticks fan out from the tip, away from the stick: [degrees off the
// stick's axis, start, end] in viewBox units from the hotspot.
const SPARKS: [number, number, number][] = [
  [-80, 3.2, 5.6],
  [-28, 3.4, 6.6],
  [28, 3.4, 6.6],
  [80, 3.2, 5.6],
];

/**
 * The strike spark, drawn in the same box as the stick so the two overlay
 * exactly. Static artwork: the caller animates it.
 */
export function DandiyaSpark({ size }: { size: number }) {
  return (
    <svg viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} width={size} height={size} aria-hidden focusable="false" style={{ display: 'block', overflow: 'visible' }}>
      <g transform={`translate(${DANDIYA_HOTSPOT} ${DANDIYA_HOTSPOT}) rotate(${-TILT})`} strokeLinecap="round">
        {SPARKS.map(([angle, from, to]) => {
          const rad = (angle * Math.PI) / 180;
          const at = (r: number) => ({ x: +(r * Math.sin(rad)).toFixed(2), y: +(-r * Math.cos(rad)).toFixed(2) });
          const a = at(from);
          const b = at(to);
          return (
            <g key={angle}>
              {/* Same ink edge as the stick, so haldi ticks hold up on paper and haldi surfaces. */}
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="stroke-ink/60" strokeWidth={2.4} />
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="stroke-haldi" strokeWidth={1.2} />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/** Hotspot offset in CSS px for a given rendered size. */
export const dandiyaHotspotPx = (size: number) => (DANDIYA_HOTSPOT / VIEWBOX) * size;
