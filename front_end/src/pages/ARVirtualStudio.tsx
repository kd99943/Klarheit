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
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ARTryOnCanvas } from "../ar/ARTryOnCanvas";
import { FrameShowcase } from "../ar/FrameShowcase";
import { FrameCompare } from "../ar/FrameCompare";
import { FaceCalibrationGuide } from "../components/ar/FaceCalibrationGuide";
import { calculateGlassesTransform } from "../ar/arCalibration";
import { AR_FRAME_CATALOG, getFrameConfigForProduct, getSpecsForProduct } from "../ar/frameCatalog";
import type { ARFinishId } from "../ar/types";
import type { ARExperienceStatus, ARFrameConfig, ARUserAdjust, FaceLandmark } from "../ar/types";
import { useProducts } from "../hooks/useProducts";
import { useCameraStream } from "../ar/useCameraStream";
import { useFaceLandmarks } from "../ar/useFaceLandmarks";
import { Button } from "../components/ui/Button";
import { cn } from "../lib/utils";
import { useCart, cartItemFromProduct } from "../hooks/useCart";
import { track } from "../services/analytics";

const AERO_X1_IMAGE_URL = "/images/aero_x1.png";
const TRY_ON_SNAPSHOT_KEY = "klarheit_tryon_snapshot";

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

/** Rough mm estimate from normalized landmarks + typical face proportions. */
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

  // Face width (temple-temple) averages ~142mm; scale landmarks to that anchor.
  const faceWidthMm = 142;
  const eyeOuterMm = (eyeOuter / faceWidthNorm) * faceWidthMm;
  // Inter-pupillary distance sits slightly inside outer-canthi span
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
  const { addItem } = useCart();

  const { products } = useProducts();
  const [activeProductId, setActiveProductId] = useState<number | null>(null);
  const [activeFinishId, setActiveFinishId] = useState<ARFinishId | null>(null);
  const [isCatalogExpanded, setIsCatalogExpanded] = useState<boolean>(true);

  const [capturePreview, setCapturePreview] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState<boolean>(true);
  const [showPrivacyTooltip, setShowPrivacyTooltip] = useState<boolean>(false);
  const [showAdjustPanel, setShowAdjustPanel] = useState<boolean>(false);
  const [showCompare, setShowCompare] = useState<boolean>(false);
  const [userAdjust, setUserAdjust] = useState<ARUserAdjust>({ x: 0, y: 0, scale: 1 });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureRef = useRef<(() => string | null) | null>(null);
  const handleCaptureReady = useCallback((capture: (() => string | null) | null) => {
    captureRef.current = capture;
  }, []);

  const enteredAtRef = useRef(Date.now());
  const productSwitchedRef = useRef(false);
  const faceDetectedRef = useRef(false);
  const faceFirstDetectedAtRef = useRef<number | null>(null);
  const initFailedTrackedRef = useRef(false);

  const camera = useCameraStream();
  const tracking = useFaceLandmarks({ videoRef, enabled: camera.status === "ready" });

  useEffect(() => {
    if (products.length > 0 && activeProductId === null) {
      const storedFinish = sessionStorage.getItem("savedFinishId");
      const match = products.find((p) => {
        const slug = p.name.toLowerCase().replace(/\s+/g, "-");
        return (
          p.name.toLowerCase() === storedFinish?.toLowerCase() || slug === storedFinish?.toLowerCase()
        );
      });
      if (match) {
        setActiveProductId(match.id);
      } else {
        setActiveProductId(products[0].id);
      }
    }
  }, [products, activeProductId]);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === activeProductId) || products[0] || null;
  }, [products, activeProductId]);

  const finishes = useMemo(() => selectedProduct?.arConfigs ?? [], [selectedProduct]);

  // Reset finish when product changes
  useEffect(() => {
    setActiveFinishId(null);
  }, [activeProductId]);

  const frame = useMemo(() => {
    if (selectedProduct) {
      return getFrameConfigForProduct(selectedProduct, activeFinishId);
    }
    return AR_FRAME_CATALOG.titanium;
  }, [selectedProduct, activeFinishId]);

  const transform = useMemo(
    () => (tracking.landmarks ? calculateGlassesTransform(tracking.landmarks) : null),
    [tracking.landmarks]
  );

  const experienceStatus = resolveExperienceStatus(
    camera.status,
    transform && tracking.status === "tracking" ? "tracking" : tracking.status,
    Boolean(capturePreview)
  );

  const faceMetrics = useMemo(
    () => estimateFaceMetrics(tracking.landmarks),
    [tracking.landmarks]
  );

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
    camera.start();
    return () => {
      camera.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    const dist = (p1: FaceLandmark, p2: FaceLandmark) =>
      Math.hypot(p1.x - p2.x, p1.y - p2.y);
    const eyeDist = dist(leftEye, rightEye);

    if (eyeDist > 0.22) {
      return "tooClose";
    }
    if (eyeDist < 0.11) {
      return "tooFar";
    }
    return "perfect";
  }, [experienceStatus, tracking.landmarks]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = camera.stream;
    }
  }, [camera.stream]);

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
    const productName = (selectedProduct?.name || "klarheit").toLowerCase().replace(/\s+/g, "-");
    link.download = `klarheit-tryon-${productName}.jpg`;
    link.click();
    track("ar_screenshot_downloaded", {});
  }, [capturePreview, selectedProduct]);

  const handleSaveAndConfigure = () => {
    if (!selectedProduct) return;
    // Prefer backend finish id (titanium/rose-gold) when available
    const slug = activeFinishId || selectedProduct.name.toLowerCase().replace(/\s+/g, "-");
    try {
      sessionStorage.setItem("savedFinishId", slug);
      if (capturePreview) {
        sessionStorage.setItem(TRY_ON_SNAPSHOT_KEY, capturePreview);
      } else {
        sessionStorage.removeItem(TRY_ON_SNAPSHOT_KEY);
      }
      if (faceMetrics) {
        sessionStorage.setItem("klarheit_tryon_pd", String(faceMetrics.pdMm));
      }
    } catch (e) {
      console.error("Failed to persist try-on state", e);
    }
    track("ar_save_configure_clicked", {
      product_name: selectedProduct.name,
      has_snapshot: Boolean(capturePreview),
      has_pd: Boolean(faceMetrics),
    });
    navigate("/config-lab", { state: { finishId: slug } });
  };

  const resetAdjust = () => setUserAdjust({ x: 0, y: 0, scale: 1 });

  const handleAddToCart = () => {
    if (!selectedProduct) return;
    addItem(
      cartItemFromProduct(selectedProduct, {
        finishId: activeFinishId || undefined,
        tryOnSnapshot: capturePreview,
      })
    );
    track("cart_item_added", {
      product_id: String(selectedProduct.id),
      product_name: selectedProduct.name,
      lens_count: 0,
    });
    setCapturePreview(null);
    navigate("/cart");
  };

  const showFallback =
    camera.status === "denied" ||
    camera.status === "unsupported" ||
    camera.status === "error";

  return (
    <div className="relative w-full min-h-[calc(100vh-80px)] overflow-hidden bg-slate-50 text-slate-900 flex flex-col font-sans">
      <video ref={videoRef} className="hidden" autoPlay muted playsInline />

      {camera.status === "requesting" ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50">
          <Loader2
            className="w-10 h-10 text-brand-primary animate-spin mb-4"
            strokeWidth={1.5}
          />
          <h3 className="font-display font-light text-xl tracking-tight mb-1">
            {t("status.initializing")}
          </h3>
          <p className="text-xs text-slate-500 font-light">{t("camera.allowAccess")}</p>
        </div>
      ) : showFallback ? (
        <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 max-w-6xl mx-auto w-full px-6 py-12">
          <div className="w-full max-w-md bg-white border border-slate-200/60 rounded-3xl shadow-xl p-8 flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-60 z-0 pointer-events-none" />

            <div className="relative z-10 w-full aspect-[4/3] flex items-center justify-center bg-slate-50/50 rounded-2xl border border-slate-100 p-6 shadow-inner">
              <img
                src={selectedProduct?.imageUrl || AERO_X1_IMAGE_URL}
                alt={frame.productName}
                className="w-full h-full object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            </div>

            <div className="w-full mt-6 text-center">
              <span className="text-[9px] border border-slate-200 px-3 py-1 rounded-full uppercase tracking-widest text-slate-500 font-semibold bg-slate-50">
                {t("showcase.photo")}
              </span>
              <h3 className="text-2xl font-display font-light text-slate-900 tracking-tight mt-3">
                {frame.productName}
              </h3>
              <p className="text-xs text-slate-500 mt-2 font-mono">
                {t("lensProfile")}: {frame.lensLabel}
              </p>
            </div>

            {/* Live 3D silhouette even without camera — visual QA of frame fidelity */}
            <div className="w-full mt-4">
              <div className="flex items-center justify-between">
                <span className="text-[9px] border border-slate-200 px-3 py-1 rounded-full uppercase tracking-widest text-slate-500 font-semibold bg-slate-50">
                  {showCompare ? t("showcase.compare") : t("showcase.model3d")}
                </span>
                <button
                  type="button"
                  onClick={() => setShowCompare((v) => !v)}
                  className="text-[9px] uppercase tracking-widest font-bold text-slate-500 hover:text-slate-900 border border-slate-200 rounded-full px-3 py-1 bg-white"
                >
                  {showCompare ? t("showcase.single") : t("showcase.compareToggle")}
                </button>
              </div>
              <div className="mt-2 rounded-2xl border border-slate-100 bg-gradient-to-b from-slate-50 to-slate-100 overflow-hidden">
                {showCompare ? (
                  <div className="p-3">
                    <FrameCompare
                      products={products}
                      activeProductId={activeProductId}
                      activeFinishId={activeFinishId}
                    />
                  </div>
                ) : (
                  <div className="h-48" key={`${frame.id}-${frame.styleName}`}>
                    <FrameShowcase frame={frame} className="h-full w-full" />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="w-full max-w-md flex flex-col gap-8">
            <div>
              <h2 className="text-3xl font-display font-light text-slate-900 tracking-tight mb-3">
                {t("fallbackTitle")}
              </h2>
              <p className="text-sm text-slate-500 font-light leading-relaxed mb-4">
                {t("fallbackDesc")}
              </p>
              {camera.status === "unsupported" && (
                <p className="text-xs text-red-500 font-medium bg-red-50 border border-red-100 p-3 rounded-xl">
                  {t("status.unsupported")}
                </p>
              )}
            </div>

            {camera.status !== "unsupported" && (
              <div className="bg-slate-100/80 border border-slate-200 p-5 rounded-2xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200/50 flex items-center justify-center text-slate-600 shrink-0">
                    <Camera className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest">
                      {t("camera.disabled")}
                    </h4>
                    <p className="text-[11px] text-slate-400 font-light mt-0.5">
                      {t("camera.allowInstructions")}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline-light"
                  onClick={camera.start}
                  className="bg-white border-slate-200 hover:bg-slate-50 shadow-sm py-2 px-4 text-[9px]"
                >
                  {t("camera.retry")}
                </Button>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                {t("catalog.choose", "选择镜框系列")}
              </span>
              <div className="flex flex-col gap-2.5 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
                {products.map((product) => {
                  const isSelected = activeProductId === product.id;
                  const displayName = isZh ? product.nameZh : product.nameEn;
                  const displayMat = isZh ? product.materialZh : product.materialEn;
                  return (
                    <button
                      key={product.id}
                      onClick={() => setActiveProductId(product.id)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-2xl border text-left transition-all duration-300 w-full active:scale-[0.98]",
                        isSelected
                          ? "border-brand-primary bg-brand-primary/5 shadow-sm ring-1 ring-brand-primary"
                          : "border-slate-100 bg-slate-50 hover:border-slate-200"
                      )}
                    >
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center p-1 shrink-0">
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
                            "text-xs font-semibold truncate",
                            isSelected ? "text-slate-900" : "text-slate-700"
                          )}
                        >
                          {displayName}
                        </span>
                        <span className="text-[9px] text-slate-400 truncate mt-0.5">
                          {displayMat}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {finishes.length > 1 && (
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <span className="text-[9px] uppercase tracking-widest font-bold text-slate-400">
                    {t("catalog.finish")}
                  </span>
                  {finishes.map((finish) => {
                    const isActive = (activeFinishId ?? frame.id) === finish.id;
                    return (
                      <button
                        key={finish.id}
                        type="button"
                        onClick={() => setActiveFinishId(finish.id)}
                        title={finish.lensLabel}
                        className={cn(
                          "w-7 h-7 rounded-full border-2 transition-all",
                          isActive ? "border-slate-900 scale-110" : "border-white"
                        )}
                        style={{ backgroundColor: finish.frameColor }}
                        aria-label={finish.id}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            <div className="w-full h-px bg-slate-200 my-2" />

            <Button
              variant="primary"
              onClick={handleSaveAndConfigure}
              className="w-full bg-brand-primary hover:bg-brand-primary/90 text-white border-0 shadow-md text-[10px] py-4 font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 rounded-xl"
            >
              <SlidersHorizontal className="w-4 h-4" />
              {t("saveAndConfigure")}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="absolute inset-0 z-0">
            <ARTryOnCanvas
              stream={camera.stream}
              frame={frame}
              transform={transform}
              landmarks={tracking.landmarks}
              landmarksRef={tracking.landmarksRef}
              userAdjust={userAdjust}
              userPdMm={faceMetrics?.pdMm}
              onCaptureReady={handleCaptureReady}
              showOverlay={showOverlay}
            />
            <FaceCalibrationGuide status={experienceStatus} />
          </div>

          <div className="relative z-30 flex-1 flex flex-col justify-between p-4 sm:p-6 pointer-events-none">
            {/* Top Bar Navigation & Info */}
            <div className="w-full max-w-6xl mx-auto flex items-center justify-between gap-4 pointer-events-none">
              <div className="flex items-center gap-3 pointer-events-auto">
                <Link
                  to="/collections"
                  className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-800 hover:text-slate-900 transition-all bg-white/85 hover:bg-white px-4 py-2.5 rounded-full border border-slate-200/80 shadow-sm backdrop-blur-md"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {t("backToCollections")}
                </Link>

                {/* Subtle face metrics HUD pill */}
                {experienceStatus === "tracking" && faceMetrics && (
                  <div className="hidden sm:inline-flex items-center gap-2.5 bg-slate-950/80 text-white text-[11px] font-light px-3.5 py-2 rounded-full shadow-md border border-white/10 backdrop-blur-md animate-fade-in">
                    <Ruler className="w-3.5 h-3.5 text-brand-cyan" />
                    <span className="text-slate-400 font-sans">{t("metrics.pd", "瞳距")}</span>
                    <span className="font-mono font-medium text-brand-cyan">{faceMetrics.pdMm} mm</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-slate-400 font-sans">{t("metrics.faceWidth", "脸宽")}</span>
                    <span className="font-mono">~{faceMetrics.faceWidthMm} mm</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-emerald-400 text-[10px] font-medium">{t(`fitHint.face.${fitLabelKey}`)}</span>
                  </div>
                )}
              </div>

              {/* Status and privacy indicators */}
              <div className="flex items-center gap-2.5 pointer-events-auto">
                <div className="relative">
                  <button
                    onClick={() => setShowPrivacyTooltip(!showPrivacyTooltip)}
                    onMouseEnter={() => setShowPrivacyTooltip(true)}
                    onMouseLeave={() => setShowPrivacyTooltip(false)}
                    className="w-9 h-9 rounded-full bg-white/85 hover:bg-white border border-slate-200/80 flex items-center justify-center text-slate-600 transition-colors shadow-sm backdrop-blur-md"
                    title={t("privacyTitle")}
                  >
                    <ShieldCheck className="w-4.5 h-4.5 text-emerald-500" />
                  </button>
                  {showPrivacyTooltip && (
                    <div className="absolute right-0 top-11 z-50 w-72 bg-slate-950 text-white text-[11px] leading-relaxed p-4 rounded-2xl shadow-xl border border-white/10 animate-fade-in font-normal">
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
                      experienceStatus === "tracking"
                        ? "bg-emerald-500 animate-pulse"
                        : "bg-amber-400"
                    )}
                  />
                  {experienceStatus === "tracking" ? t("cameraActive") : t("analyzingFace")}
                </div>
              </div>
            </div>

            {/* Position guidance floating badge */}
            {experienceStatus === "tracking" && fitHintKey !== "perfect" && (
              <div className="self-center -mt-6 pointer-events-none animate-fade-in">
                <div className="px-4 py-1.5 rounded-full border text-[10px] uppercase font-semibold tracking-wider shadow-sm backdrop-blur-md bg-amber-50/90 border-amber-200 text-amber-900">
                  {t(`fitHint.${fitHintKey}`)}
                </div>
              </div>
            )}

            {/* Bottom Floating Control Dock */}
            <div className="w-full max-w-3xl mx-auto flex flex-col gap-2 pointer-events-none mt-auto">
              <div className="flex justify-center">
                <button
                  onClick={() => setIsCatalogExpanded(!isCatalogExpanded)}
                  className="pointer-events-auto flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full border border-white/60 bg-white/90 hover:bg-white text-[10px] font-bold uppercase tracking-wider text-slate-700 hover:text-slate-900 shadow-md backdrop-blur-md transition-all active:scale-95"
                >
                  <SlidersHorizontal className="w-3 h-3 text-brand-primary" />
                  {isCatalogExpanded ? t("catalog.hide", "收起") : t("catalog.show", "展开系列")}
                </button>
              </div>

              {isCatalogExpanded && (
                <div className="bg-white/90 backdrop-blur-xl border border-white/60 p-4 sm:p-5 rounded-3xl shadow-2xl pointer-events-auto flex flex-col gap-3.5 transition-all duration-300">
                  {/* Active Frame Title & Finish Swatches Row */}
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100/80 pb-2.5">
                    <div className="flex items-baseline gap-2.5 min-w-0">
                      <h2 className="text-base sm:text-lg font-display font-medium text-slate-900 tracking-tight truncate">
                        {frame.productName}
                      </h2>
                      {selectedProduct && (
                        <span className="text-[11px] font-normal text-slate-500 truncate">
                          {isZh ? selectedProduct.materialZh : selectedProduct.materialEn}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                        {frame.lensLabel}
                      </span>
                    </div>

                    {/* Finish color swatches */}
                    {finishes.length > 1 && (
                      <div className="flex items-center gap-2 shrink-0">
                        {finishes.map((finish) => {
                          const isActive = (activeFinishId ?? frame.id) === finish.id;
                          return (
                            <button
                              key={finish.id}
                              type="button"
                              onClick={() => setActiveFinishId(finish.id)}
                              title={finish.lensLabel}
                              className={cn(
                                "w-6 h-6 rounded-full border-2 transition-all shadow-sm",
                                isActive
                                  ? "border-brand-primary scale-110 ring-2 ring-brand-primary/20"
                                  : "border-white hover:scale-105 opacity-80 hover:opacity-100"
                              )}
                              style={{ backgroundColor: finish.frameColor }}
                              aria-label={finish.id}
                            />
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
                          onClick={() => setActiveProductId(product.id)}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 rounded-2xl border text-left transition-all duration-200 min-w-[170px] max-w-[210px] shrink-0 snap-start active:scale-[0.98]",
                            isSelected
                              ? "border-brand-primary bg-brand-primary/10 shadow-sm ring-1 ring-brand-primary/30"
                              : "border-slate-200/60 bg-white/60 hover:bg-white hover:border-slate-300"
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
                            <span className="text-[9px] text-slate-400 truncate mt-0.5">
                              {displayMat}
                            </span>
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
                          onChange={(e) =>
                            setUserAdjust((prev) => ({ ...prev, x: Number(e.target.value) }))
                          }
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
                          onChange={(e) =>
                            setUserAdjust((prev) => ({ ...prev, y: Number(e.target.value) }))
                          }
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
                          onChange={(e) =>
                            setUserAdjust((prev) => ({ ...prev, scale: Number(e.target.value) }))
                          }
                          className="accent-slate-900"
                        />
                      </label>
                      <div className="sm:col-span-3 flex justify-end">
                        <button
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
                        onClick={() => setShowOverlay(!showOverlay)}
                        className={cn(
                          "px-3.5 py-2.5 rounded-xl border text-[10px] uppercase font-bold tracking-wider transition-all flex items-center gap-1.5 shadow-xs",
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
                        onClick={() => setShowAdjustPanel((v) => !v)}
                        className={cn(
                          "px-3.5 py-2.5 rounded-xl border text-[10px] uppercase font-bold tracking-wider transition-all flex items-center gap-1.5 shadow-xs",
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
                        onClick={handleCapture}
                        className="w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all flex items-center justify-center shadow-xs active:scale-95"
                        title={t("camera.takePhoto")}
                      >
                        <Camera className="w-4 h-4 text-brand-primary" />
                      </button>
                    </div>

                    <Button
                      variant="primary"
                      onClick={handleSaveAndConfigure}
                      className="bg-brand-primary hover:bg-brand-primary/90 text-white border-0 shadow-md text-[10px] py-3.5 px-6 rounded-xl font-bold uppercase tracking-[0.15em] flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
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
            <div className="flex flex-col gap-2">
              <Button
                variant="outline-light"
                onClick={handleAddToCart}
                className="flex-1 border-slate-200 text-slate-800 hover:bg-slate-50"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t("addToCart", "加入购物车")}
              </Button>
              <Button
                variant="outline-light"
                onClick={handleDownloadCapture}
                className="flex-1 border-slate-200 text-slate-800 hover:bg-slate-50"
              >
                <Download className="w-4 h-4 mr-2" />
                {t("capture.download")}
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveAndConfigure}
                className="flex-1 bg-brand-primary hover:bg-brand-primary/90 text-white border-0"
              >
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                {t("saveAndConfigure")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
