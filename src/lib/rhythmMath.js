/**
 * Rhythm math utilities - pure functions for rhythm calculations
 */

/**
 * Greatest common divisor (Euclidean algorithm)
 */
export function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/**
 * Least common multiple
 */
export function lcm(a, b) {
  return Math.abs(a * b) / gcd(a, b);
}

/**
 * LCM of an array of numbers - for computing master grid steps
 */
export function lcmArray(numbers) {
  if (numbers.length === 0) return 1;
  return numbers.reduce((acc, n) => lcm(acc, n), numbers[0]);
}

/**
 * Rotate hit positions by a given offset
 */
export function rotateHits(hits, steps, rotation) {
  return hits.map((h) => (h + rotation + steps) % steps).sort((a, b) => a - b);
}

/**
 * Convert hits to binary string representation
 */
export function binaryString(steps, hits) {
  const set = new Set(hits);
  return Array.from({ length: steps }, (_, i) => (set.has(i) ? "1" : "0")).join("");
}

/**
 * Calculate intervals between consecutive hits
 */
export function intervalVector(steps, hits) {
  if (hits.length === 0) return [];
  const sorted = [...hits].sort((a, b) => a - b);
  return sorted.map((hit, index) => {
    const next = sorted[(index + 1) % sorted.length];
    return (next - hit + steps) % steps || steps;
  });
}

/**
 * Get the canonical necklace form (lexicographically smallest rotation)
 */
export function necklaceForm(steps, hits) {
  if (hits.length === 0) return "∅";
  const rotations = Array.from({ length: steps }, (_, r) =>
    binaryString(steps, rotateHits(hits, steps, r))
  );
  return rotations.sort()[0];
}

/**
 * Calculate evenness score (0-1, how evenly distributed the hits are)
 */
export function evennessScore(steps, hits) {
  if (hits.length <= 1) return 1;
  const intervals = intervalVector(steps, hits);
  const ideal = steps / hits.length;
  const deviation = intervals.reduce((sum, v) => sum + Math.abs(v - ideal), 0) / hits.length;
  return Math.max(0, 1 - deviation / Math.max(ideal, 1));
}

/**
 * Generate a Euclidean rhythm pattern
 */
export function euclideanRhythm(steps, pulses) {
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

/**
 * Map a master transport step to a ring's local step
 * Returns -1 if this master step doesn't align with a ring step
 */
export function masterToRingStep(masterStep, ringSteps, masterSteps) {
  const ratio = masterSteps / ringSteps;
  if (masterStep % ratio !== 0) return -1;
  return Math.floor(masterStep / ratio) % ringSteps;
}
