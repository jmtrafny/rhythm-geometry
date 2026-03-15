import { useMemo, useState } from 'react';
import { rotateHits, intervalVector } from '../lib/rhythmMath';

/**
 * Compute combined hit density across all rings at each master step position
 * Returns array of { angle, density, rings[] } for each position
 */
function computeHitDensity(rings, masterSteps) {
  const density = [];

  for (let i = 0; i < masterSteps; i++) {
    const angle = -Math.PI / 2 + (i / masterSteps) * Math.PI * 2;
    const hitsAtStep = [];

    rings.forEach((ring) => {
      if (!ring.visible || ring.muted) return;

      // Map master step to ring step
      const ratio = masterSteps / ring.steps;
      if (i % ratio !== 0) return;

      const ringStep = Math.floor(i / ratio) % ring.steps;
      const rotatedHits = rotateHits(ring.hits, ring.steps, ring.rotation);

      if (rotatedHits.includes(ringStep)) {
        hitsAtStep.push({ ringId: ring.id, color: ring.color });
      }
    });

    density.push({
      masterStep: i,
      angle,
      density: hitsAtStep.length,
      rings: hitsAtStep,
    });
  }

  return density;
}

/**
 * Compute combined interval spectrum across all rings
 * Returns frequency of each interval size
 */
function computeIntervalSpectrum(rings) {
  const spectrum = {};
  let maxInterval = 0;

  rings.forEach((ring) => {
    if (!ring.visible || ring.muted) return;

    const rotatedHits = rotateHits(ring.hits, ring.steps, ring.rotation);
    const intervals = intervalVector(ring.steps, rotatedHits);

    intervals.forEach((interval) => {
      spectrum[interval] = (spectrum[interval] || 0) + 1;
      maxInterval = Math.max(maxInterval, interval);
    });
  });

  return { spectrum, maxInterval };
}

// Color values for rendering
const COLOR_VALUES = {
  slate: "#64748b",
  blue: "#3b82f6",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  purple: "#a855f7",
};

/**
 * Radial Amplitude Wave - circular waveform showing hit density
 */
function RadialWave({ rings, masterSteps, size = 120, playhead = -1 }) {
  const cx = size / 2;
  const cy = size / 2;
  const baseRadius = size * 0.25;
  const maxAmplitude = size * 0.18;

  const density = useMemo(
    () => computeHitDensity(rings, masterSteps),
    [rings, masterSteps]
  );

  const maxDensity = useMemo(
    () => Math.max(1, ...density.map((d) => d.density)),
    [density]
  );

  // Generate smooth wave path
  const wavePath = useMemo(() => {
    if (density.length === 0) return '';

    const points = density.map((d) => {
      const amplitude = (d.density / maxDensity) * maxAmplitude;
      const r = baseRadius + amplitude;
      return {
        x: cx + Math.cos(d.angle) * r,
        y: cy + Math.sin(d.angle) * r,
        density: d.density,
      };
    });

    // Create smooth closed path using quadratic curves
    let path = `M ${points[0].x} ${points[0].y}`;

    for (let i = 0; i < points.length; i++) {
      const curr = points[i];
      const next = points[(i + 1) % points.length];
      const midX = (curr.x + next.x) / 2;
      const midY = (curr.y + next.y) / 2;
      path += ` Q ${curr.x} ${curr.y} ${midX} ${midY}`;
    }

    path += ' Z';
    return path;
  }, [density, maxDensity, cx, cy, baseRadius, maxAmplitude]);

  // Playhead position
  const playheadAngle = playhead >= 0
    ? -Math.PI / 2 + (playhead / masterSteps) * Math.PI * 2
    : null;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Base circle */}
      <circle
        cx={cx}
        cy={cy}
        r={baseRadius}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth={1}
      />

      {/* Wave fill */}
      <path
        d={wavePath}
        fill="rgba(59, 130, 246, 0.15)"
        stroke="#3b82f6"
        strokeWidth={2}
      />

      {/* Hit points with color coding */}
      {density.map((d, i) => {
        if (d.density === 0) return null;
        const amplitude = (d.density / maxDensity) * maxAmplitude;
        const r = baseRadius + amplitude;
        const x = cx + Math.cos(d.angle) * r;
        const y = cy + Math.sin(d.angle) * r;

        // Use first ring's color or blend
        const color = d.rings[0]
          ? COLOR_VALUES[d.rings[0].color] || '#3b82f6'
          : '#3b82f6';

        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={2 + d.density * 1.5}
            fill={color}
            opacity={0.8}
          />
        );
      })}

      {/* Playhead line */}
      {playheadAngle !== null && (
        <line
          x1={cx}
          y1={cy}
          x2={cx + Math.cos(playheadAngle) * (baseRadius + maxAmplitude + 5)}
          y2={cy + Math.sin(playheadAngle) * (baseRadius + maxAmplitude + 5)}
          stroke="#f43f5e"
          strokeWidth={2}
          opacity={0.7}
        />
      )}
    </svg>
  );
}

/**
 * Interval Spectrum - bar chart showing interval distribution (the rhythm's "DNA")
 */
function IntervalSpectrum({ rings, size = 120 }) {
  const { spectrum, maxInterval } = useMemo(
    () => computeIntervalSpectrum(rings),
    [rings]
  );

  const maxCount = useMemo(
    () => Math.max(1, ...Object.values(spectrum)),
    [spectrum]
  );

  const barWidth = size / Math.max(maxInterval + 1, 8);
  const maxBarHeight = size * 0.7;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Baseline */}
      <line
        x1={0}
        y1={size - 10}
        x2={size}
        y2={size - 10}
        stroke="#e2e8f0"
        strokeWidth={1}
      />

      {/* Interval bars */}
      {Array.from({ length: maxInterval + 1 }, (_, i) => {
        const count = spectrum[i] || 0;
        const height = (count / maxCount) * maxBarHeight;
        const x = i * barWidth + barWidth * 0.1;
        const width = barWidth * 0.8;

        // Color intensity based on interval commonality
        const opacity = 0.3 + (count / maxCount) * 0.7;

        return (
          <g key={i}>
            <rect
              x={x}
              y={size - 10 - height}
              width={width}
              height={height}
              fill="#10b981"
              opacity={opacity}
              rx={2}
            />
            {i > 0 && (
              <text
                x={x + width / 2}
                y={size - 2}
                textAnchor="middle"
                className="fill-slate-400"
                style={{ fontSize: '8px' }}
              >
                {i}
              </text>
            )}
          </g>
        );
      })}

      {/* Label */}
      <text
        x={size / 2}
        y={12}
        textAnchor="middle"
        className="fill-slate-500"
        style={{ fontSize: '9px', fontWeight: 500 }}
      >
        Intervals
      </text>
    </svg>
  );
}

/**
 * Phase Spiral - shows rhythm unfolding as an outward spiral
 */
function PhaseSpiral({ rings, masterSteps, size = 120 }) {
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size * 0.42;
  const minRadius = size * 0.08;

  const density = useMemo(
    () => computeHitDensity(rings, masterSteps),
    [rings, masterSteps]
  );

  // Generate spiral path with amplitude modulation
  const spiralPoints = useMemo(() => {
    const points = [];
    const turns = 2; // Number of spiral rotations
    const totalPoints = masterSteps * turns;

    for (let i = 0; i <= totalPoints; i++) {
      const t = i / totalPoints;
      const angle = -Math.PI / 2 + t * Math.PI * 2 * turns;
      const baseR = minRadius + (maxRadius - minRadius) * t;

      // Find density at this angular position
      const masterStep = i % masterSteps;
      const d = density[masterStep] || { density: 0 };
      const amplitude = d.density * 3;

      const r = baseR + amplitude;
      points.push({
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        density: d.density,
        masterStep,
      });
    }

    return points;
  }, [density, masterSteps, cx, cy, maxRadius, minRadius]);

  const spiralPath = useMemo(() => {
    if (spiralPoints.length < 2) return '';
    return spiralPoints
      .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
      .join(' ');
  }, [spiralPoints]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Spiral path */}
      <path
        d={spiralPath}
        fill="none"
        stroke="#a855f7"
        strokeWidth={1.5}
        opacity={0.6}
      />

      {/* Hit markers on spiral */}
      {spiralPoints.map((p, i) => {
        if (p.density === 0) return null;
        return (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={1.5 + p.density}
            fill="#a855f7"
            opacity={0.8}
          />
        );
      })}

      {/* Center dot */}
      <circle cx={cx} cy={cy} r={3} fill="#e2e8f0" />
    </svg>
  );
}

/**
 * Binary Ring - compact circular binary representation
 */
function BinaryRing({ rings, masterSteps, size = 120 }) {
  const cx = size / 2;
  const cy = size / 2;

  const density = useMemo(
    () => computeHitDensity(rings, masterSteps),
    [rings, masterSteps]
  );

  const maxDensity = useMemo(
    () => Math.max(1, ...density.map((d) => d.density)),
    [density]
  );

  // Draw concentric arcs for each step
  const arcWidth = (size * 0.35) / Math.max(maxDensity, 3);
  const baseRadius = size * 0.15;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {density.map((d, i) => {
        const startAngle = -Math.PI / 2 + (i / masterSteps) * Math.PI * 2;
        const endAngle = -Math.PI / 2 + ((i + 0.8) / masterSteps) * Math.PI * 2;

        // Draw stacked arcs for density
        return Array.from({ length: d.density }, (_, layer) => {
          const r = baseRadius + layer * arcWidth;
          const color = d.rings[layer]
            ? COLOR_VALUES[d.rings[layer].color]
            : '#64748b';

          const x1 = cx + Math.cos(startAngle) * r;
          const y1 = cy + Math.sin(startAngle) * r;
          const x2 = cx + Math.cos(endAngle) * r;
          const y2 = cy + Math.sin(endAngle) * r;

          return (
            <path
              key={`${i}-${layer}`}
              d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
              fill="none"
              stroke={color}
              strokeWidth={arcWidth * 0.8}
              strokeLinecap="round"
            />
          );
        });
      })}

      {/* Center label */}
      <text
        x={cx}
        y={cy + 3}
        textAnchor="middle"
        className="fill-slate-400"
        style={{ fontSize: '10px', fontWeight: 600 }}
      >
        {masterSteps}
      </text>
    </svg>
  );
}

/**
 * Clave Pattern - binary rhythm code visualization
 */
function ClavePattern({ rings, masterSteps, size = 120, playhead = -1 }) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.4;

  const activeRings = rings.filter(r => r.visible && !r.muted);

  if (activeRings.length === 0) return null;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Background circle */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth={1}
      />

      {/* Binary pattern for each ring */}
      {activeRings.map((ring, ringIndex) => {
        const rotatedHits = rotateHits(ring.hits, ring.steps, ring.rotation);
        const angleStep = (Math.PI * 2) / masterSteps;
        const ringRadius = radius * (0.9 - ringIndex * 0.15);

        return rotatedHits.map((hit) => {
          // Map ring step to master step
          const ratio = masterSteps / ring.steps;
          const masterStep = Math.floor(hit * ratio) % masterSteps;
          const angle = -Math.PI / 2 + masterStep * angleStep;
          const x = cx + Math.cos(angle) * ringRadius;
          const y = cy + Math.sin(angle) * ringRadius;

          return (
            <circle
              key={`${ring.id}-${hit}`}
              cx={x}
              cy={y}
              r={3}
              fill={COLOR_VALUES[ring.color] || '#3b82f6'}
              opacity={0.8}
            />
          );
        });
      })}

      {/* Playhead */}
      {playhead >= 0 && (
        <line
          x1={cx}
          y1={cy}
          x2={cx + Math.cos(-Math.PI / 2 + playhead * (Math.PI * 2) / masterSteps) * radius}
          y2={cy + Math.sin(-Math.PI / 2 + playhead * (Math.PI * 2) / masterSteps) * radius}
          stroke="#f43f5e"
          strokeWidth={2}
          opacity={0.7}
        />
      )}

      {/* Center label */}
      <text
        x={cx}
        y={cy + 4}
        textAnchor="middle"
        className="fill-slate-600"
        style={{ fontSize: '10px', fontWeight: 'bold' }}
      >
        CLAVE
      </text>
    </svg>
  );
}

// Visualization modes for carousel
const VISUALIZATIONS = [
  { id: 'rings', name: 'Rings', description: 'Concentric rhythm rings' },
  { id: 'wave', name: 'Amplitude', description: 'Hit density as radial wave' },
  { id: 'spectrum', name: 'Spectrum', description: 'Interval distribution' },
  { id: 'spiral', name: 'Spiral', description: 'Pattern unfolding over time' },
  { id: 'binary', name: 'Density', description: 'Stacked hit positions' },
  { id: 'clave', name: 'Clave', description: 'Binary rhythm code' },
];

/**
 * Main RhythmFingerprint component with multiple visualization modes
 */
export default function RhythmFingerprint({
  rings,
  masterSteps,
  playhead = -1,
  mode = 'carousel', // 'wave', 'spectrum', 'spiral', 'binary', 'all', 'carousel'
  size = 120,
  children, // Optional: render prop or element for the main rings visualization
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);

  const activeRings = useMemo(
    () => rings.filter((r) => r.visible && !r.muted),
    [rings]
  );

  // Touch gesture handlers
  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e) => {
    if (!touchStartX || !touchStartY) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const minSwipeDistance = 50;

    // Horizontal swipe detection (prioritize over vertical)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
      if (deltaX > 0) {
        // Swipe right - go to previous
        goPrev();
      } else {
        // Swipe left - go to next
        goNext();
      }
    }

    setTouchStartX(0);
    setTouchStartY(0);
  };

  const goNext = () => {
    setCurrentIndex((i) => (i + 1) % VISUALIZATIONS.length);
  };

  const goPrev = () => {
    setCurrentIndex((i) => (i - 1 + VISUALIZATIONS.length) % VISUALIZATIONS.length);
  };

  if (activeRings.length === 0) {
    return (
      <div className="text-center text-slate-400 text-sm py-4">
        No active rings
      </div>
    );
  }

  // Single visualization modes
  if (mode === 'wave') {
    return <RadialWave rings={rings} masterSteps={masterSteps} size={size} playhead={playhead} />;
  }
  if (mode === 'spectrum') {
    return <IntervalSpectrum rings={rings} size={size} />;
  }
  if (mode === 'spiral') {
    return <PhaseSpiral rings={rings} masterSteps={masterSteps} size={size} playhead={playhead} />;
  }
  if (mode === 'binary') {
    return <BinaryRing rings={rings} masterSteps={masterSteps} size={size} />;
  }
  if (mode === 'clave') {
    return <ClavePattern rings={rings} masterSteps={masterSteps} size={size} playhead={playhead} />;
  }

  // Grid mode - show all visualizations
  if (mode === 'all') {
    return (
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col items-center">
          <RadialWave rings={rings} masterSteps={masterSteps} size={size} playhead={playhead} />
          <span className="text-xs text-slate-400 mt-1">Amplitude</span>
        </div>
        <div className="flex flex-col items-center">
          <IntervalSpectrum rings={rings} size={size} />
          <span className="text-xs text-slate-400 mt-1">Spectrum</span>
        </div>
        <div className="flex flex-col items-center">
          <PhaseSpiral rings={rings} masterSteps={masterSteps} size={size} playhead={playhead} />
          <span className="text-xs text-slate-400 mt-1">Spiral</span>
        </div>
        <div className="flex flex-col items-center">
          <BinaryRing rings={rings} masterSteps={masterSteps} size={size} />
          <span className="text-xs text-slate-400 mt-1">Density</span>
        </div>
        <div className="flex flex-col items-center">
          <ClavePattern rings={rings} masterSteps={masterSteps} size={size} playhead={playhead} />
          <span className="text-xs text-slate-400 mt-1">Clave</span>
        </div>
      </div>
    );
  }

  // Carousel mode (default)
  const current = VISUALIZATIONS[currentIndex];

  const renderVisualization = () => {
    switch (current.id) {
      case 'rings':
        return children || null;
      case 'wave':
        return <RadialWave rings={rings} masterSteps={masterSteps} size={carouselSize} playhead={playhead} />;
      case 'spectrum':
        return <IntervalSpectrum rings={rings} size={carouselSize} />;
      case 'spiral':
        return <PhaseSpiral rings={rings} masterSteps={masterSteps} size={carouselSize} playhead={playhead} />;
      case 'binary':
        return <BinaryRing rings={rings} masterSteps={masterSteps} size={carouselSize} />;
      case 'clave':
        return <ClavePattern rings={rings} masterSteps={masterSteps} size={carouselSize} playhead={playhead} />;
      default:
        return null;
    }
  };

  const carouselSize = size * 1.8; // Larger size for single view
  const containerMinHeight = carouselSize + 120; // Keep controls anchored

  return (
    <div 
      className="flex flex-col items-center"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: 'pan-y pinch-zoom', minHeight: containerMinHeight }}
    >
      {/* Visualization */}
      <div className="flex justify-center mb-4" style={{ minHeight: carouselSize, height: carouselSize, alignItems: 'center' }}>
        {renderVisualization()}
      </div>

      {/* Navigation controls */}
      <div className="flex items-center justify-center gap-4 w-full max-w-md">
        <button
          onClick={goPrev}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 hover:bg-white hover:border-slate-300 text-slate-600 hover:text-slate-800 transition-colors"
          title="Previous visualization"
        >
          <svg width="16" height="16" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M8 2L4 6L8 10" />
          </svg>
          <span className="text-sm font-medium">Prev</span>
        </button>

        <div className="text-center min-w-0 flex-1">
          <div className="text-lg font-semibold text-slate-700">{current.name}</div>
          <div className="text-sm text-slate-500">{current.description}</div>
        </div>

        <button
          onClick={goNext}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 hover:bg-white hover:border-slate-300 text-slate-600 hover:text-slate-800 transition-colors"
          title="Next visualization"
        >
          <span className="text-sm font-medium">Next</span>
          <svg width="16" height="16" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 2L8 6L4 10" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export { RadialWave, IntervalSpectrum, PhaseSpiral, BinaryRing };
