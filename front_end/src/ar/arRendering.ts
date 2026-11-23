import * as THREE from "three";
import type { FaceLandmark, ARFrameConfig } from "./types";

export interface FaceProjection {
  width: number;
  height: number;
  z: number;
  cameraZ: number;
  depthScale: number;
}

/** Unproject at each landmark's actual depth so projecting it returns the same video pixel. */
export function facePointToWorld(point: FaceLandmark, projection: FaceProjection, videoAspect: number, viewportAspect: number, target: THREE.Vector3) {
  const [x, y] = toViewportPoint(point, videoAspect, viewportAspect);
  const z = projection.z - (point.z ?? 0) * projection.depthScale;
  const depthRatio = (projection.cameraZ - z) / (projection.cameraZ - projection.z);
  return target.set((x - 0.5) * projection.width * depthRatio, (0.5 - y) * projection.height * depthRatio, z);
}

export function toViewportPoint(point: FaceLandmark, videoAspect: number, viewportAspect: number): [number, number] {
  const [x, y] = coverRepeat(videoAspect, viewportAspect);
  return [(point.x - (1 - x) / 2) / x, (point.y - (1 - y) / 2) / y];
}

function coverRepeat(videoAspect: number, viewportAspect: number): [number, number] {
  return videoAspect > viewportAspect ? [viewportAspect / videoAspect, 1] : [1, videoAspect / viewportAspect];
}

export function applyVideoCover(texture: THREE.Texture, videoAspect: number, viewportAspect: number) {
  const [x, y] = coverRepeat(videoAspect, viewportAspect);
  texture.repeat.set(x, y);
  texture.offset.set((1 - x) / 2, (1 - y) / 2);
  texture.updateMatrix();
}

export function videoPixelRatio(videoWidth: number, videoHeight: number, width: number, height: number, dpr: number) {
  if (!videoWidth || !videoHeight) return Math.min(dpr, 2);
  const [, visibleHeight] = coverRepeat(videoWidth / videoHeight, width / height);
  return Math.min(dpr, 2, Math.max(1, videoHeight * visibleHeight / height));
}

export function wrapFrameModel(model: THREE.Object3D, frame: ARFrameConfig) {
  const wrapper = new THREE.Group();
  wrapper.add(model);
  if (frame.modelScaleMode === "real-meters") {
    wrapper.scale.setScalar(0.48 / ((frame.lensCenterDistanceMm ?? 71) / 1000));
  }
  return wrapper;
}

/** glTF-owned textures are released once; shared procedural maps remain cached. */
export function disposeModel(root: THREE.Object3D, textures = false) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const maps = new Set<THREE.Texture>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    (Array.isArray(object.material) ? object.material : [object.material]).forEach((mat) => {
      materials.add(mat);
      if (textures) Object.values(mat).forEach((value) => {
        if (value instanceof THREE.Texture && !value.userData.shared) maps.add(value);
      });
    });
  });
  geometries.forEach((geo) => geo.dispose());
  materials.forEach((mat) => mat.dispose());
  maps.forEach((map) => map.dispose());
}

/** Linear-light averages from forehead and cheeks, sampled in uncropped video coordinates. */
export function estimateFaceLighting(data: Uint8ClampedArray, width: number, height: number, landmarks: FaceLandmark[]) {
  const patches = [[10, 151], [50, 205], [280, 425]].map(([a, b]) => {
    if (!landmarks[a] || !landmarks[b]) return null;
    const x = Math.round((landmarks[a].x + landmarks[b].x) * width / 2);
    const y = Math.round((landmarks[a].y + landmarks[b].y) * height / 2);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const rgb = [0, 0, 0];
    let count = 0;
    for (let py = Math.max(0, y - 2); py <= Math.min(height - 1, y + 2); py++) {
      for (let px = Math.max(0, x - 2); px <= Math.min(width - 1, x + 2); px++) {
        for (let c = 0; c < 3; c++) {
          const value = data[(py * width + px) * 4 + c] / 255;
          rgb[c] += value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
        }
        count++;
      }
    }
    return count ? rgb.map((v) => v / count) : null;
  });
  if (patches.some((patch) => !patch)) return null;
  const luminance = patches.map((rgb) => 0.2126 * rgb![0] + 0.7152 * rgb![1] + 0.0722 * rgb![2]);
  const forehead = patches[0]!;
  const peak = Math.max(...forehead, 0.001);
  return {
    exposure: THREE.MathUtils.clamp((luminance.reduce((a, b) => a + b, 0) / 3) / 0.35, 0.55, 1.4),
    color: new THREE.Color().setRGB(...forehead.map((v) => 0.5 + 0.5 * v / peak) as [number, number, number]),
    direction: (luminance[2] - luminance[1]) / Math.max(luminance[2] + luminance[1], 0.001),
  };
}
