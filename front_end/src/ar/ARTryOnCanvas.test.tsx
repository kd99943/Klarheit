import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("three", () => {
  const mockRenderer = {
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
  };

  return {
    WebGLRenderer: class WebGLRenderer {
      constructor() {
        return mockRenderer;
      }
    },
    Scene: class Scene {
      add = vi.fn();
      remove = vi.fn();
    },
    PerspectiveCamera: class PerspectiveCamera {
      position = { z: 0 };
      aspect = 1;
      updateProjectionMatrix = vi.fn();
    },
    AmbientLight: class AmbientLight {},
    DirectionalLight: class DirectionalLight {
      position = { set: vi.fn() };
    },
    Group: class Group {
      add = vi.fn();
      position = { set: vi.fn() };
      rotation = { set: vi.fn() };
      scale = { setScalar: vi.fn() };
      traverse = vi.fn();
    },
    Mesh: class Mesh {
      position = { set: vi.fn(), x: 0 };
      rotation = { y: 0 };
      geometry = { dispose: vi.fn() };
      material = { dispose: vi.fn() };
    },
    TorusGeometry: class TorusGeometry {},
    CircleGeometry: class CircleGeometry {},
    BoxGeometry: class BoxGeometry {},
    MeshStandardMaterial: class MeshStandardMaterial {},
    MeshPhysicalMaterial: class MeshPhysicalMaterial {},
  };
});

import { ARTryOnCanvas } from "./ARTryOnCanvas";
import { getARFrameConfig } from "./frameCatalog";

describe("ARTryOnCanvas", () => {
  test("renders video and canvas layers for the AR scene", () => {
    const stream = { id: "stream-1" } as MediaStream;

    render(
      <ARTryOnCanvas
        stream={stream}
        frame={getARFrameConfig("matte-black")}
        transform={null}
        onCaptureReady={vi.fn()}
      />
    );

    expect(screen.getByTestId("ar-video-layer")).toBeInTheDocument();
    expect(screen.getByTestId("ar-canvas-layer")).toBeInTheDocument();
  });

  test("exposes a capture function when the canvas is ready", () => {
    const onCaptureReady = vi.fn();

    render(
      <ARTryOnCanvas
        stream={{ id: "stream-1" } as MediaStream}
        frame={getARFrameConfig("titanium")}
        transform={null}
        onCaptureReady={onCaptureReady}
      />
    );

    expect(onCaptureReady).toHaveBeenCalledWith(expect.any(Function));
  });
});
