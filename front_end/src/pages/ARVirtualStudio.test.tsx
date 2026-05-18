import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
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

vi.mock("../ar/useCameraStream", () => ({
  useCameraStream: () => ({
    status: "unsupported",
    stream: null,
    start: vi.fn(),
    stop: vi.fn(),
  }),
}));

vi.mock("../ar/useFaceLandmarks", () => ({
  useFaceLandmarks: () => ({
    status: "initializing",
    landmarks: null,
  }),
}));

vi.mock("../ar/ARTryOnCanvas", () => ({
  ARTryOnCanvas: () => <div data-testid="ar-try-on-canvas" />,
}));

import { ARVirtualStudio } from "./ARVirtualStudio";

describe("ARVirtualStudio", () => {
  test("shows unsupported fallback instead of claiming live tracking", () => {
    render(
      <BrowserRouter>
        <ARVirtualStudio />
      </BrowserRouter>
    );

    const matches = screen.getAllByText(/camera-capable browser/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Live AR Try-On Active")).not.toBeInTheDocument();
  });
});
