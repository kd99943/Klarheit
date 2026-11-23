import * as THREE from "three";

/**
 * Procedural PBR maps for eyewear materials.
 * Canvas-based so they work in browser AND Node (GLB export).
 */

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** Tortoiseshell tip: dark brown with amber mottling. */
export function createTortoiseMaps(size = 128) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#2a1810";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const rad = 6 + Math.random() * 22;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, rad);
    rg.addColorStop(0, `rgba(160,90,30,${0.25 + Math.random() * 0.35})`);
    rg.addColorStop(0.6, "rgba(80,40,15,0.2)");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const rad = 3 + Math.random() * 8;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, rad);
    rg.addColorStop(0, "rgba(230,180,90,0.45)");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Shared physical parameters, in normalized model units (71mm between lens centers). */
export function buildEnhancedMaterials() {
  let tortoiseMap: THREE.Texture | null = null;
  try {
    tortoiseMap = createTortoiseMaps();
    tortoiseMap.userData.shared = true;
  } catch {
    // Canvas textures are optional in SSR / jsdom; physical materials still work.
  }
  const mm = 0.48 / 71;
  const titanium = (color = 0xc1bab1) => new THREE.MeshPhysicalMaterial({
    color, metalness: 1, roughness: 0.28, anisotropy: 0.7, clearcoat: 0.15, clearcoatRoughness: 0.25,
  });
  const blackAcetate = (color = 0x121214) => new THREE.MeshPhysicalMaterial({
    color, metalness: 0, roughness: 0.14, ior: 1.49,
    clearcoat: 1, clearcoatRoughness: 0.04,
  });
  const crystal = () => new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.025, transmission: 1,
    thickness: 4.5 * mm, ior: 1.52, attenuationColor: 0xc2ccd4,
    attenuationDistance: 5.5 * mm, clearcoat: 1, clearcoatRoughness: 0.03,
    specularIntensity: 1,
  });
  const amberAcetate = (color = 0xb46a28) => new THREE.MeshPhysicalMaterial({
    color, metalness: 0, roughness: 0.08, transmission: 0.52,
    thickness: 4.2 * mm, ior: 1.5, attenuationColor: color,
    attenuationDistance: 4.5 * mm, clearcoat: 1, clearcoatRoughness: 0.04,
    specularIntensity: 0.9,
  });
  const opticalLens = () => new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0, transmission: 1,
    thickness: 2 * mm, ior: 1.5, specularIntensity: 0.45, envMapIntensity: 0.5,
    iridescence: 1, iridescenceIOR: 1.35, iridescenceThicknessRange: [250, 420],
  });
  const sunLens = (color = 0x3a3f44) => new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0, transmission: 1,
    thickness: 2 * mm, ior: 1.5, attenuationColor: color, attenuationDistance: 2 * mm,
  });
  const gold = () => new THREE.MeshPhysicalMaterial({
    color: 0xffe29b, metalness: 1, roughness: 0.24,
  });
  const tortoise = () => new THREE.MeshPhysicalMaterial({
    color: tortoiseMap ? 0xffffff : 0x8a4b1a, map: tortoiseMap,
    metalness: 0, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05,
    transmission: 0.35, thickness: 4 * mm,
    attenuationColor: 0x8a4b1a, attenuationDistance: 3 * mm,
  });
  const silicone = () => new THREE.MeshPhysicalMaterial({
    color: 0xffffff, transmission: 0.6, roughness: 0.35, ior: 1.41, thickness: 3 * mm,
  });
  return { titanium, blackAcetate, crystal, amberAcetate, opticalLens, sunLens, gold, tortoise, silicone };
}

/** Convert only newly generated materials; authored PBR materials keep their units. */
export function scaleMaterialUnits(material: THREE.MeshPhysicalMaterial, factor: number) {
  material.thickness *= factor;
  material.attenuationDistance *= factor;
}
