import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("three", () => {
  class MockGeometry {
    translate() {
      return this;
    }
    rotateX() {
      return this;
    }
    rotateY() {
      return this;
    }
    rotateZ() {
      return this;
    }
    clone() {
      return new MockGeometry();
    }
    dispose() {}
  }

  class Vector3 {
    x = 0;
    y = 0;
    z = 0;
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    set(x: number, y: number, z: number) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }
    setScalar(s: number) {
      this.x = s;
      this.y = s;
      this.z = s;
      return this;
    }
    lerp(v: { x: number; y: number; z: number }, alpha: number) {
      this.x += (v.x - this.x) * alpha;
      this.y += (v.y - this.y) * alpha;
      this.z += (v.z - this.z) * alpha;
      return this;
    }
    clone() {
      return new Vector3(this.x, this.y, this.z);
    }
    sub() {
      return this;
    }
    normalize() {
      return this;
    }
    cross() {
      return this;
    }
    distanceTo() {
      return 0.5;
    }
    applyQuaternion() {
      return this;
    }
  }

  class Quaternion {
    x = 0;
    y = 0;
    z = 0;
    w = 1;
    set() {
      return this;
    }
    setFromEuler() {
      return this;
    }
    setFromRotationMatrix() {
      return this;
    }
    copy() {
      return this;
    }
    multiply() {
      return this;
    }
    slerp() {
      return this;
    }
  }

  class Euler {
    x = 0;
    y = 0;
    z = 0;
    order = "XYZ";
    constructor(x = 0, y = 0, z = 0, order = "XYZ") {
      this.x = x;
      this.y = y;
      this.z = z;
      this.order = order;
    }
    set(x: number, y: number, z: number, order?: string) {
      this.x = x;
      this.y = y;
      this.z = z;
      if (order) this.order = order;
      return this;
    }
  }

  class Matrix4 {
    makeBasis() {
      return this;
    }
  }

  const mockRenderer = {
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
    setClearColor: vi.fn(),
    shadowMap: { enabled: false, type: 0 },
    toneMapping: 0,
    toneMappingExposure: 1,
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
      environment = null;
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
        radius: 0,
        camera: {
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          near: 0,
          far: 0,
          updateProjectionMatrix: vi.fn(),
        },
      };
    },
    Group: class Group {
      add = vi.fn();
      remove = vi.fn();
      position = new Vector3();
      quaternion = new Quaternion();
      rotation = new Euler();
      scale = new Vector3(1, 1, 1);
      traverse = vi.fn();
      visible = true;
    },
    Mesh: class Mesh {
      position = new Vector3();
      quaternion = new Quaternion();
      rotation = new Euler();
      scale = new Vector3(1, 1, 1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      geometry: any = { dispose: vi.fn() };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      material: any = { dispose: vi.fn() };
      castShadow = false;
      receiveShadow = false;
      constructor(geometry?: unknown, material?: unknown) {
        if (geometry) this.geometry = geometry;
        if (material) this.material = material;
      }
      add() {
        return this;
      }
    },
    TorusGeometry: class TorusGeometry extends MockGeometry {},
    CircleGeometry: class CircleGeometry extends MockGeometry {},
    BoxGeometry: class BoxGeometry extends MockGeometry {},
    SphereGeometry: class SphereGeometry extends MockGeometry {},
    CylinderGeometry: class CylinderGeometry extends MockGeometry {},
    ExtrudeGeometry: class ExtrudeGeometry extends MockGeometry {},
    ShapeGeometry: class ShapeGeometry extends MockGeometry {},
    CapsuleGeometry: class CapsuleGeometry extends MockGeometry {},
    TubeGeometry: class TubeGeometry extends MockGeometry {},
    CatmullRomCurve3: class CatmullRomCurve3 {
      constructor() {}
    },
    Shape: class Shape {
      moveTo = vi.fn();
      lineTo = vi.fn();
      quadraticCurveTo = vi.fn();
      bezierCurveTo = vi.fn();
      absellipse = vi.fn();
      closePath = vi.fn();
      holes: unknown[] = [];
    },
    Path: class Path {
      moveTo = vi.fn();
      lineTo = vi.fn();
      quadraticCurveTo = vi.fn();
      bezierCurveTo = vi.fn();
      absellipse = vi.fn();
      closePath = vi.fn();
    },
    MeshStandardMaterial: class MeshStandardMaterial {},
    MeshPhysicalMaterial: class MeshPhysicalMaterial {
      color = { offsetHSL: () => this };
      constructor(public params?: unknown) {}
    },
    MeshBasicMaterial: class MeshBasicMaterial {},
    ShadowMaterial: class ShadowMaterial {},
    Vector3,
    Quaternion,
    Euler,
    Matrix4,
    Color: class Color {
      constructor(_val?: unknown) {}
      offsetHSL() {
        return this;
      }
    },
    PCFSoftShadowMap: 1,
    ACESFilmicToneMapping: 1,
    EquirectangularReflectionMapping: 2,
    SRGBColorSpace: "srgb",
    PMREMGenerator: class PMREMGenerator {
      compileEquirectangularShader = vi.fn();
      fromEquirectangular = vi.fn().mockReturnValue({ texture: {} });
      dispose = vi.fn();
    },
    CanvasTexture: class CanvasTexture {
      mapping = 0;
      colorSpace = "";
      dispose = vi.fn();
    },
  };
});

vi.mock("three/examples/jsm/loaders/GLTFLoader.js", () => {
  return {
    GLTFLoader: class GLTFLoader {
      load = vi.fn();
    },
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
