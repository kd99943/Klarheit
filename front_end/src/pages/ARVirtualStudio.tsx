import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, CheckCircle, Repeat, Share2, SlidersHorizontal, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArTryOnCanvas } from "../ar/ArTryOnCanvas";
import { calculateGlassesTransform } from "../ar/arCalibration";
import { DEFAULT_AR_FINISH, getArFrameConfig } from "../ar/frameCatalog";
import type { ArExperienceStatus, ArFinishId } from "../ar/types";
import { useCameraStream } from "../ar/useCameraStream";
import { useFaceLandmarks } from "../ar/useFaceLandmarks";
import { Button } from "../components/ui/Button";
import { GlassPanel } from "../components/ui/GlassPanel";
import { cn } from "../lib/utils";

function resolveExperienceStatus(cameraStatus: string, trackingStatus: string, captured: boolean): ArExperienceStatus {
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
  const { t } = useTranslation("ar-studio");
  const [activeFinish, setActiveFinish] = useState<ArFinishId>(DEFAULT_AR_FINISH);
  const [captureMessage, setCaptureMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureRef = useRef<(() => string | null) | null>(null);
  const camera = useCameraStream();
  const tracking = useFaceLandmarks({ videoRef, enabled: camera.status === "ready" });
  const frame = getArFrameConfig(activeFinish);
  const transform = useMemo(() => (tracking.landmarks ? calculateGlassesTransform(tracking.landmarks) : null), [tracking.landmarks]);
  const experienceStatus = resolveExperienceStatus(camera.status, transform && tracking.status === "tracking" ? "tracking" : tracking.status, Boolean(captureMessage));

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = camera.stream;
    }
  }, [camera.stream]);

  const handleCapture = useCallback(() => {
    const capture = captureRef.current?.();
    setCaptureMessage(capture ? t("capture.ready") : t("capture.unavailable"));
  }, [t]);

  return (
    <div className="relative w-full min-h-[calc(100vh-80px)] overflow-hidden bg-[#0A1121]">
      <div className="absolute inset-0 z-0">
        <ArTryOnCanvas stream={camera.stream} frame={frame} transform={transform} onCaptureReady={(capture) => (captureRef.current = capture)} />
      </div>
      <video ref={videoRef} className="hidden" autoPlay muted playsInline />

      <div className="relative z-30 mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-[1440px] flex-col justify-between px-4 pb-6 pt-6 sm:px-6 lg:px-10">
        <div className="pointer-events-none flex justify-between gap-4">
          <GlassPanel className="pointer-events-auto max-w-sm px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-brand-cyan font-semibold">{t("studioStatus")}</p>
                <h1 className="mt-2 text-xl font-display font-medium text-white">{t("liveFaceMapping")}</h1>
                <p className="mt-2 text-sm text-slate-300 font-light">{t(`status.${experienceStatus}`)}</p>
              </div>
              <Sparkles className="w-5 h-5 text-brand-cyan shrink-0" />
            </div>
          </GlassPanel>
        </div>

        <div className="mt-auto flex flex-col items-center justify-end pointer-events-none">
          <GlassPanel className="p-5 sm:p-8 mb-4 w-full max-w-4xl pointer-events-auto flex flex-col gap-6 sm:gap-8">
            <div className="flex flex-col gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-display text-white text-xl md:text-2xl tracking-wide font-light">{frame.productName}</h2>
                <p className="text-[10px] text-slate-400 mt-2 uppercase font-semibold tracking-widest flex items-center gap-2">
                  <span className={cn("w-1.5 h-1.5 rounded-full", experienceStatus === "tracking" ? "bg-emerald-400 animate-pulse" : "bg-amber-300")} />
                  {t(`status.${experienceStatus}`)}
                </p>
              </div>
              <Button variant="outline-dark" onClick={camera.start}>
                <Camera className="w-4 h-4" />
                {camera.status === "idle" ? t("camera.start") : t("camera.retry")}
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:flex sm:items-center sm:justify-center sm:gap-12 py-2">
              {(["matte-black", "titanium", "rose-gold"] as const).map((finish) => {
                const option = getArFrameConfig(finish);
                return (
                  <button key={finish} onClick={() => setActiveFinish(finish)} className="group flex flex-col items-center gap-3 rounded-2xl px-2 py-1">
                    <div className={cn("w-12 h-12 rounded-full p-1 relative transition-colors duration-300", activeFinish === finish ? "border-2 border-white" : "border border-white/20 group-hover:border-white/50")}>
                      <div className="w-full h-full rounded-full shadow-inner" style={{ background: option.frameColor }} />
                      {activeFinish === finish ? <CheckCircle className="absolute -top-1 -right-1 w-4 h-4 text-white bg-[#050B16] rounded-full" /> : null}
                    </div>
                    <span className={cn("text-[9px] text-center uppercase tracking-widest font-semibold transition-colors duration-300", activeFinish === finish ? "text-white" : "text-slate-500 group-hover:text-slate-300")}>
                      {t(option.finishLabelKey)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">{t("liveReadout")}</p>
                <p className="mt-2">{t("lensProfile")}: {frame.lensLabel}. {experienceStatus === "tracking" ? t("captureInstruction") : t("fallback.continue")}</p>
              </div>
              <Link to="/config-lab" className="w-full">
                <Button variant="outline-dark" className="w-full">
                  <SlidersHorizontal className="w-4 h-4" />
                  {t("configurePrecisionLenses")}
                </Button>
              </Link>
            </div>
          </GlassPanel>

          <div className="flex flex-wrap justify-center gap-3 pointer-events-auto">
            <button onClick={camera.start} className="w-12 h-12 rounded-full bg-[#050B16]/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/10 hover:border-white/30 transition-colors duration-300">
              <Repeat className="w-4 h-4" />
            </button>
            <button onClick={handleCapture} className="w-12 h-12 rounded-full bg-[#050B16]/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/10 hover:border-white/30 transition-colors duration-300">
              <Camera className="w-4 h-4" />
            </button>
            <button className="w-12 h-12 rounded-full bg-[#050B16]/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/10 hover:border-white/30 transition-colors duration-300">
              <Share2 className="w-4 h-4" />
            </button>
          </div>
          {captureMessage ? <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-brand-cyan font-semibold pointer-events-auto">{captureMessage}</p> : null}
        </div>
      </div>
    </div>
  );
}
