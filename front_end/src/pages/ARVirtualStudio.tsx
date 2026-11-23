import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  SlidersHorizontal,
  ArrowLeft,
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
  Download,
  X,
  RotateCcw,
  Ruler,
  Plus,
  Sparkles,
  Columns2,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ARTryOnCanvas } from "../ar/ARTryOnCanvas";
import { FrameShowcase } from "../ar/FrameShowcase";
import { FrameCompare, type CompareSlotSelection } from "../ar/FrameCompare";
import { FaceCalibrationGuide } from "../components/ar/FaceCalibrationGuide";
import { calculateGlassesTransform } from "../ar/arCalibration";
import { AR_FRAME_CATALOG, getFrameConfigForProduct, getSpecsForProduct } from "../ar/frameCatalog";
import type { ARFinishId, ARExperienceStatus, ARUserAdjust, FaceLandmark } from "../ar/types";
import { useProducts } from "../hooks/useProducts";
import { useCameraStream } from "../ar/useCameraStream";
import { useFaceLandmarks } from "../ar/useFaceLandmarks";
import { Button } from "../components/ui/Button";
import { cn, formatPrice } from "../lib/utils";
import { useCart, cartItemFromProduct } from "../hooks/useCart";
import { track } from "../services/analytics";
import {
  getDefaultFinishId,
  isProductOrderable,
  isSkuOrderable,
  persistProductSelection,
  readLastProductSelection,
  readSavedFinishForProduct,
  resolveFinishForProduct,
  resolveSkuForSelection,
} from "../lib/selection";
import { TRYON_SNAPSHOT_KEY, writeTaggedTryOnSnapshot } from "../lib/privacy";

const AERO_X1_IMAGE_URL = "/images/aero_x1.png";
const TRY_ON_SNAPSHOT_KEY = TRYON_SNAPSHOT_KEY;

type ARRouteState = {
  productId?: number;
  finishId?: string;
  sizeSpec?: string;
  skuId?: number;
  fromProductDetails?: boolean;
  catalogReturnUrl?: string;
};

function resolveExperienceStatus(
  cameraStatus: string,
  trackingStatus: string,
  captured: boolean
): ARExperienceStatus {
  if (captured) return "captured";
  if (cameraStatus === "unsupported") return "unsupported";
  if (cameraStatus === "denied") return "permission-denied";
  if (cameraStatus === "error" || trackingStatus === "error") return "error";
  if (cameraStatus !== "ready") return "initializing";
  if (trackingStatus === "tracking") return "tracking";
  if (trackingStatus === "low-confidence") return "low-confidence";
  return "no-face";
}

function estimateFaceMetrics(landmarks: FaceLandmark[] | null) {
  if (!landmarks || landmarks.length < 455) return null;
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const leftFace = landmarks[234];
  const rightFace = landmarks[454];
  if (!leftEye || !rightEye || !leftFace || !rightFace) return null;

  const dist = (a: FaceLandmark, b: FaceLandmark) => Math.hypot(a.x - b.x, a.y - b.y);
  const eyeOuter = dist(leftEye, rightEye);
  const faceWidthNorm = dist(leftFace, rightFace);
  if (faceWidthNorm < 0.05 || eyeOuter < 0.02) return null;

  const faceWidthMm = 142;
  const eyeOuterMm = (eyeOuter / faceWidthNorm) * faceWidthMm;
  const pdMm = Math.round(eyeOuterMm * 0.78);
  return {
    faceWidthMm,
    pdMm: Math.min(78, Math.max(50, pdMm)),
    eyeOuterMm,
  };
}

export function ARVirtualStudio() {
  const { t, i18n } = useTranslation("ar-studio");
  const isZh = i18n.language === "zh";
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = (location.state as ARRouteState | null) ?? null;
  const { addItem, removeItem } = useCart();

  const { products } = useProducts();
  const [activeProductId, setActiveProductId] = useState<number | null>(null);
  const [activeFinishId, setActiveFinishId] = useState<ARFinishId | null>(null);
  const [studioMode, setStudioMode] = useState<"pre-camera" | "model" | "camera">("pre-camera");
  const [previewMedia, setPreviewMedia] = useState<"3d" | "photo">("3d");
  const [isCatalogExpanded, setIsCatalogExpanded] = useState<boolean>(true);

  const [capturePreview, setCapturePreview] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState<boolean>(true);
  const [showPrivacyTooltip, setShowPrivacyTooltip] = useState<boolean>(false);
  const [showAdjustPanel, setShowAdjustPanel] = useState<boolean>(false);
  const [userAdjust, setUserAdjust] = useState<ARUserAdjust>({ x: 0, y: 0, scale: 1 });
  const [switchBanner, setSwitchBanner] = useState<string | null>(null);
  const [addedToast, setAddedToast] = useState<{ itemId: string; text: string } | null>(null);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [activeCompareSlot, setActiveCompareSlot] = useState<"A" | "B">("A");
  const [compareSlotB, setCompareSlotB] = useState<CompareSlotSelection | null>(null);
  const [showSlowLoadFallback, setShowSlowLoadFallback] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureRef = useRef<(() => string | null) | null>(null);
  const switchTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const cameraStartAtRef = useRef<number | null>(null);
  const firstFrameTrackedRef = useRef(false);

  const handleCaptureReady = useCallback((capture: (() => string | null) | null) => {
    captureRef.current = capture;
  }, []);

  const enteredAtRef = useRef(Date.now());
  const productSwitchedRef = useRef(false);
  const faceDetectedRef = useRef(false);
  const faceFirstDetectedAtRef = useRef<number | null>(null);
  const initFailedTrackedRef = useRef(false);

  const camera = useCameraStream();
  const tracking = useFaceLandmarks({
    videoRef,
    enabled: studioMode === "camera" && camera.status === "ready",
  });

  // Always stop camera tracks when leaving studio, never auto-request camera on mount
  useEffect(() => {
    return () => {
      camera.stop();
      if (switchTimerRef.current !== null) window.clearTimeout(switchTimerRef.current);
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hydrate initial (productId, finishId) strictly bound to the target product
  useEffect(() => {
    if (products.length > 0 && activeProductId === null) {
      const lastStored = readLastProductSelection();
      const targetProductId = routeState?.productId ?? lastStored?.productId;
      const candidateProduct =
        (targetProductId !== undefined ? products.find((p) => p.id === Number(targetProductId)) : undefined) ??
        products[0];

      if (!candidateProduct) return;

      const requestedFinish =
        routeState?.finishId &&
        (routeState.productId === undefined || Number(routeState.productId) === candidateProduct.id)
          ? routeState.finishId
          : readSavedFinishForProduct(candidateProduct.id);

      const resolved = resolveFinishForProduct(candidateProduct, requestedFinish);
      setActiveProductId(candidateProduct.id);
      setActiveFinishId((resolved.finishId as ARFinishId | undefined) ?? null);
      persistProductSelection(candidateProduct.id, resolved.finishId ?? null);
    }
  }, [products, activeProductId, routeState]);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === activeProductId) || products[0] || null;
  }, [products, activeProductId]);

  const finishes = useMemo(() => selectedProduct?.arConfigs ?? [], [selectedProduct]);

  const effectiveFinishId = useMemo(() => {
    if (!selectedProduct) return activeFinishId;
    if (activeFinishId && finishes.some((f) => f.id === activeFinishId)) {
      return activeFinishId;
    }
    return (getDefaultFinishId(selectedProduct) as ARFinishId | undefined) ?? null;
  }, [selectedProduct, activeFinishId, finishes]);

  const frame = useMemo(() => {
    if (selectedProduct) {
      return getFrameConfigForProduct(selectedProduct, effectiveFinishId);
    }
    return AR_FRAME_CATALOG.titanium;
  }, [selectedProduct, effectiveFinishId]);

  const slotA = useMemo<CompareSlotSelection | null>(() => {
    if (!selectedProduct) return null;
    return { productId: selectedProduct.id, finishId: effectiveFinishId };
  }, [selectedProduct, effectiveFinishId]);

  const resolvedSlotB = useMemo<CompareSlotSelection | null>(() => {
    if (products.length === 0) return null;
    if (compareSlotB && products.some((p) => p.id === compareSlotB.productId)) {
      return compareSlotB;
    }
    const alternative = products.find((p) => p.id !== selectedProduct?.id) ?? products[0];
    const altFinishes = alternative.arConfigs ?? [];
    const altFinish =
      alternative.id === selectedProduct?.id && altFinishes.length > 1
        ? (altFinishes.find((f) => f.id !== effectiveFinishId)?.id ?? getDefaultFinishId(alternative) ?? null)
        : (getDefaultFinishId(alternative) ?? null);
    return { productId: alternative.id, finishId: altFinish };
  }, [products, compareSlotB, selectedProduct?.id, effectiveFinishId]);

  const productB = useMemo(
    () => (resolvedSlotB ? products.find((p) => p.id === resolvedSlotB.productId) ?? null : null),
    [products, resolvedSlotB]
  );

  const frameB = useMemo(() => {
    if (!productB) return frame;
    return getFrameConfigForProduct(productB, (resolvedSlotB?.finishId as ARFinishId | null) ?? null);
  }, [productB, resolvedSlotB?.finishId, frame]);

  const displayedProduct = compareEnabled && activeCompareSlot === "B" && productB ? productB : selectedProduct;
  const displayedFinishId: ARFinishId | null =
    compareEnabled && activeCompareSlot === "B" && resolvedSlotB
      ? ((resolvedSlotB.finishId as ARFinishId | null) ?? null)
      : effectiveFinishId;
  const displayedFrame = compareEnabled && activeCompareSlot === "B" ? frameB : frame;

  const handleToggleCompare = () => {
    setCompareEnabled((prev) => {
      const next = !prev;
      if (next && resolvedSlotB && !compareSlotB) {
        setCompareSlotB(resolvedSlotB);
      }
      if (!next) {
        setActiveCompareSlot("A");
      }
      return next;
    });
  };

  const displayProductName = selectedProduct
    ? isZh
      ? selectedProduct.nameZh
      : selectedProduct.nameEn
    : frame.productName;

  const activeFinishObj = useMemo(
    () => finishes.find((f) => f.id === effectiveFinishId) ?? finishes[0] ?? null,
    [finishes, effectiveFinishId]
  );

  const activeFinishLabel = useMemo(() => {
    if (!activeFinishObj) return null;
    return t("color." + activeFinishObj.id, {
      defaultValue: t(activeFinishObj.finishLabelKey, { defaultValue: activeFinishObj.id }),
    });
  }, [activeFinishObj, t]);

  const displayedProductName = displayedProduct
    ? isZh
      ? displayedProduct.nameZh
      : displayedProduct.nameEn
    : displayProductName;

  const displayedFinishLabel = useMemo(() => {
    const targetFinishes = displayedProduct?.arConfigs ?? [];
    const obj = targetFinishes.find((f) => f.id === displayedFinishId) ?? targetFinishes[0] ?? null;
    if (!obj) return null;
    return t("color." + obj.id, {
      defaultValue: t(obj.finishLabelKey, { defaultValue: obj.id }),
    });
  }, [displayedProduct, displayedFinishId, t]);

  const displayedRequestedSize =
    routeState?.productId !== undefined && displayedProduct && Number(routeState.productId) === displayedProduct.id
      ? routeState.sizeSpec
      : undefined;

  const displayedSku = useMemo(
    () =>
      resolveSkuForSelection(displayedProduct, {
        skuId:
          routeState?.productId !== undefined && displayedProduct && Number(routeState.productId) === displayedProduct.id
            ? routeState.skuId
            : undefined,
        finishId: displayedFinishId,
        sizeSpec: displayedRequestedSize,
      }),
    [displayedProduct, displayedFinishId, displayedRequestedSize, routeState?.productId, routeState?.skuId]
  );

  const isDisplayedOrderable =
    Boolean(displayedProduct) && isProductOrderable(displayedProduct) && isSkuOrderable(displayedSku);

  const announceSelectionChange = useCallback(
    (prodName: string, finishLbl: string | null) => {
      if (!finishLbl) return;
      setSwitchBanner(t("live.switchedFeedback", { name: prodName, finish: finishLbl }));
      if (switchTimerRef.current !== null) window.clearTimeout(switchTimerRef.current);
      switchTimerRef.current = window.setTimeout(() => {
        setSwitchBanner(null);
        switchTimerRef.current = null;
      }, 2400);
    },
    [t]
  );

  const handleSelectProduct = (productId: number) => {
    const nextProd = products.find((p) => p.id === productId);
    if (!nextProd) return;
    const savedFinish = readSavedFinishForProduct(nextProd.id);
    const resolved = resolveFinishForProduct(nextProd, savedFinish);
    const nextFinish = (resolved.finishId as ARFinishId | undefined) ?? null;
    setActiveProductId(nextProd.id);
    setActiveFinishId(nextFinish);
    persistProductSelection(nextProd.id, nextFinish);
    const nextName = isZh ? nextProd.nameZh : nextProd.nameEn;
    const nextFinishObj = nextProd.arConfigs?.find((f) => f.id === nextFinish) ?? nextProd.arConfigs?.[0];
    const nextFinishLbl = nextFinishObj
      ? t("color." + nextFinishObj.id, {
          defaultValue: t(nextFinishObj.finishLabelKey, { defaultValue: nextFinishObj.id }),
        })
      : null;
    announceSelectionChange(nextName, nextFinishLbl);
  };

  const handleSelectFinish = (finishId: ARFinishId) => {
    if (!selectedProduct) return;
    setActiveFinishId(finishId);
    persistProductSelection(selectedProduct.id, finishId);
    const finishObj = finishes.find((f) => f.id === finishId);
    const label = finishObj
      ? t("color." + finishObj.id, {
          defaultValue: t(finishObj.finishLabelKey, { defaultValue: finishObj.id }),
        })
      : finishId;
    announceSelectionChange(displayProductName, label);
  };

  const transform = useMemo(
    () => (tracking.landmarks ? calculateGlassesTransform(tracking.landmarks) : null),
    [tracking.landmarks]
  );

  const experienceStatus = resolveExperienceStatus(
    camera.status,
    transform && tracking.status === "tracking" ? "tracking" : tracking.status,
    Boolean(capturePreview)
  );

  const faceMetrics = useMemo(() => estimateFaceMetrics(tracking.landmarks), [tracking.landmarks]);
  const productSpecs = useMemo(
    () => (selectedProduct ? getSpecsForProduct(selectedProduct) : null),
    [selectedProduct]
  );

  const fitLabelKey = useMemo(() => {
    if (!faceMetrics || !productSpecs) return "fit.calculating";
    const [min, max] = productSpecs.faceWidthRange;
    if (faceMetrics.faceWidthMm < min) return "fit.narrow";
    if (faceMetrics.faceWidthMm > max) return "fit.wide";
    return "fit.good";
  }, [faceMetrics, productSpecs]);

  useEffect(() => {
    track("ar_studio_entered", {});
    return () => {
      track("ar_studio_exited", {
        duration_sec: Math.round((Date.now() - enteredAtRef.current) / 1000),
      });
    };
  }, []);

  useEffect(() => {
    if (!productSwitchedRef.current) {
      productSwitchedRef.current = true;
      return;
    }
    if (activeProductId === null) return;
    const product = products.find((p) => p.id === activeProductId);
    if (product) {
      track("ar_product_switched", {
        product_id: String(product.id),
        product_name: isZh ? product.nameZh : product.nameEn,
      });
      setUserAdjust({ x: 0, y: 0, scale: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProductId]);

  useEffect(() => {
    const isFallback =
      camera.status === "denied" ||
      camera.status === "unsupported" ||
      camera.status === "error";
    if (isFallback && !initFailedTrackedRef.current) {
      initFailedTrackedRef.current = true;
      track("ar_init_failed", { error_type: camera.status });
    }
  }, [camera.status]);

  useEffect(() => {
    if (tracking.status === "tracking") {
      if (!faceDetectedRef.current) {
        faceDetectedRef.current = true;
        faceFirstDetectedAtRef.current = Date.now();
        track("ar_face_detected", {});
      }
    } else if (faceDetectedRef.current) {
      faceDetectedRef.current = false;
      const startedAt = faceFirstDetectedAtRef.current;
      if (startedAt !== null) {
        track("ar_face_lost", {
          duration_sec: Math.round((Date.now() - startedAt) / 1000),
        });
        faceFirstDetectedAtRef.current = null;
      }
    }
  }, [tracking.status]);

  const fitHintKey = useMemo(() => {
    if (experienceStatus !== "tracking" || !tracking.landmarks) return "calibrating";
    const leftEye = tracking.landmarks[33];
    const rightEye = tracking.landmarks[263];
    const leftFace = tracking.landmarks[234];
    const rightFace = tracking.landmarks[454];
    if (!leftEye || !rightEye || !leftFace || !rightFace) return "calibrating";

    const eyeDist = Math.hypot(leftEye.x - rightEye.x, leftEye.y - rightEye.y);
    if (eyeDist > 0.22) return "tooClose";
    if (eyeDist < 0.11) return "tooFar";
    return "perfect";
  }, [experienceStatus, tracking.landmarks]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = camera.stream;
    }
  }, [camera.stream]);

  useEffect(() => {
    if (studioMode !== "camera") {
      setShowSlowLoadFallback(false);
      return;
    }
    if (tracking.status === "tracking") {
      setShowSlowLoadFallback(false);
      if (!firstFrameTrackedRef.current) {
        firstFrameTrackedRef.current = true;
        const started = cameraStartAtRef.current ?? enteredAtRef.current;
        track("ar_first_frame_ready", {
          mode: "camera",
          duration_ms: Math.max(0, Date.now() - started),
        });
      }
      return;
    }
    if (firstFrameTrackedRef.current) {
      return;
    }
    const slowTimer = window.setTimeout(() => {
      setShowSlowLoadFallback(true);
    }, 6000);
    return () => window.clearTimeout(slowTimer);
  }, [studioMode, tracking.status]);

  const handleStartCamera = () => {
    cameraStartAtRef.current = Date.now();
    firstFrameTrackedRef.current = false;
    setShowSlowLoadFallback(false);
    setStudioMode("camera");
    void camera.start();
  };

  const handleSwitchToModelMode = () => {
    camera.stop();
    setShowSlowLoadFallback(false);
    setStudioMode("model");
  };

  const handleSwitchToPhotoFallback = () => {
    camera.stop();
    setShowSlowLoadFallback(false);
    setPreviewMedia("photo");
    setStudioMode("model");
    track("ar_asset_fallback_photo", { reason: "slow_load" });
  };

  const handleBackToProduct = () => {
    camera.stop();
    const targetProduct = displayedProduct ?? selectedProduct;
    const targetFinish = displayedFinishId ?? effectiveFinishId;
    if (targetProduct) {
      persistProductSelection(targetProduct.id, targetFinish);
      const finishQuery = targetFinish ? `?finish=${encodeURIComponent(targetFinish)}` : "";
      navigate(`/product/${targetProduct.id}${finishQuery}`, {
        state: {
          productId: targetProduct.id,
          finishId: targetFinish ?? undefined,
          catalogReturnUrl: routeState?.catalogReturnUrl,
        },
      });
    } else {
      navigate("/collections");
    }
  };

  const handleCapture = useCallback(() => {
    const capture = captureRef.current?.();
    const dataUrl = capture ?? null;
    setCapturePreview(dataUrl);
    track("ar_screenshot_taken", { has_image: Boolean(dataUrl) });
  }, []);

  const handleDownloadCapture = useCallback(() => {
    if (!capturePreview) return;
    const link = document.createElement("a");
    link.href = capturePreview;
    const productName = (displayedProduct?.name || "klarheit").toLowerCase().replace(/\s+/g, "-");
    link.download = `klarheit-tryon-${productName}.jpg`;
    link.click();
    track("ar_screenshot_downloaded", {});
  }, [capturePreview, displayedProduct]);

  const handleSaveAndConfigure = () => {
    const targetProduct = displayedProduct ?? selectedProduct;
    const targetFinish = displayedFinishId ?? effectiveFinishId;
    if (!targetProduct || !isDisplayedOrderable) return;
    const targetSize = displayedSku?.sizeSpec ?? displayedRequestedSize ?? targetProduct.specsSize;
    camera.stop();
    persistProductSelection(targetProduct.id, targetFinish, targetSize, displayedSku?.id ?? null);
    try {
      if (capturePreview) {
        writeTaggedTryOnSnapshot({
          dataUrl: capturePreview,
          productId: targetProduct.id,
          productName: displayedProductName,
          finishId: targetFinish ?? null,
        });
      } else {
        sessionStorage.removeItem(TRY_ON_SNAPSHOT_KEY);
      }
    } catch (e) {
      console.error("Failed to persist try-on state", e);
    }
    track("ar_save_configure_clicked", {
      product_name: targetProduct.name,
      has_snapshot: Boolean(capturePreview),
      has_pd: Boolean(faceMetrics),
    });
    navigate("/config-lab", {
      state: {
        productId: targetProduct.id,
        finishId: targetFinish ?? undefined,
        sizeSpec: targetSize ?? undefined,
        skuId: displayedSku?.id,
        tryOnSnapshot: capturePreview,
      },
    });
  };

  const resetAdjust = () => setUserAdjust({ x: 0, y: 0, scale: 1 });

  const handleDiscardCapture = () => {
    setCapturePreview(null);
    try {
      sessionStorage.removeItem(TRY_ON_SNAPSHOT_KEY);
    } catch {
      /* ignore */
    }
  };

  const handleAddToCartInPlace = () => {
    const targetProduct = displayedProduct ?? selectedProduct;
    const targetFinish = displayedFinishId ?? effectiveFinishId;
    if (!targetProduct || !isDisplayedOrderable) return;
    const targetSize = displayedSku?.sizeSpec ?? displayedRequestedSize ?? targetProduct.specsSize;
    persistProductSelection(targetProduct.id, targetFinish, targetSize, displayedSku?.id ?? null);
    const added = addItem(
      cartItemFromProduct(targetProduct, {
        finishId: targetFinish ?? undefined,
        sizeSpec: targetSize ?? undefined,
        skuId: displayedSku?.id,
        tryOnSnapshot: capturePreview,
      })
    );
    setCapturePreview(null);
    setAddedToast({
      itemId: added.id,
      text: t("live.addedToast", {
        name: displayedProductName,
        finish: displayedFinishLabel || "",
      }),
    });
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setAddedToast(null);
      toastTimerRef.current = null;
    }, 8000);
  };

  const handleUndoAdded = (itemId: string) => {
    removeItem(itemId);
    setAddedToast(null);
  };

  const isCameraUnavailable =
    camera.status === "denied" ||
    camera.status === "unsupported" ||
    camera.status === "error";

  const showLiveCamera = studioMode === "camera" && camera.status === "ready";
  const showWaitingCamera = studioMode === "camera" && camera.status === "requesting";
  const showPreCamera = studioMode === "pre-camera" && camera.status === "idle";
  const showModelOrFallback = !showLiveCamera && !showWaitingCamera && !showPreCamera;

  const studioHeading = activeFinishLabel
    ? t("preCamera.titleWithFinish", { name: displayProductName, finish: activeFinishLabel })
    : t("preCamera.title", { name: displayProductName });

  return (
    <div className="relative w-full min-h-[calc(100vh-80px)] overflow-hidden bg-slate-50 text-slate-900 flex flex-col font-sans">
      <video ref={videoRef} className="absolute h-px w-px opacity-0 pointer-events-none" autoPlay muted playsInline />

      {showWaitingCamera ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 bg-slate-50 text-center">
          <div className="max-w-md w-full bg-white border border-slate-200/70 rounded-3xl p-8 shadow-sm flex flex-col items-center gap-4">
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-brand-primary whitespace-nowrap">
              {activeFinishObj && (
                <span
                  className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
                  style={{ backgroundColor: activeFinishObj.frameColor }}
                />
              )}
              <span>{studioHeading}</span>
            </span>
            <Loader2 className="w-10 h-10 text-brand-primary animate-spin" strokeWidth={1.5} />
            <h2 className="font-display font-medium text-xl text-brand-primary tracking-tight">
              {t("camera.waitingPermission")}
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              {t("camera.waitingHint")}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2 w-full">
              <Button type="button" variant="outline-light" size="sm" onClick={handleSwitchToModelMode} className="rounded-xl">
                {t("preCamera.viewModelFirst")}
              </Button>
              <Button type="button" size="sm" onClick={handleSaveAndConfigure} className="rounded-xl">
                {t("preCamera.continueConfigure")}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={handleBackToProduct} className="rounded-xl">
                {t("camera.backToSelect")}
              </Button>
            </div>
          </div>
        </div>
      ) : showPreCamera ? (
        <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-5 sm:px-8 py-8 lg:py-12 gap-6">
          {/* Top Navigation Bar */}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleBackToProduct}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-brand-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {selectedProduct ? t("preCamera.backToProduct") : t("backToCollections")}
            </button>
            <Link
              to="/collections"
              className="text-xs text-slate-400 hover:text-brand-primary transition-colors"
            >
              {t("backToCollections")}
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left: Current Frame 3D/Photo Preview */}
            <div className="lg:col-span-7 bg-white border border-slate-200/70 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-brand-primary whitespace-nowrap">
                  {activeFinishObj && (
                    <span
                      className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
                      style={{ backgroundColor: activeFinishObj.frameColor }}
                    />
                  )}
                  <span>{studioHeading}</span>
                </span>
                <div className="inline-flex rounded-full border border-slate-200 bg-slate-100/80 p-0.5 shrink-0">
                  <button
                    type="button"
                    aria-pressed={previewMedia === "3d"}
                    onClick={() => setPreviewMedia("3d")}
                    className={cn(
                      "px-3 py-1 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap",
                      previewMedia === "3d" ? "bg-brand-primary text-white" : "text-slate-500"
                    )}
                  >
                    {t("showcase.model3d")}
                  </button>
                  <button
                    type="button"
                    aria-pressed={previewMedia === "photo"}
                    onClick={() => setPreviewMedia("photo")}
                    className={cn(
                      "px-3 py-1 rounded-full text-[11px] font-semibold transition-all whitespace-nowrap",
                      previewMedia === "photo" ? "bg-white text-brand-primary shadow-xs" : "text-slate-500"
                    )}
                  >
                    {t("showcase.photo")}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-gradient-to-b from-slate-50 to-slate-100 aspect-[4/3] overflow-hidden flex items-center justify-center relative">
                {previewMedia === "3d" ? (
                  <FrameShowcase
                    key={`${selectedProduct?.id ?? "default"}-${effectiveFinishId ?? "default"}`}
                    frame={frame}
                    className="w-full h-full"
                  />
                ) : (
                  <img
                    src={selectedProduct?.imageUrl || AERO_X1_IMAGE_URL}
                    alt={displayProductName}
                    className="w-4/5 h-4/5 object-contain mix-blend-multiply"
                    loading="lazy"
                  />
                )}
              </div>

              {/* Finish selector right below preview */}
              {finishes.length > 1 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                    {t("catalog.finish")}
                  </span>
                  {finishes.map((finish) => {
                    const isActive = effectiveFinishId === finish.id;
                    const finishLabel = t("color." + finish.id, {
                      defaultValue: t(finish.finishLabelKey, { defaultValue: finish.id }),
                    });
                    return (
                      <button
                        key={finish.id}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => handleSelectFinish(finish.id as ARFinishId)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                          isActive
                            ? "border-brand-primary bg-brand-primary/5 text-brand-primary ring-1 ring-brand-primary/25"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        )}
                      >
                        <span
                          className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
                          style={{ backgroundColor: finish.frameColor }}
                        />
                        <span>{finishLabel}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Explicit Camera Opt-in & Controls */}
            <div className="lg:col-span-5 flex flex-col gap-5">
              <div>
                <h1 className="text-2xl sm:text-3xl font-display font-medium text-brand-primary tracking-tight">
                  {studioHeading}
                </h1>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                  {t("subtitle")}
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/60 px-4 py-3 flex items-start gap-2.5 text-xs text-emerald-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{t("preCamera.privacyNote")}</span>
              </div>

              <div className="flex flex-col gap-3">
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleStartCamera}
                  className="w-full rounded-2xl py-4 text-xs"
                >
                  <Camera className="w-4 h-4" />
                  {t("preCamera.startCamera")}
                </Button>

                <Button
                  type="button"
                  variant="outline-light"
                  onClick={handleSwitchToModelMode}
                  className="w-full rounded-2xl py-3.5 text-xs"
                >
                  <Sparkles className="w-4 h-4" />
                  {t("preCamera.viewModelFirst")}
                </Button>

                {!isDisplayedOrderable && (
                  <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {t("unavailableOrderHint")}
                  </p>
                )}

                <button
                  type="button"
                  disabled={!isDisplayedOrderable}
                  onClick={handleSaveAndConfigure}
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 text-xs font-semibold text-brand-primary hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  {t("preCamera.continueConfigure")}
                </button>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">{t("virtualDisclaimer")}</p>
            </div>
          </div>
        </div>
      ) : showModelOrFallback ? (
        <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-5 sm:px-8 py-8 lg:py-12 gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleBackToProduct}
              className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-brand-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              {selectedProduct ? t("preCamera.backToProduct") : t("backToCollections")}
            </button>
            <div className="flex items-center gap-2">
              {switchBanner && (
                <span
                  role="status"
                  aria-live="polite"
                  className="rounded-full bg-brand-primary text-white px-3 py-1 text-xs font-medium"
                >
                  {switchBanner}
                </span>
              )}
              {products.length > 0 && (
                <button
                  type="button"
                  aria-pressed={compareEnabled}
                  onClick={handleToggleCompare}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                    compareEnabled
                      ? "border-brand-primary bg-brand-primary text-white"
                      : "border-slate-200 bg-white text-brand-primary hover:bg-slate-50"
                  )}
                >
                  <Columns2 className="w-3.5 h-3.5" />
                  {compareEnabled ? t("compare.exit") : t("compare.toggle")}
                </button>
              )}
            </div>
          </div>

          {compareEnabled && slotA && resolvedSlotB ? (
            <div className="bg-white border border-slate-200/70 rounded-3xl p-5 sm:p-8 shadow-sm flex flex-col gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">{t("compare.hint")}</p>
                <div className="inline-flex rounded-full border border-slate-200 bg-slate-100/80 p-0.5">
                  <button
                    type="button"
                    aria-pressed={previewMedia === "3d"}
                    onClick={() => setPreviewMedia("3d")}
                    className={cn(
                      "px-3 py-1 rounded-full text-[11px] font-semibold transition-all",
                      previewMedia === "3d" ? "bg-brand-primary text-white" : "text-slate-500"
                    )}
                  >
                    {t("showcase.model3d")}
                  </button>
                  <button
                    type="button"
                    aria-pressed={previewMedia === "photo"}
                    onClick={() => setPreviewMedia("photo")}
                    className={cn(
                      "px-3 py-1 rounded-full text-[11px] font-semibold transition-all",
                      previewMedia === "photo" ? "bg-white text-brand-primary shadow-xs" : "text-slate-500"
                    )}
                  >
                    {t("showcase.photo")}
                  </button>
                </div>
              </div>
              <FrameCompare
                products={products}
                slotA={slotA}
                slotB={resolvedSlotB}
                activeSlot={activeCompareSlot}
                previewMedia={previewMedia}
                onActiveSlotChange={setActiveCompareSlot}
                onSlotAChange={(next) => {
                  setActiveProductId(next.productId);
                  setActiveFinishId((next.finishId as ARFinishId | null) ?? null);
                  persistProductSelection(next.productId, next.finishId);
                }}
                onSlotBChange={(next) => setCompareSlotB(next)}
                onConfigureActive={handleSaveAndConfigure}
                onAddToCartActive={handleAddToCartInPlace}
              />
            </div>
          ) : (
          <div className="flex-1 flex flex-col lg:flex-row items-start justify-center gap-8 lg:gap-12 w-full">
            <div className="w-full lg:max-w-lg bg-white border border-slate-200/60 rounded-3xl shadow-sm p-6 sm:p-8 flex flex-col gap-4 relative overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] border border-slate-200 px-3 py-1 rounded-full uppercase tracking-wider text-slate-600 font-semibold bg-slate-50">
                  {previewMedia === "3d" ? t("modelMode.badge") : t("showcase.photo")}
                </span>
                <div className="inline-flex rounded-full border border-slate-200 bg-slate-100/80 p-0.5">
                  <button
                    type="button"
                    aria-pressed={previewMedia === "3d"}
                    onClick={() => setPreviewMedia("3d")}
                    className={cn(
                      "px-3 py-1 rounded-full text-[11px] font-semibold transition-all",
                      previewMedia === "3d" ? "bg-brand-primary text-white" : "text-slate-500"
                    )}
                  >
                    {t("showcase.model3d")}
                  </button>
                  <button
                    type="button"
                    aria-pressed={previewMedia === "photo"}
                    onClick={() => setPreviewMedia("photo")}
                    className={cn(
                      "px-3 py-1 rounded-full text-[11px] font-semibold transition-all",
                      previewMedia === "photo" ? "bg-white text-brand-primary shadow-xs" : "text-slate-500"
                    )}
                  >
                    {t("showcase.photo")}
                  </button>
                </div>
              </div>

              <div className="w-full aspect-[4/3] rounded-2xl border border-slate-100 bg-gradient-to-b from-slate-50 to-slate-100 overflow-hidden flex items-center justify-center">
                {previewMedia === "3d" ? (
                  <FrameShowcase
                    key={`${selectedProduct?.id ?? "default"}-${effectiveFinishId ?? "default"}`}
                    frame={frame}
                    className="h-full w-full"
                  />
                ) : (
                  <img
                    src={selectedProduct?.imageUrl || AERO_X1_IMAGE_URL}
                    alt={displayProductName}
                    className="w-4/5 h-4/5 object-contain mix-blend-multiply"
                    loading="lazy"
                  />
                )}
              </div>

              <div className="text-center">
                <h2 className="text-xl font-display font-medium text-brand-primary tracking-tight">
                  {activeFinishLabel ? `${displayProductName} · ${activeFinishLabel}` : displayProductName}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {previewMedia === "3d"
                    ? t("modelMode.dragHint")
                    : `${t("lensProfile")}${isZh ? "：" : ": "}${t("lensProfileLabel." + frame.lensLabel, { defaultValue: frame.lensLabel })}`}
                </p>
              </div>
            </div>

            <div className="w-full lg:max-w-md flex flex-col gap-6">
              {isCameraUnavailable && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 shadow-xs">
                  <p className="text-sm font-semibold text-brand-primary">
                    {t("camera.deniedSummary")}
                  </p>
                  {camera.status === "unsupported" ? (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-100 p-3 rounded-xl">
                      {t("status.unsupported")}
                    </p>
                  ) : (
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <p className="text-xs text-slate-500">{t("camera.allowInstructions")}</p>
                      <Button
                        type="button"
                        variant="outline-light"
                        size="sm"
                        onClick={handleStartCamera}
                        className="rounded-xl shrink-0"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        {t("camera.retry")}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {!isCameraUnavailable && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-600">{t("preCamera.privacyNote")}</span>
                  <Button
                    type="button"
                    variant="outline-light"
                    size="sm"
                    onClick={handleStartCamera}
                    className="rounded-xl shrink-0"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {t("preCamera.startCamera")}
                  </Button>
                </div>
              )}

              <div className="flex flex-col gap-3">
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                  {t("catalog.choose")}
                </span>
                <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-1">
                  {products.map((product) => {
                    const isSelected = activeProductId === product.id;
                    const displayName = isZh ? product.nameZh : product.nameEn;
                    const displayMat = isZh ? product.materialZh : product.materialEn;
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleSelectProduct(product.id)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-2xl border text-left transition-all w-full",
                          isSelected
                            ? "border-brand-primary bg-brand-primary/5 shadow-xs ring-1 ring-brand-primary"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        )}
                      >
                        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center p-1 shrink-0">
                          <img
                            src={product.imageUrl}
                            alt={displayName}
                            className="w-full h-full object-contain mix-blend-multiply"
                            loading="lazy"
                          />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold truncate text-brand-primary">
                            {displayName}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate mt-0.5">{displayMat}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {finishes.length > 1 && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                      {t("catalog.finish")}
                    </span>
                    {finishes.map((finish) => {
                      const isActive = effectiveFinishId === finish.id;
                      const finishLabel = t("color." + finish.id, {
                        defaultValue: t(finish.finishLabelKey, { defaultValue: finish.id }),
                      });
                      return (
                        <button
                          key={finish.id}
                          type="button"
                          onClick={() => handleSelectFinish(finish.id as ARFinishId)}
                          title={finishLabel}
                          aria-pressed={isActive}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all",
                            isActive
                              ? "border-brand-primary bg-brand-primary/5 text-brand-primary ring-1 ring-brand-primary/25"
                              : "border-slate-200 bg-white text-slate-600"
                          )}
                        >
                          <span
                            className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
                            style={{ backgroundColor: finish.frameColor }}
                          />
                          <span>{finishLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="text-[11px] text-slate-400 leading-relaxed">{t("virtualDisclaimer")}</p>
              </div>

              <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-200">
                {!isDisplayedOrderable && (
                  <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {t("unavailableOrderHint")}
                  </p>
                )}
                <Button
                  type="button"
                  variant="primary"
                  disabled={!isDisplayedOrderable}
                  onClick={handleSaveAndConfigure}
                  className="w-full rounded-xl py-4 text-xs"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  {t("preCamera.continueConfigure")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!isDisplayedOrderable}
                  onClick={handleAddToCartInPlace}
                  className="w-full rounded-xl py-3 text-xs"
                >
                  <Plus className="w-4 h-4" />
                  {t("addToCart")}
                </Button>
              </div>
            </div>
          </div>
          )}
        </div>
      ) : (
        <>
          <div className="absolute inset-0 z-0">
            <ARTryOnCanvas
              stream={camera.stream}
              frame={displayedFrame}
              transform={transform}
              landmarks={tracking.landmarks}
              landmarksRef={tracking.landmarksRef}
              sourceVideoRef={videoRef}
              trackedFrameRef={tracking.trackedFrameRef}
              userAdjust={userAdjust}
              userPdMm={faceMetrics?.pdMm}
              onCaptureReady={handleCaptureReady}
              showOverlay={showOverlay}
            />
            <FaceCalibrationGuide status={experienceStatus} />
          </div>

          <div className="relative z-30 flex-1 flex flex-col justify-between p-4 sm:p-6 pointer-events-none">
            {showSlowLoadFallback && (
              <div
                role="status"
                aria-live="polite"
                className="pointer-events-auto mx-auto mb-3 w-full max-w-xl rounded-2xl border border-amber-300/70 bg-slate-950/85 px-4 py-3 text-white shadow-lg backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <span className="text-xs text-amber-100 leading-relaxed">{t("camera.slowLoadNotice")}</span>
                <button
                  type="button"
                  onClick={handleSwitchToPhotoFallback}
                  className="shrink-0 rounded-xl bg-white px-3.5 py-1.5 text-xs font-semibold text-brand-primary hover:bg-slate-100 transition-colors"
                >
                  {t("camera.switchToPhotoBtn")}
                </button>
              </div>
            )}
            {/* Top Bar Navigation & Info */}
            <div className="w-full max-w-6xl mx-auto flex items-center justify-between gap-3 pointer-events-none">
              <div className="flex items-center gap-3 pointer-events-auto">
                <button
                  type="button"
                  onClick={handleBackToProduct}
                  className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-800 hover:text-slate-900 transition-all bg-white/90 hover:bg-white px-4 py-2.5 rounded-full border border-slate-200/80 shadow-sm backdrop-blur-md"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {selectedProduct ? t("live.backToDetails") : t("backToCollections")}
                </button>

                {experienceStatus === "tracking" && faceMetrics && (
                  <div className="relative hidden sm:block">
                    <div className="inline-flex items-center gap-2.5 bg-slate-950/80 text-white text-[11px] font-light px-3.5 py-2 rounded-full shadow-md border border-white/10 backdrop-blur-md">
                      <Ruler className="w-3.5 h-3.5 text-brand-cyan" />
                      <span className="text-slate-400 font-sans">{t("metrics.pd")}</span>
                      <span className="font-mono font-medium text-brand-cyan">{faceMetrics.pdMm} mm</span>
                      <span className="text-slate-600">|</span>
                      <span className="text-slate-400 font-sans">{t("metrics.faceWidth")}</span>
                      <span className="font-mono">~{faceMetrics.faceWidthMm} mm</span>
                      <span className="text-slate-600">|</span>
                      <span className="text-emerald-400 text-[10px] font-medium">{t(`fitHint.face.${fitLabelKey}`)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2.5 pointer-events-auto">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowPrivacyTooltip(!showPrivacyTooltip)}
                    onMouseEnter={() => setShowPrivacyTooltip(true)}
                    onMouseLeave={() => setShowPrivacyTooltip(false)}
                    className="w-9 h-9 rounded-full bg-white/85 hover:bg-white border border-slate-200/80 flex items-center justify-center text-slate-600 transition-colors shadow-sm backdrop-blur-md"
                    title={t("privacyTitle")}
                  >
                    <ShieldCheck className="w-4.5 h-4.5 text-emerald-500" />
                  </button>
                  {showPrivacyTooltip && (
                    <div className="absolute right-0 top-11 z-50 w-72 bg-slate-950 text-white text-[11px] leading-relaxed p-4 rounded-2xl shadow-xl border border-white/10 font-normal">
                      <h4 className="font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {t("privacyTitle")}
                      </h4>
                      <p className="text-slate-300">{t("privacyDisclaimer")}</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 bg-white/85 border border-slate-200/80 px-3.5 py-2 rounded-full shadow-sm backdrop-blur-md text-[9px] uppercase font-bold tracking-widest text-slate-700">
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full",
                      experienceStatus === "tracking" ? "bg-emerald-500" : "bg-amber-400"
                    )}
                  />
                  {experienceStatus === "tracking" ? t("cameraActive") : t("analyzingFace")}
                </div>
              </div>
            </div>

            {/* Selection Switch Feedback Pill (polite live announcement) */}
            {switchBanner && (
              <div className="self-center mt-2 pointer-events-none" role="status" aria-live="polite">
                <div className="px-4 py-1.5 rounded-full bg-brand-primary/90 text-white text-xs font-medium shadow-md backdrop-blur-md">
                  {switchBanner}
                </div>
              </div>
            )}

            {/* Single Calm Distance Guidance Badge (only when tracking is locked) */}
            {!switchBanner && experienceStatus === "tracking" && fitHintKey !== "perfect" && (
              <div className="self-center mt-2 pointer-events-none" role="status" aria-live="polite">
                <div className="px-4 py-1.5 rounded-full border text-xs font-medium shadow-sm backdrop-blur-md bg-amber-50/90 border-amber-200 text-amber-900">
                  {t(`fitHint.${fitHintKey}`)}
                </div>
              </div>
            )}

            {/* Bottom Floating Control Dock */}
            <div className="w-full max-w-3xl mx-auto flex flex-col gap-2 pointer-events-none mt-auto">
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setIsCatalogExpanded(!isCatalogExpanded)}
                  className="pointer-events-auto flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full border border-white/60 bg-white/90 hover:bg-white text-[10px] font-bold uppercase tracking-wider text-slate-700 hover:text-slate-900 shadow-md backdrop-blur-md transition-all"
                >
                  <SlidersHorizontal className="w-3 h-3 text-brand-primary" />
                  {isCatalogExpanded ? t("catalog.hide") : t("catalog.show")}
                </button>
              </div>

              {isCatalogExpanded && (
                <div className="bg-white/92 backdrop-blur-xl border border-white/60 p-4 sm:p-5 rounded-3xl shadow-2xl pointer-events-auto flex flex-col gap-3.5">
                  {/* Same-Face A/B Compare Switcher in Live Camera Mode */}
                  {compareEnabled && slotA && resolvedSlotB && productB && (
                    <div className="rounded-2xl border border-brand-primary/15 bg-slate-50/90 p-3 flex flex-col gap-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5">
                          <button
                            type="button"
                            aria-pressed={activeCompareSlot === "A"}
                            onClick={() => setActiveCompareSlot("A")}
                            className={cn(
                              "px-3 py-1 rounded-full text-xs font-semibold transition-all",
                              activeCompareSlot === "A" ? "bg-brand-primary text-white" : "text-slate-600"
                            )}
                          >
                            {t("compare.viewA")} · {displayProductName}
                          </button>
                          <button
                            type="button"
                            aria-pressed={activeCompareSlot === "B"}
                            onClick={() => setActiveCompareSlot("B")}
                            className={cn(
                              "px-3 py-1 rounded-full text-xs font-semibold transition-all",
                              activeCompareSlot === "B" ? "bg-brand-primary text-white" : "text-slate-600"
                            )}
                          >
                            {t("compare.viewB")} · {isZh ? productB.nameZh : productB.nameEn}
                          </button>
                        </div>

                        <select
                          aria-label={t("compare.pickB")}
                          value={productB.id}
                          onChange={(e) => {
                            const nextProd = products.find((p) => p.id === Number(e.target.value));
                            if (!nextProd) return;
                            setCompareSlotB({
                              productId: nextProd.id,
                              finishId: getDefaultFinishId(nextProd) ?? null,
                            });
                            setActiveCompareSlot("B");
                          }}
                          className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-brand-primary"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {t("compare.slotB")}{isZh ? "：" : ": "}{isZh ? p.nameZh : p.nameEn}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                        <div className="rounded-xl bg-white border border-slate-200/70 px-2.5 py-1.5 flex items-center justify-between">
                          <span className="font-semibold text-brand-primary">{t("compare.slotA")}</span>
                          <span className="font-mono">
                            {selectedProduct?.specsSize || "—"} · {formatPrice(selectedProduct?.basePrice ?? 0)}
                          </span>
                        </div>
                        <div className="rounded-xl bg-white border border-slate-200/70 px-2.5 py-1.5 flex items-center justify-between">
                          <span className="font-semibold text-brand-primary">{t("compare.slotB")}</span>
                          <span className="font-mono">
                            {productB.specsSize || "—"} · {formatPrice(productB.basePrice)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Active Frame Title & Finish Swatches Row */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100/80 pb-2.5">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <h2 className="text-base sm:text-lg font-display font-medium text-slate-900 tracking-tight truncate">
                        {activeFinishLabel ? `${displayProductName} · ${activeFinishLabel}` : displayProductName}
                      </h2>
                      <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                        {t("lensProfileLabel." + frame.lensLabel, { defaultValue: frame.lensLabel })}
                      </span>
                    </div>

                    {finishes.length > 1 && (
                      <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                        {finishes.map((finish) => {
                          const isActive = effectiveFinishId === finish.id;
                          const finishLabel = t("color." + finish.id, {
                            defaultValue: t(finish.finishLabelKey, { defaultValue: finish.id }),
                          });
                          return (
                            <button
                              key={finish.id}
                              type="button"
                              onClick={() => handleSelectFinish(finish.id as ARFinishId)}
                              title={finishLabel}
                              aria-pressed={isActive}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                                isActive
                                  ? "border-brand-primary bg-brand-primary/10 text-brand-primary"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                              )}
                            >
                              <span
                                className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
                                style={{ backgroundColor: finish.frameColor }}
                              />
                              <span className="hidden sm:inline">{finishLabel}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Horizontal Eyewear Carousel */}
                  <div className="flex overflow-x-auto gap-2.5 py-1 scrollbar-none snap-x snap-mandatory">
                    {products.map((product) => {
                      const isSelected = activeProductId === product.id;
                      const displayName = isZh ? product.nameZh : product.nameEn;
                      const displayMat = isZh ? product.materialZh : product.materialEn;
                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => handleSelectProduct(product.id)}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 rounded-2xl border text-left transition-all min-w-[165px] max-w-[210px] shrink-0 snap-start",
                            isSelected
                              ? "border-brand-primary bg-brand-primary/10 shadow-sm ring-1 ring-brand-primary/30"
                              : "border-slate-200/60 bg-white/70 hover:bg-white hover:border-slate-300"
                          )}
                        >
                          <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center p-1 shrink-0 shadow-xs">
                            <img
                              src={product.imageUrl}
                              alt={displayName}
                              className="w-full h-full object-contain mix-blend-multiply"
                              loading="lazy"
                            />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span
                              className={cn(
                                "text-xs font-semibold tracking-tight truncate",
                                isSelected ? "text-brand-primary font-bold" : "text-slate-700"
                              )}
                            >
                              {displayName}
                            </span>
                            <span className="text-[9px] text-slate-400 truncate mt-0.5">{displayMat}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Fine-tune panel slider overlay if open */}
                  {showAdjustPanel && (
                    <div className="border-t border-slate-100 pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <label className="flex flex-col gap-1.5 text-[9px] uppercase tracking-widest text-slate-500 font-bold">
                        {t("adjust.horizontal")} · {userAdjust.x.toFixed(2)}
                        <input
                          type="range"
                          min={-0.25}
                          max={0.25}
                          step={0.01}
                          value={userAdjust.x}
                          onChange={(e) => setUserAdjust((prev) => ({ ...prev, x: Number(e.target.value) }))}
                          className="accent-slate-900"
                        />
                      </label>
                      <label className="flex flex-col gap-1.5 text-[9px] uppercase tracking-widest text-slate-500 font-bold">
                        {t("adjust.vertical")} · {userAdjust.y.toFixed(2)}
                        <input
                          type="range"
                          min={-0.25}
                          max={0.25}
                          step={0.01}
                          value={userAdjust.y}
                          onChange={(e) => setUserAdjust((prev) => ({ ...prev, y: Number(e.target.value) }))}
                          className="accent-slate-900"
                        />
                      </label>
                      <label className="flex flex-col gap-1.5 text-[9px] uppercase tracking-widest text-slate-500 font-bold">
                        {t("adjust.scale")} · {userAdjust.scale.toFixed(2)}
                        <input
                          type="range"
                          min={0.8}
                          max={1.3}
                          step={0.01}
                          value={userAdjust.scale}
                          onChange={(e) => setUserAdjust((prev) => ({ ...prev, scale: Number(e.target.value) }))}
                          className="accent-slate-900"
                        />
                      </label>
                      <div className="sm:col-span-3 flex justify-end">
                        <button
                          type="button"
                          onClick={resetAdjust}
                          className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-bold text-slate-500 hover:text-slate-900"
                        >
                          <RotateCcw className="w-3 h-3" />
                          {t("adjust.reset")}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Actions Row */}
                  <div className="flex items-center justify-between border-t border-slate-100/80 pt-3 gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowOverlay(!showOverlay)}
                        className={cn(
                          "px-3 py-2.5 rounded-xl border text-[10px] uppercase font-bold tracking-wider transition-all flex items-center gap-1.5",
                          showOverlay
                            ? "bg-slate-900 border-slate-900 text-white"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        )}
                        title={t("beforeAfter")}
                      >
                        {showOverlay ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        <span className="hidden sm:inline">{t("beforeAfter")}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowAdjustPanel((v) => !v)}
                        className={cn(
                          "px-3 py-2.5 rounded-xl border text-[10px] uppercase font-bold tracking-wider transition-all flex items-center gap-1.5",
                          showAdjustPanel
                            ? "bg-slate-900 border-slate-900 text-white"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        )}
                        title={t("adjust.toggle")}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{t("adjust.toggle")}</span>
                      </button>

                      <button
                        type="button"
                        aria-pressed={compareEnabled}
                        onClick={handleToggleCompare}
                        className={cn(
                          "px-3 py-2.5 rounded-xl border text-[10px] uppercase font-bold tracking-wider transition-all flex items-center gap-1.5",
                          compareEnabled
                            ? "bg-brand-primary border-brand-primary text-white"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        )}
                        title={compareEnabled ? t("compare.exit") : t("compare.toggle")}
                      >
                        <Columns2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">
                          {compareEnabled ? t("compare.exit") : t("compare.toggle")}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCapture}
                        className="w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all flex items-center justify-center"
                        title={t("camera.takePhoto")}
                      >
                        <Camera className="w-4 h-4 text-brand-primary" />
                      </button>
                    </div>

                    <Button
                      type="button"
                      variant="primary"
                      disabled={!isDisplayedOrderable}
                      onClick={handleSaveAndConfigure}
                      className="rounded-xl py-3.5 px-5 text-[10px]"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>{t("saveAndConfigure")}</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Non-blocking In-Place Add-to-Cart Confirmation Bar */}
      {addedToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-4 right-4 bottom-6 md:left-auto md:right-6 md:max-w-md z-50 rounded-2xl border border-slate-800 bg-brand-primary text-white px-4 py-3.5 shadow-2xl flex items-center justify-between gap-3"
        >
          <p className="text-xs font-semibold truncate">{addedToast.text}</p>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/cart"
              className="rounded-xl bg-white text-brand-primary px-3 py-1.5 text-xs font-semibold hover:bg-slate-100"
            >
              {t("live.viewCart")}
            </Link>
            <button
              type="button"
              onClick={() => handleUndoAdded(addedToast.itemId)}
              className="rounded-xl border border-white/25 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10"
            >
              {t("live.undo")}
            </button>
          </div>
        </div>
      )}

      {/* Capture preview modal */}
      {capturePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-semibold tracking-tight">{t("capture.title")}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{t("capture.subtitle")}</p>
              </div>
              <button
                type="button"
                onClick={() => setCapturePreview(null)}
                className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50"
                aria-label={t("capture.close")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              <img
                src={capturePreview}
                alt={t("capture.title")}
                className="w-full rounded-2xl border border-slate-100"
              />
            </div>
            <div className="px-4 pb-4 flex flex-col gap-2">
              {!isDisplayedOrderable && (
                <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {t("unavailableOrderHint")}
                </p>
              )}
              <Button
                type="button"
                variant="primary"
                disabled={!isDisplayedOrderable}
                onClick={handleSaveAndConfigure}
                className="w-full rounded-xl"
              >
                <SlidersHorizontal className="w-4 h-4" />
                {t("saveAndConfigure")}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline-light"
                  disabled={!isDisplayedOrderable}
                  onClick={handleAddToCartInPlace}
                  className="rounded-xl border-slate-200 text-slate-800 hover:bg-slate-50"
                >
                  <Plus className="w-4 h-4" />
                  {t("addToCart")}
                </Button>
                <Button
                  type="button"
                  variant="outline-light"
                  onClick={handleDownloadCapture}
                  className="rounded-xl border-slate-200 text-slate-800 hover:bg-slate-50"
                >
                  <Download className="w-4 h-4" />
                  {t("capture.download")}
                </Button>
              </div>
              <button
                type="button"
                onClick={handleDiscardCapture}
                className="w-full py-2 text-xs text-slate-400 hover:text-red-500 transition-colors"
              >
                {t("capture.discard")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
