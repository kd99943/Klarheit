import * as THREE from "three";
import { describe, expect, test } from "vitest";
import { calculateGlassesTransform } from "./arCalibration";
import { calculateGlassesTransform3D } from "./ARTryOnCanvas";
import type { FaceLandmark } from "./types";

function landmarksWithFace(): FaceLandmark[] {
  const points = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  // Left eye corners (33 outer, 133 inner) and iris center (468)
  points[33] = { x: 0.35, y: 0.43, z: -0.02 };
  points[133] = { x: 0.41, y: 0.43, z: -0.02 };
  points[468] = { x: 0.38, y: 0.43, z: -0.02 };
  // Right eye corners (263 outer, 362 inner) and iris center (473)
  points[263] = { x: 0.65, y: 0.42, z: -0.02 };
  points[362] = { x: 0.59, y: 0.42, z: -0.02 };
  points[473] = { x: 0.62, y: 0.42, z: -0.02 };
  // Nose bridge (168) and nose tip (1)
  points[168] = { x: 0.5, y: 0.49, z: -0.04 };
  points[1] = { x: 0.5, y: 0.53, z: -0.06 };
  return points;
}

describe("calculateGlassesTransform", () => {
  test("computes a centered glasses transform from 478-point eye, iris, and nose landmarks", () => {
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

  test("captures roll rotation in both directions from uneven eye landmarks", () => {
    const positiveRollTransform = calculateGlassesTransform(landmarksWithFace());
    expect(positiveRollTransform?.rotation[2]).toBeGreaterThan(0);

    const tiltedOpposite = landmarksWithFace();
    tiltedOpposite[468] = { x: 0.38, y: 0.41, z: -0.02 };
    tiltedOpposite[473] = { x: 0.62, y: 0.44, z: -0.02 };
    const negativeRollTransform = calculateGlassesTransform(tiltedOpposite);
    expect(negativeRollTransform?.rotation[2]).toBeLessThan(0);
  });

  test("falls back to eye corner midpoints when iris landmarks are absent", () => {
    const withoutIris = landmarksWithFace().slice(0, 468);
    const transform = calculateGlassesTransform(withoutIris);

    expect(transform).not.toBeNull();
    expect(transform?.position[0]).toBeCloseTo(0, 3);
    expect(transform?.rotation[2]).toBeGreaterThan(0);
  });
});

describe("calculateGlassesTransform3D", () => {
  test("computes orthonormal 3D pose and consistent roll sign with calculateGlassesTransform", () => {
    const pose3d = calculateGlassesTransform3D(landmarksWithFace(), 16 / 9, 16 / 9, 70, 63, 45, 0);
    expect(pose3d).not.toBeNull();
    expect(pose3d?.position[0]).toBeCloseTo(0, 3);
    expect(pose3d?.scale[0]).toBeGreaterThan(0.2);

    const euler = new THREE.Euler().setFromQuaternion(pose3d!.quaternion, "XYZ");
    expect(euler.z).toBeGreaterThan(0);

    const tiltedOpposite = landmarksWithFace();
    tiltedOpposite[468] = { x: 0.38, y: 0.41, z: -0.02 };
    tiltedOpposite[473] = { x: 0.62, y: 0.44, z: -0.02 };
    const oppositePose3d = calculateGlassesTransform3D(tiltedOpposite, 16 / 9, 16 / 9, 70, 63, 45, 0);
    const oppositeEuler = new THREE.Euler().setFromQuaternion(oppositePose3d!.quaternion, "XYZ");
    expect(oppositeEuler.z).toBeLessThan(0);
  });

  test("returns null when required landmarks are missing", () => {
    expect(calculateGlassesTransform3D([], 16 / 9, 16 / 9, 70, 63, 45, 0)).toBeNull();
  });
});
