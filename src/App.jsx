import { useEffect, useMemo, useRef, useState } from "react";
import { RHYTHM_PRESETS } from "./presets";
import {
  gcd,
  rotateHits,
  binaryString,
  intervalVector,
  necklaceForm,
  evennessScore,
  euclideanRhythm,
  lcmArray,
  masterToRingStep,
} from "./lib/rhythmMath";
import { concentricRadius } from "./lib/rhythmGeometry";
import RhythmRing, { COLOR_SCHEMES } from "./components/RhythmRing";
import sampleManager, { playSound, preloadSamples } from "./lib/audioEngine";

const RING_COLORS = Object.keys(COLOR_SCHEMES);
const SOUNDS = ["clave", "bell", "kick", "snare", "rim"];
const BASE_RADIUS = 145;
const RING_GAP = 32;

function createRing(preset, index = 0) {
  return {
    id: `ring-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: preset?.name || "New Ring",
    steps: preset?.steps || 16,
    hits: preset?.hits ? [...preset.hits] : euclideanRhythm(16, 4),
    rotation: 0,
    visible: true,
    muted: false,
    sound: SOUNDS[index % SOUNDS.length],
    color: RING_COLORS[index % RING_COLORS.length],
  };
}

export default function RhythmGeometryPrototype() {
  const presets = RHYTHM_PRESETS;

  // Multi-ring state
  const [rings, setRings] = useState(() => [createRing(presets[0], 0)]);
  const [selectedRingId, setSelectedRingId] = useState(() => rings[0]?.id);

  // Transport state
  const [isPlaying, setIsPlaying] = useState(false);
  const [masterStep, setMasterStep] = useState(0);
  const [bpm, setBpm] = useState(60);

  // Audio state
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [subdivisionClick, setSubdivisionClick] = useState(true);
  const [samplesLoaded, setSamplesLoaded] = useState(false);

  const timerRef = useRef(null);
  const ringsRef = useRef(rings);
  const audioParamsRef = useRef({ audioEnabled, subdivisionClick });

  // Keep refs in sync
  useEffect(() => {
    ringsRef.current = rings;
  }, [rings]);

  useEffect(() => {
    audioParamsRef.current = { audioEnabled, subdivisionClick };
  }, [audioEnabled, subdivisionClick]);

  // Preload samples on mount
  useEffect(() => {
    preloadSamples().then((loaded) => {
      setSamplesLoaded(loaded.length > 0);
    });
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      sampleManager.dispose();
    };
  }, []);

  // Derived state
  const selectedRing = useMemo(
    () => rings.find((r) => r.id === selectedRingId),
    [rings, selectedRingId]
  );

  const activeRings = useMemo(
    () => rings.filter((r) => r.visible && !r.muted),
    [rings]
  );

  const masterSteps = useMemo(() => {
    const stepCounts = activeRings.map((r) => r.steps);
    return stepCounts.length > 0 ? lcmArray(stepCounts) : 16;
  }, [activeRings]);

  // Metrics for selected ring
  const selectedMetrics = useMemo(() => {
    if (!selectedRing) return null;
    const rotatedHits = rotateHits(selectedRing.hits, selectedRing.steps, selectedRing.rotation);
    const intervals = intervalVector(selectedRing.steps, rotatedHits);
    return {
      binary: binaryString(selectedRing.steps, rotatedHits),
      intervals,
      necklace: necklaceForm(selectedRing.steps, rotatedHits),
      evenness: evennessScore(selectedRing.steps, rotatedHits),
      symmetry: rotatedHits.length > 0 ? gcd(selectedRing.steps, ...intervals) : 1,
    };
  }, [selectedRing]);

  // SVG dimensions
  const size = 380;
  const cx = size / 2;
  const cy = size / 2;

  // Playback
  const playStepForAllRings = (step) => {
    const params = audioParamsRef.current;
    if (!params.audioEnabled) return;

    const currentRings = ringsRef.current;

    // Subdivision click on every master step (optional)
    if (params.subdivisionClick && step % (masterSteps / 16) === 0) {
      playSound("pulse", 0, 0.15, 1, "subdivision");
    }

    // Play each ring's sounds
    currentRings.forEach((ring) => {
      if (ring.muted || !ring.visible) return;

      const ringStep = masterToRingStep(step, ring.steps, masterSteps);
      if (ringStep === -1) return;

      const rotatedHits = rotateHits(ring.hits, ring.steps, ring.rotation);
      const isHit = rotatedHits.includes(ringStep);

      if (isHit) {
        playSound(ring.sound, 0, 0.6, 1, "percussion");
      }
    });
  };

  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }

    // Calculate interval: masterSteps subdivisions per bar, 4 beats per bar
    const msPerMasterStep = (60000 / bpm) / (masterSteps / 4);

    let step = 0;
    setMasterStep(0);
    playStepForAllRings(0);

    timerRef.current = setInterval(() => {
      step = (step + 1) % masterSteps;
      setMasterStep(step);
      playStepForAllRings(step);
    }, msPerMasterStep);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [isPlaying, masterSteps, bpm]);

  // Ring manipulation
  const addRing = (preset) => {
    const newRing = createRing(preset, rings.length);
    setRings((prev) => [...prev, newRing]);
    setSelectedRingId(newRing.id);
  };

  const updateRing = (id, updates) => {
    setRings((prev) =>
      prev.map((ring) => (ring.id === id ? { ...ring, ...updates } : ring))
    );
  };

  const removeRing = (id) => {
    setRings((prev) => prev.filter((r) => r.id !== id));
    if (selectedRingId === id) {
      setSelectedRingId(rings.find((r) => r.id !== id)?.id);
    }
  };

  const toggleStep = (index) => {
    if (!selectedRing) return;
    updateRing(selectedRingId, {
      hits: selectedRing.hits.includes(index)
        ? selectedRing.hits.filter((h) => h !== index)
        : [...selectedRing.hits, index].sort((a, b) => a - b),
    });
  };

  const applyEuclidean = () => {
    if (!selectedRing) return;
    const targetHits = Math.min(Math.max(selectedRing.hits.length || 1, 1), selectedRing.steps);
    updateRing(selectedRingId, {
      hits: euclideanRhythm(selectedRing.steps, targetHits),
      rotation: 0,
    });
  };

  const clearPattern = () => {
    if (!selectedRing) return;
    updateRing(selectedRingId, { hits: [], rotation: 0 });
  };

  const randomizePattern = () => {
    if (!selectedRing) return;
    const count = Math.min(Math.max(selectedRing.hits.length || 3, 1), selectedRing.steps);
    const chosen = new Set();
    while (chosen.size < count) {
      chosen.add(Math.floor(Math.random() * selectedRing.steps));
    }
    updateRing(selectedRingId, {
      hits: [...chosen].sort((a, b) => a - b),
      rotation: 0,
    });
  };

  const loadPreset = (presetName) => {
    const preset = presets.find((p) => p.name === presetName);
    if (preset && selectedRing) {
      updateRing(selectedRingId, {
        name: preset.name,
        steps: preset.steps,
        hits: [...preset.hits],
        rotation: 0,
      });
    }
  };

  const handlePlayToggle = async () => {
    if (!isPlaying) {
      await sampleManager.init();
      await sampleManager.resume();
    }
    setIsPlaying((v) => !v);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl !text-black font-bold tracking-tight">
            Rhythm Geometry
          </h1>
          <p className="text-slate-500 text-sm">
            Multi-ring polyrhythm visualizer
          </p>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Main visualization */}
          <section className="xl:col-span-2 bg-white rounded-3xl shadow-sm border p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-semibold">Circular Rhythm View</h2>
                <p className="text-sm text-slate-500">
                  {rings.length} ring{rings.length !== 1 ? "s" : ""} · Master grid: {masterSteps} steps
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handlePlayToggle}
                  className="rounded-2xl border px-4 py-2 text-sm font-medium hover:bg-slate-50"
                >
                  {isPlaying ? "Pause" : "Play"}
                </button>
                <button
                  onClick={applyEuclidean}
                  className="rounded-2xl border px-4 py-2 text-sm font-medium hover:bg-slate-50"
                  disabled={!selectedRing}
                >
                  Euclideanize
                </button>
                <button
                  onClick={randomizePattern}
                  className="rounded-2xl border px-4 py-2 text-sm font-medium hover:bg-slate-50"
                  disabled={!selectedRing}
                >
                  Randomize
                </button>
                <button
                  onClick={clearPattern}
                  className="rounded-2xl border px-4 py-2 text-sm font-medium hover:bg-slate-50"
                  disabled={!selectedRing}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                className="overflow-visible"
              >
                {/* Render rings from outermost to innermost */}
                {rings
                  .filter((r) => r.visible)
                  .map((ring, index) => {
                    const ringStep = masterToRingStep(masterStep, ring.steps, masterSteps);
                    return (
                      <RhythmRing
                        key={ring.id}
                        id={ring.id}
                        steps={ring.steps}
                        hits={ring.hits}
                        rotation={ring.rotation}
                        radius={concentricRadius(index, BASE_RADIUS, RING_GAP)}
                        cx={cx}
                        cy={cy}
                        playhead={isPlaying ? ringStep : -1}
                        onToggleStep={ring.id === selectedRingId ? toggleStep : undefined}
                        color={ring.color}
                        showLabels={index === 0}
                        showSpokes={index === 0}
                        muted={ring.muted}
                        selected={ring.id === selectedRingId}
                      />
                    );
                  })}
              </svg>

              {/* Transport controls */}
              <div className="mt-4 w-full max-w-sm space-y-3">
                <label className="block">
                  <div className="flex justify-between text-sm font-medium mb-1">
                    <span>BPM</span>
                    <span>{bpm}</span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="180"
                    value={bpm}
                    onChange={(e) => setBpm(Number(e.target.value))}
                    className="w-full"
                  />
                </label>
              </div>
            </div>

            {/* Metrics panel for selected ring */}
            {selectedRing && selectedMetrics && (
              <div className="mt-6 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 text-sm">
                <div className="rounded-2xl bg-slate-50 p-3 border xl:col-span-2">
                  <div className="text-slate-500">Binary</div>
                  <div className="font-mono mt-1 break-all">{selectedMetrics.binary}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 border">
                  <div className="text-slate-500">Intervals</div>
                  <div className="font-mono mt-1">
                    {selectedMetrics.intervals.length ? selectedMetrics.intervals.join("-") : "—"}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 border">
                  <div className="text-slate-500">Rotation</div>
                  <div className="mt-1">{selectedRing.rotation} steps</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 border">
                  <div className="text-slate-500">Evenness</div>
                  <div className="mt-1">{Math.round(selectedMetrics.evenness * 100)}%</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 border">
                  <div className="text-slate-500">Symmetry</div>
                  <div className="mt-1">{selectedMetrics.symmetry}</div>
                </div>
              </div>
            )}
          </section>

          {/* Sidebar */}
          <aside className="bg-white rounded-3xl shadow-sm border p-6 space-y-5">
            {/* Ring list */}
            <div className="rounded-2xl bg-slate-50 border p-4 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Rings</h3>
                <button
                  onClick={() => addRing()}
                  className="text-sm px-3 py-1 rounded-xl border hover:bg-white"
                >
                  + Add
                </button>
              </div>

              <div className="space-y-2">
                {rings.map((ring) => (
                  <div
                    key={ring.id}
                    className={`flex items-center gap-2 p-2 rounded-xl border cursor-pointer transition-colors
                      ${selectedRingId === ring.id ? "bg-white border-slate-400" : "hover:bg-white"}`}
                    onClick={() => setSelectedRingId(ring.id)}
                  >
                    <span
                      className={`w-3 h-3 rounded-full`}
                      style={{
                        backgroundColor: `var(--tw-${ring.color}-500, #64748b)`,
                        opacity: ring.muted ? 0.3 : 1,
                      }}
                    />
                    <span className="flex-1 text-sm truncate">{ring.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateRing(ring.id, { muted: !ring.muted });
                      }}
                      className="text-xs opacity-60 hover:opacity-100 px-1"
                      title={ring.muted ? "Unmute" : "Mute"}
                    >
                      {ring.muted ? "🔇" : "🔊"}
                    </button>
                    {rings.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRing(ring.id);
                        }}
                        className="text-xs opacity-60 hover:opacity-100 px-1"
                        title="Remove ring"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Selected ring controls */}
            {selectedRing && (
              <div className="rounded-2xl bg-slate-50 border p-4 space-y-3">
                <h3 className="font-semibold">{selectedRing.name}</h3>

                <label className="block">
                  <span className="text-sm text-slate-600">Preset</span>
                  <select
                    value=""
                    onChange={(e) => e.target.value && loadPreset(e.target.value)}
                    className="w-full mt-1 rounded-xl border px-3 py-1.5 bg-white text-sm"
                  >
                    <option value="">Load preset...</option>
                    {presets.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm text-slate-600">Sound</span>
                  <select
                    value={selectedRing.sound}
                    onChange={(e) => updateRing(selectedRingId, { sound: e.target.value })}
                    className="w-full mt-1 rounded-xl border px-3 py-1.5 bg-white text-sm"
                  >
                    {SOUNDS.map((s) => (
                      <option key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-sm text-slate-600">Color</span>
                  <select
                    value={selectedRing.color}
                    onChange={(e) => updateRing(selectedRingId, { color: e.target.value })}
                    className="w-full mt-1 rounded-xl border px-3 py-1.5 bg-white text-sm"
                  >
                    {RING_COLORS.map((c) => (
                      <option key={c} value={c}>
                        {c.charAt(0).toUpperCase() + c.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Pulses</span>
                    <span>{selectedRing.steps}</span>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="24"
                    value={selectedRing.steps}
                    onChange={(e) => {
                      const newSteps = Number(e.target.value);
                      updateRing(selectedRingId, {
                        steps: newSteps,
                        hits: selectedRing.hits.filter((h) => h < newSteps),
                        rotation: Math.min(selectedRing.rotation, newSteps - 1),
                      });
                    }}
                    className="w-full"
                  />
                </label>

                <label className="block">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Hits</span>
                    <span>{selectedRing.hits.length}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={selectedRing.steps}
                    value={selectedRing.hits.length}
                    onChange={(e) => {
                      const nextCount = Number(e.target.value);
                      if (nextCount === selectedRing.hits.length) return;
                      if (nextCount < selectedRing.hits.length) {
                        updateRing(selectedRingId, {
                          hits: selectedRing.hits.slice(0, nextCount),
                        });
                      } else {
                        updateRing(selectedRingId, {
                          hits: euclideanRhythm(selectedRing.steps, nextCount),
                        });
                      }
                    }}
                    className="w-full"
                  />
                </label>

                <label className="block">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Rotation</span>
                    <span>{selectedRing.rotation}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(selectedRing.steps - 1, 0)}
                    value={selectedRing.rotation}
                    onChange={(e) =>
                      updateRing(selectedRingId, { rotation: Number(e.target.value) })
                    }
                    className="w-full"
                  />
                </label>
              </div>
            )}

            {/* Audio controls */}
            <div className="rounded-2xl bg-slate-50 border p-4 space-y-3">
              <h3 className="font-semibold">Audio</h3>
              <div className="space-y-3 text-sm text-slate-700">
                <label className="flex items-center justify-between gap-3">
                  <span>Audio enabled</span>
                  <input
                    type="checkbox"
                    checked={audioEnabled}
                    onChange={(e) => setAudioEnabled(e.target.checked)}
                  />
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span>Subdivision click</span>
                  <input
                    type="checkbox"
                    checked={subdivisionClick}
                    onChange={(e) => setSubdivisionClick(e.target.checked)}
                  />
                </label>
                <div className="text-xs text-slate-400">
                  {samplesLoaded ? "✓ Samples loaded" : "Using fallback sounds"}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
