import * as THREE from "three";
import { buildEnhancedMaterials } from "./frameTextures";

let cached: ReturnType<typeof buildEnhancedMaterials> | null = null;

function getMats() {
  if (!cached) cached = buildEnhancedMaterials();
  return cached;
}

/**
 * Upgrade GLB materials in-place by name (set at export time).
 * Gives metal brushed maps, acetate polish, lens AR coat without embedding
 * textures in the GLB (Node exporter limitation).
 */
export function enhanceGlbMaterials(root: THREE.Object3D) {
  let mats: ReturnType<typeof buildEnhancedMaterials>;
  try {
    mats = getMats();
  } catch {
    // jsdom / SSR without canvas — keep baked GLB materials
    return;
  }

  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const apply = (mat: THREE.Material | undefined) => {
      if (!mat) return;
      const name = (mat.name || "").toLowerCase();
      let next: THREE.MeshPhysicalMaterial | null = null;

      if (name.includes("titanium") || name.includes("steel")) {
        const color =
          mat instanceof THREE.MeshStandardMaterial
            ? mat.color.clone()
            : new THREE.Color("#9aa1aa");
        next = mats.titanium(color.getHex());
      } else if (name.includes("acetate-black") || name === "acetate") {
        next = mats.blackAcetate(
          mat instanceof THREE.MeshStandardMaterial
            ? mat.color.getHex()
            : 0x121214
        );
      } else if (name.includes("crystal")) {
        next = mats.crystal();
      } else if (name.includes("sun")) {
        next = mats.sunLens(
          mat instanceof THREE.MeshStandardMaterial
            ? mat.color.getHex()
            : 0x1a2430
        );
      } else if (name.includes("optical") || name.includes("lens")) {
        next = mats.opticalLens(
          mat instanceof THREE.MeshStandardMaterial
            ? mat.color.getHex()
            : 0xdce8f2
        );
      } else if (name.includes("gold")) {
        next = mats.gold();
      } else if (name.includes("tortoise")) {
        next = mats.tortoise();
      }

      if (next) {
        next.side = mat.side;
        obj.material = next;
        mat.dispose();
      }
    };

    if (Array.isArray(obj.material)) obj.material.forEach(apply);
    else apply(obj.material);
  });
}