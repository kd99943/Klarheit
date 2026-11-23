import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { ARFrameConfig, ARFrameStyleName } from "./types";
import { buildEnhancedMaterials, scaleMaterialUnits } from "./frameTextures";

let cachedEnhancedMats: ReturnType<typeof buildEnhancedMaterials> | null = null;
function getEnhancedMaterials() {
  return cachedEnhancedMats ??= buildEnhancedMaterials();
}

const LENS_X = 0.24;

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
  path.closePath();
}

function aeroPantoAt(path: THREE.Shape | THREE.Path, cx: number, cy: number, rx: number, ry: number, side = 1) {
  const s = side;
  path.moveTo(cx + s * rx * 0.05, cy + ry * 0.98);
  path.bezierCurveTo(
    cx + s * rx * 0.56, cy + ry * 0.99,
    cx + s * rx * 0.94, cy + ry * 0.84,
    cx + s * rx * 0.99, cy + ry * 0.36
  );
  path.bezierCurveTo(
    cx + s * rx * 1.02, cy - ry * 0.22,
    cx + s * rx * 0.72, cy - ry * 0.88,
    cx + s * rx * 0.08, cy - ry * 0.98
  );
  path.bezierCurveTo(
    cx - s * rx * 0.54, cy - ry * 0.98,
    cx - s * rx * 0.94, cy - ry * 0.44,
    cx - s * rx * 0.96, cy + ry * 0.16
  );
  path.bezierCurveTo(
    cx - s * rx * 0.98, cy + ry * 0.68,
    cx - s * rx * 0.52, cy + ry * 0.97,
    cx + s * rx * 0.05, cy + ry * 0.98
  );
  path.closePath();
}

function orbitRoundAt(path: THREE.Shape | THREE.Path, cx: number, cy: number, rx: number, ry: number) {
  path.moveTo(cx, cy + ry * 0.96);
  path.bezierCurveTo(cx + rx * 0.58, cy + ry * 0.96, cx + rx, cy + ry * 0.54, cx + rx, cy - ry * 0.02);
  path.bezierCurveTo(cx + rx, cy - ry * 0.58, cx + rx * 0.56, cy - ry, cx, cy - ry);
  path.bezierCurveTo(cx - rx * 0.56, cy - ry, cx - rx, cy - ry * 0.58, cx - rx, cy - ry * 0.02);
  path.bezierCurveTo(cx - rx, cy + ry * 0.54, cx - rx * 0.58, cy + ry * 0.96, cx, cy + ry * 0.96);
  path.closePath();
}

function monolithLensAt(path: THREE.Shape | THREE.Path, cx: number, cy: number, rx: number, ry: number, side = 1) {
  const s = side;
  const topIn = -rx * 0.88;
  const topOut = rx * 0.96;
  const botOut = rx * 0.82;
  const botIn = -rx * 0.76;
  path.moveTo(cx + s * topIn * 0.5, cy + ry * 0.96);
  path.bezierCurveTo(
    cx + s * topOut * 0.65, cy + ry * 0.98,
    cx + s * topOut, cy + ry * 0.92,
    cx + s * topOut, cy + ry * 0.52
  );
  path.bezierCurveTo(
    cx + s * topOut * 0.98, cy - ry * 0.15,
    cx + s * botOut * 1.04, cy - ry * 0.92,
    cx + s * botOut * 0.58, cy - ry * 0.96
  );
  path.lineTo(cx + s * botIn * 0.55, cy - ry * 0.96);
  path.bezierCurveTo(
    cx + s * botIn * 0.98, cy - ry * 0.92,
    cx + s * topIn * 0.95, cy - ry * 0.25,
    cx + s * topIn, cy + ry * 0.38
  );
  path.bezierCurveTo(
    cx + s * topIn * 1.02, cy + ry * 0.88,
    cx + s * topIn * 0.82, cy + ry * 0.95,
    cx + s * topIn * 0.5, cy + ry * 0.96
  );
  path.closePath();
}

function drawMonolithFrontOutline(shape: THREE.Shape) {
  shape.moveTo(0, 0.108);
  shape.lineTo(0.042, 0.108);
  shape.bezierCurveTo(0.064, 0.108, 0.072, 0.140, 0.105, 0.142);
  shape.lineTo(0.448, 0.138);
  shape.quadraticCurveTo(0.482, 0.137, 0.484, 0.118);
  shape.lineTo(0.482, 0.036);
  shape.quadraticCurveTo(0.480, 0.018, 0.446, 0.012);
  shape.bezierCurveTo(0.436, -0.065, 0.422, -0.138, 0.376, -0.146);
  shape.lineTo(0.142, -0.146);
  shape.bezierCurveTo(0.096, -0.142, 0.074, -0.075, 0.056, 0.012);
  shape.bezierCurveTo(0.044, 0.054, 0.024, 0.064, 0, 0.064);
  shape.bezierCurveTo(-0.024, 0.064, -0.044, 0.054, -0.056, 0.012);
  shape.bezierCurveTo(-0.074, -0.075, -0.096, -0.142, -0.142, -0.146);
  shape.lineTo(-0.376, -0.146);
  shape.bezierCurveTo(-0.422, -0.138, -0.436, -0.065, -0.446, 0.012);
  shape.quadraticCurveTo(-0.480, 0.018, -0.482, 0.036);
  shape.lineTo(-0.484, 0.118);
  shape.quadraticCurveTo(-0.482, 0.137, -0.448, 0.138);
  shape.lineTo(-0.105, 0.142);
  shape.bezierCurveTo(-0.072, 0.140, -0.064, 0.108, -0.042, 0.108);
  shape.lineTo(0, 0.108);
  shape.closePath();
}

function lucentLensAt(path: THREE.Shape | THREE.Path, cx: number, cy: number, rx: number, ry: number, side = 1) {
  const s = side;
  path.moveTo(cx, cy + ry * 0.96);
  path.bezierCurveTo(
    cx + s * rx * 0.58, cy + ry * 0.98,
    cx + s * rx * 0.98, cy + ry * 0.80,
    cx + s * rx * 0.98, cy + ry * 0.28
  );
  path.bezierCurveTo(
    cx + s * rx * 0.96, cy - ry * 0.42,
    cx + s * rx * 0.66, cy - ry * 0.96,
    cx + s * rx * 0.04, cy - ry * 0.98
  );
  path.bezierCurveTo(
    cx - s * rx * 0.58, cy - ry * 0.98,
    cx - s * rx * 0.92, cy - ry * 0.46,
    cx - s * rx * 0.92, cy + ry * 0.22
  );
  path.bezierCurveTo(
    cx - s * rx * 0.92, cy + ry * 0.76,
    cx - s * rx * 0.52, cy + ry * 0.95,
    cx, cy + ry * 0.96
  );
  path.closePath();
}

function drawLucentFrontOutline(shape: THREE.Shape) {
  shape.moveTo(0, 0.102);
  shape.lineTo(0.038, 0.102);
  shape.bezierCurveTo(0.058, 0.104, 0.072, 0.146, 0.165, 0.156);
  shape.bezierCurveTo(0.285, 0.164, 0.395, 0.146, 0.468, 0.122);
  shape.quadraticCurveTo(0.486, 0.114, 0.486, 0.088);
  shape.lineTo(0.484, 0.042);
  shape.quadraticCurveTo(0.482, 0.022, 0.448, 0.012);
  shape.bezierCurveTo(0.438, -0.075, 0.378, -0.158, 0.246, -0.162);
  shape.bezierCurveTo(0.132, -0.162, 0.076, -0.095, 0.056, -0.008);
  shape.bezierCurveTo(0.044, 0.048, 0.022, 0.064, 0, 0.064);
  shape.bezierCurveTo(-0.022, 0.064, -0.044, 0.048, -0.056, -0.008);
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

function smoothAndIndexGeometry(geom: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = geom.attributes?.position;
  if (!pos || typeof pos.count !== "number") return geom;
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

function applyOpticalCurvature(geom: THREE.BufferGeometry, xCenter = 0, wrapK = 0.075): THREE.BufferGeometry {
  const pos = geom.attributes?.position;
  if (!pos || typeof pos.count !== "number") return geom;
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

function extrudeRim(
  drawOuter: (p: THREE.Shape) => void,
  drawInner: (p: THREE.Path) => void,
  depth: number,
  bevel: number,
  xCenter = 0
) {
  const outer = new THREE.Shape();
  drawOuter(outer);
  const hole = new THREE.Path();
  drawInner(hole);
  outer.holes.push(hole);
  const geom = new THREE.ExtrudeGeometry(outer, {
    depth,
    curveSegments: 24,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
  });
  return applyOpticalCurvature(geom, xCenter, 0.075);
}

function extrudeOnePieceAcetateFront(
  drawFront: (p: THREE.Shape) => void,
  drawLeftHole: (p: THREE.Path) => void,
  drawRightHole: (p: THREE.Path) => void,
  depth: number,
  bevel: number
) {
  const outer = new THREE.Shape();
  drawFront(outer);
  const leftHole = new THREE.Path();
  drawLeftHole(leftHole);
  const rightHole = new THREE.Path();
  drawRightHole(rightHole);
  outer.holes.push(leftHole, rightHole);
  const geom = new THREE.ExtrudeGeometry(outer, {
    depth,
    curveSegments: 24,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
  });
  return applyOpticalCurvature(geom, 0, 0.08);
}

function extrudeLens(draw: (p: THREE.Shape) => void, depth: number, xCenter = 0, wrapK = 0.075) {
  const shape = new THREE.Shape();
  draw(shape);
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    curveSegments: 24,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: 0.0008,
    bevelThickness: 0.0008,
  });
  const pos = geom.attributes?.position;
  if (pos && typeof pos.count === "number") {
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const r = Math.min(1, Math.hypot(x, y) / 0.2);
      pos.setZ(i, z + 0.0055 * (1 - r * r));
    }
  }
  return applyOpticalCurvature(geom, xCenter, wrapK);
}

function titanium(color: string) {
  return getEnhancedMaterials().titanium(new THREE.Color(color).getHex());
}
function blackAcetate(color: string) {
  return getEnhancedMaterials().blackAcetate(new THREE.Color(color).getHex());
}
function crystalAcetate(_color: string) {
  return getEnhancedMaterials().crystal();
}
function amberAcetateMat(color: string) {
  return getEnhancedMaterials().amberAcetate(new THREE.Color(color).getHex());
}
function opticalGlass(_color: string) {
  return getEnhancedMaterials().opticalLens();
}
function sunGlass(color: string) {
  return getEnhancedMaterials().sunLens(new THREE.Color(color).getHex());
}
function tortoise() {
  return getEnhancedMaterials().tortoise();
}

function aviatorTeardropAt(path: THREE.Shape | THREE.Path, cx: number, cy: number, rx: number, ry: number, side = 1) {
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

function catEyeLensAt(path: THREE.Shape | THREE.Path, cx: number, cy: number, rx: number, ry: number, side = 1) {
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

function drawVelvetFrontOutline(shape: THREE.Shape) {
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

function hexGeometricAt(path: THREE.Shape | THREE.Path, cx: number, cy: number, rx: number, ry: number) {
  const pts: Array<[number, number]> = [
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

function narrowRectLensAt(path: THREE.Shape | THREE.Path, cx: number, cy: number, rx: number, ry: number, side = 1) {
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

function drawAmberFrontOutline(shape: THREE.Shape) {
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

function addGooseneckPads(
  group: THREE.Group,
  metalMat: THREE.Material,
  padMat: THREE.Material,
  armX = 0.074,
  yTop = 0.004
) {
  for (const side of [-1, 1]) {
    const armCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * armX, yTop, 0.002),
      new THREE.Vector3(side * (armX - 0.008), yTop - 0.014, -0.016),
      new THREE.Vector3(side * (armX + 0.006), yTop - 0.044, -0.028),
      new THREE.Vector3(side * (armX + 0.018), yTop - 0.066, -0.024),
    ]);
    const arm = new THREE.Mesh(new THREE.TubeGeometry(armCurve, 18, 0.0020, 8, false), metalMat);
    const padGeom = new THREE.CapsuleGeometry(0.0095, 0.022, 8, 12);
    padGeom.scale(0.38, 1.0, 0.68);
    const pad = new THREE.Mesh(padGeom, padMat);
    pad.rotation.set(0.28, side * 0.26, side * 0.32);
    pad.position.set(side * (armX + 0.022), yTop - 0.070, -0.024);
    group.add(arm, pad);
  }
}

function addAeroTitaniumTemple(
  group: THREE.Group,
  metal: THREE.Material,
  side: number,
  x = 0.454,
  y = 0.026,
  zStart = -0.010
) {
  const shaftCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * x, y, zStart),
    new THREE.Vector3(side * (x + 0.012), y + 0.001, zStart - 0.16),
    new THREE.Vector3(side * (x + 0.015), y - 0.002, zStart - 0.34),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(shaftCurve, 20, 0.0028, 10, false), metal));

  const tipCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * (x + 0.015), y - 0.002, zStart - 0.33),
    new THREE.Vector3(side * (x + 0.012), y - 0.010, zStart - 0.43),
    new THREE.Vector3(side * (x + 0.002), y - 0.046, zStart - 0.51),
    new THREE.Vector3(side * (x - 0.010), y - 0.088, zStart - 0.565),
  ]);
  const paddleGeo = new THREE.TubeGeometry(tipCurve, 20, 0.0050, 10, false);
  const pos = paddleGeo.attributes?.position;
  if (pos && typeof pos.count === "number") {
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const center = side * (x + 0.006);
      pos.setX(i, center + (px - center) * 0.42);
    }
    pos.needsUpdate = true;
    paddleGeo.computeVertexNormals();
  }
  group.add(new THREE.Mesh(paddleGeo, metal));
}

function addOrbitTempleWithTortoiseTip(
  group: THREE.Group,
  metal: THREE.Material,
  tipMat: THREE.Material,
  side: number,
  x = 0.438,
  y = 0.016,
  zStart = -0.008
) {
  const shaftCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * x, y, zStart),
    new THREE.Vector3(side * (x + 0.010), y + 0.001, zStart - 0.18),
    new THREE.Vector3(side * (x + 0.014), y - 0.002, zStart - 0.36),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(shaftCurve, 20, 0.0026, 10, false), metal));

  const sleeveCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(side * (x + 0.014), y - 0.002, zStart - 0.35),
    new THREE.Vector3(side * (x + 0.012), y - 0.012, zStart - 0.44),
    new THREE.Vector3(side * (x + 0.002), y - 0.052, zStart - 0.52),
    new THREE.Vector3(side * (x - 0.008), y - 0.094, zStart - 0.57),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(sleeveCurve, 20, 0.0054, 10, false), tipMat));
}

function addSculptedAcetateTemple(
  group: THREE.Group,
  mat: THREE.Material,
  side: number,
  xStart: number,
  yStart: number,
  zStart: number,
  w: number,
  h: number,
  len = 0.58,
  coreMat: THREE.Material | null = null
) {
  const section = new THREE.Shape();
  roundedRectPath(section, w, h, Math.min(w * 0.42, 0.005));
  const geom = new THREE.ExtrudeGeometry(section, {
    depth: len,
    curveSegments: 14,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 14,
    bevelSize: 0.0014,
    bevelThickness: 0.0014,
  });

  const pos = geom.attributes?.position;
  if (pos && typeof pos.count === "number") {
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
      const bowX =
        side *
        (Math.sin(t * Math.PI * 0.82) * 0.014 -
          (t > 0.68 ? Math.pow((t - 0.68) / 0.32, 1.6) * 0.020 : 0));
      const dropY = t > 0.62 ? -Math.pow((t - 0.62) / 0.38, 1.85) * 0.095 : 0;

      pos.setX(i, side * xStart + lx + bowX);
      pos.setY(i, yStart + ly * heightScale + dropY);
      pos.setZ(i, zStart - lz);
    }
    pos.needsUpdate = true;
  }
  // Reflecting Z reverses orientation; restore outward winding before computing normals.
  if (pos) {
    const indices: number[] = [];
    for (let i = 0; i < pos.count; i += 3) indices.push(i, i + 2, i + 1);
    geom.setIndex(indices);
  }
  group.add(new THREE.Mesh(smoothAndIndexGeometry(geom), mat));

  if (coreMat) {
    const corePts: THREE.Vector3[] = [];
    const segs = 16;
    for (let s = 0; s <= segs; s++) {
      const t = 0.02 + (s / segs) * 0.90;
      const bowX =
        side *
        (Math.sin(t * Math.PI * 0.82) * 0.014 -
          (t > 0.68 ? Math.pow((t - 0.68) / 0.32, 1.6) * 0.020 : 0));
      const dropY = t > 0.62 ? -Math.pow((t - 0.62) / 0.38, 1.85) * 0.095 : 0;
      corePts.push(new THREE.Vector3(side * xStart + bowX, yStart + dropY, zStart - t * len));
    }
    const coreCurve = new THREE.CatmullRomCurve3(corePts);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(coreCurve, 20, 0.0028, 8, false), coreMat));
  }
}

export function createHeadOccluder(): THREE.Group {
  const group = new THREE.Group();
  const geo = new THREE.SphereGeometry(0.52, 24, 18);
  const occluder = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true }));
  occluder.scale.set(1.05, 1.28, 0.92);
  occluder.position.set(0, -0.12, -0.5);
  occluder.renderOrder = -1;
  group.add(occluder);

  const shadow = new THREE.Mesh(geo.clone(), new THREE.ShadowMaterial({ opacity: 0.28, depthWrite: false }));
  shadow.scale.set(1.05, 1.28, 0.92);
  shadow.position.set(0, -0.12, -0.5);
  shadow.renderOrder = 1;
  shadow.receiveShadow = true;
  group.add(shadow);

  return group;
}

export function prepareModelForShadows(group: THREE.Object3D) {
  const attenuationDistances = new Map<THREE.MeshPhysicalMaterial, number>();
  const worldScale = new THREE.Vector3();
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const isHelper =
        child.material instanceof THREE.MeshBasicMaterial ||
        child.material instanceof THREE.ShadowMaterial;
      if (!isHelper) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        child.castShadow = !materials.every((mat) =>
          mat instanceof THREE.MeshPhysicalMaterial && mat.transmission > 0.5
        );
        child.receiveShadow = true;
        materials.forEach((mat) => {
          if (mat instanceof THREE.MeshPhysicalMaterial && Number.isFinite(mat.attenuationDistance)) {
            attenuationDistances.set(mat, mat.attenuationDistance);
          }
        });
        const beforeRender = child.onBeforeRender;
        child.onBeforeRender = function (...args) {
          beforeRender.apply(this, args);
          const material = args[4];
          if (material instanceof THREE.MeshPhysicalMaterial && attenuationDistances.has(material)) {
            worldScale.setFromMatrixScale(child.matrixWorld);
            material.attenuationDistance = attenuationDistances.get(material)! * Math.max(worldScale.x, worldScale.y, worldScale.z);
          }
        };
      }
    }
  });
}

function buildAeroX1(frame: ARFrameConfig) {
  const group = new THREE.Group();
  const metal = titanium(frame.frameColor);
  const glass = opticalGlass(frame.lensColor);

  for (const side of [-1, 1]) {
    const rimGeom = extrudeRim(
      (s) => aeroPantoAt(s, 0, 0, 0.194, 0.164, side),
      (p) => aeroPantoAt(p, 0, 0, 0.186, 0.156, side),
      0.012,
      0.0012,
      side * LENS_X
    );
    const rim = new THREE.Mesh(rimGeom, metal);
    rim.position.set(side * LENS_X, 0, 0);
    group.add(rim);

    const lensGeom = extrudeLens((s) => aeroPantoAt(s, 0, 0, 0.187, 0.157, side), 0.005, side * LENS_X);
    const lens = new THREE.Mesh(lensGeom, glass);
    lens.position.set(side * LENS_X, 0, 0.003);
    group.add(lens);
  }

  const bridgeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.056, 0.026, 0.009),
    new THREE.Vector3(-0.026, 0.044, 0.016),
    new THREE.Vector3(0.026, 0.044, 0.016),
    new THREE.Vector3(0.056, 0.026, 0.009),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(bridgeCurve, 24, 0.0036, 10, false), metal));

  for (const side of [-1, 1]) {
    for (const dy of [-0.0035, 0, 0.0035]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.0022, 0.008), metal);
      rib.position.set(side * 0.444, 0.026 + dy, -0.004);
      group.add(rib);
    }
    addAeroTitaniumTemple(group, metal, side, 0.454, 0.026, -0.010);
  }

  addGooseneckPads(group, metal, metal, 0.072, 0.002);
  return group;
}

function buildMonolith(frame: ARFrameConfig) {
  const group = new THREE.Group();
  const acetate = blackAcetate(frame.frameColor);
  const glass = opticalGlass(frame.lensColor);

  const frontGeo = extrudeOnePieceAcetateFront(
    drawMonolithFrontOutline,
    (hole) => monolithLensAt(hole, -LENS_X, -0.004, 0.172, 0.116, -1),
    (hole) => monolithLensAt(hole, LENS_X, -0.004, 0.172, 0.116, 1),
    0.022,
    0.0036
  );
  group.add(new THREE.Mesh(frontGeo, acetate));

  for (const side of [-1, 1]) {
    const lensGeom = extrudeLens((s) => monolithLensAt(s, 0, -0.004, 0.174, 0.118, side), 0.006, side * LENS_X, 0.08);
    const lens = new THREE.Mesh(lensGeom, glass);
    lens.position.set(side * LENS_X, 0, 0.008);
    group.add(lens);
  }

  for (const side of [-1, 1]) {
    addSculptedAcetateTemple(group, acetate, side, 0.468, 0.082, -0.004, 0.014, 0.082, 0.58);
    const noseGeo = new THREE.CapsuleGeometry(0.009, 0.028, 8, 12);
    noseGeo.scale(0.55, 1.0, 0.8);
    const nose = new THREE.Mesh(noseGeo, acetate);
    nose.position.set(side * 0.064, -0.042, 0.002);
    nose.rotation.set(0.22, side * -0.25, side * 0.28);
    group.add(nose);
  }
  return group;
}

function buildOrbit(frame: ARFrameConfig) {
  const group = new THREE.Group();
  const metal = titanium(frame.frameColor);
  const glass = opticalGlass(frame.lensColor);
  const tip = tortoise();

  for (const side of [-1, 1]) {
    const rimGeom = extrudeRim(
      (s) => orbitRoundAt(s, 0, 0, 0.180, 0.166),
      (p) => orbitRoundAt(p, 0, 0, 0.172, 0.158),
      0.012,
      0.0012,
      side * LENS_X
    );
    const rim = new THREE.Mesh(rimGeom, metal);
    rim.position.set(side * LENS_X, 0, 0);
    group.add(rim);

    const lensGeom = extrudeLens((s) => orbitRoundAt(s, 0, 0, 0.173, 0.159), 0.005, side * LENS_X);
    const lens = new THREE.Mesh(lensGeom, glass);
    lens.position.set(side * LENS_X, 0, 0.003);
    group.add(lens);
  }

  const bridgeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.068, 0.026, 0.008),
    new THREE.Vector3(0, 0.046, 0.016),
    new THREE.Vector3(0.068, 0.026, 0.008),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(bridgeCurve, 24, 0.0038, 10, false), metal));

  const browCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.215, 0.156, 0.009),
    new THREE.Vector3(0, 0.164, 0.014),
    new THREE.Vector3(0.215, 0.156, 0.009),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(browCurve, 24, 0.0028, 10, false), metal));

  for (const side of [-1, 1]) {
    const lug = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.012, 0.009), metal);
    lug.position.set(side * 0.428, 0.016, -0.003);
    group.add(lug);
    addOrbitTempleWithTortoiseTip(group, metal, tip, side, 0.438, 0.016, -0.008);
  }

  addGooseneckPads(group, metal, metal, 0.076, 0.002);
  return group;
}

function buildLucent(frame: ARFrameConfig) {
  const group = new THREE.Group();
  const crystal = crystalAcetate(frame.frameColor);
  const sun = sunGlass(frame.lensColor || "#232a31");
  const core = titanium("#c8cfd8");

  const frontGeo = extrudeOnePieceAcetateFront(
    drawLucentFrontOutline,
    (hole) => lucentLensAt(hole, -LENS_X, -0.002, 0.174, 0.132, -1),
    (hole) => lucentLensAt(hole, LENS_X, -0.002, 0.174, 0.132, 1),
    0.022,
    0.0038
  );
  group.add(new THREE.Mesh(frontGeo, crystal));

  for (const side of [-1, 1]) {
    const lensGeom = extrudeLens((s) => lucentLensAt(s, 0, -0.002, 0.176, 0.134, side), 0.007, side * LENS_X, 0.08);
    const lens = new THREE.Mesh(lensGeom, sun);
    lens.position.set(side * LENS_X, 0, 0.008);
    group.add(lens);
  }

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
    addSculptedAcetateTemple(group, crystal, side, 0.468, 0.074, -0.004, 0.014, 0.058, 0.58, core);
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

function buildSolaris(frame: ARFrameConfig) {
  const group = new THREE.Group();
  const metal = titanium(frame.frameColor || "#d4b483");
  const glass = opticalGlass(frame.lensColor);

  for (const side of [-1, 1]) {
    const rimGeom = extrudeRim(
      (s) => aviatorTeardropAt(s, 0, -0.006, 0.198, 0.170, side),
      (p) => aviatorTeardropAt(p, 0, -0.006, 0.190, 0.162, side),
      0.012,
      0.0012,
      side * LENS_X
    );
    const rim = new THREE.Mesh(rimGeom, metal);
    rim.position.set(side * LENS_X, 0, 0);
    group.add(rim);

    const lensGeom = extrudeLens((s) => aviatorTeardropAt(s, 0, -0.006, 0.191, 0.163, side), 0.005, side * LENS_X);
    const lens = new THREE.Mesh(lensGeom, glass);
    lens.position.set(side * LENS_X, 0, 0.003);
    group.add(lens);
  }

  const bridgeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.056, 0.044, 0.009),
    new THREE.Vector3(-0.024, 0.062, 0.016),
    new THREE.Vector3(0.024, 0.062, 0.016),
    new THREE.Vector3(0.056, 0.044, 0.009),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(bridgeCurve, 24, 0.0036, 10, false), metal));

  const browCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.232, 0.156, 0.011),
    new THREE.Vector3(0, 0.162, 0.015),
    new THREE.Vector3(0.232, 0.156, 0.011),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(browCurve, 24, 0.0030, 10, false), metal));

  for (const side of [-1, 1]) {
    const lug = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.013, 0.009), metal);
    lug.position.set(side * 0.442, 0.044, -0.004);
    group.add(lug);
    addAeroTitaniumTemple(group, metal, side, 0.452, 0.044, -0.010);
  }

  addGooseneckPads(group, metal, metal, 0.068, 0.016);
  return group;
}

function buildVelvet(frame: ARFrameConfig) {
  const group = new THREE.Group();
  const acetate = blackAcetate(frame.frameColor || "#6b1d2f");
  const glass = opticalGlass(frame.lensColor);
  const hardware = titanium("#d8dde4");

  const frontGeo = extrudeOnePieceAcetateFront(
    drawVelvetFrontOutline,
    (hole) => catEyeLensAt(hole, -LENS_X, -0.008, 0.166, 0.126, -1),
    (hole) => catEyeLensAt(hole, LENS_X, -0.008, 0.166, 0.126, 1),
    0.022,
    0.0038
  );
  group.add(new THREE.Mesh(frontGeo, acetate));

  for (const side of [-1, 1]) {
    const lensGeom = extrudeLens((s) => catEyeLensAt(s, 0, -0.008, 0.168, 0.128, side), 0.006, side * LENS_X, 0.08);
    const lens = new THREE.Mesh(lensGeom, glass);
    lens.position.set(side * LENS_X, 0, 0.008);
    group.add(lens);
  }

  for (const side of [-1, 1]) {
    addSculptedAcetateTemple(group, acetate, side, 0.482, 0.104, -0.004, 0.014, 0.056, 0.58);
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.007, 0.006), hardware);
    pin.position.set(side * 0.456, 0.120, 0.014);
    group.add(pin);
    const noseGeo = new THREE.CapsuleGeometry(0.009, 0.026, 8, 12);
    noseGeo.scale(0.55, 1.0, 0.8);
    const nose = new THREE.Mesh(noseGeo, acetate);
    nose.position.set(side * 0.060, -0.044, 0.002);
    nose.rotation.set(0.22, side * -0.25, side * 0.28);
    group.add(nose);
  }
  return group;
}

function buildPrism(frame: ARFrameConfig) {
  const group = new THREE.Group();
  const metal = titanium(frame.frameColor || "#525860");
  const glass = opticalGlass(frame.lensColor);

  for (const side of [-1, 1]) {
    const rimGeom = extrudeRim(
      (s) => hexGeometricAt(s, 0, 0, 0.186, 0.158),
      (p) => hexGeometricAt(p, 0, 0, 0.177, 0.149),
      0.013,
      0.0012,
      side * LENS_X
    );
    const rim = new THREE.Mesh(rimGeom, metal);
    rim.position.set(side * LENS_X, 0, 0);
    group.add(rim);

    const lensGeom = extrudeLens((s) => hexGeometricAt(s, 0, 0, 0.178, 0.150), 0.005, side * LENS_X);
    const lens = new THREE.Mesh(lensGeom, glass);
    lens.position.set(side * LENS_X, 0, 0.003);
    group.add(lens);
  }

  const bridgeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.060, 0.022, 0.009),
    new THREE.Vector3(-0.026, 0.042, 0.016),
    new THREE.Vector3(0.026, 0.042, 0.016),
    new THREE.Vector3(0.060, 0.022, 0.009),
  ]);
  group.add(new THREE.Mesh(new THREE.TubeGeometry(bridgeCurve, 24, 0.0038, 10, false), metal));

  for (const side of [-1, 1]) {
    const lug = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.014, 0.010), metal);
    lug.position.set(side * 0.436, 0.020, -0.004);
    group.add(lug);
    addAeroTitaniumTemple(group, metal, side, 0.448, 0.020, -0.010);
  }

  addGooseneckPads(group, metal, metal, 0.070, 0.002);
  return group;
}

function buildAmber(frame: ARFrameConfig) {
  const group = new THREE.Group();
  const amber = amberAcetateMat(frame.frameColor || "#b46a28");
  const glass = opticalGlass(frame.lensColor);
  const core = getEnhancedMaterials().gold();

  const frontGeo = extrudeOnePieceAcetateFront(
    drawAmberFrontOutline,
    (hole) => narrowRectLensAt(hole, -LENS_X, 0.0, 0.168, 0.094, -1),
    (hole) => narrowRectLensAt(hole, LENS_X, 0.0, 0.168, 0.094, 1),
    0.020,
    0.0034
  );
  group.add(new THREE.Mesh(frontGeo, amber));

  for (const side of [-1, 1]) {
    const lensGeom = extrudeLens((s) => narrowRectLensAt(s, 0, 0.0, 0.170, 0.096, side), 0.006, side * LENS_X, 0.08);
    const lens = new THREE.Mesh(lensGeom, glass);
    lens.position.set(side * LENS_X, 0, 0.007);
    group.add(lens);
  }

  for (const side of [-1, 1]) {
    addSculptedAcetateTemple(group, amber, side, 0.468, 0.070, -0.004, 0.013, 0.052, 0.58, core);
    const noseGeo = new THREE.CapsuleGeometry(0.0085, 0.024, 8, 12);
    noseGeo.scale(0.55, 1.0, 0.8);
    const nose = new THREE.Mesh(noseGeo, amber);
    nose.position.set(side * 0.060, -0.036, 0.002);
    nose.rotation.set(0.22, side * -0.25, side * 0.28);
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
    case "aviator-double":
      group = buildSolaris(frame);
      break;
    case "cat-eye-acetate":
      group = buildVelvet(frame);
      break;
    case "hex-wire":
      group = buildPrism(frame);
      break;
    case "narrow-rect-amber":
      group = buildAmber(frame);
      break;
    case "panto-metal":
    default:
      group = buildAeroX1(frame);
      break;
  }
  const materials = new Set<THREE.MeshPhysicalMaterial>();
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      const list = Array.isArray(object.material) ? object.material : [object.material];
      list.forEach((mat) => {
        if (mat instanceof THREE.MeshPhysicalMaterial) materials.add(mat);
      });
    }
  });
  materials.forEach((mat) => scaleMaterialUnits(mat, 71 / (frame.lensCenterDistanceMm ?? 71)));
  return group;
}

export function buildIndoorEnvTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, "#dce4ef");
    grad.addColorStop(0.35, "#e8edf4");
    grad.addColorStop(0.55, "#d4dae4");
    grad.addColorStop(0.75, "#a8b2c0");
    grad.addColorStop(1, "#8a94a4");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function captureCompositeFrame(
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
