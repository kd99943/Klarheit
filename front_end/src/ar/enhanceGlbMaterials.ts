import * as THREE from "three";
import { buildEnhancedMaterials, scaleMaterialUnits } from "./frameTextures";

let cached: ReturnType<typeof buildEnhancedMaterials> | null = null;

function getMats() {
  if (!cached) cached = buildEnhancedMaterials();
  return cached;
}

/**
 * Upgrade GLB materials in-place by name (set at export time).
 * Rebuilds legacy materials while preserving authored PBR maps and opt-out markers.
 */
export function enhanceGlbMaterials(
  root: THREE.Object3D,
  options: { legacyMaterials?: boolean; modelScaleMode?: string; lensCenterDistanceMm?: number; frameColor?: string } = {}
) {
  let mats: ReturnType<typeof buildEnhancedMaterials>;
  try {
    mats = getMats();
  } catch {
    // jsdom / SSR without canvas — keep baked GLB materials
    return;
  }

  const replacements = new Map<THREE.Material, THREE.Material>();
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const apply = (mat: THREE.Material | undefined) => {
      if (!mat) return mat;
      if (replacements.has(mat)) return replacements.get(mat)!;
      const name = (mat.name || "").toLowerCase();
      // An authored primary material explicitly opts into color variants; keep its maps and PBR settings.
      if ((name === "frame-primary" || name === "pbr-frame-primary") && options.frameColor && mat instanceof THREE.MeshStandardMaterial) {
        const next = mat.clone();
        next.color.set(options.frameColor);
        replacements.set(mat, next);
        return next;
      }
      if (name.startsWith("pbr-") || mat.userData.keepMaterial === true ||
          Object.values(mat).some((value) => value instanceof THREE.Texture) ||
          (mat instanceof THREE.MeshPhysicalMaterial && mat.transmission > 0 && !options.legacyMaterials)) {
        return mat;
      }
      let next: THREE.MeshPhysicalMaterial | null = null;

      if (name.includes("titanium") || name.includes("steel")) {
        const color =
          mat instanceof THREE.MeshStandardMaterial
            ? mat.color.clone()
            : new THREE.Color("#9aa1aa");
        next = mats.titanium(color.getHex());
      } else if (name.includes("amber-acetate")) {
        const baseHex =
          mat instanceof THREE.MeshStandardMaterial ? mat.color.getHex() : 0xb46a28;
        next = mats.amberAcetate(baseHex);
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
        next = mats.opticalLens();
      } else if (name.includes("silicone")) {
        next = mats.silicone();
      } else if (name.includes("gold")) {
        next = mats.gold();
      } else if (name.includes("tortoise")) {
        next = mats.tortoise();
      }

      if (next) {
        if (options.legacyMaterials && options.frameColor &&
            (name.includes("titanium") || name.includes("steel") || name.includes("amber-acetate") || name.includes("acetate-black") || name === "acetate" || name.includes("crystal"))) {
          next.color.set(options.frameColor);
          if (name.includes("amber-acetate")) {
            next.attenuationColor.set(options.frameColor);
          }
        }
        next.name = mat.name;
        next.side = mat.side;
        const factor = options.modelScaleMode === "real-meters"
          ? 0.001 / (0.48 / 71)
          : 71 / (options.lensCenterDistanceMm ?? 71);
        scaleMaterialUnits(next, factor);
        replacements.set(mat, next);
        return next;
      }
      return mat;
    };

    obj.material = Array.isArray(obj.material) ? obj.material.map(apply) : apply(obj.material);
  });
  replacements.forEach((_next, original) => original.dispose());
}
