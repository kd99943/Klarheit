import { afterEach, describe, expect, test, vi } from "vitest";
import * as THREE from "three";
import { applyVideoCover, toViewportPoint, facePointToWorld, videoPixelRatio, wrapFrameModel, estimateFaceLighting } from "./arRendering";
import { captureCompositeFrame } from "./glassesGeometry";
import { getARFrameConfig } from "./frameCatalog";
import { PoseFilter } from "./oneEuroFilter";
import { createFaceOcclusion } from "./faceOcclusion";
import { FACE_TRIANGLES } from "./faceTriangles";

afterEach(() => vi.restoreAllMocks());

describe("camera compositing", () => {
  test.each([[16 / 9, 3 / 4], [3 / 4, 16 / 9], [1, 1]])("matches background crop and landmark mapping (%s, %s)", (videoAspect, viewAspect) => {
    const texture = new THREE.Texture();
    applyVideoCover(texture, videoAspect, viewAspect);
    const point = { x: 0.42, y: 0.63 };
    const projected = toViewportPoint(point, videoAspect, viewAspect);
    expect(projected[0] * texture.repeat.x + texture.offset.x).toBeCloseTo(point.x);
    expect(projected[1] * texture.repeat.y + texture.offset.y).toBeCloseTo(point.y);
  });

  test("limits resolution to visible camera pixels", () => {
    expect(videoPixelRatio(1280, 720, 640, 360, 3)).toBe(2);
    expect(videoPixelRatio(640, 480, 400, 800, 2)).toBe(1);
    expect(videoPixelRatio(640, 480, 640, 360, 2)).toBe(1);
  });

  test.each([[16 / 9, 3 / 4], [3 / 4, 16 / 9], [1, 1]])("preserves video pixels after perspective projection at varying depths (%s, %s)", (videoAspect, viewAspect) => {
    const camera = new THREE.PerspectiveCamera(35, viewAspect, 0.1, 10);
    camera.position.z = 2.8;
    camera.updateMatrixWorld();
    const height = 2 * Math.tan(THREE.MathUtils.degToRad(35 / 2));
    const projection = { width: height * viewAspect, height, z: 1.8, cameraZ: 2.8, depthScale: height * Math.max(videoAspect, viewAspect) };
    for (const z of [-0.15, 0, 0.1]) {
      const point = { x: 0.42, y: 0.2, z };
      const world = facePointToWorld(point, projection, videoAspect, viewAspect, new THREE.Vector3());
      const screen = world.project(camera);
      const expected = toViewportPoint(point, videoAspect, viewAspect);
      expect((screen.x + 1) / 2).toBeCloseTo(expected[0], 6);
      expect((1 - screen.y) / 2).toBeCloseTo(expected[1], 6);
    }
  });

  test("captures the canvas once, mirrors it, then draws the watermark", () => {
    const ctx = { fillRect: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(), drawImage: vi.fn(), fillText: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,test");
    const canvas = document.createElement("canvas");
    expect(captureCompositeFrame(canvas)).toMatch(/^data:image\/jpeg/);
    expect(ctx.drawImage).toHaveBeenCalledExactlyOnceWith(canvas, 0, 0, canvas.width, canvas.height);
    expect(ctx.scale).toHaveBeenCalledWith(-1, 1);
    expect(ctx.fillText).toHaveBeenCalledWith("KLARHEIT", 14, canvas.height - 12);
  });

  test("normalizes real meter GLBs without changing the old model convention", () => {
    const frame = getARFrameConfig("titanium");
    const old = wrapFrameModel(new THREE.Group(), frame);
    const real = wrapFrameModel(new THREE.Group(), { ...frame, modelScaleMode: "real-meters" });
    expect(old.scale.x).toBe(1);
    expect(real.scale.x * 0.071).toBeCloseTo(0.48);
  });

  test("estimates dim and warm lighting in linear space", () => {
    const landmarks = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5 }));
    const make = (r: number, g: number, b: number) => new Uint8ClampedArray(Array.from({ length: 64 * 48 }, () => [r, g, b, 255]).flat());
    const dim = estimateFaceLighting(make(20, 20, 20), 64, 48, landmarks)!;
    const warm = estimateFaceLighting(make(210, 150, 90), 64, 48, landmarks)!;
    expect(dim.exposure).toBe(0.55);
    expect(warm.exposure).toBeGreaterThan(dim.exposure);
    expect(warm.color.r).toBeGreaterThan(warm.color.b);
    expect(warm.direction).toBe(0);
    expect(estimateFaceLighting(make(0, 0, 0), 64, 48, [])).toBeNull();
  });
});

describe("pose filtering and face occlusion", () => {
  test("starts on the target, suppresses jitter and resets on reacquisition", () => {
    const filter = new PoseFilter();
    const target = new THREE.Group();
    const position = new THREE.Vector3(2, 3, 4);
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    filter.apply(target, position, rotation, scale, 0);
    expect(target.position.equals(position)).toBe(true);
    position.x += 0.01;
    filter.apply(target, position, rotation, scale, 33);
    expect(target.position.x).toBeGreaterThan(2);
    expect(target.position.x).toBeLessThan(2.005);
    filter.reset();
    filter.apply(target, position, rotation, scale, 66);
    expect(target.position.equals(position)).toBe(true);
  });

  test("treats opposite quaternion signs as the same orientation", () => {
    const filter = new PoseFilter();
    const target = new THREE.Group();
    filter.apply(target, new THREE.Vector3(), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1), 0);
    filter.apply(target, new THREE.Vector3(), new THREE.Quaternion(0, 0, 0, -1), new THREE.Vector3(1, 1, 1), 33);
    expect(target.quaternion.angleTo(new THREE.Quaternion())).toBeCloseTo(0);
  });

  test("keeps a sustained 120 degree/second turn within two 30fps samples", () => {
    const filter = new PoseFilter();
    const target = new THREE.Group();
    const axis = new THREE.Vector3(0, 1, 0);
    const rotation = new THREE.Quaternion();
    for (let i = 0; i <= 30; i++) {
      rotation.setFromAxisAngle(axis, THREE.MathUtils.degToRad(i * 4));
      filter.apply(target, new THREE.Vector3(), rotation, new THREE.Vector3(1, 1, 1), i * 1000 / 30);
    }
    expect(THREE.MathUtils.radToDeg(target.quaternion.angleTo(rotation))).toBeLessThan(8);
  });

  test("uses canonical triangles, shares depth/shadow geometry and rejects incomplete faces", () => {
    expect(FACE_TRIANGLES).toHaveLength(898 * 3);
    expect(Math.max(...FACE_TRIANGLES)).toBe(467);
    const face = createFaceOcclusion();
    const points = Array.from({ length: 468 }, (_, i) => ({ x: (i % 26) / 26, y: Math.floor(i / 26) / 18, z: 0 }));
    expect(face.update(points, { width: 2, height: 2, z: 1, cameraZ: 3, depthScale: 2 }, 1, 1, new THREE.Quaternion(), 0)).toBe(true);
    const mesh = face.group.children[0] as THREE.Mesh;
    expect(mesh.geometry).toBe((face.group.children[1] as THREE.Mesh).geometry);
    expect(mesh.geometry.getAttribute("position").getX(234)).toBeCloseTo((points[234].x - 0.5) * 2);
    expect(mesh.renderOrder).toBe(-1);
    expect(face.update([], { width: 2, height: 2, z: 1, cameraZ: 3, depthScale: 2 }, 1, 1, new THREE.Quaternion(), 0)).toBe(false);
    expect(face.group.visible).toBe(false);
  });
});
