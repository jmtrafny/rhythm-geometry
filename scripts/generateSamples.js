/**
 * Generate synthetic percussion samples using Node.js
 * Run with: node scripts/generateSamples.js
 *
 * This creates placeholder samples using synthesis.
 * For production, replace with real recorded samples from:
 * - https://freesound.org (Creative Commons)
 * - https://samplefocus.com/tag/clave (Free samples)
 * - https://99sounds.org/percussion-samples/ (Royalty-free)
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'public', 'samples', 'percussion');

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Simple WAV file generator
function createWavFile(samples, sampleRate = 44100) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = samples.length * (bitsPerSample / 8);
  const fileSize = 36 + dataSize;

  const buffer = Buffer.alloc(44 + dataSize);
  let offset = 0;

  // RIFF header
  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(fileSize, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;

  // fmt chunk
  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4; // chunk size
  buffer.writeUInt16LE(1, offset); offset += 2; // audio format (PCM)
  buffer.writeUInt16LE(numChannels, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(byteRate, offset); offset += 4;
  buffer.writeUInt16LE(blockAlign, offset); offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;

  // data chunk
  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;

  // Write samples
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    const intSample = Math.round(sample * 32767);
    buffer.writeInt16LE(intSample, offset);
    offset += 2;
  }

  return buffer;
}

// Generate a percussive sound
function generatePercussion(options) {
  const {
    sampleRate = 44100,
    duration = 0.2,
    frequency = 440,
    frequencyDecay = 0.5,
    attack = 0.002,
    decay = 0.1,
    sustain = 0.3,
    release = 0.1,
    noiseAmount = 0,
    waveform = 'sine',
  } = options;

  const numSamples = Math.floor(sampleRate * duration);
  const samples = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const phase = t * frequency * Math.pow(frequencyDecay, t * 10);

    // Waveform
    let wave;
    switch (waveform) {
      case 'square':
        wave = Math.sin(2 * Math.PI * phase) > 0 ? 1 : -1;
        break;
      case 'triangle':
        wave = 2 * Math.abs(2 * ((phase % 1) - 0.5)) - 1;
        break;
      case 'sawtooth':
        wave = 2 * (phase % 1) - 1;
        break;
      default: // sine
        wave = Math.sin(2 * Math.PI * phase);
    }

    // Add noise
    if (noiseAmount > 0) {
      wave = wave * (1 - noiseAmount) + (Math.random() * 2 - 1) * noiseAmount;
    }

    // ADSR envelope
    let envelope;
    if (t < attack) {
      envelope = t / attack;
    } else if (t < attack + decay) {
      envelope = 1 - ((t - attack) / decay) * (1 - sustain);
    } else if (t < duration - release) {
      envelope = sustain;
    } else {
      envelope = sustain * (1 - (t - (duration - release)) / release);
    }

    samples[i] = wave * envelope * 0.8;
  }

  return samples;
}

// Sample definitions
const sampleConfigs = {
  clave: {
    frequency: 2500,
    frequencyDecay: 0.7,
    duration: 0.08,
    attack: 0.001,
    decay: 0.03,
    sustain: 0.1,
    release: 0.04,
    waveform: 'square',
    noiseAmount: 0.1,
  },
  bell: {
    frequency: 1200,
    frequencyDecay: 0.95,
    duration: 0.4,
    attack: 0.001,
    decay: 0.1,
    sustain: 0.4,
    release: 0.2,
    waveform: 'sine',
    noiseAmount: 0,
  },
  kick: {
    frequency: 150,
    frequencyDecay: 0.3,
    duration: 0.25,
    attack: 0.001,
    decay: 0.08,
    sustain: 0.2,
    release: 0.1,
    waveform: 'sine',
    noiseAmount: 0.05,
  },
  snare: {
    frequency: 200,
    frequencyDecay: 0.5,
    duration: 0.15,
    attack: 0.001,
    decay: 0.05,
    sustain: 0.1,
    release: 0.08,
    waveform: 'triangle',
    noiseAmount: 0.6,
  },
  rim: {
    frequency: 800,
    frequencyDecay: 0.6,
    duration: 0.06,
    attack: 0.001,
    decay: 0.02,
    sustain: 0.1,
    release: 0.03,
    waveform: 'triangle',
    noiseAmount: 0.2,
  },
  pulse: {
    frequency: 1000,
    frequencyDecay: 0.8,
    duration: 0.04,
    attack: 0.001,
    decay: 0.015,
    sustain: 0.1,
    release: 0.02,
    waveform: 'square',
    noiseAmount: 0,
  },
};

// Generate all samples
console.log('Generating percussion samples...');

for (const [name, config] of Object.entries(sampleConfigs)) {
  const samples = generatePercussion(config);
  const wavBuffer = createWavFile(samples);
  const outputPath = join(OUTPUT_DIR, `${name}.wav`);
  writeFileSync(outputPath, wavBuffer);
  console.log(`  Created: ${name}.wav`);
}

console.log(`\nSamples saved to: ${OUTPUT_DIR}`);
console.log('\nNote: These are synthesized placeholders.');
console.log('For better sound quality, replace with real samples from:');
console.log('  - https://freesound.org');
console.log('  - https://samplefocus.com/tag/clave');
console.log('  - https://99sounds.org/percussion-samples/');
