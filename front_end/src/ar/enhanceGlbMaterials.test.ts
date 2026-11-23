import * as THREE from "three";
import { beforeEach, afterEach, describe, expect, test, vi } from "vitest";
import { enhanceGlbMaterials } from "./enhanceGlbMaterials";
import { buildEnhancedMaterials } from "./frameTextures";
import { prepareModelForShadows } from "./glassesGeometry";

beforeEach(() => vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null));
afterEach(() => vi.restoreAllMocks());

describe("GLB physical materials", () => {
  test("recolors only the opted-in primary material while preserving maps and authored properties", () => {
    const map = new THREE.Texture();
    const primary = new THREE.MeshPhysicalMaterial({ name: "pbr-frame-primary", map, roughness: 0.27, transmission: 0.3 });
    const accent = new THREE.MeshPhysicalMaterial({ name: "pbr-gold", color: 0xffe29b });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), [primary, accent, primary]);
    enhanceGlbMaterials(mesh, { frameColor: "#c4a090" });
    expect(mesh.material[0].color.getHexString()).toBe("c4a090");
    expect(mesh.material[0].map).toBe(map);
    expect(mesh.material[0].roughness).toBe(0.27);
    expect(mesh.material[0].transmission).toBe(0.3);
    expect(mesh.material[0]).toBe(mesh.material[2]);
    expect(mesh.material[1]).toBe(accent);
  });

  test("applies legacy finish colors without tinting lenses or gold accents", () => {
    const materials = ["titanium", "acetate-black", "crystal", "optical-lens", "gold"].map((name) => new THREE.MeshPhysicalMaterial({ name }));
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), materials);
    enhanceGlbMaterials(mesh, { legacyMaterials: true, frameColor: "#c4a090" });
    expect(mesh.material.slice(0, 3).map((mat) => mat.color.getHexString())).toEqual(["c4a090", "c4a090", "c4a090"]);
    expect(mesh.material[3].color.getHexString()).toBe("ffffff");
    expect(mesh.material[4].color.getHexString()).toBe("ffe29b");
  });
  test.each(["map", "normalMap", "roughnessMap"] as const)("preserves an authored %s", (key) => {
    const material = new THREE.MeshPhysicalMaterial({ name: "titanium", [key]: new THREE.Texture() });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
    enhanceGlbMaterials(mesh);
    expect(mesh.material).toBe(material);
  });

  test.each([{ name: "pbr-gold" }, { name: "gold", userData: { keepMaterial: true } }, { name: "optical-lens", transmission: 1 }])("preserves authored markers and transmission %j", (params) => {
    const material = new THREE.MeshPhysicalMaterial(params);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
    enhanceGlbMaterials(mesh);
    expect(mesh.material).toBe(material);
  });

  test("upgrades legacy lenses, preserves arrays and reuses shared replacements", () => {
    const legacy = new THREE.MeshPhysicalMaterial({ name: "optical-lens", transmission: 0.9, opacity: 0.14, transparent: true });
    const authored = new THREE.MeshPhysicalMaterial({ name: "pbr-gold" });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), [legacy, authored, legacy]);
    const dispose = vi.spyOn(legacy, "dispose");
    enhanceGlbMaterials(mesh, { legacyMaterials: true });
    expect(mesh.material).toHaveLength(3);
    expect(mesh.material[0]).toBe(mesh.material[2]);
    expect(mesh.material[1]).toBe(authored);
    expect(mesh.material[0].transmission).toBe(1);
    expect(mesh.material[0].opacity).toBe(1);
    expect(mesh.material[0].transparent).toBe(false);
    expect(mesh.material[0].sheen).toBe(0);
    expect(mesh.material[0].iridescence).toBe(1);
    expect(dispose).toHaveBeenCalledOnce();
  });

  test("uses local meter thickness when enhancing a real-meter model", () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshPhysicalMaterial({ name: "optical-lens" }));
    enhanceGlbMaterials(mesh, { modelScaleMode: "real-meters" });
    expect(mesh.material.thickness).toBeCloseTo(0.002);
  });

  test("casts frame shadows without treating clear lenses as opaque blockers", () => {
    const mats = buildEnhancedMaterials();
    const model = new THREE.Group();
    const lens = new THREE.Mesh(new THREE.BoxGeometry(), mats.opticalLens());
    const frame = new THREE.Mesh(new THREE.BoxGeometry(), mats.titanium());
    model.add(lens, frame);
    prepareModelForShadows(model);
    expect(lens.castShadow).toBe(false);
    expect(frame.castShadow).toBe(true);
    expect(mats.titanium().normalMap).toBeNull();
    expect(mats.sunLens().attenuationDistance).toBeCloseTo(2 * 0.48 / 71);
  });

  test("keeps volume absorption stable as the tracked model changes scale", () => {
    const lens = new THREE.Mesh(new THREE.BoxGeometry(), buildEnhancedMaterials().sunLens());
    const distance = lens.material.attenuationDistance;
    prepareModelForShadows(lens);
    for (const scale of [2, 3, 1]) {
      lens.scale.setScalar(scale);
      lens.updateMatrixWorld();
      lens.onBeforeRender({} as THREE.WebGLRenderer, new THREE.Scene(), new THREE.Camera(), lens.geometry, lens.material, null);
      expect(lens.material.attenuationDistance).toBeCloseTo(distance * scale);
    }
  });
});
