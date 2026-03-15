# Rhythm Geometry - Design Philosophy

## Core Principle: Mobile-First, Touch-Native

A PWA that feels native on mobile but works beautifully in desktop browsers. Every interaction should be achievable with one hand on a phone.

---

## Gesture Language

### Ring Selection
- **Tap on ring** → Select that ring for editing
- **Tap on step node** → Toggle hit on/off (selected ring only)

### Zoom / Focus (Radial Drag)
- **Drag finger toward center** → Zoom IN (focus on inner rings)
  - Outer rings fade out progressively
  - Inner rings become more prominent
- **Drag finger away from center** → Zoom OUT (see all rings)
  - Inner rings fade/shrink
  - Outer rings fade back in
- This creates a "focus lens" effect centered on the current view

### Panel Navigation (Horizontal Swipe)
- **Swipe LEFT** → Ring configuration panel slides in from right
  - Preset selection
  - Steps, hits, rotation sliders
  - Sound & color pickers
- **Swipe RIGHT** → App settings panel slides in from left
  - Audio controls (enable/disable, subdivision click)
  - BPM control
  - Transport (play/pause)
- **Swipe back** or **tap main area** → Return to visualization

### Carousel (Within Main View)
- **Small horizontal swipe** or **nav buttons** → Cycle through visualizations
  - Rings → Amplitude → Spectrum → Spiral → Density

---

## Ring Layouts

### 1. Concentric Rings (Current)
Rings nested inside each other, sharing the same center point.
- Great for seeing polyrhythmic relationships
- Stacked nodes show where rhythms align
- Natural for "zooming" in/out

```
    ╭──────────╮
   ╱  ╭──────╮  ╲
  │  ╱  ╭──╮  ╲  │
  │ │   │  │   │ │
  │  ╲  ╰──╯  ╱  │
   ╲  ╰──────╯  ╱
    ╰──────────╯
```

### 2. Consecutive Rings - Möbius Strip

A Möbius strip visualization where the rhythm surface twists, revealing the next cycle as the playhead passes each beat.

```
        ╭───────────────╮
       ╱  ●   ○   ●   ○  ╲        ← Current cycle (top surface)
      │                    │
      │    THE TWIST       │      ← Playhead crosses here
      │                    │
       ╲  ○   ●   ○   ●  ╱        ← Next cycle (flipped, becoming visible)
        ╰───────────────╯
```

**How it works:**
- The strip has two "sides" that are actually one continuous surface
- As the metronome arm sweeps, beats flip from "upcoming" to "played"
- The twist occurs at the playhead position
- You always see ~half of the current cycle and ~half of the next
- Creates a sense of continuous flow, not discrete loops

**Visual states for each beat:**
1. **Upcoming (next cycle)** - Subtle, waiting on the "underside"
2. **Approaching** - Rotating into view as playhead nears
3. **NOW** - At the twist point, fully visible, highlighted
4. **Just played** - Rotating away, fading
5. **Past** - On the "underside" again, becoming next cycle

**Implementation ideas:**
- 3D CSS transforms for the twist effect
- Or 2D approximation with opacity/scale transitions
- The "twist" creates anticipation - you see what's coming
- Perfect for teaching: "watch for that next hit..."

**Variations:**
- **Single ring Möbius**: One rhythm looping infinitely
- **Multi-ring helix**: Multiple rings as parallel strips, offset
- **Phase Möbius**: Show the same pattern at different rotations

---

## Visual Hierarchy

### Focus States
1. **Selected Ring**: Full opacity, thicker stroke, interactive nodes
2. **Adjacent Rings**: Slightly faded (0.7 opacity)
3. **Distant Rings**: More faded (0.4 opacity)
4. **Out of Focus**: Nearly invisible (0.1 opacity) or hidden

### Zoom Levels
- **Level 0 (Overview)**: All rings visible, equal weight
- **Level 1-N (Focused)**: Progressive fade based on distance from focus ring

---

## Panel Structure

### Left Panel: App Settings
```
┌─────────────────────┐
│ ≡ Settings          │
├─────────────────────┤
│ ▶ Play      ⏸ Pause │
│                     │
│ BPM ────●────── 120 │
│                     │
│ ☑ Audio enabled     │
│ ☑ Subdivision click │
│                     │
│ Theme: ○ Light ● Dark│
└─────────────────────┘
```

### Right Panel: Ring Config
```
┌─────────────────────┐
│ Ring: Son Clave     │
├─────────────────────┤
│ Preset ─────────▼   │
│                     │
│ Steps ────●──── 16  │
│ Hits  ──●────── 5   │
│ Rotate ●─────── 0   │
│                     │
│ Sound: [Clave ▼]    │
│ Color: ● ○ ○ ○ ○ ○  │
│                     │
│ [Euclidean] [Random]│
│ [Clear]    [Delete] │
└─────────────────────┘
```

### Main Area: Visualization Carousel
```
┌─────────────────────┐
│   < ●○○○○ >         │  ← Carousel dots
│                     │
│      ╭─────╮        │
│    ╱ ● ─ ● ╲       │
│   ●    ╳    ●      │  ← Ring visualization
│    ╲ ● ─ ● ╱       │
│      ╰─────╯        │
│                     │
│   [Ring Name]       │
└─────────────────────┘
```

---

## PWA Requirements

### Manifest
- `display: standalone`
- App icon (multiple sizes)
- Theme color matching app
- Offline capability

### Service Worker
- Cache static assets
- Cache audio samples
- Offline-first architecture

### Touch Optimizations
- `touch-action: manipulation` (disable double-tap zoom)
- Minimum tap target: 44x44px
- Haptic feedback on interactions (where supported)

---

## State Management

### URL-Serializable State
Enable sharing rhythms via URL:
```
?rings=[{s:16,h:[0,3,6,10,12],r:0,c:blue}]&bpm=90
```

### Local Storage
- Save/load rhythm presets
- Remember last session state
- User preferences (theme, audio settings)

---

## Future Ideas

### Consecutive Ring Modes
1. **Timeline View**: See multiple cycles of the same ring
2. **Phrase Builder**: Chain different patterns into a phrase
3. **Comparison View**: Same rhythm at different rotations side-by-side

### Social Features
- Share rhythms via link
- Export as audio/video
- Rhythm library/community presets

### Advanced Visualizations
- 3D ring rotation
- Waveform overlay (actual audio visualization)
- Notation view (traditional or TUBS)

---

## Implementation Priority

### Phase 1: Touch Foundation
- [ ] Tap to select ring
- [ ] Basic swipe panels (left/right)
- [ ] PWA manifest and service worker

### Phase 2: Gesture Polish
- [ ] Radial zoom gesture
- [ ] Smooth panel transitions
- [ ] Haptic feedback

### Phase 3: Consecutive Rings
- [ ] Timeline/horizontal ring layout
- [ ] Phrase chaining
- [ ] Loop points

### Phase 4: PWA Polish
- [ ] Offline support
- [ ] Install prompt
- [ ] Share API integration
