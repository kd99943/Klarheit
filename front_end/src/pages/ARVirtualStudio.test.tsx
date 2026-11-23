import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import i18n from "../i18n";

const mockCameraStart = vi.fn();
const mockCameraStop = vi.fn();
let mockCameraStatus: "idle" | "requesting" | "ready" | "denied" | "unsupported" | "error" = "unsupported";

vi.mock("../ar/useCameraStream", () => ({
  useCameraStream: () => ({
    status: mockCameraStatus,
    stream: null,
    start: mockCameraStart,
    stop: mockCameraStop,
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

vi.mock("../ar/FrameShowcase", () => ({
  FrameShowcase: ({ frame }: { frame: { productName: string; id: string } }) => (
    <div data-testid="frame-showcase">{`${frame.productName}:${frame.id}`}</div>
  ),
}));

vi.mock("../components/ar/FaceCalibrationGuide", () => ({
  FaceCalibrationGuide: () => <div data-testid="face-calibration-guide" />,
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
      basePrice: 850.0,
      imageUrl: "/images/aero_x1.png",
      shape: "ROUND",
      specsSize: "54-17-140",
      detailImages: null,
      arConfigs: [
        { id: "titanium", finishLabelKey: "color.titanium", frameColor: "#9aa1aa", lensColor: "#dce8f2", lensLabel: "Neutral Clear" },
        { id: "rose-gold", finishLabelKey: "color.roseGold", frameColor: "#c4a090", lensColor: "#f0e6dc", lensLabel: "Warm HEV" },
      ],
    },
  ]),
}));

import { ARVirtualStudio } from "./ARVirtualStudio";
import { CartProvider } from "../hooks/useCart";

function ProductReturnProbe() {
  const loc = useLocation();
  return <div data-testid="returned-product">{`${loc.pathname}${loc.search}`}</div>;
}

describe("ARVirtualStudio", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    await i18n.changeLanguage("en");
    mockCameraStatus = "unsupported";
  });

  afterEach(cleanup);

  test("shows unsupported fallback instead of claiming live tracking", async () => {
    render(
      <MemoryRouter initialEntries={["/virtual-studio"]}>
        <CartProvider>
          <ARVirtualStudio />
        </CartProvider>
      </MemoryRouter>
    );

    const matches = await screen.findAllByText(/camera-capable browser/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("Live AR Try-On Active")).not.toBeInTheDocument();
  });

  test("does not auto-start camera on mount; shows selected frame & finish first and starts camera only on user click", async () => {
    mockCameraStatus = "idle";
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/virtual-studio", state: { productId: 1, finishId: "rose-gold" } },
        ]}
      >
        <CartProvider>
          <ARVirtualStudio />
        </CartProvider>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: /Try On AERO X1 · Rose Gold/i })).toBeInTheDocument();
    expect(screen.getByTestId("frame-showcase")).toHaveTextContent("AERO X1:rose-gold");
    expect(mockCameraStart).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Start Camera/i }));
    expect(mockCameraStart).toHaveBeenCalledTimes(1);
  });

  test("switching finish in model mode and returning to product details preserves the updated finish", async () => {
    mockCameraStatus = "idle";
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: "/virtual-studio", state: { productId: 1, finishId: "titanium" } },
        ]}
      >
        <CartProvider>
          <Routes>
            <Route path="/virtual-studio" element={<ARVirtualStudio />} />
            <Route path="/product/:id" element={<ProductReturnProbe />} />
          </Routes>
        </CartProvider>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: /Try On AERO X1 · Titanium/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /View 3D Model First/i }));
    fireEvent.click(screen.getByRole("button", { name: "Rose Gold" }));
    expect(screen.getByTestId("frame-showcase")).toHaveTextContent("AERO X1:rose-gold");

    fireEvent.click(screen.getByRole("button", { name: /Back to Product/i }));
    expect(screen.getByTestId("returned-product")).toHaveTextContent("/product/1?finish=rose-gold");
  });
});
