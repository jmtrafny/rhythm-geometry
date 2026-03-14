/**
 * Sample-based audio engine with buffer caching and oscillator fallback
 */

const SAMPLE_PATHS = {
  clave: '/samples/percussion/clave.wav',
  bell: '/samples/percussion/bell.wav',
  kick: '/samples/percussion/kick.wav',
  snare: '/samples/percussion/snare.wav',
  rim: '/samples/percussion/rim.wav',
  pulse: '/samples/percussion/pulse.wav',
};

// Oscillator fallback configurations (when samples fail to load)
const FALLBACK_CONFIG = {
  clave: { frequency: 2200, type: 'square', duration: 0.02, gain: 0.3 },
  bell: { frequency: 1800, type: 'sine', duration: 0.15, gain: 0.25 },
  kick: { frequency: 60, type: 'sine', duration: 0.12, gain: 0.5 },
  snare: { frequency: 180, type: 'triangle', duration: 0.08, gain: 0.35 },
  rim: { frequency: 280, type: 'triangle', duration: 0.04, gain: 0.3 },
  pulse: { frequency: 800, type: 'square', duration: 0.03, gain: 0.15 },
};

class SampleManager {
  constructor() {
    this.audioContext = null;
    this.buffers = new Map();
    this.loading = new Map();
    this.masterGain = null;
    this.buses = new Map();
    this.initialized = false;
  }

  /**
   * Initialize audio context (must be called after user interaction)
   */
  async init() {
    if (this.initialized && this.audioContext?.state !== 'closed') {
      return this.audioContext;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('Web Audio API not supported');
      return null;
    }

    this.audioContext = new AudioContextClass();

    // Create master gain
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);
    this.masterGain.gain.value = 0.8;

    // Create default buses
    this.createBus('percussion');
    this.createBus('subdivision');

    this.initialized = true;
    return this.audioContext;
  }

  /**
   * Resume audio context if suspended
   */
  async resume() {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /**
   * Create a mixing bus
   */
  createBus(name) {
    if (!this.audioContext || this.buses.has(name)) return;

    const bus = this.audioContext.createGain();
    bus.connect(this.masterGain);
    this.buses.set(name, bus);
    return bus;
  }

  /**
   * Set bus volume
   */
  setBusGain(busName, value) {
    const bus = this.buses.get(busName);
    if (bus) {
      bus.gain.setValueAtTime(value, this.audioContext.currentTime);
    }
  }

  /**
   * Set master volume
   */
  setMasterGain(value) {
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(value, this.audioContext.currentTime);
    }
  }

  /**
   * Load a sample by name
   */
  async loadSample(name) {
    // Return cached buffer
    if (this.buffers.has(name)) {
      return this.buffers.get(name);
    }

    // Return pending load
    if (this.loading.has(name)) {
      return this.loading.get(name);
    }

    const path = SAMPLE_PATHS[name];
    if (!path) {
      console.warn(`Unknown sample: ${name}`);
      return null;
    }

    const loadPromise = (async () => {
      try {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        this.buffers.set(name, audioBuffer);
        this.loading.delete(name);
        return audioBuffer;
      } catch (error) {
        console.warn(`Failed to load sample ${name}, will use oscillator fallback:`, error.message);
        this.loading.delete(name);
        return null;
      }
    })();

    this.loading.set(name, loadPromise);
    return loadPromise;
  }

  /**
   * Preload all samples
   */
  async preloadAll() {
    await this.init();
    const names = Object.keys(SAMPLE_PATHS);
    await Promise.all(names.map((name) => this.loadSample(name)));
    const loaded = names.filter((name) => this.buffers.has(name));
    console.log(`Loaded ${loaded.length}/${names.length} samples:`, loaded);
    return loaded;
  }

  /**
   * Play a sample or fallback to oscillator
   * @param {string} name - Sample name
   * @param {number} time - AudioContext time to play (0 for now)
   * @param {number} gain - Volume (0-1)
   * @param {number} playbackRate - Speed multiplier
   * @param {string} busName - Optional bus to route to
   */
  playSound(name, time = 0, gain = 0.5, playbackRate = 1, busName = 'percussion') {
    if (!this.audioContext) return;

    const playTime = time || this.audioContext.currentTime + 0.005;
    const buffer = this.buffers.get(name);
    const destination = this.buses.get(busName) || this.masterGain;

    if (buffer) {
      // Sample playback
      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();

      source.buffer = buffer;
      source.playbackRate.value = playbackRate;

      gainNode.gain.setValueAtTime(gain, playTime);

      source.connect(gainNode);
      gainNode.connect(destination);

      source.start(playTime);
    } else {
      // Oscillator fallback
      this.playOscillatorFallback(name, playTime, gain, destination);
    }
  }

  /**
   * Oscillator fallback when sample isn't loaded
   */
  playOscillatorFallback(name, time, gain, destination) {
    const config = FALLBACK_CONFIG[name] || FALLBACK_CONFIG.pulse;

    const oscillator = this.audioContext.createOscillator();
    const amp = this.audioContext.createGain();

    oscillator.type = config.type;
    oscillator.frequency.setValueAtTime(config.frequency, time);

    const effectiveGain = gain * config.gain;
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.exponentialRampToValueAtTime(effectiveGain, time + 0.003);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + config.duration);

    oscillator.connect(amp);
    amp.connect(destination);

    oscillator.start(time);
    oscillator.stop(time + config.duration + 0.01);
  }

  /**
   * Clean up
   */
  dispose() {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.buffers.clear();
    this.buses.clear();
    this.initialized = false;
  }

  /**
   * Get current audio context time
   */
  get currentTime() {
    return this.audioContext?.currentTime || 0;
  }

  /**
   * Check if a sample is loaded
   */
  hasSample(name) {
    return this.buffers.has(name);
  }
}

// Singleton instance
export const sampleManager = new SampleManager();

// Named exports for convenience
export const initAudio = () => sampleManager.init();
export const resumeAudio = () => sampleManager.resume();
export const preloadSamples = () => sampleManager.preloadAll();
export const playSound = (name, time, gain, rate, bus) =>
  sampleManager.playSound(name, time, gain, rate, bus);
export const setMasterGain = (v) => sampleManager.setMasterGain(v);
export const setBusGain = (bus, v) => sampleManager.setBusGain(bus, v);

export default sampleManager;
