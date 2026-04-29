import { useState } from "react";
import { CheckCircle, Repeat, Camera, Share2 } from "lucide-react";
import { cn } from "../lib/utils";
import { GlassPanel } from "../components/ui/GlassPanel";
import { Button } from "../components/ui/Button";

export function ARVirtualStudio() {
  const [activeColor, setActiveColor] = useState<"black" | "titanium" | "rose">("black");

  return (
    <div className="relative w-full h-[calc(100vh-80px)] overflow-hidden bg-[#0A1121]">
      {/* AR Background Image container */}
      <div className="absolute inset-0 z-0">
        <img
          alt="AR Try-On View"
          className="w-full h-full object-cover object-center"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBYggF8qJw0oilYsR2i531-nRvWpDmAWrdVV3ZiJuyiBNGUpcYkvmouNUJzn2Q3nAN4LyI2t1wqrVpLE5PhZEc7VFFloCnfCrjcBZRNDDOqMVje38J0aIgjDZMxZDvHPnCEAghP_GeGOMmRp_7fuUk0fWDV7asCDR3tMIGdajd7NNaHJEEcUAmZshST9c1CoP1wXrGnMVQTNHdbRghQm33_mjfUNMjTCYbfXo7otFt44DdHhXXsUjjbIiYiyIjaJS247XHsldGkWA"
        />
        <div className="absolute inset-0 bg-[#0A1121]/20 mix-blend-multiply"></div>
      </div>

      {/* AR Reticle Overlay */}
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

      {/* AR Center Crosshair & Specific UI */}
      <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
        <div className="relative w-24 h-24 border border-brand-cyan/40 rounded-full flex items-center justify-center">
          <div className="absolute w-[120%] h-[1px] bg-brand-cyan/60"></div>
          <div className="absolute h-[120%] w-[1px] bg-brand-cyan/60"></div>
          <div className="absolute w-1.5 h-1.5 bg-brand-cyan rounded-full animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]"></div>
        </div>

        {/* AR Tech Readouts Left */}
        <div className="absolute top-[35%] left-[10%] lg:left-[20%] hidden md:flex flex-col gap-2 text-[9px] text-brand-cyan font-mono tracking-widest uppercase opacity-80 border-l border-brand-cyan/30 pl-3">
          <span>Face Mesh <span className="text-white ml-2">Active</span></span>
          <span>Pupillary Dist <span className="text-white ml-2">62mm</span></span>
          <span>Tilt Angle <span className="text-white ml-2">2.4°</span></span>
          <span>Depth Z <span className="text-white ml-2">-14.2cm</span></span>
        </div>

        {/* AR Tech Readouts Right */}
        <div className="absolute bottom-[40%] right-[10%] lg:right-[20%] hidden md:flex flex-col gap-2 text-[9px] text-brand-cyan font-mono tracking-widest uppercase opacity-80 border-r border-brand-cyan/30 pr-3 items-end">
          <span>Lens <span className="text-white ml-2">Aero X1 T</span></span>
          <span>Coating <span className="text-white ml-2">Onyx AR</span></span>
          <span>Fit <span className="text-white ml-2">Optimal</span></span>
          <span>Confidence <span className="text-emerald-400 ml-2">98.2%</span></span>
        </div>
      </div>

      {/* UI Controls Overlay (Bottom) */}
      <div className="absolute inset-x-0 bottom-0 z-40 flex flex-col items-center justify-end pb-8 px-6 pointer-events-none">

        {/* Frame Color Selection Panel */}
        <GlassPanel className="p-8 mb-6 w-full max-w-2xl pointer-events-auto flex flex-col gap-8">
          <div className="flex justify-between items-start border-b border-white/10 pb-4">
            <div>
              <h2 className="font-display text-white text-xl md:text-2xl tracking-wide font-light">Aero X1</h2>
              <p className="text-[10px] text-slate-400 mt-2 uppercase font-semibold tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Live AR Try-On Active
              </p>
            </div>
            <div className="flex items-center gap-2 border border-brand-cyan/30 bg-brand-cyan/10 px-3 py-1.5 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan"></span>
              <span className="font-mono text-[9px] text-brand-cyan tracking-widest uppercase mt-[1px]">Mesh Tracking</span>
            </div>
          </div>

          {/* Color Options */}
          <div className="flex items-center justify-center gap-12 py-2">
            {(["black", "titanium", "rose"] as const).map((color) => (
              <button
                key={color}
                onClick={() => setActiveColor(color)}
                className="group flex flex-col items-center gap-3"
              >
                <div className={cn(
                  "w-12 h-12 rounded-full p-1 relative transition-colors duration-300",
                  activeColor === color ? "border-2 border-white" : "border border-white/20 group-hover:border-white/50"
                )}>
                  <div className={cn(
                    "w-full h-full rounded-full shadow-inner",
                    color === "black" && "bg-[#1c1c1c]",
                    color === "titanium" && "bg-gradient-to-br from-slate-300 to-slate-500",
                    color === "rose" && "bg-gradient-to-br from-rose-300 to-rose-400"
                  )} />
                  {activeColor === color && (
                    <CheckCircle className="absolute -top-1 -right-1 w-4 h-4 text-white bg-[#050B16] rounded-full" />
                  )}
                </div>
                <span className={cn(
                  "text-[9px] uppercase tracking-widest font-semibold transition-colors duration-300",
                  activeColor === color ? "text-white" : "text-slate-500 group-hover:text-slate-300"
                )}>
                  {color === "black" ? "Matte Black" : color === "titanium" ? "Titanium" : "Rose Gold"}
                </span>
              </button>
            ))}
          </div>

          <Button variant="outline-dark" className="w-full">
            Configure Precision Lenses
          </Button>
        </GlassPanel>

        {/* Secondary Actions */}
        <div className="flex gap-4 pointer-events-auto">
          {[Repeat, Camera, Share2].map((Icon, i) => (
            <button
              key={i}
              className="w-12 h-12 rounded-full bg-[#050B16]/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/10 hover:border-white/30 transition-colors duration-300"
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
