/**
 * High-fidelity eyewear GLB export.
 * Run from front_end: node scripts/export-frame-glbs.mjs
 */
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ── Node polyfills for GLTFExporter ─────────────────────────────────────────
class FileReaderPolyfill {
  constructor() {
    this.onload = null;
    this.onloadend = null;
    this.onerror = null;
    this.result = null;
  }
  _finish(result) {
    this.result = result;
    this.onload?.({ target: this });
    this.onloadend?.({ target: this });
  }
  readAsArrayBuffer(blob) {
    Promise.resolve(blob.arrayBuffer()).then(
      (buf) => this._finish(buf),
      (err) => {
        this.onerror?.(err);
        this.onloadend?.({ target: this });
      }
    );
  }
  readAsDataURL(blob) {
    Promise.resolve(blob.arrayBuffer()).then((buf) => {
      const b64 = Buffer.from(buf).toString("base64");
      const type = blob?.type || "application/octet-stream";
      this._finish(`data:${type};base64,${b64}`);
    });
  }
}
globalThis.FileReader = FileReaderPolyfill;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../public/models/frames");
const LENS_X = 0.24;

// ── Silhouette Helpers ──────────────────────────────────────────────────────
function roundedRect(path, w, h, r) {
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
  path.closePath();
}

/**
 * Asymmetric Boston/Panto silhouette matching aero_x1.png.
 * `side` is -1 for left lens, +1 for right lens so nasal/temporal contours mirror across x=0.
 */
function aeroPantoAt(path, cx, cy, rx, ry, side = 1) {
  const s = side;
  // Start at top-center of lens brow
  path.moveTo(cx + s * rx * 0.05, cy + ry * 0.98);
  // Brow to temporal (outer) top corner — flatter, wider upper-outer sweep
  path.bezierCurveTo(
    cx + s * rx * 0.56, cy + ry * 0.99,
    cx + s * rx * 0.94, cy + ry * 0.84,
    cx + s * rx * 0.99, cy + ry * 0.36
  );
  // Temporal cheek down to bottom-outer curve
  path.bezierCurveTo(
    cx + s * rx * 1.02, cy - ry * 0.22,
    cx + s * rx * 0.72, cy - ry * 0.88,
    cx + s * rx * 0.08, cy - ry * 0.98
  );
  // Bottom curve to nasal (inner) cheek — tapers inward toward bridge
  path.bezierCurveTo(
    cx - s * rx * 0.54, cy - ry * 0.98,
    cx - s * rx * 0.94, cy - ry * 0.44,
    cx - s * rx * 0.96, cy + ry * 0.16
  );
  // Nasal upper shoulder back to top brow
  path.bezierCurveTo(
    cx - s * rx * 0.98, cy + ry * 0.68,
    cx - s * rx * 0.52, cy + ry * 0.97,
    cx + s * rx * 0.05, cy + ry * 0.98
  );
  path.closePath();
}

/**
 * Round-panto silhouette matching orbit_t4.png (round with slightly flatter top brow).
 */
function orbitRoundAt(path, cx, cy, rx, ry) {
  path.moveTo(cx, cy + ry * 0.96);
  path.bezierCurveTo(cx + rx * 0.58, cy + ry * 0.96, cx + rx, cy + ry * 0.54, cx + rx, cy - ry * 0.02);
  path.bezierCurveTo(cx + rx, cy - ry * 0.58, cx + rx * 0.56, cy - ry, cx, cy - ry);
  path.bezierCurveTo(cx - rx * 0.56, cy - ry, cx - rx, cy - ry * 0.58, cx - rx, cy - ry * 0.02);
  path.bezierCurveTo(cx - rx, cy + ry * 0.54, cx - rx * 0.58, cy + ry * 0.96, cx, cy + ry * 0.96);
  path.closePath();
}

/**
 * Trapezoidal Wellington lens opening matching monolith_02.png.
 * Wider at top, tapered at bottom, with smooth rounded corners.
 */
function monolithLensAt(path, cx, cy, rx, ry, side = 1) {
  const s = side;
  const topIn = -rx * 0.88;
  const topOut = rx * 0.96;
  const botOut = rx * 0.82;
  const botIn = -rx * 0.76;
  path.moveTo(cx + s * topIn * 0.5, cy + ry * 0.96);
  // Top brow edge to outer-top corner
  path.bezierCurveTo(
    cx + s * topOut * 0.65, cy + ry * 0.98,
    cx + s * topOut, cy + ry * 0.92,
    cx + s * topOut, cy + ry * 0.52
  );
  // Slanted outer edge down to bottom-outer corner
  path.bezierCurveTo(
    cx + s * topOut * 0.98, cy - ry * 0.15,
    cx + s * botOut * 1.04, cy - ry * 0.92,
    cx + s * botOut * 0.58, cy - ry * 0.96
  );
  // Flat-ish bottom edge to bottom-inner corner
  path.lineTo(cx + s * botIn * 0.55, cy - ry * 0.96);
  path.bezierCurveTo(
    cx + s * botIn * 0.98, cy - ry * 0.92,
    cx + s * topIn * 0.95, cy - ry * 0.25,
    cx + s * topIn, cy + ry * 0.38
  );
  // Inner nasal edge up to top-inner corner
  path.bezierCurveTo(
    cx + s * topIn * 1.02, cy + ry * 0.88,
    cx + s * topIn * 0.82, cy + ry * 0.95,
    cx + s * topIn * 0.5, cy + ry * 0.96
  );
  path.closePath();
}

/**
 * Continuous one-piece Wellington acetate front (MONOLITH 02) matching monolith_02.png:
 * - Stepped-down horizontal top bridge
 * - Crisp endpiece lugs that step inward cleanly onto the slanted lower cheek
 * - Uniform rim thickness around the trapezoidal Wellington lenses
 */
function drawMonolithFrontOutline(shape) {
  // Center of stepped-down top bridge
  shape.moveTo(0, 0.108);
  shape.lineTo(0.042, 0.108);
  // Step up to bold horizontal brow line
  shape.bezierCurveTo(0.064, 0.108, 0.072, 0.140, 0.105, 0.142);
  shape.lineTo(0.448, 0.138);
  // Right outer endpiece lug (top-outer corner)
  shape.quadraticCurveTo(0.482, 0.137, 0.484, 0.118);
  shape.lineTo(0.482, 0.036);
  // Crisp step-in from lug to slanted outer rim wall
  shape.quadraticCurveTo(0.480, 0.018, 0.446, 0.012);
  // Slanted outer cheek down to bottom-outer corner
  shape.bezierCurveTo(0.436, -0.065, 0.422, -0.138, 0.376, -0.146);
  shape.lineTo(0.142, -0.146);
  // Slanted inner nasal wall up to saddle bridge arch
  shape.bezierCurveTo(0.096, -0.142, 0.074, -0.075, 0.056, 0.012);
  shape.bezierCurveTo(0.044, 0.054, 0.024, 0.064, 0, 0.064);
  // Left saddle bridge arch & inner nasal wall
  shape.bezierCurveTo(-0.024, 0.064, -0.044, 0.054, -0.056, 0.012);
  shape.bezierCurveTo(-0.074, -0.075, -0.096, -0.142, -0.142, -0.146);
  shape.lineTo(-0.376, -0.146);
  // Left slanted outer cheek up to lug step
  shape.bezierCurveTo(-0.422, -0.138, -0.436, -0.065, -0.446, 0.012);
  shape.quadraticCurveTo(-0.480, 0.018, -0.482, 0.036);
  shape.lineTo(-0.484, 0.118);
  shape.quadraticCurveTo(-0.482, 0.137, -0.448, 0.138);
  shape.lineTo(-0.105, 0.142);
  shape.bezierCurveTo(-0.072, 0.140, -0.064, 0.108, -0.042, 0.108);
  shape.lineTo(0, 0.108);
  shape.closePath();
}

/**
 * Softly rounded trapezoidal Panto lens opening matching lucent_v1.png.
 */
function lucentLensAt(path, cx, cy, rx, ry, side = 1) {
  const s = side;
  path.moveTo(cx, cy + ry * 0.96);
  // Top brow to outer-top corner
  path.bezierCurveTo(
    cx + s * rx * 0.58, cy + ry * 0.98,
    cx + s * rx * 0.98, cy + ry * 0.80,
    cx + s * rx * 0.98, cy + ry * 0.28
  );
  // Outer cheek to rounded bottom
  path.bezierCurveTo(
    cx + s * rx * 0.96, cy - ry * 0.42,
    cx + s * rx * 0.66, cy - ry * 0.96,
    cx + s * rx * 0.04, cy - ry * 0.98
  );
  // Bottom to inner nasal cheek
  path.bezierCurveTo(
    cx - s * rx * 0.58, cy - ry * 0.98,
    cx - s * rx * 0.92, cy - ry * 0.46,
    cx - s * rx * 0.92, cy + ry * 0.22
  );
  // Inner nasal shoulder to top brow
  path.bezierCurveTo(
    cx - s * rx * 0.92, cy + ry * 0.76,
    cx - s * rx * 0.52, cy + ry * 0.95,
    cx, cy + ry * 0.96
  );
  path.closePath();
}

/**
 * Continuous one-piece Panto crystal acetate front (LUCENT V1) matching lucent_v1.png:
 * - Stepped-down bridge top, keyhole bridge arch, uniform slender rim border, upswept lugs
 */
function drawLucentFrontOutline(shape) {
  shape.moveTo(0, 0.102);
  shape.lineTo(0.038, 0.102);
  // Step up onto arched panto brow
  shape.bezierCurveTo(0.058, 0.104, 0.072, 0.146, 0.165, 0.156);
  shape.bezierCurveTo(0.285, 0.164, 0.395, 0.146, 0.468, 0.122);
  // Right upswept endpiece lug
  shape.quadraticCurveTo(0.486, 0.114, 0.486, 0.088);
  shape.lineTo(0.484, 0.042);
  shape.quadraticCurveTo(0.482, 0.022, 0.448, 0.012);
  // Slender outer cheek & rounded panto bottom (uniform border around lens)
  shape.bezierCurveTo(0.438, -0.075, 0.378, -0.158, 0.246, -0.162);
  shape.bezierCurveTo(0.132, -0.162, 0.076, -0.095, 0.056, -0.008);
  // Sculpted keyhole bridge arch
  shape.bezierCurveTo(0.044, 0.048, 0.022, 0.064, 0, 0.064);
  shape.bezierCurveTo(-0.022, 0.064, -0.044, 0.048, -0.056, -0.008);
  // Left bottom & outer cheek
  shape.bezierCurveTo(-0.076, -0.095, -0.132, -0.162, -0.246, -0.162);
  shape.bezierCurveTo(-0.378, -0.158, -0.438, -0.075, -0.448, 0.012);
  shape.quadraticCurveTo(-0.482, 0.022, -0.484, 0.042);
  shape.lineTo(-0.486, 0.088);
  shape.quadraticCurveTo(-0.486, 0.114, -0.468, 0.122);
  shape.bezierCurveTo(-0.395, 0.146, -0.285, 0.164, -0.165, 0.156);
  shape.bezierCurveTo(-0.072, 0.146, -0.058, 0.104, -0.038, 0.102);
  shape.lineTo(0, 0.102);
  shape.closePath();
}

function smoothAndIndexGeometry(geom) {
  const pos = geom.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    uv[i * 2] = x * 2.0 + z * 0.5 + 0.5;
    uv[i * 2 + 1] = y * 2.0 + z * 0.5 + 0.5;
  }
  geom.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geom.deleteAttribute("normal");
  const indexed = mergeVertices(geom, 1e-4);
  indexed.computeVertexNormals();
  return indexed;
}

/**
 * Smooth spherical/cylindrical 4.5D base curve + face-form wrap + pantoscopic tilt.
 * Zeroed at gx = ±LENS_X so lens centers remain anchored at z = 0.
 */
function applyOpticalCurvature(geom, xCenter = 0, wrapK = 0.075) {
  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const gx = x + xCenter;
    const wrapZ = -wrapK * (gx * gx - LENS_X * LENS_X) - 0.032 * y * y;
    const tiltZ = y * 0.055;
    pos.setZ(i, z + wrapZ + tiltZ);
  }
  pos.needsUpdate = true;
  return smoothAndIndexGeometry(geom);
}

function rimGeom(drawOuter, drawInner, depth, bevel, xCenter = 0) {
  const outer = new THREE.Shape();
  drawOuter(outer);
  const hole = new THREE.Path();
  drawInner(hole);
  outer.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(outer, {
    depth,
    curveSegments: 28,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
  });
  return applyOpticalCurvature(g, xCenter, 0.075);
}

function onePieceAcetateFrontGeom(drawFront, drawLeftHole, drawRightHole, depth, bevel) {
  const outer = new THREE.Shape();
  drawFront(outer);
  const leftHole = new THREE.Path();
  drawLeftHole(leftHole);
  const rightHole = new THREE.Path();
  drawRightHole(rightHole);
  outer.holes.push(leftHole, rightHole);
  const g = new THREE.ExtrudeGeometry(outer, {
    depth,
    curveSegments: 28,
    bevelEnabled: true,
    bevelSegments: 5,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
  });
  return applyOpticalCurvature(g, 0, 0.08);
}

/** Meniscus optical lens with spherical base-curve and edge bevel. */
function lensGeom(draw, depth, bulge = 0.0055, xCenter = 0, wrapK = 0.075) {
  const s = new THREE.Shape();
  draw(s);
  const g = new THREE.ExtrudeGeometry(s, {
    depth,
    curveSegments: 28,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.0008,
    bevelThickness: 0.0008,
  });
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.min(1, Math.hypot(x, y) / 0.2);
    const meniscus = bulge * (1 - r * r);
    pos.setZ(i, z + meniscus);
  }
  return applyOpticalCurvature(g, xCenter, wrapK);
}

// ── Materials (matched by enhanceGlbMaterials at runtime) ───────────────────
function titanium(color = 0xb8bec6) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 1,
    roughness: 0.28,
    clearcoat: 0.15,
    clearcoatRoughness: 0.25,
    name: "titanium",
  });
}

function blackAcetate(color = 0x121214) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0,
    roughness: 0.14,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    name: "acetate-black",
  });
}

function crystalMat() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.025,
    transmission: 1,
    thickness: 0.03,
    ior: 1.52,
    transparent: true,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    name: "crystal",
  });
}

function sunLens(color = 0x242b32) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0,
    roughness: 0,
    transparent: true,
    transmission: 1,
    thickness: 0.014,
    ior: 1.5,
    clearcoat: 1,
    name: "sun-lens",
  });
}

function opticalLens(color = 0xffffff) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0,
    roughness: 0,
    transparent: true,
    transmission: 1,
    thickness: 0.014,
    ior: 1.5,
    clearcoat: 1,
    name: "optical-lens",
  });
}

function tortoise() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x6b3a18,
    metalness: 0,
    roughness: 0.18,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    name: "tortoise",
  });
}

function amberAcetate(color = 0xb46a28) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0,
    roughness: 0.08,
    transmission: 0.52,
    thickness: 0.026,
    ior: 1.5,
    transparent: true,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    name: "amber-acetate",
  });
}

function goldCore(color = 0xd8b46c) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 1,
    roughness: 0.24,
    name: "gold",
  });
}

function aviatorTeardropAt(path, cx, cy, rx, ry, side = 1) {
  const s = side;
  path.moveTo(cx, cy + ry * 0.94);
  path.bezierCurveTo(
    cx + s * rx * 0.58, cy + ry * 0.95,
    cx + s * rx * 0.96, cy + ry * 0.80,
    cx + s * rx * 0.98, cy + ry * 0.32
  );
  path.bezierCurveTo(
    cx + s * rx * 1.02, cy - ry * 0.35,
    cx + s * rx * 0.76, cy - ry * 1.04,
    cx + s * rx * 0.18, cy - ry * 1.06
  );
  path.bezierCurveTo(
    cx - s * rx * 0.42, cy - ry * 1.02,
    cx - s * rx * 0.90, cy - ry * 0.36,
    cx - s * rx * 0.94, cy + ry * 0.24
  );
  path.bezierCurveTo(
    cx - s * rx * 0.96, cy + ry * 0.74,
    cx - s * rx * 0.52, cy + ry * 0.93,
    cx, cy + ry * 0.94
  );
  path.closePath();
}

function catEyeLensAt(path, cx, cy, rx, ry, side = 1) {
  const s = side;
  path.moveTo(cx - s * rx * 0.10, cy + ry * 0.86);
  path.bezierCurveTo(
    cx + s * rx * 0.46, cy + ry * 0.94,
    cx + s * rx * 0.96, cy + ry * 1.04,
    cx + s * rx * 1.00, cy + ry * 0.56
  );
  path.bezierCurveTo(
    cx + s * rx * 0.94, cy - ry * 0.18,
    cx + s * rx * 0.58, cy - ry * 0.94,
    cx - s * rx * 0.04, cy - ry * 0.98
  );
  path.bezierCurveTo(
    cx - s * rx * 0.62, cy - ry * 0.96,
    cx - s * rx * 0.92, cy - ry * 0.36,
    cx - s * rx * 0.90, cy + ry * 0.24
  );
  path.bezierCurveTo(
    cx - s * rx * 0.86, cy + ry * 0.72,
    cx - s * rx * 0.52, cy + ry * 0.84,
    cx - s * rx * 0.10, cy + ry * 0.86
  );
  path.closePath();
}

function drawVelvetFrontOutline(shape) {
  shape.moveTo(0, 0.088);
  shape.lineTo(0.042, 0.088);
  shape.bezierCurveTo(0.072, 0.094, 0.130, 0.146, 0.245, 0.154);
  shape.bezierCurveTo(0.355, 0.162, 0.448, 0.174, 0.494, 0.158);
  shape.quadraticCurveTo(0.508, 0.152, 0.502, 0.122);
  shape.lineTo(0.486, 0.056);
  shape.bezierCurveTo(0.464, -0.030, 0.404, -0.152, 0.240, -0.162);
  shape.bezierCurveTo(0.126, -0.162, 0.074, -0.095, 0.056, -0.006);
  shape.bezierCurveTo(0.044, 0.044, 0.022, 0.056, 0, 0.056);
  shape.bezierCurveTo(-0.022, 0.056, -0.044, 0.044, -0.056, -0.006);
  shape.bezierCurveTo(-0.074, -0.095, -0.126, -0.162, -0.240, -0.162);
  shape.bezierCurveTo(-0.404, -0.152, -0.464, -0.030, -0.486, 0.056);
  shape.lineTo(-0.502, 0.122);
  shape.quadraticCurveTo(-0.508, 0.152, -0.494, 0.158);
  shape.bezierCurveTo(-0.448, 0.174, -0.355, 0.162, -0.245, 0.154);
  shape.bezierCurveTo(-0.130, 0.146, -0.072, 0.094, -0.042, 0.088);
  shape.lineTo(0, 0.088);
  shape.closePath();
}

function hexGeometricAt(path, cx, cy, rx, ry) {
  const pts = [
    [cx - 0.62 * rx, cy + 0.96 * ry],
    [cx + 0.62 * rx, cy + 0.96 * ry],
    [cx + 1.00 * rx, cy + 0.12 * ry],
    [cx + 0.58 * rx, cy - 0.96 * ry],
    [cx - 0.58 * rx, cy - 0.96 * ry],
    [cx - 1.00 * rx, cy + 0.12 * ry],
  ];
  const f = 0.14;
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[(i - 1 + pts.length) % pts.length];
    const curr = pts[i];
    const next = pts[(i + 1) % pts.length];
    const ax = curr[0] + (prev[0] - curr[0]) * f;
    const ay = curr[1] + (prev[1] - curr[1]) * f;
    const bx = curr[0] + (next[0] - curr[0]) * f;
    const by = curr[1] + (next[1] - curr[1]) * f;
    if (i === 0) {
      path.moveTo(ax, ay);
    } else {
      path.lineTo(ax, ay);
    }
    path.quadraticCurveTo(curr[0], curr[1], bx, by);
  }
  path.closePath();
}

function narrowRectLensAt(path, cx, cy, rx, ry, side = 1) {
  const s = side;
  const topIn = -rx * 0.84;
  const topOut = rx * 0.96;
  const botOut = rx * 0.88;
  const botIn = -rx * 0.70;
  path.moveTo(cx + s * topIn * 0.52, cy + ry * 0.98);
  path.bezierCurveTo(
    cx + s * topOut * 0.68, cy + ry * 0.99,
    cx + s * topOut, cy + ry * 0.94,
    cx + s * topOut, cy + ry * 0.50
  );
  path.bezierCurveTo(
    cx + s * topOut * 0.99, cy - ry * 0.14,
    cx + s * botOut * 1.03, cy - ry * 0.92,
    cx + s * botOut * 0.58, cy - ry * 0.98
  );
  path.lineTo(cx + s * botIn * 0.54, cy - ry * 0.98);
  path.bezierCurveTo(
    cx + s * botIn * 0.98, cy - ry * 0.92,
    cx + s * topIn * 0.92, cy - ry * 0.24,
    cx + s * topIn, cy + ry * 0.42
  );
  path.bezierCurveTo(
    cx + s * topIn * 1.02, cy + ry * 0.90,
    cx + s * topIn * 0.84, cy + ry * 0.97,
    cx + s * topIn * 0.52, cy + ry * 0.98
  );
  path.closePath();
}

function drawAmberFrontOutline(shape) {
  shape.moveTo(0, 0.098);
  shape.lineTo(0.044, 0.098);
  shape.bezierCurveTo(0.064, 0.098, 0.074, 0.121, 0.106, 0.123);
  shape.lineTo(0.452, 0.121);
  shape.quadraticCurveTo(0.480, 0.119, 0.482, 0.098);
  shape.lineTo(0.480, 0.044);
  shape.quadraticCurveTo(0.478, 0.026, 0.440, 0.020);
  shape.bezierCurveTo(0.432, -0.056, 0.422, -0.116, 0.390, -0.122);
  shape.lineTo(0.126, -0.122);
  shape.bezierCurveTo(0.090, -0.116, 0.072, -0.052, 0.058, 0.020);
  shape.bezierCurveTo(0.044, 0.056, 0.022, 0.066, 0, 0.066);
  shape.bezierCurveTo(-0.022, 0.066, -0.044, 0.056, -0.058, 0.020);
  shape.bezierCurveTo(-0.072, -0.052, -0.090, -0.116, -0.126, -0.122);
  shape.lineTo(-0.390, -0.122);
  shape.bezierCurveTo(-0.422, -0.116, -0.432, -0.056, -0.440, 0.020);
  shape.quadraticCurveTo(-0.478, 0.026, -0.480, 0.044);
  shape.lineTo(-0.482, 0.098);
  shape.quadraticCurveTo(-0.480, 0.119, -0.452, 0.121);
  shape.lineTo(-0.106, 0.123);
  shape.bezierCurveTo(-0.074, 0.121, -0.064, 0.098, -0.044, 0.098);
  shape.lineTo(0, 0.098);
  shape.closePath();
}

// ── Shared Hardware & Ergonomic Temple Builders ─────────────────────────────
function addHinge(group, metal, x, y = 0.015, z = -0.008) {
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0038, 0.0038, 0.016, 12),
    metal
  );
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(x, y, z);
  group.add(barrel);

  const screw = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0022, 0.0022, 0.004, 10),
    metal
  );
  screw.position.set(x, y + 0.008, z);
  group.add(screw);
}

/**
 * S-curved gooseneck pad arms with metallic/silicone nose pads.
 */
function addGooseneckPads(group, metalMat, padMat, armX = 0.074, yTop = 0.004) {
  for (const side of [-1, 1]) {
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * armX, yTop, 0.002),
      new THREE.Vector3(side * (armX - 0.008), yTop - 0.014, -0.016),
      new THREE.Vector3(side * (armX + 0.006), yTop - 0.044, -0.028),
      new THREE.Vector3(side * (armX + 0.018), yTop - 0.066, -0.024),
    ]);
    const arm = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 20, 0.0020, 8, false), metalMat);
    group.add(arm);

    const padGeo = new THREE.CapsuleGeometry(0.0095, 0.022, 8, 14);
    padGeo.scale(0.38, 1.0, 0.68);
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.rotation.set(0.28, side * 0.26, side * 0.32);
    pad.position.set(side * (armX + 0.022), yTop - 0.070, -0.024);
    group.add(pad);
  }
}

/**
 * All-titanium wire temple with sculpted titanium paddle ear tip (matches aero_x1.png).
 */
function addAeroTitaniumTemple(group, metal, side, x = 0.452, y = 0.024, zStart = -0.012) {
  const shaftCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * x, y, zStart),
    new THREE.Vector3(side * (x + 0.012), y + 0.001, zStart - 0.16),
    new THREE.Vector3(side * (x + 0.015), y - 0.002, zStart - 0.34),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(shaftCurve, 24, 0.0028, 10, false), metal));

  // Tapered flat-oval titanium paddle tip with ergonomic ear bend
  const tipCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * (x + 0.015), y - 0.002, zStart - 0.33),
    new THREE.Vector3(side * (x + 0.012), y - 0.010, zStart - 0.43),
    new THREE.Vector3(side * (x + 0.002), y - 0.046, zStart - 0.51),
    new THREE.Vector3(side * (x - 0.010), y - 0.088, zStart - 0.565),
  ]);
  const paddleGeo = new THREE.TubeGeometry(tipCurve, 24, 0.0050, 10, false);
  const pos = paddleGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const center = side * (x + 0.006);
    pos.setX(i, center + (px - center) * 0.42);
  }
  pos.needsUpdate = true;
  paddleGeo.computeVertexNormals();
  group.add(new THREE.Mesh(paddleGeo, metal));
}

/**
 * Metal wire temple with curved tortoiseshell drop-end sleeve (matches orbit_t4.png).
 */
function addOrbitTempleWithTortoiseTip(group, metal, tipMat, side, x = 0.436, y = 0.016, zStart = -0.010) {
  const shaftCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * x, y, zStart),
    new THREE.Vector3(side * (x + 0.010), y + 0.001, zStart - 0.18),
    new THREE.Vector3(side * (x + 0.014), y - 0.002, zStart - 0.36),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(shaftCurve, 22, 0.0026, 10, false), metal));

  const sleeveCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * (x + 0.014), y - 0.002, zStart - 0.35),
    new THREE.Vector3(side * (x + 0.012), y - 0.012, zStart - 0.44),
    new THREE.Vector3(side * (x + 0.002), y - 0.052, zStart - 0.52),
    new THREE.Vector3(side * (x - 0.008), y - 0.094, zStart - 0.57),
  ]);
  const sleeveGeo = new THREE.TubeGeometry(sleeveCurve, 24, 0.0054, 10, false);
  group.add(new THREE.Mesh(sleeveGeo, tipMat));
}

/**
 * Ergonomic sculpted acetate temple slab with step-down profile and drop-end ear bend.
 * Optionally embeds a metallic core wire + internal hinge plate (for LUCENT V1).
 */
function addSculptedAcetateTemple(group, mat, side, xStart, yStart, zStart, w, h, len = 0.58, coreMat = null) {
  const section = new THREE.Shape();
  roundedRect(section, w, h, Math.min(w * 0.42, 0.005));
  const geom = new THREE.ExtrudeGeometry(section, {
    depth: len,
    curveSegments: 16,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 18,
    bevelSize: 0.0014,
    bevelThickness: 0.0014,
  });

  const pos = geom.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const lx = pos.getX(i);
    const ly = pos.getY(i);
    const lz = pos.getZ(i);
    const t = THREE.MathUtils.clamp(lz / len, 0, 1);

    const heightScale =
      t < 0.22
        ? 1.0
        : t < 0.66
          ? THREE.MathUtils.lerp(1.0, 0.64, (t - 0.22) / 0.44)
          : THREE.MathUtils.lerp(0.64, 0.84, (t - 0.66) / 0.34);

    const bowX = side * (Math.sin(t * Math.PI * 0.82) * 0.014 - (t > 0.68 ? Math.pow((t - 0.68) / 0.32, 1.6) * 0.020 : 0));
    const dropY = t > 0.62 ? -Math.pow((t - 0.62) / 0.38, 1.85) * 0.095 : 0;

    pos.setX(i, side * xStart + lx + bowX);
    pos.setY(i, yStart + ly * heightScale + dropY);
    pos.setZ(i, zStart - lz);
  }
  pos.needsUpdate = true;
  // Reflecting Z reverses orientation; restore outward winding before computing normals.
  const indices = [];
  for (let i = 0; i < pos.count; i += 3) indices.push(i, i + 2, i + 1);
  geom.setIndex(indices);
  group.add(new THREE.Mesh(smoothAndIndexGeometry(geom), mat));

  if (coreMat) {
    const corePts = [];
    const segs = 18;
    for (let s = 0; s <= segs; s++) {
      const t = 0.02 + (s / segs) * 0.90;
      const bowX = side * (Math.sin(t * Math.PI * 0.82) * 0.014 - (t > 0.68 ? Math.pow((t - 0.68) / 0.32, 1.6) * 0.020 : 0));
      const dropY = t > 0.62 ? -Math.pow((t - 0.62) / 0.38, 1.85) * 0.095 : 0;
      corePts.push(new THREE.Vector3(side * xStart + bowX, yStart + dropY, zStart - t * len));
    }
    const coreCurve = new THREE.CatmullRomCurve3(corePts);
    const coreGeo = new THREE.TubeGeometry(coreCurve, 24, 0.0028, 10, false);
    group.add(new THREE.Mesh(coreGeo, coreMat));
  }
}

// ── Frame 1: AERO X1 (54-17-140) — Brushed Grade 5 Titanium Panto ──────────
function buildAero() {
  const group = new THREE.Group();
  group.name = "AERO_X1";
  const metal = titanium(0xc1bab1);
  const glass = opticalLens();

  for (const side of [-1, 1]) {
    const rim = rimGeom(
      (s) => aeroPantoAt(s, 0, 0, 0.194, 0.164, side),
      (p) => aeroPantoAt(p, 0, 0, 0.186, 0.156, side),
      0.012,
      0.0012,
      side * LENS_X
    );
    const rMesh = new THREE.Mesh(rim, metal);
    rMesh.position.set(side * LENS_X, 0, 0);
    group.add(rMesh);

    const lens = lensGeom((s) => aeroPantoAt(s, 0, 0, 0.187, 0.157, side), 0.005, 0.0055, side * LENS_X);
    const lMesh = new THREE.Mesh(lens, glass);
    lMesh.position.set(side * LENS_X, 0, 0.003);
    group.add(lMesh);
  }

  // Sculpted arched metal bridge connecting the nasal shoulders cleanly
  const bridgeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.056, 0.026, 0.009),
    new THREE.Vector3(-0.026, 0.044, 0.016),
    new THREE.Vector3(0.026, 0.044, 0.016),
    new THREE.Vector3(0.056, 0.026, 0.009),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(bridgeCurve, 28, 0.0036, 12, false), metal));

  // Ribbed horizontal titanium endpieces + hinges + all-titanium paddle temples
  for (const side of [-1, 1]) {
    for (const dy of [-0.0035, 0, 0.0035]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.0022, 0.008), metal);
      rib.position.set(side * 0.444, 0.026 + dy, -0.004);
      group.add(rib);
    }
    addHinge(group, metal, side * 0.454, 0.026, -0.010);
    addAeroTitaniumTemple(group, metal, side, 0.454, 0.026, -0.010);
  }

  addGooseneckPads(group, metal, metal, 0.072, 0.002);
  return group;
}

// ── Frame 2: MONOLITH 02 (50-20-145) — Architectural Black Acetate ─────────
function buildMonolith() {
  const group = new THREE.Group();
  group.name = "MONOLITH_02";
  const acetate = blackAcetate(0x121214);
  const glass = opticalLens();
  const hardware = titanium(0xd4d8de);

  // Continuous CNC-milled one-piece Wellington front (realistic ~4.3mm Z thickness)
  const frontGeo = onePieceAcetateFrontGeom(
    drawMonolithFrontOutline,
    (hole) => monolithLensAt(hole, -LENS_X, -0.004, 0.172, 0.116, -1),
    (hole) => monolithLensAt(hole, LENS_X, -0.004, 0.172, 0.116, 1),
    0.022,
    0.0036
  );
  group.add(new THREE.Mesh(frontGeo, acetate));

  for (const side of [-1, 1]) {
    const lens = lensGeom((s) => monolithLensAt(s, 0, -0.004, 0.174, 0.118, side), 0.006, 0.0055, side * LENS_X, 0.08);
    const lMesh = new THREE.Mesh(lens, glass);
    lMesh.position.set(side * LENS_X, 0, 0.008);
    group.add(lMesh);
  }

  for (const side of [-1, 1]) {
    // Wide sculpted black acetate temple flush with the tall endpiece lug
    addSculptedAcetateTemple(group, acetate, side, 0.468, 0.082, -0.004, 0.014, 0.082, 0.58);
    addHinge(group, hardware, side * 0.458, 0.082, -0.004);

    // Contoured inner acetate nose pads
    const noseGeo = new THREE.CapsuleGeometry(0.009, 0.028, 8, 12);
    noseGeo.scale(0.55, 1.0, 0.8);
    const nose = new THREE.Mesh(noseGeo, acetate);
    nose.position.set(side * 0.064, -0.042, 0.002);
    nose.rotation.set(0.22, side * -0.25, side * 0.28);
    group.add(nose);
  }
  return group;
}

// ── Frame 3: ORBIT T-4 (48-21-140) — Double-Bridge Round Titanium + Tortoise ─
function buildOrbit() {
  const group = new THREE.Group();
  group.name = "ORBIT_T4";
  const metal = titanium(0xb7b8b4);
  const glass = opticalLens();
  const tip = tortoise();

  for (const side of [-1, 1]) {
    const rim = rimGeom(
      (s) => orbitRoundAt(s, 0, 0, 0.180, 0.166),
      (p) => orbitRoundAt(p, 0, 0, 0.172, 0.158),
      0.012,
      0.0012,
      side * LENS_X
    );
    const rMesh = new THREE.Mesh(rim, metal);
    rMesh.position.set(side * LENS_X, 0, 0);
    group.add(rMesh);

    const lens = lensGeom((s) => orbitRoundAt(s, 0, 0, 0.173, 0.159), 0.005, 0.0055, side * LENS_X);
    const lMesh = new THREE.Mesh(lens, glass);
    lMesh.position.set(side * LENS_X, 0, 0.003);
    group.add(lMesh);
  }

  // Lower arched bridge
  const bridgeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.068, 0.026, 0.008),
    new THREE.Vector3(0, 0.046, 0.016),
    new THREE.Vector3(0.068, 0.026, 0.008),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(bridgeCurve, 24, 0.0038, 12, false), metal));

  // Signature flat-top aviator brow bar welded across the upper rim crests (matches orbit_t4.png)
  const browCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.215, 0.156, 0.009),
    new THREE.Vector3(0, 0.164, 0.014),
    new THREE.Vector3(0.215, 0.156, 0.009),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(browCurve, 28, 0.0028, 10, false), metal));

  for (const side of [-1, 1]) {
    const lug = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.012, 0.009), metal);
    lug.position.set(side * 0.428, 0.016, -0.003);
    group.add(lug);
    addHinge(group, metal, side * 0.438, 0.016, -0.008);
    addOrbitTempleWithTortoiseTip(group, metal, tip, side, 0.438, 0.016, -0.008);
  }

  addGooseneckPads(group, metal, metal, 0.076, 0.002);
  return group;
}

// ── Frame 4: LUCENT V1 (49-19-142) — Crystal Panto Sun + Core Wire ─────────
function buildLucent() {
  const group = new THREE.Group();
  group.name = "LUCENT_V1";
  const crystal = crystalMat();
  const sun = sunLens(0x232a31);
  const core = titanium(0xc8cfd8);

  // Continuous one-piece crystal acetate front (realistic ~4.3mm Z thickness)
  const frontGeo = onePieceAcetateFrontGeom(
    drawLucentFrontOutline,
    (hole) => lucentLensAt(hole, -LENS_X, -0.002, 0.174, 0.132, -1),
    (hole) => lucentLensAt(hole, LENS_X, -0.002, 0.174, 0.132, 1),
    0.022,
    0.0038
  );
  group.add(new THREE.Mesh(frontGeo, crystal));

  for (const side of [-1, 1]) {
    const lens = lensGeom((s) => lucentLensAt(s, 0, -0.002, 0.176, 0.134, side), 0.007, 0.0055, side * LENS_X, 0.08);
    const lMesh = new THREE.Mesh(lens, sun);
    lMesh.position.set(side * LENS_X, 0, 0.008);
    group.add(lMesh);
  }

  // Signature diamond/lozenge front rivet + internal hinge block visible inside crystal lug
  const diamondShape = new THREE.Shape();
  diamondShape.moveTo(-0.013, 0);
  diamondShape.lineTo(0, 0.0055);
  diamondShape.lineTo(0.013, 0);
  diamondShape.lineTo(0, -0.0055);
  diamondShape.closePath();
  const diamondGeo = new THREE.ExtrudeGeometry(diamondShape, {
    depth: 0.016,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.0006,
    bevelThickness: 0.0006,
  });

  for (const side of [-1, 1]) {
    // Sculpted crystal temple flush with upswept lug + curved metallic core wire inside
    addSculptedAcetateTemple(group, crystal, side, 0.468, 0.074, -0.004, 0.014, 0.058, 0.58, core);
    addHinge(group, core, side * 0.462, 0.074, -0.002);

    const rivet = new THREE.Mesh(diamondGeo, core);
    rivet.position.set(side * 0.458, 0.076, 0.002);
    rivet.rotation.y = side * -0.08;
    group.add(rivet);

    const noseGeo = new THREE.CapsuleGeometry(0.009, 0.026, 8, 12);
    noseGeo.scale(0.55, 1.0, 0.8);
    const nose = new THREE.Mesh(noseGeo, crystal);
    nose.position.set(side * 0.060, -0.044, 0.002);
    nose.rotation.set(0.22, side * -0.25, side * 0.3);
    group.add(nose);
  }
  return group;
}

// ── Frame 5: SOLARIS A1 (56-16-145) — Champagne Gold Double-Bridge Aviator ──
function buildSolaris() {
  const group = new THREE.Group();
  group.name = "SOLARIS_A1";
  const metal = titanium(0xd4b483);
  const glass = opticalLens();

  for (const side of [-1, 1]) {
    const rim = rimGeom(
      (s) => aviatorTeardropAt(s, 0, -0.006, 0.198, 0.170, side),
      (p) => aviatorTeardropAt(p, 0, -0.006, 0.190, 0.162, side),
      0.012,
      0.0012,
      side * LENS_X
    );
    const rMesh = new THREE.Mesh(rim, metal);
    rMesh.position.set(side * LENS_X, 0, 0);
    group.add(rMesh);

    const lens = lensGeom((s) => aviatorTeardropAt(s, 0, -0.006, 0.191, 0.163, side), 0.005, 0.0055, side * LENS_X);
    const lMesh = new THREE.Mesh(lens, glass);
    lMesh.position.set(side * LENS_X, 0, 0.003);
    group.add(lMesh);
  }

  // Lower arched bridge
  const bridgeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.056, 0.044, 0.009),
    new THREE.Vector3(-0.024, 0.062, 0.016),
    new THREE.Vector3(0.024, 0.062, 0.016),
    new THREE.Vector3(0.056, 0.044, 0.009),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(bridgeCurve, 28, 0.0036, 12, false), metal));

  // Signature straight upper aviator double brow bar
  const browCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.232, 0.156, 0.011),
    new THREE.Vector3(0, 0.162, 0.015),
    new THREE.Vector3(0.232, 0.156, 0.011),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(browCurve, 28, 0.0030, 10, false), metal));

  for (const side of [-1, 1]) {
    const lug = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.013, 0.009), metal);
    lug.position.set(side * 0.442, 0.044, -0.004);
    group.add(lug);
    addHinge(group, metal, side * 0.452, 0.044, -0.010);
    addAeroTitaniumTemple(group, metal, side, 0.452, 0.044, -0.010);
  }

  addGooseneckPads(group, metal, metal, 0.068, 0.016);
  return group;
}

// ── Frame 6: VELVET C3 (52-18-142) — Burgundy Sculpted Cat-Eye Acetate ──────
function buildVelvet() {
  const group = new THREE.Group();
  group.name = "VELVET_C3";
  const acetate = new THREE.MeshPhysicalMaterial({
    color: 0x6b1d2f,
    metalness: 0,
    roughness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    name: "acetate",
  });
  const glass = opticalLens();
  const hardware = titanium(0xd8dde4);

  const frontGeo = onePieceAcetateFrontGeom(
    drawVelvetFrontOutline,
    (hole) => catEyeLensAt(hole, -LENS_X, -0.008, 0.166, 0.126, -1),
    (hole) => catEyeLensAt(hole, LENS_X, -0.008, 0.166, 0.126, 1),
    0.022,
    0.0038
  );
  group.add(new THREE.Mesh(frontGeo, acetate));

  for (const side of [-1, 1]) {
    const lens = lensGeom((s) => catEyeLensAt(s, 0, -0.008, 0.168, 0.128, side), 0.006, 0.0055, side * LENS_X, 0.08);
    const lMesh = new THREE.Mesh(lens, glass);
    lMesh.position.set(side * LENS_X, 0, 0.008);
    group.add(lMesh);
  }

  const pinShape = new THREE.Shape();
  pinShape.moveTo(-0.012, 0);
  pinShape.lineTo(-0.005, 0.0045);
  pinShape.lineTo(0.005, 0.0045);
  pinShape.lineTo(0.012, 0);
  pinShape.lineTo(0.005, -0.0045);
  pinShape.lineTo(-0.005, -0.0045);
  pinShape.closePath();
  const pinGeo = new THREE.ExtrudeGeometry(pinShape, {
    depth: 0.006,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.0005,
    bevelThickness: 0.0005,
  });

  for (const side of [-1, 1]) {
    addSculptedAcetateTemple(group, acetate, side, 0.482, 0.104, -0.004, 0.014, 0.056, 0.58);
    addHinge(group, hardware, side * 0.472, 0.104, -0.004);

    const rivet = new THREE.Mesh(pinGeo, hardware);
    rivet.position.set(side * 0.456, 0.120, 0.014);
    rivet.rotation.y = side * -0.08;
    group.add(rivet);

    const noseGeo = new THREE.CapsuleGeometry(0.009, 0.026, 8, 12);
    noseGeo.scale(0.55, 1.0, 0.8);
    const nose = new THREE.Mesh(noseGeo, acetate);
    nose.position.set(side * 0.060, -0.044, 0.002);
    nose.rotation.set(0.22, side * -0.25, side * 0.28);
    group.add(nose);
  }
  return group;
}

// ── Frame 7: PRISM H6 (50-19-145) — Gunmetal Hexagonal Geometric Wire ───────
function buildPrism() {
  const group = new THREE.Group();
  group.name = "PRISM_H6";
  const metal = titanium(0x525860);
  const glass = opticalLens();

  for (const side of [-1, 1]) {
    const rim = rimGeom(
      (s) => hexGeometricAt(s, 0, 0, 0.186, 0.158),
      (p) => hexGeometricAt(p, 0, 0, 0.177, 0.149),
      0.013,
      0.0012,
      side * LENS_X
    );
    const rMesh = new THREE.Mesh(rim, metal);
    rMesh.position.set(side * LENS_X, 0, 0);
    group.add(rMesh);

    const lens = lensGeom((s) => hexGeometricAt(s, 0, 0, 0.178, 0.150), 0.005, 0.0055, side * LENS_X);
    const lMesh = new THREE.Mesh(lens, glass);
    lMesh.position.set(side * LENS_X, 0, 0.003);
    group.add(lMesh);
  }

  const bridgeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.060, 0.022, 0.009),
    new THREE.Vector3(-0.026, 0.042, 0.016),
    new THREE.Vector3(0.026, 0.042, 0.016),
    new THREE.Vector3(0.060, 0.022, 0.009),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(bridgeCurve, 26, 0.0038, 12, false), metal));

  for (const side of [-1, 1]) {
    const lug = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.014, 0.010), metal);
    lug.position.set(side * 0.436, 0.020, -0.004);
    group.add(lug);
    addHinge(group, metal, side * 0.448, 0.020, -0.010);
    addAeroTitaniumTemple(group, metal, side, 0.448, 0.020, -0.010);
  }

  addGooseneckPads(group, metal, metal, 0.070, 0.002);
  return group;
}

// ── Frame 8: AMBER R5 (53-18-145) — Translucent Amber Narrow Rectangle ──────
function buildAmber() {
  const group = new THREE.Group();
  group.name = "AMBER_R5";
  const amber = amberAcetate(0xb46a28);
  const glass = opticalLens();
  const core = goldCore(0xd8b46c);

  const frontGeo = onePieceAcetateFrontGeom(
    drawAmberFrontOutline,
    (hole) => narrowRectLensAt(hole, -LENS_X, 0.0, 0.168, 0.094, -1),
    (hole) => narrowRectLensAt(hole, LENS_X, 0.0, 0.168, 0.094, 1),
    0.020,
    0.0034
  );
  group.add(new THREE.Mesh(frontGeo, amber));

  for (const side of [-1, 1]) {
    const lens = lensGeom((s) => narrowRectLensAt(s, 0, 0.0, 0.170, 0.096, side), 0.006, 0.0050, side * LENS_X, 0.08);
    const lMesh = new THREE.Mesh(lens, glass);
    lMesh.position.set(side * LENS_X, 0, 0.007);
    group.add(lMesh);
  }

  for (const side of [-1, 1]) {
    addSculptedAcetateTemple(group, amber, side, 0.468, 0.070, -0.004, 0.013, 0.052, 0.58, core);
    addHinge(group, core, side * 0.460, 0.070, -0.002);

    const noseGeo = new THREE.CapsuleGeometry(0.0085, 0.024, 8, 12);
    noseGeo.scale(0.55, 1.0, 0.8);
    const nose = new THREE.Mesh(noseGeo, amber);
    nose.position.set(side * 0.060, -0.036, 0.002);
    nose.rotation.set(0.22, side * -0.25, side * 0.28);
    group.add(nose);
  }
  return group;
}

function exportGLB(object, filename) {
  return new Promise((resolve, reject) => {
    try {
      const exporter = new GLTFExporter();
      exporter.parse(
        object,
        (result) => {
          try {
            const buf = Buffer.from(result);
            fs.writeFileSync(path.join(OUT_DIR, filename), buf);
            console.log("wrote", filename, buf.length, "bytes");
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        (err) => reject(err),
        { binary: true }
      );
    } catch (e) {
      reject(e);
    }
  });
}

fs.mkdirSync(OUT_DIR, { recursive: true });
console.log("exporting high-fidelity frames...");
const frames = [
  { build: buildAero, fileName: "aero_x1.glb" },
  { build: buildMonolith, fileName: "monolith_02.glb" },
  { build: buildOrbit, fileName: "orbit_t4.glb" },
  { build: buildLucent, fileName: "lucent_v1.glb" },
  { build: buildSolaris, fileName: "solaris_a1.glb" },
  { build: buildVelvet, fileName: "velvet_c3.glb" },
  { build: buildPrism, fileName: "prism_h6.glb" },
  { build: buildAmber, fileName: "amber_r5.glb" },
];
const requestedFrame = process.argv[2]?.toLowerCase();
const framesToExport = frames.filter(
  (frame) => !requestedFrame || frame.fileName === requestedFrame
);
if (requestedFrame && framesToExport.length === 0) {
  throw new Error(`Unknown frame: ${requestedFrame}`);
}
for (const frame of framesToExport) {
  await exportGLB(frame.build(), frame.fileName);
}
console.log("done");
