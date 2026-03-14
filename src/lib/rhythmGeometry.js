/**
 * Rhythm geometry utilities - SVG coordinate calculations
 */

/**
 * Calculate point position on a circle
 * @param {number} index - Step index (0-based)
 * @param {number} steps - Total steps in the ring
 * @param {number} cx - Center X coordinate
 * @param {number} cy - Center Y coordinate
 * @param {number} radius - Circle radius
 * @returns {{x: number, y: number}} Point coordinates
 */
export function stepToPoint(index, steps, cx, cy, radius) {
  const angle = -Math.PI / 2 + (index / steps) * Math.PI * 2;
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  };
}

/**
 * Generate all points for a ring
 * @param {number} steps - Number of steps
 * @param {Set<number>} hitSet - Set of active hit indices
 * @param {number} playhead - Current playhead position (-1 if not playing)
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} radius - Ring radius
 */
export function generateRingPoints(steps, hitSet, playhead, cx, cy, radius) {
  return Array.from({ length: steps }, (_, i) => {
    const { x, y } = stepToPoint(i, steps, cx, cy, radius);
    return {
      i,
      x,
      y,
      active: hitSet.has(i),
      playhead: playhead === i,
    };
  });
}

/**
 * Generate SVG polygon string from points
 * @param {Array} points - Array of point objects with x, y, active properties
 * @returns {string|null} SVG polygon points string or null if < 2 active points
 */
export function pointsToPolygon(points) {
  const active = points.filter((p) => p.active);
  if (active.length < 2) return null;
  return active.map((p) => `${p.x},${p.y}`).join(" ");
}

/**
 * Calculate concentric ring radius
 * @param {number} ringIndex - Index of the ring (0 = outermost)
 * @param {number} baseRadius - Outermost ring radius
 * @param {number} ringGap - Gap between rings
 */
export function concentricRadius(ringIndex, baseRadius, ringGap = 35) {
  return baseRadius - ringIndex * ringGap;
}
