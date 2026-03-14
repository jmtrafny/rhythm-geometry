# Rhythm Geometry Prototype Refactor Guide

## Goal
Refactor the current single-ring rhythm prototype into a cleaner, more modular architecture that supports:

- preset management in separate files
- reusable rhythm math utilities
- more reliable audio handling
- multiple concentric rings
- a shared transport for layered playback
- future export and study features

---

## Current State Summary
The current prototype works, but most responsibilities live in a single React component:

- preset data
- rhythm math helpers
- SVG geometry generation
- playback scheduling
- Web Audio click synthesis
- UI state and controls

This is totally fine for a prototype, but it will get harder to maintain once you add more presets, more sounds, or multiple rings.

---

## Recommended Refactor Strategy
Use a staged refactor rather than rewriting everything at once.

### Stage 1: Extract Presets
Move preset definitions into a dedicated file.

### Recommended file
`src/presets.js`

### Example
```js
export const RHYTHM_PRESETS = [
  {
    id: "one-bar-clave",
    name: "One Bar Clave",
    family: "Clave",
    steps: 8,
    hits: [0, 3, 6],
  },
  {
    id: "son-clave-3-2",
    name: "Son Clave (3:2)",
    family: "Clave",
    steps: 16,
    hits: [0, 3, 6, 10, 12],
  },
  {
    id: "son-clave-2-3",
    name: "Son Clave (2:3)",
    family: "Clave",
    steps: 16,
    hits: [0, 2, 6, 9, 12],
  },
  {
    id: "rumba-clave",
    name: "Rumba Clave",
    family: "Clave",
    steps: 16,
    hits: [0, 3, 7, 10, 12],
  },
  {
    id: "bembe",
    name: "Bembe",
    family: "Bell Pattern",
    steps: 12,
    hits: [0, 2, 5, 6, 8, 10],
  },
  {
    id: "partido-alto",
    name: "Partido Alto",
    family: "Brazilian",
    steps: 16,
    hits: [0, 3, 5, 7, 10, 12, 15],
  },
];
```

### Why
This makes it easy to add and organize rhythms without editing the main UI component.

---

### Stage 2: Extract Rhythm Math Utilities
Move pure math helpers into a utility module.

### Recommended file
`src/lib/rhythmMath.js`

### Functions to move
- `gcd`
- `rotateHits`
- `binaryString`
- `intervalVector`
- `necklaceForm`
- `evennessScore`
- `euclideanRhythm`

### Why
These functions are pure and reusable. Pulling them out makes the main component smaller and easier to reason about.

### Suggested future additions
- `lcm`
- `normalizeHits`
- `isMaximallyEven`
- `mapMasterStepToRingStep`
- `ringStepTriggersAtMasterStep`

---

### Stage 3: Extract Geometry Helpers
Move circular point and polygon generation into a geometry module.

### Recommended file
`src/lib/rhythmGeometry.js`

### Suggested functions
```js
export function getRingPoints(steps, radius, cx, cy) {
  return Array.from({ length: steps }, (_, i) => {
    const angle = -Math.PI / 2 + (i / steps) * Math.PI * 2;
    return {
      i,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    };
  });
}

export function getPolygonPoints(points, hitSet) {
  return points
    .filter((p) => hitSet.has(p.i))
    .map((p) => `${p.x},${p.y}`)
    .join(" ");
}
```

### Why
Separating geometry from UI makes multi-ring rendering much easier later.

---

### Stage 4: Extract Audio Engine
Right now the app uses inline Web Audio scheduling inside the React component. That works, but audio concerns should be isolated.

### Recommended file
`src/lib/audioEngine.js`

### Suggested responsibilities
- create or resume `AudioContext`
- create click sounds
- expose `playPulseClick()` and `playHitClick()`
- manage a master gain node
- expose test sound support

### Why
This will make debugging audio much easier, especially since browser audio initialization can be finicky.

### Note on current code
The current audio implementation is good enough for experimentation, but it is tightly coupled to React state. Moving it out will make it easier to improve loudness, diagnostics, and ring-specific sounds.

---

### Stage 5: Extract Reusable UI Components
Break the main screen into smaller presentational components.

### Suggested components
- `RhythmRing.jsx`
- `RhythmViewer.jsx`
- `PresetSelector.jsx`
- `TransportControls.jsx`
- `MetricsPanel.jsx`
- `AudioControls.jsx`
- `RingEditor.jsx`

### Good first extraction
Start with `RhythmRing.jsx`.

### Example responsibility of `RhythmRing`
- render one circle
- render one polygon
- render one ring's vertices
- highlight one ring's playhead
- forward click events when a step is toggled

### Why
This is the component you will reuse for multiple concentric rings.

---

## Recommended Intermediate Folder Structure
```text
src/
  App.jsx
  main.jsx
  index.css
  presets.js
  components/
    RhythmRing.jsx
    RhythmViewer.jsx
    MetricsPanel.jsx
    TransportControls.jsx
    AudioControls.jsx
    RingEditor.jsx
  lib/
    rhythmMath.js
    rhythmGeometry.js
    audioEngine.js
```

---

## Plan for Multiple Rings
This is the most important architectural shift.

### Current single-ring state
```js
const [steps, setSteps] = useState(...);
const [hits, setHits] = useState(...);
const [rotation, setRotation] = useState(0);
```

### Recommended multi-ring state
```js
const [rings, setRings] = useState([
  {
    id: "ring-1",
    name: "Son Clave (3:2)",
    steps: 16,
    hits: [0, 3, 6, 10, 12],
    rotation: 0,
    visible: true,
    muted: false,
    sound: "clave",
    role: "timeline",
  },
]);
```

Each ring becomes an object with its own:
- steps
- hits
- rotation
- visibility
- mute state
- optional sound identity
- optional role

### Why this matters
Once you adopt `rings[]`, the rest of the app can evolve naturally into multi-layer visualization and playback.

---

## Shared Transport Recommendation
Multiple rings need a single transport.

### Suggested transport state
```js
const [isPlaying, setIsPlaying] = useState(false);
const [bpm, setBpm] = useState(120);
const [masterStep, setMasterStep] = useState(0);
```

### Why
Playback should be global, not owned by an individual ring.

This lets multiple rings stay synchronized while still having different step counts.

---

## Master Grid Recommendation
If you want to play rings with different step counts together, you need a shared master cycle.

### Example
- 8-step ring
- 12-step ring
- 16-step ring

Shared cycle length should be the least common multiple.

### Utility
```js
function lcm(a, b) {
  return Math.abs(a * b) / gcd(a, b);
}

function lcmMany(values) {
  return values.reduce((acc, value) => lcm(acc, value), 1);
}
```

### Example result
- LCM of 8, 12, and 16 = 48

So the transport runs on 48 master steps, and each ring maps into that grid.

### Why
This preserves timing integrity across rings with different subdivisions.

---

## Ring-to-Transport Mapping Recommendation
Each ring should determine whether a hit occurs on a given master step.

### Example idea
```js
function ringStepTriggersAtMasterStep(masterStep, masterSteps, ring) {
  const stepsPerRingPulse = masterSteps / ring.steps;
  if (masterStep % stepsPerRingPulse !== 0) return false;

  const ringStep = Math.floor(masterStep / stepsPerRingPulse);
  const rotatedStep = (ringStep - ring.rotation + ring.steps) % ring.steps;
  return ring.hits.includes(rotatedStep);
}
```

### Why
This decouples local ring indexing from the transport.

---

## Suggested Rendering Strategy for Multiple Rings
Use one SVG and render multiple concentric rings inside it.

### Example idea
```jsx
{rings.map((ring, index) => (
  <RhythmRing
    key={ring.id}
    ring={ring}
    radius={baseRadius - index * ringGap}
    cx={cx}
    cy={cy}
    masterStep={masterStep}
    masterSteps={masterSteps}
  />
))}
```

### Radius recommendation
```js
const baseRadius = 150;
const ringGap = 24;
```

### Notes
- outer ring can be pulse or timeline
- inner rings can be rhythm layers
- each ring can optionally draw polygon lines, dots only, or both

---

## Suggested Ring Controls
Once multiple rings exist, the control panel should become per-ring.

### Each ring should support
- preset selection
- steps
- rotation
- mute/unmute
- show/hide
- delete
- duplicate

### App-level controls should support
- add ring
- clear all
- play/pause
- BPM
- global audio enable

---

## Audio Refactor Recommendation for Multiple Rings
Once rings are layered, audio should support per-ring identity.

### Suggested ring audio fields
```js
{
  sound: "clave",
  gain: 0.8,
  muted: false,
}
```

### Sound identity examples
- `pulse`
- `clave`
- `bell`
- `kick`
- `snare`
- `rim`

### Why
This makes layered playback musically meaningful instead of just producing identical clicks.

---

## Recommended Development Order
Do not jump straight to everything at once.

### Phase 1
- extract presets
- extract math helpers
- extract geometry helpers

### Phase 2
- create `RhythmRing` component
- move single-ring SVG logic into it

### Phase 3
- replace single state with `rings[]`
- keep UI limited to one ring at first if needed

### Phase 4
- add global transport
- compute `masterSteps` with LCM

### Phase 5
- render 2 rings
- then 3 rings
- then per-ring controls

### Phase 6
- upgrade audio to ring-specific sounds
- add test sound and diagnostics

### Phase 7
- add preset bundles and export features

---

## Recommended First Milestone
The best low-risk milestone is:

- one outer pulse ring
- one rhythm ring
- one second rhythm ring
- shared playhead
- no advanced audio yet

This will prove the geometry and transport architecture before you sink time into deeper UI work.

---

## Notes Specific to the Current Prototype
The current prototype already has a strong foundation:

- preset selection works
- hit toggling works
- rotation works
- interval and necklace analysis works
- Euclidean generation works
- visual playhead works
- basic audio exists

So this is not a rewrite-from-scratch situation. It is a good candidate for an incremental refactor.

---

## Recommended Next Files to Create
1. `src/presets.js`
2. `src/lib/rhythmMath.js`
3. `src/lib/rhythmGeometry.js`
4. `src/components/RhythmRing.jsx`

That sequence gives you the biggest clarity improvement for the least disruption.

---

## Optional Future Enhancements
Once the refactor is complete, these would be strong next features:

- maximally even rhythm detection
- cultural notes attached to presets
- preset families and filtering
- export to SVG or PNG
- export preset JSON
- multiple audio voices
- study mode with pulse counting overlays
- side-by-side rhythm comparison mode

---

## Closing Recommendation
Treat this project as evolving from:

**single interactive demo**

to

**small rhythm engine with layered visualization**

The main architectural move is replacing single-ring assumptions with a ring array and a shared master transport.

Once that is in place, the rest of the features become much easier to add.
