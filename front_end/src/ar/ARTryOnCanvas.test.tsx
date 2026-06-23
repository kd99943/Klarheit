import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("three", () => {
  class MockGeometry {
    translate(x: number, y: number, z: number) { return this; }
    rotateX(a: number) { return this; }
    rotateY(a: number) { return this; }
    rotateZ(a: number) { return this; }
    dispose() {}
  }

  class Vector3 {
    x = 0; y = 0; z = 0;
    constructor(x = 0, y = 0, z = 0) {
      this.x = x; this.y = y; this.z = z;
    }
    set(x: number, y: number, z: number) {
      this.x = x; this.y = y; this.z = z;
      return this;
    }
    setScalar(s: number) {
      this.x = s; this.y = s; this.z = s;
      return this;
    }
    lerp(v: any, alpha: number) {
      this.x += (v.x - this.x) * alpha;
      this.y += (v.y - this.y) * alpha;
      this.z += (v.z - this.z) * alpha;
      return this;
    }
  }

  class Quaternion {
    x = 0; y = 0; z = 0; w = 1;
    set(x: number, y: number, z: number, w: number) {
      this.x = x; this.y = y; this.z = z; this.w = w;
      return this;
    }
    setFromEuler(e: any) { return this; }
    slerp(q: any, alpha: number) { return this; }
  }

  class Euler {
    x = 0; y = 0; z = 0; order = "XYZ";
    constructor(x = 0, y = 0, z = 0, order = "XYZ") {
      this.x = x; this.y = y; this.z = z; this.order = order;
    }
    set(x: number, y: number, z: number, order?: string) {
      this.x = x; this.y = y; this.z = z;
      if (order) this.order = order;
      return this;
    }
  }

  const mockRenderer = {
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
    shadowMap: { enabled: false, type: 0 }
  };

  return {
    WebGLRenderer: class WebGLRenderer {
      shadowMap = { enabled: false, type: 0 };
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
      shadow = {
        mapSize: { width: 0, height: 0 },
        bias: 0,
        camera: {
          left: 0, right: 0, top: 0, bottom: 0, near: 0, far: 0,
          updateProjectionMatrix: vi.fn()
        }
      };
    },
    Group: class Group {
      add = vi.fn();
      position = new Vector3();
      quaternion = new Quaternion();
      rotation = new Euler();
      scale = new Vector3(1, 1, 1);
      traverse = vi.fn((cb) => {
        // Can be called to simulate traversal
      });
    },
    Mesh: class Mesh {
      position = new Vector3();
      quaternion = new Quaternion();
      rotation = new Euler();
      scale = new Vector3(1, 1, 1);
      geometry = { dispose: vi.fn() };
      material = { dispose: vi.fn() };
    },
    TorusGeometry: class TorusGeometry extends MockGeometry {},
    CircleGeometry: class CircleGeometry extends MockGeometry {},
    BoxGeometry: class BoxGeometry extends MockGeometry {},
    SphereGeometry: class SphereGeometry extends MockGeometry {},
    CylinderGeometry: class CylinderGeometry extends MockGeometry {},
    ExtrudeGeometry: class ExtrudeGeometry extends MockGeometry {},
    ShapeGeometry: class ShapeGeometry extends MockGeometry {},
    Shape: class Shape {
      moveTo = vi.fn();
      bezierCurveTo = vi.fn();
      absellipse = vi.fn();
      holes: any[] = [];
    },
    Path: class Path {
      moveTo = vi.fn();
      bezierCurveTo = vi.fn();
      absellipse = vi.fn();
    },
    MeshStandardMaterial: class MeshStandardMaterial {},
    MeshPhysicalMaterial: class MeshPhysicalMaterial {},
    MeshBasicMaterial: class MeshBasicMaterial {},
    ShadowMaterial: class ShadowMaterial {},
    Vector3,
    Quaternion,
    Euler,
    Color: class Color {
      constructor(val?: any) {}
    },
    PCFSoftShadowMap: 1,
    ACESFilmicToneMapping: 1,
    EquirectangularReflectionMapping: 2,
    PMREMGenerator: class PMREMGenerator {
      compileEquirectangularShader = vi.fn();
      fromEquirectangular = vi.fn().mockReturnValue({ texture: {} });
      dispose = vi.fn();
    },
    CanvasTexture: class CanvasTexture {
      dispose = vi.fn();
    }
  };
});

vi.mock("three/examples/jsm/loaders/GLTFLoader.js", () => {
  return {
    GLTFLoader: class GLTFLoader {
      load = vi.fn();
    }
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
