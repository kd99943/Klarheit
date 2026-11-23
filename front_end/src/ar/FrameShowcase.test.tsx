import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import * as THREE from "three";

const mocks = vi.hoisted(() => ({ render: vi.fn(), load: vi.fn() }));
vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();
  return { ...actual,
    WebGLRenderer: class {
      domElement = document.createElement("canvas");
      render = mocks.render;
      setPixelRatio = vi.fn(); setSize = vi.fn(); setClearColor = vi.fn(); dispose = vi.fn();
    },
    PMREMGenerator: class {
      fromScene = () => ({ texture: new actual.Texture(), dispose: vi.fn() });
      dispose = vi.fn();
    },
  };
});
vi.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({
  GLTFLoader: class { load = mocks.load; setMeshoptDecoder = vi.fn(); },
}));

import { FrameShowcase } from "./FrameShowcase";
import { getARFrameConfig } from "./frameCatalog";

let tick: FrameRequestCallback;
let resize: () => void;
const frame = { ...getARFrameConfig("titanium"), modelUrl: "/frame.glb" };
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => { tick = callback; return 1; });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal("ResizeObserver", class { constructor(callback: () => void) { resize = callback; } observe() {} disconnect() {} });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test("reports GLB ready once, only after it is rendered", () => {
  const onModelLoad = vi.fn();
  render(<FrameShowcase frame={frame} onModelLoad={onModelLoad} />);
  act(() => tick(10));
  expect(onModelLoad).not.toHaveBeenCalled();
  const model = new THREE.Group().add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
  act(() => mocks.load.mock.lastCall![1]({ scene: model }));
  expect(onModelLoad).not.toHaveBeenCalled();
  act(() => tick(20));
  expect(onModelLoad).toHaveBeenCalledWith({ url: frame.modelUrl, status: "loaded" });
  expect(mocks.render.mock.invocationCallOrder.at(-1)).toBeLessThan(onModelLoad.mock.invocationCallOrder[0]);
  act(() => tick(30));
  expect(onModelLoad).toHaveBeenCalledOnce();
});

test("reports load failure without accepting the fallback and ignores late callbacks after unmount", () => {
  const onModelLoad = vi.fn();
  const { unmount } = render(<FrameShowcase frame={frame} onModelLoad={onModelLoad} />);
  const [, loaded, , failed] = mocks.load.mock.lastCall!;
  act(() => failed(new Error("missing GLB")));
  act(() => tick(10));
  expect(onModelLoad).toHaveBeenCalledExactlyOnceWith({ url: frame.modelUrl, status: "error" });
  unmount();
  const geometry = new THREE.BoxGeometry();
  const dispose = vi.spyOn(geometry, "dispose");
  act(() => {
    failed(new Error("late failure"));
    loaded({ scene: new THREE.Group().add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial())) });
  });
  expect(onModelLoad).toHaveBeenCalledOnce();
  expect(dispose).toHaveBeenCalledOnce();
});

test("keeps the entire rotating model in view after a narrow-container resize", () => {
  const width = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(480);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(480);
  render(<FrameShowcase frame={frame} />);
  const model = new THREE.Group().add(new THREE.Mesh(new THREE.BoxGeometry(2, 1, 3), new THREE.MeshStandardMaterial()));
  act(() => mocks.load.mock.lastCall![1]({ scene: model }));
  for (const containerWidth of [480, 160]) {
    width.mockReturnValue(containerWidth);
    act(() => { resize(); tick(20); });
    const [scene, camera] = mocks.render.mock.lastCall! as [THREE.Scene, THREE.PerspectiveCamera];
    const turntable = scene.children.find((child) => child instanceof THREE.Group)!;
    turntable.rotation.y = 0.55;
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    for (const x of [-1, 1]) for (const y of [-0.5, 0.5]) for (const z of [-1.5, 1.5]) {
      const point = new THREE.Vector3(x, y, z).applyMatrix4(model.matrixWorld).project(camera);
      expect(Math.abs(point.x)).toBeLessThan(1);
      expect(Math.abs(point.y)).toBeLessThan(1);
      expect(Math.abs(point.z)).toBeLessThan(1);
    }
  }
});

test("supports unclamped horizontal and vertical rotation and keeps pose after pointer release", () => {
  const { getByTestId } = render(<FrameShowcase frame={frame} />);
  const canvas = getByTestId("frame-showcase").querySelector("canvas")!;
  expect(canvas.style.touchAction).toBe("none");

  const [scene] = mocks.render.mock.lastCall! as [THREE.Scene, THREE.PerspectiveCamera];
  const showcase = scene.children.find((child) => child instanceof THREE.Group)!;
  const initialYaw = showcase.rotation.y;
  const initialPitch = showcase.rotation.x;

  // Drag horizontally past the legacy ±1.1 rad clamp and vertically to tilt top/bottom
  act(() => {
    canvas.dispatchEvent(new MouseEvent("pointerdown", { clientX: 100, clientY: 100, bubbles: true }));
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 400, clientY: 300, bubbles: true }));
    window.dispatchEvent(new MouseEvent("pointerup", { clientX: 400, clientY: 300, bubbles: true }));
  });

  const expectedYaw = initialYaw + 300 * 0.008;
  const expectedPitch = initialPitch + 200 * 0.008;
  expect(showcase.rotation.y).toBeCloseTo(expectedYaw, 5);
  expect(Math.abs(showcase.rotation.y)).toBeGreaterThan(1.1);
  expect(showcase.rotation.x).toBeCloseTo(expectedPitch, 5);

  // Subsequent animation frame preserves the released yaw & pitch without snapping back
  act(() => tick(40));
  expect(showcase.rotation.y).toBeCloseTo(expectedYaw, 5);
  expect(showcase.rotation.x).toBeCloseTo(expectedPitch, 5);

  // A second drag continues smoothly from the retained pose
  act(() => {
    canvas.dispatchEvent(new MouseEvent("pointerdown", { clientX: 200, clientY: 200, bubbles: true }));
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 250, clientY: 150, bubbles: true }));
    window.dispatchEvent(new MouseEvent("pointerup", { clientX: 250, clientY: 150, bubbles: true }));
  });
  expect(showcase.rotation.y).toBeCloseTo(expectedYaw + 50 * 0.008, 5);
  expect(showcase.rotation.x).toBeCloseTo(expectedPitch - 50 * 0.008, 5);
});
