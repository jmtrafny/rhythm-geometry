import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { RHYTHM_PRESETS } from "./presets";
import {
  rotateHits,
  euclideanRhythm,
  lcmArray,
  masterToRingStep,
} from "./lib/rhythmMath";
import { concentricRadius } from "./lib/rhythmGeometry";
import RhythmRing, { COLOR_SCHEMES } from "./components/RhythmRing";
import RhythmFingerprint from "./components/RhythmFingerprint";
import sampleManager, { playSound, preloadSamples } from "./lib/audioEngine";

const RING_COLORS = Object.keys(COLOR_SCHEMES);
const SOUNDS = ["clave", "bell", "kick", "snare", "rim"];
const BASE_RADIUS = 145;
const RING_GAP = 32;

// Tailwind color values for ring indicators (matching COLOR_SCHEMES)
const COLOR_VALUES = {
  slate: "#64748b",
  blue: "#3b82f6",
  emerald: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  purple: "#a855f7",
};

// Haptic feedback utility
const hapticFeedback = () => {
  if ('vibrate' in navigator) {
    navigator.vibrate(50);
  }
};

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

  // Mobile panel state
  const [leftPanelOpen, setLeftPanelOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);
  const [showSwipeHint, setShowSwipeHint] = useState(true);

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
    const minSwipeDistance = 100; // Increased from 50 to 100 for less sensitivity

    // Horizontal swipe detection - only if horizontal movement is dominant
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance && Math.abs(deltaY) < 30) {
      if (deltaX > 0) {
        // Swipe right - open left panel
        setLeftPanelOpen(true);
        setRightPanelOpen(false);
        hapticFeedback();
      } else {
        // Swipe left - open right panel
        setRightPanelOpen(true);
        setLeftPanelOpen(false);
        hapticFeedback();
      }
    }

    setTouchStartX(0);
    setTouchStartY(0);
  };

  const closePanels = () => {
    setLeftPanelOpen(false);
    setRightPanelOpen(false);
  };

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

  // Hide swipe hint after 5 seconds or when panels are used
  useEffect(() => {
    const timer = setTimeout(() => setShowSwipeHint(false), 5000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (leftPanelOpen || rightPanelOpen) {
      setShowSwipeHint(false);
    }
  }, [leftPanelOpen, rightPanelOpen]);

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration);
        })
        .catch((error) => {
          console.log('Service Worker registration failed:', error);
        });
    }
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

  // SVG dimensions
  const size = 380;
  const cx = size / 2;
  const cy = size / 2;

  // Playback
  const playStepForAllRings = useCallback((step) => {
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
  }, [masterSteps]);

  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }

    // Calculate interval: masterSteps subdivisions per bar, 4 beats per bar
    const msPerMasterStep = (60000 / bpm) / (masterSteps / 4);

    let step = 0;
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
  }, [isPlaying, masterSteps, bpm, playStepForAllRings]);

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
    hapticFeedback();
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
    <div className="min-h-screen bg-slate-50 text-slate-900 overflow-hidden">
      {/* Main view - full screen on mobile */}
      <div
        className="relative h-screen flex flex-col"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'manipulation' }}
      >
        {/* Swipe hint */}
        {showSwipeHint && (
          <div className="flex items-center justify-center p-2 bg-white/80 backdrop-blur-sm border-b border-slate-200/50 transition-opacity duration-500">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M7 16l-4-4m0 0l4-4m-4 4h18" />
              </svg>
              <span>Swipe to open settings</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </div>
          </div>
        )}

        {/* Main visualization area */}
        <div className="flex-1 flex flex-col items-center justify-start p-4 overflow-y-auto">
          <div className="text-center mb-4">
            <h2 className="text-xl font-semibold">{selectedRing?.name || "No Ring Selected"}</h2>
            <p className="text-sm text-slate-500">
              {rings.length} ring{rings.length !== 1 ? "s" : ""} · {masterSteps} steps
            </p>
          </div>

          <div className="w-full max-w-md"
            style={{ maxHeight: 'calc(100vh - 200px)' }}
          >
            <RhythmFingerprint
              rings={rings}
              masterSteps={masterSteps}
              playhead={isPlaying ? masterStep : -1}
              mode="carousel"
              size={Math.min(window.innerWidth - 32, window.innerHeight - 150, 350)}
            >
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="overflow-visible"
            >
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
                      onSelectRing={() => {
                        hapticFeedback();
                        setSelectedRingId(ring.id);
                      }}
                      color={ring.color}
                      showLabels={index === 0}
                      showSpokes={index === 0}
                      muted={ring.muted}
                      selected={ring.id === selectedRingId}
                    />
                  );
                })}
            </svg>
            </RhythmFingerprint>
          </div>
        </div>

        {/* Bottom toolbar - transport controls and ring selector */}
        <div className="bg-white border-t border-slate-200 p-4 pb-6 space-y-4 safe-area-inset-bottom">
          {/* Transport controls */}
          <div className="flex flex-col items-center space-y-3">
            <button
              onClick={handlePlayToggle}
              className="w-full max-w-xs py-3 px-6 rounded-2xl bg-blue-600 text-white font-medium hover:bg-blue-700"
            >
              {isPlaying ? "⏸ Pause" : "▶ Play"}
            </button>
            <label className="block w-full max-w-xs">
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

          {/* Ring selector */}
          <div className="flex gap-2 overflow-x-auto pb-4 ring-selector-scroll">
            {rings.map((ring) => {
              const isSelected = selectedRingId === ring.id;
              const ringColor = COLOR_VALUES[ring.color] || COLOR_VALUES.slate;
              return (
                <button
                  key={ring.id}
                  onClick={() => setSelectedRingId(ring.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 whitespace-nowrap text-sm flex-shrink-0 ${
                    isSelected
                      ? "bg-white shadow-md"
                      : "bg-white/80 hover:bg-white"
                  }`}
                  style={{
                    borderColor: isSelected ? ringColor : 'transparent',
                  }}
                >
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: ringColor,
                      opacity: ring.muted ? 0.3 : 1,
                    }}
                  />
                  <span
                    style={{
                      color: isSelected ? ringColor : undefined,
                      opacity: ring.muted ? 0.5 : 1,
                    }}
                  >
                    {ring.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateRing(ring.id, { muted: !ring.muted });
                    }}
                    className="ml-1 text-xs"
                  >
                    {ring.muted ? "🔇" : "🔊"}
                  </button>
                </button>
              );
            })}
            <button
              onClick={() => addRing()}
              className="px-3 py-2 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-slate-400 flex-shrink-0"
            >
              + Add Ring
            </button>
          </div>
        </div>

        {/* Overlay panels */}
        {/* Left Panel - App Settings */}
        <div
          className={`fixed inset-y-0 left-0 w-80 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 ${
            leftPanelOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Settings</h2>
              <button
                onClick={closePanels}
                className="p-2 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Transport */}
              <div>
                <h3 className="font-medium mb-3">Transport</h3>
                <button
                  onClick={handlePlayToggle}
                  className="w-full py-3 px-4 rounded-xl border-2 border-blue-600 text-blue-600 font-medium hover:bg-blue-50 mb-3"
                >
                  {isPlaying ? "⏸ Pause" : "▶ Play"}
                </button>
                <label className="block">
                  <div className="flex justify-between text-sm mb-2">
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

              {/* Audio */}
              <div>
                <h3 className="font-medium mb-3">Audio</h3>
                <div className="space-y-3">
                  <label className="flex items-center justify-between">
                    <span>Audio enabled</span>
                    <input
                      type="checkbox"
                      checked={audioEnabled}
                      onChange={(e) => setAudioEnabled(e.target.checked)}
                      className="w-5 h-5"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span>Subdivision click</span>
                    <input
                      type="checkbox"
                      checked={subdivisionClick}
                      onChange={(e) => setSubdivisionClick(e.target.checked)}
                      className="w-5 h-5"
                    />
                  </label>
                  <div className="text-sm text-slate-500">
                    {samplesLoaded ? "✓ Samples loaded" : "Using fallback sounds"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Ring Configuration */}
        <div
          className={`fixed inset-y-0 right-0 w-80 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 ${
            rightPanelOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">Ring Config</h2>
              <button
                onClick={closePanels}
                className="p-2 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {selectedRing ? (
              <div className="space-y-6">
                <div>
                  <h3 className="font-medium mb-2">{selectedRing.name}</h3>
                  <select
                    value=""
                    onChange={(e) => e.target.value && loadPreset(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2 bg-white text-sm"
                  >
                    <option value="">Load preset...</option>
                    {presets.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={applyEuclidean}
                    className="py-2 px-3 rounded-xl border text-sm hover:bg-slate-50"
                  >
                    Euclidean
                  </button>
                  <button
                    onClick={randomizePattern}
                    className="py-2 px-3 rounded-xl border text-sm hover:bg-slate-50"
                  >
                    Random
                  </button>
                  <button
                    onClick={clearPattern}
                    className="py-2 px-3 rounded-xl border text-sm hover:bg-slate-50"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => removeRing(selectedRingId)}
                    className="py-2 px-3 rounded-xl border text-sm hover:bg-slate-50 text-red-600"
                    disabled={rings.length <= 1}
                  >
                    Delete
                  </button>
                </div>

                <div className="space-y-4">
                  <label className="block">
                    <span className="text-sm font-medium mb-2 block">Sound</span>
                    <select
                      value={selectedRing.sound}
                      onChange={(e) => updateRing(selectedRingId, { sound: e.target.value })}
                      className="w-full rounded-xl border px-3 py-2 bg-white text-sm"
                    >
                      {SOUNDS.map((s) => (
                        <option key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-sm font-medium mb-2 block">Color</span>
                    <select
                      value={selectedRing.color}
                      onChange={(e) => updateRing(selectedRingId, { color: e.target.value })}
                      className="w-full rounded-xl border px-3 py-2 bg-white text-sm"
                    >
                      {RING_COLORS.map((c) => (
                        <option key={c} value={c}>
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <div className="flex justify-between text-sm mb-2">
                      <span>Steps</span>
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
                    <div className="flex justify-between text-sm mb-2">
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
                    <div className="flex justify-between text-sm mb-2">
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
              </div>
            ) : (
              <div className="text-center text-slate-500 py-8">
                No ring selected
              </div>
            )}
          </div>
        </div>

        {/* Backdrop for panels */}
        {(leftPanelOpen || rightPanelOpen) && (
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={closePanels}
          />
        )}
      </div>
    </div>
  );
}
