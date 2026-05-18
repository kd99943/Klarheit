import { describe, expect, test } from "vitest";
import { calculateGlassesTransform } from "./arCalibration";
import type { FaceLandmark } from "./types";

function landmarksWithFace(): FaceLandmark[] {
  const points = Array.from({ length: 264 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  points[33] = { x: 0.38, y: 0.42, z: -0.02 };
  points[263] = { x: 0.62, y: 0.43, z: -0.02 };
  points[168] = { x: 0.5, y: 0.49, z: -0.04 };
  points[1] = { x: 0.5, y: 0.53, z: -0.06 };
  return points;
}

describe("calculateGlassesTransform", () => {
  test("computes a centered glasses transform from eye and nose landmarks", () => {
    const transform = calculateGlassesTransform(landmarksWithFace());

    expect(transform).not.toBeNull();
    expect(transform?.position[0]).toBeCloseTo(0, 3);
    expect(transform?.position[1]).toBeCloseTo(0.13, 2);
    expect(transform?.scale[0]).toBeGreaterThan(1);
    expect(transform?.scale[0]).toBeCloseTo(transform?.scale[1] ?? 0, 5);
    expect(transform?.confidence).toBeGreaterThan(0.8);
  });

  test("returns null when required landmarks are missing", () => {
    expect(calculateGlassesTransform([])).toBeNull();
  });

  test("captures roll rotation from uneven eye landmarks", () => {
    const transform = calculateGlassesTransform(landmarksWithFace());

    expect(transform?.rotation[2]).toBeGreaterThan(0);
  });
});
