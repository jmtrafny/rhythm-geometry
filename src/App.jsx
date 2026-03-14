import { useEffect, useMemo, useRef, useState } from "react";
import { RHYTHM_PRESETS } from "./presets";

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

function rotateHits(hits, steps, rotation) {
  return hits.map((h) => (h + rotation + steps) % steps).sort((a, b) => a - b);
}

function binaryString(steps, hits) {
  const set = new Set(hits);
  return Array.from({ length: steps }, (_, i) => (set.has(i) ? "1" : "0")).join("");
}

function intervalVector(steps, hits) {
  if (hits.length === 0) return [];
  const sorted = [...hits].sort((a, b) => a - b);
  return sorted.map((hit, index) => {
    const next = sorted[(index + 1) % sorted.length];
    return (next - hit + steps) % steps || steps;
  });
}

function necklaceForm(steps, hits) {
  if (hits.length === 0) return "∅";
  const rotations = Array.from({ length: steps }, (_, r) => binaryString(steps, rotateHits(hits, steps, r)));
  return rotations.sort()[0];
}

function evennessScore(steps, hits) {
  if (hits.length <= 1) return 1;
  const intervals = intervalVector(steps, hits);
  const ideal = steps / hits.length;
  const deviation = intervals.reduce((sum, v) => sum + Math.abs(v - ideal), 0) / hits.length;
  const normalized = Math.max(0, 1 - deviation / Math.max(ideal, 1));
  return normalized;
}

function euclideanRhythm(steps, pulses) {
  if (pulses <= 0) return [];
  if (pulses >= steps) return Array.from({ length: steps }, (_, i) => i);

  const pattern = [];
  let bucket = 0;
  for (let i = 0; i < steps; i += 1) {
    bucket += pulses;
    if (bucket >= steps) {
      bucket -= steps;
      pattern.push(i);
    }
  }

  if (pattern.length === 0) return [0];
  const first = pattern[0];
  return pattern.map((p) => (p - first + steps) % steps).sort((a, b) => a - b);
}

function createClick(audioContext, time, { frequency, gain, duration, type = "sine" }) {
  const oscillator = audioContext.createOscillator();
  const amp = audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, time);

  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.exponentialRampToValueAtTime(gain, time + 0.003);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + duration);

  oscillator.connect(amp);
  amp.connect(audioContext.destination);

  oscillator.start(time);
  oscillator.stop(time + duration + 0.01);
}

export default function RhythmGeometryPrototype() {
  const presets = RHYTHM_PRESETS;

  const [presetName, setPresetName] = useState(presets[0].name);
  const selectedPreset = presets.find((p) => p.name === presetName) || presets[0];
  const [steps, setSteps] = useState(selectedPreset.steps);
  const [hits, setHits] = useState(selectedPreset.hits);
  const [rotation, setRotation] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(-1);
  const [bpm, setBpm] = useState(60);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [accentDownbeat, setAccentDownbeat] = useState(true);
  const [subdivisionClick, setSubdivisionClick] = useState(true);
  const [subdivisionGain, setSubdivisionGain] = useState(0.015);
  const [hitGain, setHitGain] = useState(0.18);
  const timerRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioParamsRef = useRef({ audioEnabled, accentDownbeat, subdivisionClick, subdivisionGain, hitGain });

  useEffect(() => {
    audioParamsRef.current = { audioEnabled, accentDownbeat, subdivisionClick, subdivisionGain, hitGain };
  }, [audioEnabled, accentDownbeat, subdivisionClick, subdivisionGain, hitGain]);

  useEffect(() => {
    setSteps(selectedPreset.steps);
    setHits(selectedPreset.hits);
    setRotation(0);
    setPlayhead(-1);
  }, [presetName]);

  useEffect(() => {
    setHits((prev) => prev.filter((h) => h < steps));
    setRotation((prev) => ((prev % steps) + steps) % steps);
  }, [steps]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
      }
    };
  }, []);

  const rotatedHits = useMemo(() => rotateHits(hits, steps, rotation), [hits, steps, rotation]);
  const hitSet = useMemo(() => new Set(rotatedHits), [rotatedHits]);
  const size = 380;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 145;

  const points = Array.from({ length: steps }, (_, i) => {
    const angle = -Math.PI / 2 + (i / steps) * Math.PI * 2;
    return {
      i,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      active: hitSet.has(i),
      playhead: playhead === i,
    };
  });

  const activePoints = points.filter((p) => p.active);
  const polygon = activePoints.map((p) => `${p.x},${p.y}`).join(" ");
  const intervals = intervalVector(steps, rotatedHits);
  const binary = binaryString(steps, rotatedHits);
  const necklace = necklaceForm(steps, rotatedHits);
  const evenness = evennessScore(steps, rotatedHits);
  const symmetry = rotatedHits.length > 0 ? gcd(steps, ...intervals) : 1;

  const ensureAudioContext = async () => {
    if (typeof window === "undefined") return null;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new AudioContextClass();
    }

    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }

    return audioContextRef.current;
  };

  const playStepSound = async (stepIndex, currentHitSet) => {
    const params = audioParamsRef.current;
    if (!params.audioEnabled) return;
    const audioContext = await ensureAudioContext();
    if (!audioContext) return;

    const now = audioContext.currentTime + 0.005;
    const isHit = currentHitSet.has(stepIndex);
    const isDownbeat = stepIndex === 0;

    if (params.subdivisionClick) {
      createClick(audioContext, now, {
        frequency: isDownbeat && params.accentDownbeat ? 1200 : 800,
        gain: isDownbeat && params.accentDownbeat ? params.subdivisionGain * 2.5 : params.subdivisionGain,
        duration: 0.03,
        type: "square",
      });
    }

    if (isHit) {
      createClick(audioContext, now, {
        frequency: isDownbeat && params.accentDownbeat ? 280 : 220,
        gain: isDownbeat && params.accentDownbeat ? params.hitGain * 1.4 : params.hitGain,
        duration: 0.08,
        type: "triangle",
      });
    }
  };

  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }

    const stepDurationMs = (60000 / bpm) / 4;
    let step = 0;
    setPlayhead(0);
    playStepSound(0, hitSet);

    timerRef.current = setInterval(() => {
      step = (step + 1) % steps;
      setPlayhead(step);
      playStepSound(step, hitSet);
    }, stepDurationMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [isPlaying, steps, bpm, hitSet]);

  const toggleStep = (index) => {
    setHits((prev) => {
      const exists = prev.includes(index);
      if (exists) return prev.filter((h) => h !== index);
      return [...prev, index].sort((a, b) => a - b);
    });
  };

  const applyEuclidean = () => {
    const targetHits = Math.min(Math.max(hits.length || 1, 1), steps);
    setHits(euclideanRhythm(steps, targetHits));
    setRotation(0);
  };

  const clearPattern = () => {
    setHits([]);
    setRotation(0);
  };

  const randomizePattern = () => {
    const count = Math.min(Math.max(hits.length || 3, 1), steps);
    const chosen = new Set();
    while (chosen.size < count) {
      chosen.add(Math.floor(Math.random() * steps));
    }
    setHits([...chosen].sort((a, b) => a - b));
    setRotation(0);
  };

  const onHitsSliderChange = (value) => {
    const nextCount = Number(value);
    if (nextCount === hits.length) return;
    if (nextCount < hits.length) {
      setHits((prev) => prev.slice(0, nextCount));
      return;
    }
    setHits(euclideanRhythm(steps, nextCount));
  };

  const handlePlayToggle = async () => {
    if (!isPlaying && audioEnabled) {
      await ensureAudioContext();
    }
    setIsPlaying((v) => !v);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl !text-black font-bold tracking-tight">Hi Colin :)</h1>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <section className="xl:col-span-2 bg-white rounded-3xl shadow-sm border p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-semibold">Circular Rhythm View</h2>
                <select
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  className="mt-1 rounded-xl border px-3 py-1.5 bg-white text-sm"
                >
                  {[...presets.map((p) => p.name), ...(presetName === "Custom" ? ["Custom"] : [])].map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
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
                >
                  Euclideanize
                </button>
                <button
                  onClick={randomizePattern}
                  className="rounded-2xl border px-4 py-2 text-sm font-medium hover:bg-slate-50"
                >
                  Randomize
                </button>
                <button
                  onClick={clearPattern}
                  className="rounded-2xl border px-4 py-2 text-sm font-medium hover:bg-slate-50"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center">
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
                <circle cx={cx} cy={cy} r={radius} fill="none" stroke="currentColor" className="text-slate-300" strokeWidth="2" />

                {points.map((p) => (
                  <line
                    key={`spoke-${p.i}`}
                    x1={cx}
                    y1={cy}
                    x2={p.x}
                    y2={p.y}
                    stroke="currentColor"
                    className={p.playhead ? "text-slate-400" : "text-slate-200"}
                    strokeWidth={p.playhead ? "2" : "1"}
                  />
                ))}

                {polygon && activePoints.length >= 2 && (
                  <polygon
                    points={polygon}
                    fill="none"
                    stroke="currentColor"
                    className="text-slate-700"
                    strokeWidth="3"
                  />
                )}

                {points.map((p) => (
                  <g key={p.i}>
                    {p.playhead && (
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={16}
                        fill="none"
                        stroke="currentColor"
                        className="text-slate-400"
                        strokeWidth="2"
                      />
                    )}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={p.active ? 10 : 6}
                      fill="currentColor"
                      className={p.active ? "text-slate-900" : "text-slate-300"}
                      onClick={() => toggleStep(p.i)}
                      style={{ cursor: "pointer" }}
                    />
                    <text
                      x={p.x}
                      y={p.y - 18}
                      textAnchor="middle"
                      className="fill-slate-500 text-[10px]"
                    >
                      {p.i + 1}
                    </text>
                  </g>
                ))}
              </svg>
              <div className="mt-4 w-full max-w-sm space-y-3">
                <label className="block">
                  <div className="flex justify-between text-sm font-medium mb-1">
                    <span>BPM</span>
                    <span>{bpm}</span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="120"
                    value={bpm}
                    onChange={(e) => setBpm(Number(e.target.value))}
                    className="w-full"
                  />
                </label>
                <label className="block">
                  <div className="flex justify-between text-sm font-medium mb-1">
                    <span>Rotation</span>
                    <span>{rotation}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(steps - 1, 0)}
                    value={rotation}
                    onChange={(e) => setRotation(Number(e.target.value))}
                    className="w-full"
                  />
                </label>
                <label className="block">
                  <div className="flex justify-between text-sm font-medium mb-1">
                    <span>Pulses</span>
                    <span>{steps}</span>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="24"
                    value={steps}
                    onChange={(e) => setSteps(Number(e.target.value))}
                    className="w-full"
                  />
                </label>
                <label className="block">
                  <div className="flex justify-between text-sm font-medium mb-1">
                    <span>Hits</span>
                    <span>{hits.length}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={steps}
                    value={Math.min(hits.length, steps)}
                    onChange={(e) => onHitsSliderChange(e.target.value)}
                    className="w-full"
                  />
                </label>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 text-sm">
              <div className="rounded-2xl bg-slate-50 p-3 border xl:col-span-2">
                <div className="text-slate-500">Binary</div>
                <div className="font-mono mt-1 break-all">{binary}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 border">
                <div className="text-slate-500">Intervals</div>
                <div className="font-mono mt-1">{intervals.length ? intervals.join("-") : "—"}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 border">
                <div className="text-slate-500">Rotation</div>
                <div className="mt-1">{rotation} steps</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 border">
                <div className="text-slate-500">Evenness</div>
                <div className="mt-1">{Math.round(evenness * 100)}%</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 border">
                <div className="text-slate-500">Symmetry GCD</div>
                <div className="mt-1">{symmetry}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3 border xl:col-span-2">
                <div className="text-slate-500">Necklace form</div>
                <div className="font-mono mt-1 break-all">{necklace}</div>
              </div>
            </div>
          </section>

          <aside className="bg-white rounded-3xl shadow-sm border p-6 space-y-5">
            <div className="rounded-2xl bg-slate-50 border p-4 space-y-3">
              <h3 className="font-semibold">Audio</h3>
              <div className="space-y-3 text-sm text-slate-700">
                <label className="flex items-center justify-between gap-3">
                  <span>Audio enabled</span>
                  <input type="checkbox" checked={audioEnabled} onChange={(e) => setAudioEnabled(e.target.checked)} />
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span>Accent beat 1</span>
                  <input type="checkbox" checked={accentDownbeat} onChange={(e) => setAccentDownbeat(e.target.checked)} />
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span>Subdivision click</span>
                  <input type="checkbox" checked={subdivisionClick} onChange={(e) => setSubdivisionClick(e.target.checked)} />
                </label>
                <label className="block">
                  <div className="flex justify-between mb-1">
                    <span>Subdivision volume</span>
                    <span>{Math.round(subdivisionGain * 1000)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.05"
                    step="0.001"
                    value={subdivisionGain}
                    onChange={(e) => setSubdivisionGain(Number(e.target.value))}
                    className="w-full"
                  />
                </label>
                <label className="block">
                  <div className="flex justify-between mb-1">
                    <span>Hit volume</span>
                    <span>{Math.round(hitGain * 1000)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.4"
                    step="0.01"
                    value={hitGain}
                    onChange={(e) => setHitGain(Number(e.target.value))}
                    className="w-full"
                  />
                </label>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
