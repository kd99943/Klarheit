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

vi.mock("../services/api", () => ({
  fetchArConfigs: vi.fn().mockResolvedValue([]),
  fetchProducts: vi.fn().mockResolvedValue([
    {
      id: 1,
      name: "AERO X1",
      material: "Grade 5 Titanium",
      nameEn: "AERO X1",
      nameZh: "AERO X1",
      materialEn: "Grade 5 Titanium",
      materialZh: "5级钛金属",
      basePrice: 850.00,
      imageUrl: "/images/aero_x1.png"
    }
  ]),
}));

import { ARVirtualStudio } from "./ARVirtualStudio";

describe("ARVirtualStudio", () => {
  test("shows unsupported fallback instead of claiming live tracking", async () => {
    render(
      <BrowserRouter>
        <ARVirtualStudio />
      </BrowserRouter>
    );

    const matches = await screen.findAllByText(/camera-capable browser/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Live AR Try-On Active")).not.toBeInTheDocument();
  });
});
