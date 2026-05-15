import { useState } from "react";
import { Camera, CheckCircle, Repeat, Share2, SlidersHorizontal, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { GlassPanel } from "../components/ui/GlassPanel";
import { Button } from "../components/ui/Button";

export function ARVirtualStudio() {
  const { t } = useTranslation("ar-studio");
  const [activeColor, setActiveColor] = useState<"black" | "titanium" | "rose">("black");
  const [captureState, setCaptureState] = useState<"idle" | "captured">("idle");

  const colorMeta = {
    black: { label: t("color.matteBlack"), lens: "Onyx AR", fit: t("fit.urbanContrast") },
    titanium: { label: t("color.titanium"), lens: "Neutral Clear", fit: t("fit.studioNeutral") },
    rose: { label: t("color.roseGold"), lens: "Warm HEV", fit: t("fit.softDaylight") },
  } as const;

  return (
    <div className="relative w-full min-h-[calc(100vh-80px)] overflow-hidden bg-[#0A1121]">
      <div className="absolute inset-0 z-0">
        <img
          alt="AR Try-On View"
          className="w-full h-full object-cover object-center"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBYggF8qJw0oilYsR2i531-nRvWpDmAWrdVV3ZiJuyiBNGUpcYkvmouNUJzn2Q3nAN4LyI2t1wqrVpLE5PhZEc7VFFloCnfCrjcBZRNDDOqMVje38J0aIgjDZMxZDvHPnCEAghP_GeGOMmRp_7fuUk0fWDV7asCDR3tMIGdajd7NNaHJEEcUAmZshST9c1CoP1wXrGnMVQTNHdbRghQm33_mjfUNMjTCYbfXo7otFt44DdHhXXsUjjbIiYiyIjaJS247XHsldGkWA"
        />
        <div className="absolute inset-0 bg-[#0A1121]/20 mix-blend-multiply"></div>
      </div>

      <div
        className="absolute inset-0 z-10 pointer-events-none opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(34, 211, 238, 0.2) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(34, 211, 238, 0.2) 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px",
          backgroundPosition: "center center",
        }}
      />

      <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
        <div className="relative w-24 h-24 border border-brand-cyan/40 rounded-full flex items-center justify-center">
          <div className="absolute w-[120%] h-[1px] bg-brand-cyan/60"></div>
          <div className="absolute h-[120%] w-[1px] bg-brand-cyan/60"></div>
          <div className="absolute w-1.5 h-1.5 bg-brand-cyan rounded-full animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]"></div>
        </div>

        <div className="absolute top-[35%] left-[10%] lg:left-[20%] hidden md:flex flex-col gap-2 text-[9px] text-brand-cyan font-mono tracking-widest uppercase opacity-80 border-l border-brand-cyan/30 pl-3">
          <span>{t("faceMesh")} <span className="text-white ml-2">{t("active")}</span></span>
          <span>{t("pupillaryDist")} <span className="text-white ml-2">62mm</span></span>
          <span>{t("tiltAngle")} <span className="text-white ml-2">2.4°</span></span>
          <span>{t("depthZ")} <span className="text-white ml-2">-14.2cm</span></span>
        </div>

        <div className="absolute bottom-[40%] right-[10%] lg:right-[20%] hidden md:flex flex-col gap-2 text-[9px] text-brand-cyan font-mono tracking-widest uppercase opacity-80 border-r border-brand-cyan/30 pr-3 items-end">
          <span>{t("lens")} <span className="text-white ml-2">{colorMeta[activeColor].lens}</span></span>
          <span>{t("coating")} <span className="text-white ml-2">{colorMeta[activeColor].label}</span></span>
          <span>{t("fit")} <span className="text-white ml-2">{colorMeta[activeColor].fit}</span></span>
          <span>{t("confidence")} <span className="text-emerald-400 ml-2">98.2%</span></span>
        </div>
      </div>

      <div className="relative z-30 mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-[1440px] flex-col justify-between px-4 pb-6 pt-6 sm:px-6 lg:px-10">
        <div className="pointer-events-none flex justify-between gap-4">
          <GlassPanel className="pointer-events-auto max-w-sm px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-brand-cyan font-semibold">{t("studioStatus")}</p>
                <h1 className="mt-2 text-xl font-display font-medium text-white">{t("liveFaceMapping")}</h1>
                <p className="mt-2 text-sm text-slate-300 font-light">{t("frontCameraAligned")}</p>
              </div>
              <Sparkles className="w-5 h-5 text-brand-cyan shrink-0" />
            </div>
          </GlassPanel>
          <GlassPanel className="pointer-events-auto hidden lg:block px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400 font-semibold">{t("currentFinish")}</p>
            <p className="mt-2 text-sm text-white">{colorMeta[activeColor].label}</p>
            <p className="mt-1 text-xs text-slate-400">{colorMeta[activeColor].fit}</p>
          </GlassPanel>
        </div>

        <div className="mt-auto flex flex-col items-center justify-end pointer-events-none">
          <GlassPanel className="p-5 sm:p-8 mb-4 w-full max-w-4xl pointer-events-auto flex flex-col gap-6 sm:gap-8">
            <div className="flex flex-col gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-display text-white text-xl md:text-2xl tracking-wide font-light">Aero X1</h2>
                <p className="text-[10px] text-slate-400 mt-2 uppercase font-semibold tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  {t("liveArTryOnActive")}
                </p>
              </div>
              <div className="flex items-center gap-2 border border-brand-cyan/30 bg-brand-cyan/10 px-3 py-1.5 rounded self-start">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan"></span>
                <span className="font-mono text-[9px] text-brand-cyan tracking-widest uppercase mt-[1px]">{t("meshTracking")}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:flex sm:items-center sm:justify-center sm:gap-12 py-2">
              {(["black", "titanium", "rose"] as const).map((color) => (
                <button
                  key={color}
                  onClick={() => setActiveColor(color)}
                  className="group flex flex-col items-center gap-3 rounded-2xl px-2 py-1"
                >
                  <div
                    className={cn(
                      "w-12 h-12 rounded-full p-1 relative transition-colors duration-300",
                      activeColor === color ? "border-2 border-white" : "border border-white/20 group-hover:border-white/50"
                    )}
                  >
                    <div
                      className={cn(
                        "w-full h-full rounded-full shadow-inner",
                        color === "black" && "bg-[#1c1c1c]",
                        color === "titanium" && "bg-gradient-to-br from-slate-300 to-slate-500",
                        color === "rose" && "bg-gradient-to-br from-rose-300 to-rose-400"
                      )}
                    />
                    {activeColor === color ? (
                      <CheckCircle className="absolute -top-1 -right-1 w-4 h-4 text-white bg-[#050B16] rounded-full" />
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      "text-[9px] text-center uppercase tracking-widest font-semibold transition-colors duration-300",
                      activeColor === color ? "text-white" : "text-slate-500 group-hover:text-slate-300"
                    )}
                  >
                    {colorMeta[color].label}
                  </span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">{t("liveReadout")}</p>
                <p className="mt-2">{t("lensProfile")}: {colorMeta[activeColor].lens}. {t("captureInstruction")}</p>
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
            {[Repeat, Camera, Share2].map((Icon, i) => (
              <button
                key={i}
                onClick={() => {
                  if (Icon === Camera) {
                    setCaptureState("captured");
                  }
                }}
                className="w-12 h-12 rounded-full bg-[#050B16]/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/10 hover:border-white/30 transition-colors duration-300"
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
          {captureState === "captured" ? (
            <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-brand-cyan font-semibold pointer-events-auto">
              {t("stillCaptured")}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
