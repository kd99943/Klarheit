import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as THREE from "three";

const mocks = vi.hoisted(() => ({
  render: vi.fn(), dispose: vi.fn(), load: vi.fn(), decoder: vi.fn(),
  ratio: vi.fn(), size: vi.fn(), envDispose: vi.fn(),
}));
vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();
  return {
    ...actual,
    WebGLRenderer: class {
      shadowMap = {};
      render = mocks.render;
      dispose = mocks.dispose;
      setPixelRatio = mocks.ratio;
      setSize = mocks.size;
      setClearColor = vi.fn();
    },
    PMREMGenerator: class {
      fromScene = () => ({ texture: new actual.Texture(), dispose: mocks.envDispose });
      dispose = vi.fn();
    },
  };
});
vi.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({
  GLTFLoader: class { load = mocks.load; setMeshoptDecoder = mocks.decoder; },
}));

import { ARTryOnCanvas, calculateGlassesTransform3D } from "./ARTryOnCanvas";
import { getARFrameConfig } from "./frameCatalog";
import type { FaceLandmark } from "./types";

let tick: FrameRequestCallback;
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => { tick = cb; return 1; });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const frame = getARFrameConfig("titanium");
const pose = { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], confidence: 1 } as const;
const transform = { position: [...pose.position], rotation: [...pose.rotation], scale: [...pose.scale], confidence: 1 } as import("./types").ARTransform;
function scene(): THREE.Scene { return mocks.render.mock.lastCall![0]; }
function glasses(): THREE.Group { return scene().children.find((item: THREE.Object3D) => item instanceof THREE.Group) as THREE.Group; }

describe("ARTryOnCanvas", () => {
  test("uses a video background while keeping the decoding video mounted and invisible", () => {
    render(<ARTryOnCanvas stream={null} frame={frame} transform={null} onCaptureReady={vi.fn()} />);
    const video = screen.getByTestId("ar-video-layer");
    expect(video).toHaveClass("opacity-0");
    expect(video).not.toHaveClass("hidden");
    expect(scene().background).toBeInstanceOf(THREE.VideoTexture);
    expect((scene().background as THREE.VideoTexture).image).toBe(video);
    expect((scene().background as THREE.VideoTexture).colorSpace).toBe(THREE.SRGBColorSpace);
    expect(glasses().visible).toBe(false);
  });

  test("retains independent depth/shadow helpers when a GLB replaces the fallback", () => {
    const onModelLoad = vi.fn();
    render(<ARTryOnCanvas stream={null} frame={{ ...frame, modelUrl: "/frame.glb" }} transform={transform} onCaptureReady={vi.fn()} onModelLoad={onModelLoad} />);
    const group = glasses();
    const helpers = group.children[0];
    const model = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    model.add(mesh);
    act(() => mocks.load.mock.lastCall![1]({ scene: model }));
    expect(group.children).toHaveLength(2);
    expect(group.children[0]).toBe(helpers);
    expect(helpers.children[0].renderOrder).toBe(-1);
    expect((helpers.children[1] as THREE.Mesh).receiveShadow).toBe(true);
    expect(mesh.castShadow).toBe(true);
    expect(mocks.decoder).toHaveBeenCalled();
    expect(onModelLoad).not.toHaveBeenCalled();
    act(() => tick(100));
    expect(onModelLoad).toHaveBeenCalledWith({ url: "/frame.glb", status: "loaded" });
    expect(mocks.render.mock.invocationCallOrder.at(-1)).toBeLessThan(onModelLoad.mock.invocationCallOrder[0]);
    act(() => tick(116));
    expect(onModelLoad).toHaveBeenCalledOnce();
  });

  test("reports failed GLB loading instead of reporting the procedural fallback as loaded", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const onModelLoad = vi.fn();
    const { unmount } = render(<ARTryOnCanvas stream={null} frame={{ ...frame, modelUrl: "/missing.glb" }} transform={transform} onCaptureReady={vi.fn()} onModelLoad={onModelLoad} />);
    act(() => mocks.load.mock.lastCall![3](new Error("404")));
    act(() => tick(100));
    expect(onModelLoad).toHaveBeenCalledExactlyOnceWith({ url: "/missing.glb", status: "error" });
    unmount();
    act(() => mocks.load.mock.lastCall![1]({ scene: new THREE.Group() }));
    expect(onModelLoad).toHaveBeenCalledOnce();
  });

  test("hides stale tracking immediately and honors overlay toggling", () => {
    const landmarksRef = { current: null as FaceLandmark[] | null };
    const { rerender } = render(<ARTryOnCanvas stream={null} frame={frame} transform={transform} landmarksRef={landmarksRef} onCaptureReady={vi.fn()} />);
    expect(glasses().visible).toBe(false);
    rerender(<ARTryOnCanvas stream={null} frame={frame} transform={transform} onCaptureReady={vi.fn()} />);
    expect(glasses().visible).toBe(true);
    rerender(<ARTryOnCanvas stream={null} frame={frame} transform={transform} showOverlay={false} onCaptureReady={vi.fn()} />);
    act(() => tick(100));
    expect(glasses().visible).toBe(false);
  });

  test("releases video, environment and late GLB resources on unmount", () => {
    const capture = vi.fn();
    const { unmount } = render(<ARTryOnCanvas stream={null} frame={{ ...frame, modelUrl: "/frame.glb" }} transform={null} onCaptureReady={capture} />);
    expect(capture).toHaveBeenCalledWith(expect.any(Function));
    const background = scene().background as THREE.VideoTexture;
    const dispose = vi.spyOn(background, "dispose");
    unmount();
    expect(dispose).toHaveBeenCalledOnce();
    expect(mocks.envDispose).toHaveBeenCalledOnce();
    expect(mocks.dispose).toHaveBeenCalledOnce();
    expect(capture).toHaveBeenLastCalledWith(null);
    const late = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    const geometryDispose = vi.spyOn(mesh.geometry, "dispose");
    late.add(mesh);
    act(() => mocks.load.mock.lastCall![1]({ scene: late }));
    expect(geometryDispose).toHaveBeenCalledOnce();
  });

  test("renders only the published snapshot and releases its texture on resolution change", () => {
    const image = document.createElement("canvas");
    image.width = 640; image.height = 480;
    const trackedFrameRef = { current: { image, landmarks: null, timestampMs: 100, mediaTime: 1 } };
    const sourceVideoRef = { current: document.createElement("video") };
    render(<ARTryOnCanvas stream={null} frame={frame} transform={transform} trackedFrameRef={trackedFrameRef} sourceVideoRef={sourceVideoRef} onCaptureReady={vi.fn()} />);
    expect(screen.queryByTestId("ar-video-layer")).toBeNull();
    const texture = scene().background as THREE.CanvasTexture;
    expect(texture).toBeInstanceOf(THREE.CanvasTexture);
    expect(texture.image).toBe(image);
    expect(glasses().visible).toBe(false);
    const version = texture.version;
    act(() => tick(116));
    expect(texture.version).toBe(version);
    const nextImage = document.createElement("canvas");
    nextImage.width = 640; nextImage.height = 480;
    trackedFrameRef.current = { image: nextImage, landmarks: null, timestampMs: 120, mediaTime: 1.02 };
    act(() => tick(120));
    expect(scene().background).toBe(texture);
    expect(texture.image).toBe(nextImage);
    expect(texture.version).toBeGreaterThan(version);
    const dispose = vi.spyOn(texture, "dispose");
    image.width = 1280; image.height = 720;
    trackedFrameRef.current = { image, landmarks: null, timestampMs: 133, mediaTime: 1.033 };
    act(() => tick(133));
    expect(dispose).toHaveBeenCalledOnce();
    expect(scene().background).not.toBe(texture);
    expect((scene().background as THREE.CanvasTexture).image).toBe(image);
  });

  test("uses iris distance and preserves physical product/PD scaling", () => {
    const points = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
    points[468] = { x: 0.4, y: 0.4, z: 0 };
    points[473] = { x: 0.6, y: 0.4, z: 0 };
    points[168] = { x: 0.5, y: 0.45, z: 0 };
    points[1] = { x: 0.5, y: 0.6, z: -0.02 };
    const base = calculateGlassesTransform3D(points, 1, 1, 71, 63, 35, 2.8)!;
    const wider = calculateGlassesTransform3D(points, 1, 1, 80, 63, 35, 2.8)!;
    expect(wider.scale[0] / base.scale[0]).toBeCloseTo(80 / 71);
    expect(calculateGlassesTransform3D(points, 1, 1, 71, 70, 35, 2.8)!.scale[0] / base.scale[0]).toBeCloseTo(63 / 70);
  });
});
