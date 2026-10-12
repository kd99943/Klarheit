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

function toTexture(canvas: HTMLCanvasElement, repeat = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Fine horizontal brush lines for titanium / steel. */
export function createBrushedMetalMaps(size = 256) {
  const rough = makeCanvas(size, size);
  const nrm = makeCanvas(size, size);
  const r = rough.getContext("2d")!;
  const n = nrm.getContext("2d")!;

  r.fillStyle = "#6a6a6a";
  r.fillRect(0, 0, size, size);
  n.fillStyle = "#8080ff";
  n.fillRect(0, 0, size, size);

  for (let i = 0; i < 900; i++) {
    const y = Math.random() * size;
    const alpha = 0.04 + Math.random() * 0.12;
    const light = Math.random() > 0.5;
    r.strokeStyle = light
      ? `rgba(200,200,200,${alpha})`
      : `rgba(40,40,40,${alpha})`;
    r.lineWidth = 0.4 + Math.random() * 1.2;
    r.beginPath();
    r.moveTo(0, y);
    r.lineTo(size, y + (Math.random() - 0.5) * 2);
    r.stroke();

    // Normal: tiny vertical gradient for micro-relief
    n.strokeStyle = `rgba(${128 + (Math.random() - 0.5) * 30},128,255,0.35)`;
    n.lineWidth = 0.6;
    n.beginPath();
    n.moveTo(0, y);
    n.lineTo(size, y);
    n.stroke();
  }

  // Subtle anisotropic streaks
  for (let i = 0; i < 40; i++) {
    const y = Math.random() * size;
    r.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.04})`;
    r.fillRect(0, y, size, 1 + Math.random() * 2);
  }

  return {
    roughnessMap: toTexture(rough, 3),
    normalMap: toTexture(nrm, 3),
  };
}

/** Deep glossy black acetate — soft cloudiness + micro-scratch normals. */
export function createAcetateMaps(size = 256) {
  const rough = makeCanvas(size, size);
  const nrm = makeCanvas(size, size);
  const r = rough.getContext("2d")!;
  const n = nrm.getContext("2d")!;

  const g = r.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, "#2a2a2a");
  g.addColorStop(0.5, "#1a1a1a");
  g.addColorStop(1, "#303030");
  r.fillStyle = g;
  r.fillRect(0, 0, size, size);

  n.fillStyle = "#8080ff";
  n.fillRect(0, 0, size, size);

  // Soft polish swirls
  for (let i = 0; i < 28; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const rad = 20 + Math.random() * 60;
    const rg = r.createRadialGradient(x, y, 0, x, y, rad);
    rg.addColorStop(0, `rgba(80,80,80,${0.08 + Math.random() * 0.1})`);
    rg.addColorStop(1, "rgba(0,0,0,0)");
    r.fillStyle = rg;
    r.beginPath();
    r.arc(x, y, rad, 0, Math.PI * 2);
    r.fill();
  }

  // Hairline scratches (near-invisible until specular)
  for (let i = 0; i < 60; i++) {
    n.strokeStyle = `rgba(140,140,255,${0.08 + Math.random() * 0.1})`;
    n.lineWidth = 0.4;
    n.beginPath();
    const x0 = Math.random() * size;
    const y0 = Math.random() * size;
    n.moveTo(x0, y0);
    n.lineTo(x0 + (Math.random() - 0.5) * 40, y0 + (Math.random() - 0.5) * 8);
    n.stroke();
  }

  return {
    roughnessMap: toTexture(rough, 2),
    normalMap: toTexture(nrm, 2),
  };
}

/** Crystal acetate — very smooth with slight internal cloud. */
export function createCrystalMaps(size = 128) {
  const rough = makeCanvas(size, size);
  const r = rough.getContext("2d")!;
  r.fillStyle = "#0d0d0d";
  r.fillRect(0, 0, size, size);
  for (let i = 0; i < 18; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const rg = r.createRadialGradient(x, y, 0, x, y, 30 + Math.random() * 40);
    rg.addColorStop(0, "rgba(40,40,40,0.25)");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    r.fillStyle = rg;
    r.beginPath();
    r.arc(x, y, 40, 0, Math.PI * 2);
    r.fill();
  }
  return { roughnessMap: toTexture(rough, 1) };
}

/**
 * Multi-coat AR sheen gradient for optical lenses.
 * Used as emissiveMap / roughness variation.
 */
export function createLensCoatMap(size = 128) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, "#0a3d3a");
  g.addColorStop(0.35, "#1a6b68");
  g.addColorStop(0.55, "#3d8f8a");
  g.addColorStop(0.8, "#0d2a40");
  g.addColorStop(1, "#061820");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // Soft highlight band (studio softbox reflection)
  const h = ctx.createLinearGradient(0, size * 0.15, size, size * 0.45);
  h.addColorStop(0, "rgba(255,255,255,0)");
  h.addColorStop(0.45, "rgba(220,255,250,0.35)");
  h.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = h;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
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

/** Materials with maps applied. */
export function buildEnhancedMaterials() {
  const metalMaps = createBrushedMetalMaps();
  const acetateMaps = createAcetateMaps();
  const crystalMaps = createCrystalMaps();
  const coat = createLensCoatMap();
  const tortoiseMap = createTortoiseMaps();

  const titanium = (color = 0x9aa1aa) =>
    new THREE.MeshPhysicalMaterial({
      color,
      metalness: 1,
      roughness: 0.32,
      roughnessMap: metalMaps.roughnessMap,
      normalMap: metalMaps.normalMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
      clearcoat: 0.25,
      clearcoatRoughness: 0.35,
      envMapIntensity: 1.15,
    });

  const blackAcetate = (color = 0x121214) =>
    new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.02,
      roughness: 0.22,
      roughnessMap: acetateMaps.roughnessMap,
      normalMap: acetateMaps.normalMap,
      normalScale: new THREE.Vector2(0.15, 0.15),
      clearcoat: 0.95,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.0,
    });

  const crystal = () =>
    new THREE.MeshPhysicalMaterial({
      color: 0xeef3f6,
      metalness: 0,
      roughness: 0.04,
      roughnessMap: crystalMaps.roughnessMap,
      transmission: 0.9,
      thickness: 0.12,
      ior: 1.49,
      transparent: true,
      clearcoat: 0.75,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.2,
    });

  const opticalLens = (color = 0xdce8f2) =>
    new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.05,
      roughness: 0.02,
      transparent: true,
      opacity: 0.28,
      transmission: 0.6,
      thickness: 0.02,
      ior: 1.54,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      reflectivity: 0.85,
      sheen: 0.85,
      sheenColor: new THREE.Color("#38bdf8"),
      sheenRoughness: 0.15,
      emissive: new THREE.Color("#0d302d"),
      emissiveMap: coat,
      emissiveIntensity: 0.16,
      envMapIntensity: 1.8,
    });

  const sunLens = (color = 0x1a2430) =>
    new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.12,
      roughness: 0.03,
      transparent: true,
      opacity: 0.88,
      transmission: 0.06,
      thickness: 0.025,
      ior: 1.54,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      reflectivity: 0.9,
      envMapIntensity: 1.6,
    });

  const gold = () =>
    new THREE.MeshPhysicalMaterial({
      color: 0xc9a227,
      metalness: 1,
      roughness: 0.3,
      roughnessMap: metalMaps.roughnessMap,
      envMapIntensity: 1.1,
    });

  const tortoise = () =>
    new THREE.MeshPhysicalMaterial({
      map: tortoiseMap,
      metalness: 0.05,
      roughness: 0.38,
      clearcoat: 0.7,
      clearcoatRoughness: 0.15,
    });

  const silicone = () =>
    new THREE.MeshPhysicalMaterial({
      color: 0xf4f1ea,
      transparent: true,
      opacity: 0.8,
      roughness: 0.4,
      transmission: 0.35,
      thickness: 0.02,
    });

  return {
    titanium,
    blackAcetate,
    crystal,
    opticalLens,
    sunLens,
    gold,
    tortoise,
    silicone,
    maps: { metalMaps, acetateMaps, crystalMaps, coat, tortoiseMap },
  };
}
