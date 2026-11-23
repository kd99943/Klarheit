import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { createProceduralGlasses } from "./glassesGeometry";
import { getARFrameConfig } from "./frameCatalog";
import { disposeModel } from "./arRendering";

beforeEach(() => vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null));
afterEach(() => vi.restoreAllMocks());

function signedVolume(geometry: THREE.BufferGeometry) {
  const positions = geometry.getAttribute("position");
  const index = geometry.index;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let volume = 0;
  for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
    a.fromBufferAttribute(positions, index ? index.getX(i) : i);
    b.fromBufferAttribute(positions, index ? index.getX(i + 1) : i + 1);
    c.fromBufferAttribute(positions, index ? index.getX(i + 2) : i + 2);
    volume += a.dot(b.cross(c)) / 6;
  }
  return volume;
}

describe.each([
  ["monolith_02", "bold-acetate"],
  ["lucent_v1", "crystal-sun"],
  ["velvet_c3", "cat-eye-acetate"],
  ["amber_r5", "narrow-rect-amber"],
] as const)("%s temple orientation", (asset, styleName) => {
  test.each(["procedural", "glb"])("%s has two outward-facing solid acetate temples", async (source) => {
    let model: THREE.Object3D;
    if (source === "glb") {
      const bytes = readFileSync(`public/models/frames/${asset}.glb`);
      model = (await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, "")).scene;
    } else {
      model = createProceduralGlasses({ ...getARFrameConfig("titanium"), styleName });
    }
    try {
      const temples: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] = [];
      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh) || !(object.material instanceof THREE.MeshStandardMaterial)) return;
        object.geometry.computeBoundingBox();
        const size = object.geometry.boundingBox!.getSize(new THREE.Vector3());
        if (size.z > 0.5 && object.material.metalness === 0) temples.push(object);
      });
      expect(temples).toHaveLength(2);
      temples.forEach((temple) => {
        expect(temple.material.side).toBe(THREE.FrontSide);
        expect(signedVolume(temple.geometry)).toBeGreaterThan(0);
      });
    } finally { disposeModel(model, true); }
  });
});

describe.each([
  ["aero_x1", "panto-metal"],
  ["monolith_02", "bold-acetate"],
  ["orbit_t4", "panto-wire"],
  ["lucent_v1", "crystal-sun"],
  ["solaris_a1", "aviator-double"],
  ["velvet_c3", "cat-eye-acetate"],
  ["prism_h6", "hex-wire"],
  ["amber_r5", "narrow-rect-amber"],
] as const)("%s lens apertures", (asset, styleName) => {
  test.each(["procedural", "glb"])("%s keeps both left and right lens openings clear of frame geometry", async (source) => {
    let model: THREE.Object3D;
    if (source === "glb") {
      const bytes = readFileSync(`public/models/frames/${asset}.glb`);
      model = (await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, "")).scene;
    } else {
      model = createProceduralGlasses({ ...getARFrameConfig("titanium"), styleName });
    }
    try {
      model.updateMatrixWorld(true);
      const frameMeshes: THREE.Mesh[] = [];
      const lensMeshes: THREE.Mesh[] = [];
      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const mat = Array.isArray(object.material) ? object.material[0] : object.material;
        const matName = (mat?.name || "").toLowerCase();
        const isLens =
          matName.includes("lens") ||
          (mat instanceof THREE.MeshPhysicalMaterial && mat.transmission >= 0.85 && mat.roughness < 0.02);
        if (isLens) lensMeshes.push(object);
        else frameMeshes.push(object);
      });

      const ray = new THREE.Raycaster();
      const offsets: Array<[number, number]> = [
        [0, 0],
        [-0.07, 0],
        [0.07, 0],
        [0, 0.035],
        [0, -0.035],
      ];
      for (const side of [-1, 1]) {
        for (const [dx, dy] of offsets) {
          ray.set(new THREE.Vector3(side * 0.24 + dx, dy, 1), new THREE.Vector3(0, 0, -1));
          expect(ray.intersectObjects(frameMeshes, false)).toHaveLength(0);
          expect(ray.intersectObjects(lensMeshes, false).length).toBeGreaterThan(0);
        }
      }
    } finally { disposeModel(model, true); }
  });
});
