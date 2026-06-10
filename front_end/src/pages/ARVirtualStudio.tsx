import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, CheckCircle, Repeat, SlidersHorizontal, Sparkles, ArrowLeft, ShieldCheck, Eye, EyeOff, X, HelpCircle, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ARTryOnCanvas } from "../ar/ARTryOnCanvas";
import { calculateGlassesTransform } from "../ar/arCalibration";
import { AR_FRAME_CATALOG, DEFAULT_AR_FINISH } from "../ar/frameCatalog";
import type { ARExperienceStatus, ARFinishId, ARFrameConfig } from "../ar/types";
import { fetchArConfigs } from "../services/api";
import { useCameraStream } from "../ar/useCameraStream";
import { useFaceLandmarks } from "../ar/useFaceLandmarks";
import { Button } from "../components/ui/Button";
import { cn } from "../lib/utils";

const AERO_X1_IMAGE_URL = "/images/aero_x1.png";

function resolveExperienceStatus(cameraStatus: string, trackingStatus: string, captured: boolean): ARExperienceStatus {
  if (captured) return "captured";
  if (cameraStatus === "unsupported") return "unsupported";
  if (cameraStatus === "denied") return "permission-denied";
  if (cameraStatus === "error" || trackingStatus === "error") return "error";
  if (cameraStatus !== "ready") return "initializing";
  if (trackingStatus === "tracking") return "tracking";
  if (trackingStatus === "low-confidence") return "low-confidence";
  return "no-face";
}

export function ARVirtualStudio() {
  const { t, i18n } = useTranslation("ar-studio");
  const navigate = useNavigate();
  const [arConfigs, setArConfigs] = useState<ARFrameConfig[]>(Object.values(AR_FRAME_CATALOG));
  const [activeFinish, setActiveFinish] = useState<ARFinishId>(DEFAULT_AR_FINISH);
  const [captureMessage, setCaptureMessage] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState<boolean>(true); // Before/After toggle state
  const [showPrivacyTooltip, setShowPrivacyTooltip] = useState<boolean>(false);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureRef = useRef<(() => string | null) | null>(null);
  
  const camera = useCameraStream();
  const tracking = useFaceLandmarks({ videoRef, enabled: camera.status === "ready" });
  
  const frame = useMemo(() => {
    return arConfigs.find((c) => c.id === activeFinish) || arConfigs[0] || Object.values(AR_FRAME_CATALOG)[0];
  }, [arConfigs, activeFinish]);
  
  const transform = useMemo(() => (tracking.landmarks ? calculateGlassesTransform(tracking.landmarks) : null), [tracking.landmarks]);
  
  const experienceStatus = resolveExperienceStatus(
    camera.status, 
    transform && tracking.status === "tracking" ? "tracking" : tracking.status, 
    Boolean(captureMessage)
  );

  // Auto-start camera on mount, clean up on unmount
  useEffect(() => {
    camera.start();
    return () => {
      camera.stop();
    };
  }, []);

  // Face Fit Hint estimation based on eye outer distance (landmarks 33 and 263)
  const fitHintKey = useMemo(() => {
    if (experienceStatus !== "tracking" || !tracking.landmarks) return "calibrating";
    const leftEye = tracking.landmarks[33];
    const rightEye = tracking.landmarks[263];
    const leftFace = tracking.landmarks[234];
    const rightFace = tracking.landmarks[454];

    if (!leftEye || !rightEye || !leftFace || !rightFace) return "calibrating";

    const dist = (p1: any, p2: any) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
    const eyeDist = dist(leftEye, rightEye);

    // Keep it conservative: we prompt users to move within standard WebAR ranges
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

  useEffect(() => {
    fetchArConfigs()
      .then((configs) => {
        if (configs && configs.length > 0) {
          setArConfigs(configs);
          if (!configs.some((c) => c.id === activeFinish)) {
            setActiveFinish(configs[0].id);
          }
        }
      })
      .catch((err) => {
        console.error("Failed to fetch AR configs from API, falling back to static catalog:", err);
      });
  }, []);

  const handleCapture = useCallback(() => {
    const capture = captureRef.current?.();
    setCaptureMessage(capture ? t("capture.ready") : t("capture.unavailable"));
    setTimeout(() => setCaptureMessage(null), 3000);
  }, [t]);

  const handleSaveAndConfigure = () => {
    try {
      sessionStorage.setItem("savedFinishId", activeFinish);
    } catch (e) {
      console.error("Failed to save finishId in sessionStorage", e);
    }
    navigate("/config-lab", { state: { finishId: activeFinish } });
  };

  const showFallback = camera.status === "denied" || camera.status === "unsupported" || camera.status === "error";

  return (
    <div className="relative w-full min-h-[calc(100vh-80px)] overflow-hidden bg-slate-50 text-slate-900 flex flex-col font-sans">
      <video ref={videoRef} className="hidden" autoPlay muted playsInline />

      {/* Main Container */}
      {camera.status === "requesting" || camera.status === "initializing" ? (
        // Loader Screen
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50">
          <Loader2 className="w-10 h-10 text-brand-primary animate-spin mb-4" strokeWidth={1.5} />
          <h3 className="font-display font-light text-xl tracking-tight mb-1">{t("status.initializing")}</h3>
          <p className="text-xs text-slate-500 font-light">{t("camera.allowAccess")}</p>
        </div>
      ) : showFallback ? (
        // Camera Blocked / Error Fallback Layout
        <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 max-w-6xl mx-auto w-full px-6 py-12">
          {/* Left Side: Gorgeous Mockup Frame Card */}
          <div className="w-full max-w-md bg-white border border-slate-200/60 rounded-3xl shadow-xl p-8 flex flex-col items-center justify-center relative overflow-hidden group">
            {/* Grid Pattern overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#f1f5f9_1px,transparent_1px),linear-gradient(to_bottom,#f1f5f9_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-60 z-0 pointer-events-none" />
            
            <div className="relative z-10 w-full aspect-[4/3] flex items-center justify-center bg-slate-50/50 rounded-2xl border border-slate-100 p-6 shadow-inner">
              <img
                src={AERO_X1_IMAGE_URL}
                alt={frame.productName}
                className="w-full h-full object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            
            <div className="w-full mt-6 text-center">
              <span className="text-[9px] border border-slate-200 px-3 py-1 rounded-full uppercase tracking-widest text-slate-500 font-semibold bg-slate-50">
                Static 2D Mockup Preview
              </span>
              <h3 className="text-2xl font-display font-light text-slate-900 tracking-tight mt-3">{frame.productName}</h3>
              <p className="text-xs text-slate-500 mt-2 font-mono">{t("lensProfile")}: {frame.lensLabel}</p>
            </div>
          </div>

          {/* Right Side: Fallback Actions & Form */}
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

            {/* Camera retry section */}
            {camera.status !== "unsupported" && (
              <div className="bg-slate-100/80 border border-slate-200 p-5 rounded-2xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200/50 flex items-center justify-center text-slate-600 shrink-0">
                    <Camera className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-widest">{t("camera.disabled")}</h4>
                    <p className="text-[11px] text-slate-400 font-light mt-0.5">{t("camera.allowInstructions")}</p>
                  </div>
                </div>
                <Button variant="outline-light" onClick={camera.start} className="bg-white border-slate-200 hover:bg-slate-50 shadow-sm py-2 px-4 text-[9px]">
                  {t("camera.retry")}
                </Button>
              </div>
            )}

            {/* Frame swatches */}
            <div className="flex flex-col gap-3">
              <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{t("currentFinish")}</span>
              <div className="flex gap-4">
                {arConfigs.map((option) => {
                  const finish = option.id;
                  const isSelected = activeFinish === finish;
                  return (
                    <button
                      key={finish}
                      onClick={() => setActiveFinish(finish)}
                      className="group flex flex-col items-center gap-1.5 transition-transform active:scale-95"
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-full p-0.5 relative transition-all duration-300",
                        isSelected ? "ring-2 ring-brand-primary ring-offset-2 scale-110" : "border border-slate-200 hover:border-slate-400"
                      )}>
                        <div className="w-full h-full rounded-full shadow-inner" style={{ background: option.frameColor }} />
                      </div>
                      <span className={cn(
                        "text-[8px] uppercase tracking-widest font-semibold transition-colors duration-300",
                        isSelected ? "text-slate-900 font-bold" : "text-slate-400 group-hover:text-slate-600"
                      )}>
                        {t(option.finishLabelKey)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="w-full h-px bg-slate-200 my-2" />

            {/* Action CTA */}
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
        // Active AR Try-On Canvas screen
        <>
          <div className="absolute inset-0 z-0">
            <ARTryOnCanvas
              stream={camera.stream}
              frame={frame}
              transform={transform}
              onCaptureReady={(capture) => (captureRef.current = capture)}
              showOverlay={showOverlay}
            />
          </div>

          {/* Overlays layout */}
          <div className="relative z-30 flex-1 flex flex-col justify-between p-6 sm:p-8">
            {/* Top Bar Overlay */}
            <div className="w-full flex justify-between gap-4 items-start pointer-events-none">
              {/* Top-Left: Back Action and Header */}
              <div className="flex flex-col items-start gap-4">
                <Link
                  to="/collections"
                  className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-800 hover:text-slate-900 transition-colors bg-white/90 px-4 py-2.5 rounded-full border border-slate-200 shadow-sm pointer-events-auto backdrop-blur-md"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {t("backToCollections")}
                </Link>
                <div className="flex flex-col gap-1 bg-white/80 border border-slate-200/50 p-4 rounded-2xl shadow-sm backdrop-blur-md pointer-events-auto max-w-sm">
                  <h1 className="text-xl font-display font-medium text-slate-900 tracking-tight">{t("title")}</h1>
                  <p className="text-xs text-slate-500 font-light mt-0.5">{t("subtitle")}</p>
                </div>
              </div>

              {/* Top-Right: Camera status indicator and Privacy */}
              <div className="flex items-center gap-3 pointer-events-auto">
                {/* Privacy Tooltip Toggle */}
                <div className="relative">
                  <button
                    onClick={() => setShowPrivacyTooltip(!showPrivacyTooltip)}
                    onMouseEnter={() => setShowPrivacyTooltip(true)}
                    onMouseLeave={() => setShowPrivacyTooltip(false)}
                    className="w-9 h-9 rounded-full bg-white/80 border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-white transition-colors shadow-sm backdrop-blur-md"
                  >
                    <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  </button>
                  {showPrivacyTooltip && (
                    <div className="absolute right-0 top-11 z-50 w-72 bg-slate-900 text-white text-[11px] leading-relaxed p-4 rounded-2xl shadow-xl border border-white/10 animate-fade-in font-normal">
                      <h4 className="font-bold text-emerald-400 mb-1 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {t("privacyTitle")}
                      </h4>
                      <p>{t("privacyDisclaimer")}</p>
                    </div>
                  )}
                </div>

                {/* Status indicator pill */}
                <div className="flex items-center gap-2 bg-white/80 border border-slate-200 px-3 py-2 rounded-full shadow-sm backdrop-blur-md text-[9px] uppercase font-bold tracking-widest text-slate-600">
                  <span className={cn("w-2 h-2 rounded-full", experienceStatus === "tracking" ? "bg-emerald-500 animate-pulse" : "bg-amber-400")} />
                  {experienceStatus === "tracking" ? t("cameraActive") : t("analyzingFace")}
                </div>
              </div>
            </div>

            {/* Middle Face Fit Calibration Banner */}
            {experienceStatus === "tracking" && (
              <div className="absolute top-28 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                <div className={cn(
                  "px-4 py-2 rounded-full border text-[9px] uppercase font-bold tracking-widest shadow-sm backdrop-blur-md transition-colors duration-300",
                  fitHintKey === "perfect" ? "bg-emerald-50/90 border-emerald-200 text-emerald-800" : "bg-amber-50/90 border-amber-200 text-amber-800"
                )}>
                  {t(`fitHint.${fitHintKey}`)}
                </div>
              </div>
            )}

            {/* Bottom Toolbar Overlay */}
            <div className="mt-auto w-full max-w-4xl mx-auto flex flex-col gap-6 pointer-events-none">
              <div className="bg-white/95 border border-slate-200/80 p-5 rounded-3xl shadow-xl pointer-events-auto backdrop-blur-md flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-center sm:text-left">
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{t("currentFinish")}</span>
                    <h3 className="font-display font-medium text-slate-900 text-lg sm:text-xl mt-0.5">{frame.productName}</h3>
                  </div>

                  {/* Frame finish options selector */}
                  <div className="flex items-center gap-4">
                    {arConfigs.map((option) => {
                      const finish = option.id;
                      const isSelected = activeFinish === finish;
                      return (
                        <button
                          key={finish}
                          onClick={() => setActiveFinish(finish)}
                          className="group flex flex-col items-center gap-1.5 transition-transform active:scale-95"
                        >
                          <div className={cn(
                            "w-9 h-9 rounded-full p-0.5 relative transition-all duration-300",
                            isSelected ? "ring-2 ring-brand-primary ring-offset-2 scale-110" : "border border-slate-200 hover:border-slate-400"
                          )}>
                            <div className="w-full h-full rounded-full shadow-inner" style={{ background: option.frameColor }} />
                          </div>
                          <span className={cn(
                            "text-[8px] uppercase tracking-widest font-semibold transition-colors duration-300",
                            isSelected ? "text-slate-900 font-bold" : "text-slate-400 group-hover:text-slate-600"
                          )}>
                            {t(option.finishLabelKey)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Toolbar control buttons */}
                <div className="flex flex-col sm:flex-row gap-3 items-center justify-between border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-2">
                    {/* Before/After Toggle */}
                    <button
                      onClick={() => setShowOverlay(!showOverlay)}
                      className={cn(
                        "px-4 py-3 rounded-xl border text-[10px] uppercase font-bold tracking-widest transition-all flex items-center gap-2",
                        showOverlay
                          ? "bg-slate-900 border-slate-900 text-white"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      {showOverlay ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      {t("beforeAfter")}
                    </button>

                    {/* Screenshot Shutter */}
                    <button
                      onClick={handleCapture}
                      className="w-11 h-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors flex items-center justify-center shadow-sm"
                      title={t("camera.takePhoto")}
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Primary Configuration CTA */}
                  <Button
                    variant="primary"
                    onClick={handleSaveAndConfigure}
                    className="w-full sm:w-auto bg-brand-primary hover:bg-brand-primary/90 text-white border-0 shadow-md text-[10px] py-4 px-8 rounded-xl font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    {t("saveAndConfigure")}
                  </Button>
                </div>
              </div>

              {captureMessage && (
                <div className="self-center bg-slate-900 text-white text-[9px] uppercase font-bold tracking-widest px-4 py-2.5 rounded-full shadow-lg border border-white/10 animate-bounce">
                  {captureMessage}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
