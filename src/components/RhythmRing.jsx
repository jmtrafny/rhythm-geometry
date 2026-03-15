import { useMemo } from 'react';
import { generateRingPoints, pointsToPolygon } from '../lib/rhythmGeometry';
import { rotateHits } from '../lib/rhythmMath';

// Color schemes for different rings
const COLOR_SCHEMES = {
  slate: {
    ring: 'text-slate-300',
    polygon: 'text-slate-700',
    active: 'text-slate-900',
    inactive: 'text-slate-300',
    playhead: 'text-slate-400',
    label: 'fill-slate-500',
  },
  blue: {
    ring: 'text-blue-300',
    polygon: 'text-blue-600',
    active: 'text-blue-700',
    inactive: 'text-blue-200',
    playhead: 'text-blue-400',
    label: 'fill-blue-500',
  },
  emerald: {
    ring: 'text-emerald-300',
    polygon: 'text-emerald-600',
    active: 'text-emerald-700',
    inactive: 'text-emerald-200',
    playhead: 'text-emerald-400',
    label: 'fill-emerald-500',
  },
  amber: {
    ring: 'text-amber-300',
    polygon: 'text-amber-600',
    active: 'text-amber-700',
    inactive: 'text-amber-200',
    playhead: 'text-amber-400',
    label: 'fill-amber-500',
  },
  rose: {
    ring: 'text-rose-300',
    polygon: 'text-rose-600',
    active: 'text-rose-700',
    inactive: 'text-rose-200',
    playhead: 'text-rose-400',
    label: 'fill-rose-500',
  },
  purple: {
    ring: 'text-purple-300',
    polygon: 'text-purple-600',
    active: 'text-purple-700',
    inactive: 'text-purple-200',
    playhead: 'text-purple-400',
    label: 'fill-purple-500',
  },
};

/**
 * A single rhythm ring visualization
 *
 * @prop {number} steps - Number of steps in the ring
 * @prop {number[]} hits - Array of hit positions (unrotated)
 * @prop {number} rotation - Rotation offset
 * @prop {number} radius - Ring radius
 * @prop {number} cx - Center X coordinate
 * @prop {number} cy - Center Y coordinate
 * @prop {number} playhead - Current step being played (-1 if not playing)
 * @prop {function} onToggleStep - Callback when step is clicked
 * @prop {function} onSelectRing - Callback when ring is tapped/clicked (for selection)
 * @prop {string} color - Color scheme name
 * @prop {boolean} showLabels - Whether to show step numbers
 * @prop {boolean} showSpokes - Whether to show spoke lines to center
 * @prop {boolean} muted - Visual indication if ring is muted
 * @prop {boolean} selected - Whether this ring is currently selected
 * @prop {string} id - Unique ring identifier
 */
export default function RhythmRing({
  steps,
  hits,
  rotation = 0,
  radius,
  cx,
  cy,
  playhead = -1,
  onToggleStep,
  onSelectRing,
  color = 'slate',
  showLabels = false,
  showSpokes = false,
  muted = false,
  selected = false,
  id,
}) {
  const rotatedHits = useMemo(
    () => rotateHits(hits, steps, rotation),
    [hits, steps, rotation]
  );

  const hitSet = useMemo(() => new Set(rotatedHits), [rotatedHits]);

  const points = useMemo(
    () => generateRingPoints(steps, hitSet, playhead, cx, cy, radius),
    [steps, hitSet, playhead, cx, cy, radius]
  );

  const polygon = useMemo(() => pointsToPolygon(points), [points]);

  const colors = COLOR_SCHEMES[color] || COLOR_SCHEMES.slate;
  const opacity = muted ? 0.35 : 1;

  return (
    <g id={id} style={{ opacity }}>
      {/* Ring circle */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke="currentColor"
        className={colors.ring}
        strokeWidth={selected ? 3 : 2}
        onClick={onSelectRing}
        style={{ cursor: onSelectRing ? 'pointer' : 'default' }}
      />

      {/* Spokes (optional - usually only for outermost ring) */}
      {showSpokes &&
        points.map((p) => (
          <line
            key={`spoke-${p.i}`}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke="currentColor"
            className={p.playhead ? colors.playhead : 'text-slate-200'}
            strokeWidth={p.playhead ? 2 : 1}
          />
        ))}

      {/* Polygon connecting active hits */}
      {polygon && (
        <polygon
          points={polygon}
          fill="none"
          stroke="currentColor"
          className={colors.polygon}
          strokeWidth={3}
        />
      )}

      {/* Step points */}
      {points.map((p) => (
        <g key={p.i}>
          {/* Playhead indicator */}
          {p.playhead && (
            <circle
              cx={p.x}
              cy={p.y}
              r={14}
              fill="none"
              stroke="currentColor"
              className={colors.playhead}
              strokeWidth={2}
            />
          )}

          {/* Step dot */}
          <circle
            cx={p.x}
            cy={p.y}
            r={p.active ? 8 : 5}
            fill="currentColor"
            className={p.active ? colors.active : colors.inactive}
            onClick={() => onToggleStep?.(p.i)}
            style={{ cursor: onToggleStep ? 'pointer' : 'default' }}
          />

          {/* Step label */}
          {showLabels && (
            <text
              x={p.x}
              y={p.y - 16}
              textAnchor="middle"
              className={`${colors.label} text-[10px]`}
            >
              {p.i + 1}
            </text>
          )}
        </g>
      ))}
    </g>
  );
}

export { COLOR_SCHEMES };
