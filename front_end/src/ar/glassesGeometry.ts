import * as THREE from "three";
import type { ARFrameConfig, ARFrameStyleName } from "./types";
import { buildEnhancedMaterials } from "./frameTextures";

let cachedEnhancedMats: ReturnType<typeof buildEnhancedMaterials> | null = null;
function getEnhancedMaterials() {
  if (!cachedEnhancedMats) {
    try {
      cachedEnhancedMats = buildEnhancedMaterials();
    } catch {
      // Fallback in environments without canvas (testing/SSR)
    }
  }
  return cachedEnhancedMats;
}

/**
 * Product-faithful silhouettes.
 * Model space: lens centers at x=±0.24 (PD anchor = 0.48, used by face tracking).
 * Lens widths follow real mm specs scaled by typical adult PD ≈ 63mm.
 */

function roundedRectPath(path: THREE.Shape | THREE.Path, w: number, h: number, r: number) {
  const x = -w / 2;
  const y = -h / 2;
  const rr = Math.min(r, w / 2, h / 2);
  path.moveTo(x + rr, y);
  path.lineTo(x + w - rr, y);
  path.quadraticCurveTo(x + w, y, x + w, y + rr);
  path.lineTo(x + w, y + h - rr);
  path.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  path.lineTo(x + rr, y + h);
  path.quadraticCurveTo(x, y + h, x, y + h - rr);
  path.lineTo(x, y + rr);
  path.quadraticCurveTo(x, y, x + rr, y);
}

function ovalPath(path: THREE.Shape | THREE.Path, rx: number, ry: number) {
  path.moveTo(0, ry);
  path.bezierCurveTo(rx * 0.55, ry, rx, ry * 0.55, rx, 0);
  path.bezierCurveTo(rx, -ry * 0.55, rx * 0.55, -ry, 0, -ry);
  path.bezierCurveTo(-rx * 0.55, -ry, -rx, -ry * 0.55, -rx, 0);
  path.bezierCurveTo(-rx, ry * 0.55, -rx * 0.55, ry, 0, ry);
}

function pantoLensPath(path: THREE.Shape | THREE.Path, rx: number, ry: number) {
  path.moveTo(-rx * 0.58, ry * 0.92);
  path.bezierCurveTo(-rx * 0.2, ry * 1.04, rx * 0.52, ry * 1.02, rx * 0.88, ry * 0.8);
  path.bezierCurveTo(rx * 1.04, ry * 0.56, rx * 0.98, -ry * 0.36, rx * 0.72, -ry * 0.78);
  path.bezierCurveTo(rx * 0.4, -ry * 1.05, -rx * 0.4, -ry * 1.05, -rx * 0.72, -ry * 0.78);
  path.bezierCurveTo(-rx * 0.98, -ry * 0.36, -rx * 1.04, ry * 0.56, -rx * 0.88, ry * 0.8);
  path.bezierCurveTo(-rx * 0.52, ry * 1.02, -rx * 0.2, ry * 1.04, -rx * 0.58, ry * 0.92);
  path.closePath();
}

function extrudeRim(
  drawOuter: (p: THREE.Shape) => void,
  drawInner: (p: THREE.Path) => void,
  depth: number,
  bevel: number
) {
  const outer = new THREE.Shape();
  drawOuter(outer);
  const hole = new THREE.Path();
  drawInner(hole);
  outer.holes.push(hole);
  return new THREE.ExtrudeGeometry(outer, {
    depth,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
  });
}

/**
 * Curved ophthalmic lens with realistic base-curve meniscus and beveled facet edge.
 */
function extrudeLens(draw: (p: THREE.Shape) => void, depth: number) {
  const shape = new THREE.Shape();
  draw(shape);
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.003,
    bevelThickness: 0.002,
  });
  // Add subtle spherical base-curve (convex front lens) for realistic light curvature
  const pos = geom.attributes?.position;
  if (pos && typeof pos.count === "number") {
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const r2 = x * x + y * y;
      if (z > depth * 0.3) {
        pos.setZ(i, z + Math.max(0, 0.012 - r2 * 0.16));
      }
    }
  }
  geom.computeVertexNormals?.();
  return geom;
}

function titanium(color: string) {
  const mats = getEnhancedMaterials();
  if (mats) {
    return mats.titanium(new THREE.Color(color).getHex());
  }
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    metalness: 0.98,
    roughness: 0.22,
    clearcoat: 0.35,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.5,
  });
}

function blackAcetate(color: string) {
  const mats = getEnhancedMaterials();
  if (mats) {
    return mats.blackAcetate(new THREE.Color(color).getHex());
  }
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    metalness: 0.04,
    roughness: 0.18,
    clearcoat: 0.95,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.3,
  });
}

function crystalAcetate(color: string) {
  const mats = getEnhancedMaterials();
  if (mats) {
    return mats.crystal();
  }
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color || "#f0f4f8"),
    metalness: 0,
    roughness: 0.05,
    transmission: 0.88,
    thickness: 0.08,
    ior: 1.49,
    transparent: true,
    clearcoat: 0.85,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.4,
  });
}

function opticalGlass(color: string) {
  const mats = getEnhancedMaterials();
  if (mats) {
    return mats.opticalLens(new THREE.Color(color).getHex());
  }
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: 0.28,
    roughness: 0.02,
    metalness: 0.05,
    ior: 1.54,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    sheen: 0.85,
    sheenColor: new THREE.Color("#38bdf8"),
    sheenRoughness: 0.15,
    envMapIntensity: 1.8,
  });
}

function sunGlass(color: string) {
  const mats = getEnhancedMaterials();
  if (mats) {
    return mats.sunLens(new THREE.Color(color).getHex());
  }
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: 0.88,
    roughness: 0.03,
    metalness: 0.12,
    ior: 1.54,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.6,
  });
}

function silicone() {
  const mats = getEnhancedMaterials();
  if (mats) {
    return mats.silicone();
  }
  return new THREE.MeshPhysicalMaterial({
    color: 0xf4f1ea,
    transparent: true,
    opacity: 0.82,
    roughness: 0.38,
    transmission: 0.35,
    thickness: 0.025,
    envMapIntensity: 0.8,
  });
}

function tortoise() {
  const mats = getEnhancedMaterials();
  if (mats) {
    return mats.tortoise();
  }
  return new THREE.MeshPhysicalMaterial({
    color: 0x4a3220,
    metalness: 0.05,
    roughness: 0.38,
    clearcoat: 0.7,
    clearcoatRoughness: 0.15,
    envMapIntensity: 1.0,
  });
}

function goldAccent() {
  const mats = getEnhancedMaterials();
  if (mats) {
    return mats.gold();
  }
  return new THREE.MeshPhysicalMaterial({
    color: 0xc9a227,
    metalness: 1,
    roughness: 0.28,
    clearcoat: 0.3,
    envMapIntensity: 1.3,
  });
}

const LENS_X = 0.24;

function padArms(group: THREE.Group, metalMat: THREE.Material, armX: number) {
  const padMat = silicone();
  for (const side of [-1, 1]) {
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * (armX - 0.01), 0.01, 0.002),
      new THREE.Vector3(side * armX, -0.04, -0.015),
      new THREE.Vector3(side * (armX + 0.015), -0.075, -0.035),
    ]);
    const arm = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 16, 0.003, 8), metalMat);
    const padGeom = new THREE.CapsuleGeometry(0.016, 0.036, 8, 16);
    const pad = new THREE.Mesh(padGeom, padMat);
    pad.rotation.set(0.35, side * 0.25, side * 0.4);
    pad.position.set(side * (armX + 0.02), -0.078, -0.038);
    group.add(arm, pad);
  }
}

function headOccluder(group: THREE.Group) {
  const geo = new THREE.SphereGeometry(0.52, 24, 18);
  const occluder = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false }));
  occluder.scale.set(1.05, 1.28, 0.92);
  occluder.position.set(0, -0.12, -0.5);
  group.add(occluder);

  const shadow = new THREE.Mesh(geo.clone(), new THREE.ShadowMaterial({ opacity: 0.15 }));
  shadow.scale.set(1.05, 1.28, 0.92);
  shadow.position.set(0, -0.12, -0.5);
  shadow.receiveShadow = true;
  group.add(shadow);

  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const isHelper =
        child.material instanceof THREE.MeshBasicMaterial ||
        child.material instanceof THREE.ShadowMaterial;
      if (!isHelper) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    }
  });
}

/** AERO X1 — large thin titanium panto, arched keyhole bridge (54-17-140). */
function buildAeroX1(frame: ARFrameConfig) {
  const group = new THREE.Group();
  const metal = titanium(frame.frameColor);
  const glass = opticalGlass(frame.lensColor);

  // Lens opening follows the 54-17 size while the outside keeps the shallow panto profile.
  const rimGeom = extrudeRim(
    (s) => pantoLensPath(s, 0.214, 0.188),
    (p) => pantoLensPath(p, 0.183, 0.169),
    0.022,
    0.0032
  );
  const lensGeom = extrudeLens((s) => pantoLensPath(s, 0.185, 0.171), 0.008);

  for (const side of [-1, 1]) {
    const rim = new THREE.Mesh(rimGeom, metal);
    rim.position.set(side * LENS_X, 0, 0);
    group.add(rim);

    const lens = new THREE.Mesh(lensGeom, glass);
    lens.position.set(side * LENS_X, 0, 0.006);
    group.add(lens);
  }

  // 3D sculpted arched keyhole bridge with forward curve over nose bridge
  const bridgeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.11, 0.02, 0.004),
    new THREE.Vector3(-0.045, 0.072, 0.016),
    new THREE.Vector3(0.045, 0.072, 0.016),
    new THREE.Vector3(0.11, 0.02, 0.004),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(bridgeCurve, 32, 0.0055, 12, false), metal));

  const hingeGeom = new THREE.BoxGeometry(0.016, 0.024, 0.016);
  const templeLen = 0.58;
  const templeGeom = new THREE.CylinderGeometry(0.0042, 0.003, templeLen, 16);
  templeGeom.rotateX(Math.PI / 2);
  templeGeom.translate(0, 0, -templeLen / 2);
  const tipGeom = new THREE.CapsuleGeometry(0.0065, 0.08, 6, 12);
  tipGeom.rotateX(Math.PI / 2);

  for (const side of [-1, 1]) {
    const hinge = new THREE.Mesh(hingeGeom, metal);
    hinge.position.set(side * 0.455, 0.01, 0.006);
    group.add(hinge);

    const temple = new THREE.Mesh(templeGeom, metal);
    temple.position.set(side * 0.46, 0.01, 0.006);
    temple.rotation.y = side * 0.1;
    group.add(temple);

    const tip = new THREE.Mesh(tipGeom, tortoise());
    tip.position.set(side * 0.475, 0.012, -templeLen + 0.05);
    group.add(tip);
  }

  padArms(group, metal, 0.105);
  return group;
}

/** MONOLITH 02 — chunky rectangular black acetate (50-20-145). */
function buildMonolith(frame: ARFrameConfig) {
  const group = new THREE.Group();
  const acetate = blackAcetate(frame.frameColor);
  const glass = opticalGlass(frame.lensColor);
  const gold = goldAccent();

  // The opening is scaled to the 50-20 lens size; the reduced rim wall matches the product photo.
  const rimGeom = extrudeRim(
    (s) => roundedRectPath(s, 0.44, 0.30, 0.05),
    (p) => roundedRectPath(p, 0.35, 0.24, 0.034),
    0.052,
    0.0045
  );
  const lensGeom = extrudeLens((s) => roundedRectPath(s, 0.352, 0.242, 0.034), 0.012);

  for (const side of [-1, 1]) {
    const rim = new THREE.Mesh(rimGeom, acetate);
    rim.position.set(side * LENS_X, 0, 0);
    group.add(rim);

    const lens = new THREE.Mesh(lensGeom, glass);
    lens.position.set(side * LENS_X, 0, 0.018);
    group.add(lens);
  }

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.048, 0.052), acetate);
  bridge.position.set(0, 0.018, 0.01);
  group.add(bridge);

  const templeLen = 0.58;
  const section = new THREE.Shape();
  roundedRectPath(section, 0.03, 0.05, 0.01);
  const templeGeom = new THREE.ExtrudeGeometry(section, {
    depth: templeLen,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.002,
    bevelThickness: 0.002,
  });
  templeGeom.translate(0, 0, -templeLen / 2);

  const rivetGeom = new THREE.CylinderGeometry(0.0045, 0.0045, 0.006, 12);
  rivetGeom.rotateX(Math.PI / 2);

  for (const side of [-1, 1]) {
    const temple = new THREE.Mesh(templeGeom, acetate);
    temple.position.set(side * 0.47, 0.02, 0);
    temple.rotation.y = side * 0.07;
    group.add(temple);

    for (const dx of [0.0, 0.038]) {
      const rivet = new THREE.Mesh(rivetGeom, gold);
      rivet.position.set(side * (0.455 - dx), 0.07, 0.03);
      group.add(rivet);
    }
  }

  const noseGeom = new THREE.BoxGeometry(0.026, 0.05, 0.024);
  for (const side of [-1, 1]) {
    const nose = new THREE.Mesh(noseGeom, acetate);
    nose.position.set(side * 0.16, -0.07, 0.018);
    nose.rotation.z = side * 0.32;
    group.add(nose);
  }
  return group;
}

/** ORBIT T-4 — round thin steel full-rim + brow bar + tortoise tips (48-21-140). */
function buildOrbit(frame: ARFrameConfig) {
  const group = new THREE.Group();
  const metal = titanium(frame.frameColor);
  const glass = opticalGlass(frame.lensColor);

  const rimGeom = extrudeRim(
    (s) => ovalPath(s, 0.186, 0.16),
    (p) => ovalPath(p, 0.17, 0.144),
    0.020,
    0.0028
  );
  const lensGeom = extrudeLens((s) => ovalPath(s, 0.172, 0.146), 0.008);

  for (const side of [-1, 1]) {
    const rim = new THREE.Mesh(rimGeom, metal);
    rim.position.set(side * LENS_X, 0, 0);
    group.add(rim);

    const lens = new THREE.Mesh(lensGeom, glass);
    lens.position.set(side * LENS_X, 0, 0.006);
    group.add(lens);
  }

  const bridgeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.09, 0.025, 0.002),
    new THREE.Vector3(0, 0.045, 0.012),
    new THREE.Vector3(0.09, 0.025, 0.002),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(bridgeCurve, 24, 0.0055, 10, false), metal));

  const browCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.2, 0.122, 0.012),
    new THREE.Vector3(0, 0.136, 0.016),
    new THREE.Vector3(0.2, 0.122, 0.012),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(browCurve, 24, 0.0032, 10, false), metal));

  const endGeom = new THREE.BoxGeometry(0.018, 0.024, 0.014);
  const templeLen = 0.58;
  const templeGeom = new THREE.CylinderGeometry(0.0038, 0.0028, templeLen, 14);
  templeGeom.rotateX(Math.PI / 2);
  templeGeom.translate(0, 0, -templeLen / 2);
  const tipGeom = new THREE.CapsuleGeometry(0.006, 0.08, 6, 10);
  tipGeom.rotateX(Math.PI / 2);

  for (const side of [-1, 1]) {
    const end = new THREE.Mesh(endGeom, metal);
    end.position.set(side * 0.435, 0.02, 0.004);
    group.add(end);

    const temple = new THREE.Mesh(templeGeom, metal);
    temple.position.set(side * 0.44, 0.02, 0.004);
    temple.rotation.y = side * 0.1;
    group.add(temple);

    const tip = new THREE.Mesh(tipGeom, tortoise());
    tip.position.set(side * 0.455, 0.022, -templeLen + 0.055);
    group.add(tip);
  }

  padArms(group, metal, 0.095);
  return group;
}

/** LUCENT V1 — thick crystal acetate sun with dark grey-green lenses (49-19-142). */
function buildLucent(frame: ARFrameConfig) {
  const group = new THREE.Group();
  const crystal = crystalAcetate(frame.frameColor);
  const sun = sunGlass(frame.lensColor || "#1a2430");
  const core = goldAccent();

  // Panto-shaped front follows the rounded, slightly upswept product silhouette.
  const rimGeom = extrudeRim(
    (s) => pantoLensPath(s, 0.23, 0.17),
    (p) => pantoLensPath(p, 0.17, 0.12),
    0.055,
    0.0045
  );
  const lensGeom = extrudeLens((s) => pantoLensPath(s, 0.1725, 0.1225), 0.014);

  for (const side of [-1, 1]) {
    const rim = new THREE.Mesh(rimGeom, crystal);
    rim.position.set(side * LENS_X, 0, 0);
    group.add(rim);

    const lens = new THREE.Mesh(lensGeom, sun);
    lens.position.set(side * LENS_X, 0, 0.02);
    group.add(lens);
  }

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.045, 0.055), crystal);
  bridge.position.set(0, 0.025, 0.01);
  group.add(bridge);

  const endGeom = new THREE.BoxGeometry(0.032, 0.048, 0.052);
  for (const side of [-1, 1]) {
    const end = new THREE.Mesh(endGeom, crystal);
    end.position.set(side * 0.47, 0.02, -0.01);
    group.add(end);
  }

  const templeLen = 0.6;
  const section = new THREE.Shape();
  roundedRectPath(section, 0.024, 0.042, 0.008);
  const templeGeom = new THREE.ExtrudeGeometry(section, {
    depth: templeLen,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.0025,
    bevelThickness: 0.0025,
  });
  templeGeom.translate(0, 0, -templeLen / 2);

  for (const side of [-1, 1]) {
    const temple = new THREE.Mesh(templeGeom, crystal);
    temple.position.set(side * 0.475, 0.02, 0);
    temple.rotation.y = side * 0.08;
    group.add(temple);

    // Gold core wire running through the clear temple
    const coreGeom = new THREE.CylinderGeometry(0.0035, 0.0035, templeLen - 0.1, 12);
    coreGeom.rotateX(Math.PI / 2);
    coreGeom.translate(0, 0, -0.05);
    temple.add(new THREE.Mesh(coreGeom, core));
  }

  const noseGeom = new THREE.BoxGeometry(0.024, 0.046, 0.022);
  for (const side of [-1, 1]) {
    const nose = new THREE.Mesh(noseGeom, crystal);
    nose.position.set(side * 0.16, -0.09, 0.016);
    nose.rotation.z = side * 0.35;
    group.add(nose);
  }
  return group;
}

export function createProceduralGlasses(frame: ARFrameConfig): THREE.Group {
  const style: ARFrameStyleName = frame.styleName || "panto-metal";
  let group: THREE.Group;
  switch (style) {
    case "bold-acetate":
      group = buildMonolith(frame);
      break;
    case "panto-wire":
      group = buildOrbit(frame);
      break;
    case "crystal-sun":
      group = buildLucent(frame);
      break;
    case "panto-metal":
    default:
      group = buildAeroX1(frame);
      break;
  }
  headOccluder(group);
  return group;
}

export function buildIndoorEnvTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // Sky-to-floor gradient (warm top → cool bottom)
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, "#dce4ef");
    grad.addColorStop(0.35, "#e8edf4");
    grad.addColorStop(0.55, "#d4dae4");
    grad.addColorStop(0.75, "#a8b2c0");
    grad.addColorStop(1, "#8a94a4");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const blob = (x: number, y: number, w: number, h: number, color: string) => {
      const g = ctx.createRadialGradient(
        x + w / 2,
        y + h / 2,
        4,
        x + w / 2,
        y + h / 2,
        Math.max(w, h) / 2
      );
      g.addColorStop(0, color);
      g.addColorStop(0.4, color);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
    };

    // ── Bright rectangular window / softbox highlights ──
    // Main key light — large bright rectangle (top center)
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fillRect(220, 10, 280, 120);
    // Secondary soft gradient over the window
    const winGrad = ctx.createLinearGradient(220, 10, 500, 130);
    winGrad.addColorStop(0, "rgba(255,252,245,0.7)");
    winGrad.addColorStop(0.5, "rgba(255,255,255,0.9)");
    winGrad.addColorStop(1, "rgba(240,248,255,0.7)");
    ctx.fillStyle = winGrad;
    ctx.fillRect(210, 5, 300, 135);

    // Right-side window (narrower, cooler tone)
    ctx.fillStyle = "rgba(230,240,255,0.85)";
    ctx.fillRect(640, 30, 160, 100);

    // Left-side warm fill (simulates warm bounce)
    ctx.fillStyle = "rgba(255,240,220,0.6)";
    ctx.fillRect(40, 60, 120, 90);

    // ── Diffuse ambient blobs (existing, improved) ──
    blob(140, 10, 320, 250, "rgba(255,255,255,0.6)");
    blob(460, 0, 300, 110, "rgba(255,255,255,0.55)");
    blob(760, 100, 180, 260, "rgba(220,232,248,0.5)");
    blob(30, 200, 150, 170, "rgba(255,242,220,0.3)");

    // ── Floor reflection (dark with subtle warm glow) ──
    const floorGrad = ctx.createLinearGradient(0, 380, 0, 512);
    floorGrad.addColorStop(0, "rgba(100,108,120,0.3)");
    floorGrad.addColorStop(1, "rgba(60,65,75,0.5)");
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, 380, 1024, 132);

    // ── Subtle highlight strips (simulates fluorescent tubes) ──
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(100, 20, 8, 80);
    ctx.fillRect(520, 15, 6, 90);
    ctx.fillRect(820, 40, 5, 60);
    ctx.globalAlpha = 1;
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function captureCompositeFrame(
  video: HTMLVideoElement | null,
  overlayCanvas: HTMLCanvasElement
): string | null {
  const w = overlayCanvas.width;
  const h = overlayCanvas.height;
  if (w <= 0 || h <= 0) return null;

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, w, h);

  const canDrawVideo =
    video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;

  if (canDrawVideo && video) {
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    const scale = Math.max(w / video.videoWidth, h / video.videoHeight);
    const dw = video.videoWidth * scale;
    const dh = video.videoHeight * scale;
    ctx.drawImage(video, (w - dw) / 2, (h - dh) / 2, dw, dh);
    ctx.restore();
  }

  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(overlayCanvas, 0, 0, w, h);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, h - 34, w, 34);
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = "#f8fafc";
  ctx.font = "600 13px system-ui, sans-serif";
  ctx.fillText("KLARHEIT", 14, h - 12);
  ctx.restore();

  return out.toDataURL("image/jpeg", 0.92);
}
