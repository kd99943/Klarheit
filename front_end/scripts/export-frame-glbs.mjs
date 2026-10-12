/**
 * High-fidelity eyewear GLB export.
 * Run from front_end: node scripts/export-frame-glbs.mjs
 */
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
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

// Minimal canvas for texture generation in Node (use OffscreenCanvas or skia-less stub)
// We generate maps via raw pixel data instead of DOM canvas.
function makeDataTexture(w, h, paint) {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const [r, g, b, a = 255] = paint(x, y, w, h);
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function brushedMetalMaps(size = 256) {
  // Deterministic-ish noise
  const rough = makeDataTexture(size, size, (x, y) => {
    const line = Math.sin(y * 1.7) * 0.5 + Math.sin(y * 0.31 + x * 0.01) * 0.3;
    const n = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
    const v = 100 + line * 40 + Math.abs(n) * 30;
    return [v, v, v, 255];
  });
  rough.repeat.set(3, 3);
  const nrm = makeDataTexture(size, size, (x, y) => {
    const dy = Math.sin(y * 2.1) * 12;
    return [128 + dy * 0.3, 128, 255, 255];
  });
  nrm.repeat.set(3, 3);
  return { roughnessMap: rough, normalMap: nrm };
}

function acetateMaps(size = 128) {
  const rough = makeDataTexture(size, size, (x, y) => {
    const n = ((Math.sin(x * 3.1 + y * 1.7) + Math.sin(x * 0.7)) * 0.5 + 0.5) * 25;
    return [28 + n, 28 + n, 28 + n, 255];
  });
  rough.repeat.set(2, 2);
  return { roughnessMap: rough };
}

function tortoiseMap(size = 128) {
  return makeDataTexture(size, size, (x, y) => {
    const n1 = Math.sin(x * 0.15) * Math.sin(y * 0.18);
    const n2 = Math.sin(x * 0.4 + 2) * Math.cos(y * 0.35);
    const m = (n1 + n2) * 0.5 + 0.5;
    const r = 40 + m * 140;
    const g = 20 + m * 70;
    const b = 10 + m * 25;
    return [r, g, b, 255];
  });
}

function lensCoatMap(size = 64) {
  const tex = makeDataTexture(size, size, (x, y) => {
    const t = (x / size + y / size) * 0.5;
    const r = 10 + t * 40;
    const g = 60 + t * 90;
    const b = 70 + t * 80;
    return [r, g, b, 255];
  });
  return tex;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../public/models/frames");

function roundedRect(shape, w, h, r) {
  const x = -w / 2;
  const y = -h / 2;
  const rr = Math.min(r, w / 2, h / 2);
  shape.moveTo(x + rr, y);
  shape.lineTo(x + w - rr, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + rr);
  shape.lineTo(x + w, y + h - rr);
  shape.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  shape.lineTo(x + rr, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - rr);
  shape.lineTo(x, y + rr);
  shape.quadraticCurveTo(x, y, x + rr, y);
}

function oval(shape, rx, ry) {
  shape.moveTo(0, ry);
  shape.bezierCurveTo(rx * 0.55, ry, rx, ry * 0.55, rx, 0);
  shape.bezierCurveTo(rx, -ry * 0.55, rx * 0.55, -ry, 0, -ry);
  shape.bezierCurveTo(-rx * 0.55, -ry, -rx, -ry * 0.55, -rx, 0);
  shape.bezierCurveTo(-rx, ry * 0.55, -rx * 0.55, ry, 0, ry);
}

function pantoLens(shape, rx, ry) {
  shape.moveTo(-rx * 0.58, ry * 0.92);
  shape.bezierCurveTo(-rx * 0.2, ry * 1.04, rx * 0.52, ry * 1.02, rx * 0.88, ry * 0.8);
  shape.bezierCurveTo(rx * 1.04, ry * 0.56, rx * 0.98, -ry * 0.36, rx * 0.72, -ry * 0.78);
  shape.bezierCurveTo(rx * 0.4, -ry * 1.05, -rx * 0.4, -ry * 1.05, -rx * 0.72, -ry * 0.78);
  shape.bezierCurveTo(-rx * 0.98, -ry * 0.36, -rx * 1.04, ry * 0.56, -rx * 0.88, ry * 0.8);
  shape.bezierCurveTo(-rx * 0.52, ry * 1.02, -rx * 0.2, ry * 1.04, -rx * 0.58, ry * 0.92);
  shape.closePath();
}

function rimGeom(drawOuter, drawInner, depth, bevel) {
  const outer = new THREE.Shape();
  drawOuter(outer);
  const hole = new THREE.Path();
  drawInner(hole);
  outer.holes.push(hole);
  return new THREE.ExtrudeGeometry(outer, {
    depth,
    bevelEnabled: true,
    bevelSegments: 5,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
  });
}

/** Slightly spherical optical lens (not a flat plate). */
function lensGeom(draw, depth, bulge = 0.004) {
  const s = new THREE.Shape();
  draw(s);
  const g = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 2,
    bevelSize: 0.0008,
    bevelThickness: 0.0008,
  });
  // Soft center bulge via z displacement of front verts
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (z > depth * 0.5) {
      const r = Math.min(1, Math.hypot(x, y) / 0.2);
      pos.setZ(i, z + bulge * (1 - r * r));
    }
  }
  pos.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

function titanium(color = 0x9aa1aa) {
  // Maps applied at runtime (Node exporter cannot process canvas maps)
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 1,
    roughness: 0.28,
    clearcoat: 0.25,
    clearcoatRoughness: 0.35,
    name: "titanium",
  });
}

function blackAcetate(color = 0x121214) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.02,
    roughness: 0.22,
    clearcoat: 0.95,
    clearcoatRoughness: 0.08,
    name: "acetate-black",
  });
}

function crystalMat() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xeef3f6,
    metalness: 0,
    roughness: 0.04,
    transmission: 0.9,
    thickness: 0.12,
    ior: 1.49,
    transparent: true,
    clearcoat: 0.75,
    name: "crystal",
  });
}

function sunLens(color = 0x1a2430) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.15,
    roughness: 0.04,
    transparent: true,
    opacity: 0.9,
    transmission: 0.1,
    thickness: 0.02,
    ior: 1.52,
    clearcoat: 1,
    name: "sun-lens",
  });
}

function opticalLens(color = 0xdce8f2) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0,
    roughness: 0.02,
    transparent: true,
    opacity: 0.14,
    transmission: 0.9,
    thickness: 0.012,
    ior: 1.52,
    clearcoat: 1,
    sheen: 0.55,
    sheenColor: new THREE.Color("#5ec4b8"),
    name: "optical-lens",
  });
}

function gold() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xc9a227,
    metalness: 1,
    roughness: 0.3,
    name: "gold",
  });
}

function tortoise() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x4a3220,
    metalness: 0.05,
    roughness: 0.38,
    clearcoat: 0.7,
    name: "tortoise",
  });
}

const LENS_X = 0.24;

/** Hinge barrel + screw head detail. */
function addHinge(group, metal, x, y = 0.01) {
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.004, 0.018, 12),
    metal
  );
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(x, y, 0);
  group.add(barrel);

  // Screw head
  const screw = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0025, 0.0025, 0.003, 10),
    metal
  );
  screw.rotation.z = Math.PI / 2;
  screw.position.set(x + Math.sign(x) * 0.008, y, 0);
  group.add(screw);

  // Screw slot
  const slot = new THREE.Mesh(
    new THREE.BoxGeometry(0.0012, 0.0015, 0.0035),
    new THREE.MeshPhysicalMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.5 })
  );
  slot.position.set(x + Math.sign(x) * 0.008, y, 0);
  group.add(slot);
}

/**
 * Windsor / rimlock wire: thin tube following the outer rim outline.
 * Signature of fine metal frames.
 */
function addWindsorWire(group, metal, drawOuter, z = 0) {
  // Sample oval/rounded outline via Shape points is hard; use ellipse for ovals
  // and a rounded-rect path approximated by a tube along a CatmullRom.
  const pts = [];
  // Generic: sample outer extents from a temporary shape bounding approach
  // We'll pass explicit radii instead via closure
  void drawOuter;
  void pts;
  void z;
  void metal;
  void group;
}

function addWindsorRoundRect(group, metal, w, h, r, z = 0.004) {
  const shape = new THREE.Shape();
  roundedRect(shape, w, h, r);
  const pts2 = shape.getPoints(64).map((p) => new THREE.Vector3(p.x, p.y, z));
  // close loop
  if (pts2.length) pts2.push(pts2[0].clone());
  const path = new THREE.CatmullRomCurve3(pts2, true);
  const geo = new THREE.TubeGeometry(path, 80, 0.0014, 6, true);
  const mesh = new THREE.Mesh(geo, metal);
  group.add(mesh);
  return mesh;
}

function addTempleWire(group, mat, x, len = 0.58) {
  const g = new THREE.CylinderGeometry(0.0032, 0.0024, len, 16);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, -len / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, 0.01, 0);
  m.rotation.y = Math.sign(x) * 0.09;
  group.add(m);
  return m;
}

function addTempleSlab(group, mat, x, w, h, len = 0.58) {
  const section = new THREE.Shape();
  roundedRect(section, w, h, 0.006);
  const g = new THREE.ExtrudeGeometry(section, {
    depth: len,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.0018,
    bevelThickness: 0.0018,
  });
  g.translate(0, 0, -len / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, 0.015, 0);
  m.rotation.y = Math.sign(x) * 0.07;
  group.add(m);
  return m;
}

function buildAero() {
  const group = new THREE.Group();
  group.name = "AERO_X1";
  const metal = titanium();
  const glass = opticalLens();
  const tip = tortoise();

  const rim = rimGeom(
    (s) => pantoLens(s, 0.214, 0.188),
    (p) => pantoLens(p, 0.183, 0.169),
    0.007,
    0.0006
  );
  const lens = lensGeom((s) => pantoLens(s, 0.185, 0.171), 0.006, 0.005);

  for (const side of [-1, 1]) {
    const r = new THREE.Mesh(rim, metal);
    r.position.set(side * LENS_X, 0, 0);
    group.add(r);
    const l = new THREE.Mesh(lens, glass);
    l.position.set(side * LENS_X, 0, 0.002);
    group.add(l);

  }

  // Arched keyhole bridge
  const bridgeCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.12, 0.015, 0.004),
    new THREE.Vector3(-0.04, 0.072, 0.012),
    new THREE.Vector3(0.04, 0.072, 0.012),
    new THREE.Vector3(0.12, 0.015, 0.004),
  ]);
  group.add(
    new THREE.Mesh(new THREE.TubeGeometry(bridgeCurve, 32, 0.0032, 10, false), metal)
  );

  // Endpieces
  for (const side of [-1, 1]) {
    const end = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.02, 0.01), metal);
    end.position.set(side * 0.445, 0.01, -0.002);
    group.add(end);
    addHinge(group, metal, side * 0.455);
    addTempleWire(group, metal, side * 0.458);
    const tipGeom = new THREE.CapsuleGeometry(0.005, 0.07, 6, 12);
    tipGeom.rotateX(Math.PI / 2);
    const t = new THREE.Mesh(tipGeom, tip);
    t.position.set(side * 0.472, 0.012, -0.525);
    group.add(t);
  }

  // Pad arms
  const padMat = new THREE.MeshPhysicalMaterial({
    color: 0xf5f2eb,
    transparent: true,
    opacity: 0.8,
    roughness: 0.4,
    transmission: 0.35,
  });
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0018, 0.0018, 0.06, 10),
      metal
    );
    arm.rotation.set(0.45, 0, side * 0.7);
    arm.position.set(side * 0.105, -0.06, -0.035);
    group.add(arm);
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 12), padMat);
    pad.scale.set(0.35, 1.15, 0.3);
    pad.position.set(side * 0.127, -0.088, -0.048);
    group.add(pad);
  }
  return group;
}

function buildMonolith() {
  const group = new THREE.Group();
  group.name = "MONOLITH_02";
  const acetate = blackAcetate();
  const glass = opticalLens(0xe8f4f6);
  const g = gold();

  // Thicker front with polished bevel
  const rim = rimGeom(
    (s) => roundedRect(s, 0.44, 0.30, 0.05),
    (p) => roundedRect(p, 0.35, 0.24, 0.034),
    0.052,
    0.004
  );
  const lens = lensGeom((s) => roundedRect(s, 0.352, 0.242, 0.034), 0.008, 0.004);

  for (const side of [-1, 1]) {
    const r = new THREE.Mesh(rim, acetate);
    r.position.set(side * LENS_X, 0, 0);
    group.add(r);
    const l = new THREE.Mesh(lens, glass);
    l.position.set(side * LENS_X, 0, 0.02);
    group.add(l);

  }

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.048, 0.052), acetate);
  bridge.position.set(0, 0.015, 0.01);
  group.add(bridge);

  const rivet = new THREE.CylinderGeometry( 0.0045, 0.0045, 0.005, 12);
  rivet.rotateX(Math.PI / 2);
  // Slot on rivet
  const slotGeo = new THREE.BoxGeometry(0.005, 0.001, 0.006);

  for (const side of [-1, 1]) {
    addTempleSlab(group, acetate, side * 0.475, 0.03, 0.05);
    // Double gold rivets + slot
    for (const dx of [0, 0.038]) {
      const r = new THREE.Mesh(rivet, g);
      r.position.set(side * (0.458 - dx), 0.072, 0.03);
      group.add(r);
      const slot = new THREE.Mesh(
        slotGeo,
        new THREE.MeshPhysicalMaterial({ color: 0x1a1a1a, metalness: 0.6, roughness: 0.4 })
      );
      slot.position.set(side * (0.458 - dx), 0.072, 0.033);
      group.add(slot);
    }
    addHinge(group, g, side * 0.478, 0.02);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.05, 0.022), acetate);
    nose.position.set(side * 0.16, -0.075, 0.018);
    nose.rotation.z = side * 0.32;
    group.add(nose);
  }
  return group;
}

function buildOrbit() {
  const group = new THREE.Group();
  group.name = "ORBIT_T4";
  const metal = titanium(0xb7b8b4);
  const glass = opticalLens(0xeef3f6);
  const tip = tortoise();

  const rim = rimGeom(
    (s) => oval(s, 0.186, 0.16),
    (p) => oval(p, 0.17, 0.144),
    0.007,
    0.0006
  );
  const lens = lensGeom((s) => oval(s, 0.172, 0.146), 0.005, 0.004);

  for (const side of [-1, 1]) {
    const r = new THREE.Mesh(rim, metal);
    r.position.set(side * LENS_X, 0, 0);
    group.add(r);
    const l = new THREE.Mesh(lens, glass);
    l.position.set(side * LENS_X, 0, 0.002);
    group.add(l);
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

  for (const side of [-1, 1]) {
    const end = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.02, 0.009), metal);
    end.position.set(side * 0.43, 0.02, -0.002);
    group.add(end);
    addHinge(group, metal, side * 0.438, 0.02);
    addTempleWire(group, metal, side * 0.44);
    const tipGeom = new THREE.CapsuleGeometry(0.0052, 0.08, 6, 12);
    tipGeom.rotateX(Math.PI / 2);
    const t = new THREE.Mesh(tipGeom, tip);
    t.position.set(side * 0.455, 0.022, -0.52);
    group.add(t);
  }
  return group;
}

function buildLucent() {
  const group = new THREE.Group();
  group.name = "LUCENT_V1";
  const crystal = crystalMat();
  const sun = sunLens();
  const core = gold();

  const rim = rimGeom(
    (s) => pantoLens(s, 0.23, 0.17),
    (p) => pantoLens(p, 0.17, 0.12),
    0.055,
    0.005
  );
  const lens = lensGeom((s) => pantoLens(s, 0.1725, 0.1225), 0.014, 0.005);

  for (const side of [-1, 1]) {
    const r = new THREE.Mesh(rim, crystal);
    r.position.set(side * LENS_X, 0, 0);
    group.add(r);
    const l = new THREE.Mesh(lens, sun);
    l.position.set(side * LENS_X, 0, 0.018);
    group.add(l);
  }

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.045, 0.058), crystal);
  bridge.position.set(0, 0.025, 0.01);
  group.add(bridge);

  for (const side of [-1, 1]) {
    const end = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.048, 0.052), crystal);
    end.position.set(side * 0.475, 0.02, -0.01);
    group.add(end);
    addHinge(group, core, side * 0.48, 0.02);

    const temple = addTempleSlab(group, crystal, side * 0.48, 0.024, 0.042, 0.62);
    const coreGeom = new THREE.CylinderGeometry(0.0032, 0.0032, 0.52, 12);
    coreGeom.rotateX(Math.PI / 2);
    coreGeom.translate(0, 0, -0.05);
    temple.add(new THREE.Mesh(coreGeom, core));

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.048, 0.022), crystal);
    nose.position.set(side * 0.16, -0.095, 0.015);
    nose.rotation.z = side * 0.35;
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
