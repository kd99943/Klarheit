import { useState } from "react";
import { Button } from "../components/ui/Button";
import { FormField } from "../components/ui/FormField";
import { cn } from "../lib/utils";

type Step = 1 | 2 | 3;
type CoatingOption = "ar-onyx" | "hev-blue";

export function ConfigLab() {
  const [activeStep, setActiveStep] = useState<Step>(1);
  const [activeCoating, setActiveCoating] = useState<CoatingOption>("ar-onyx");

  return (
    <div className="flex-1 flex overflow-hidden bg-surface-offwhite">
      {/* Side Navigation */}
      <aside className="w-20 border-r border-slate-200 flex flex-col items-center py-8 gap-12 shrink-0 bg-white/50">
        {([1, 2, 3] as Step[]).map((step) => (
          <button
            key={step}
            onClick={() => setActiveStep(step)}
            className={cn(
              "w-8 h-8 rounded flex items-center justify-center text-[10px] font-mono transition-colors",
              activeStep === step
                ? "bg-brand-primary text-white shadow-sm"
                : "border border-slate-200 text-slate-400 hover:border-brand-primary hover:text-brand-primary bg-white"
            )}
          >
            {String(step).padStart(2, "0")}
          </button>
        ))}
        <div className="mt-auto mb-4">
          <div className="w-[1px] h-24 bg-slate-200"></div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-y-auto w-full">
        <div className="p-8 lg:p-12 pb-4">
          <h1 className="text-4xl lg:text-5xl font-display font-light tracking-tight text-brand-primary mb-2 flex items-baseline">
            Config Lab
            <span className="text-brand-cyan font-mono text-base lg:text-lg ml-4 opacity-80">v2.4</span>
          </h1>
          <p className="text-slate-400 text-xs lg:text-sm uppercase tracking-widest font-semibold mt-4">Swiss Precision Customization Interface</p>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 p-8 lg:p-12 pt-4">
          {/* Left Column: Measurements */}
          <div className="lg:col-span-8 flex flex-col gap-8">
            {/* Visualizer Widget */}
            <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 font-mono text-[9px] text-slate-300 uppercase">Live Visualization Engine</div>
              <div className="h-64 w-full flex items-center justify-center bg-slate-50/50 rounded-lg relative border border-dashed border-slate-200 overflow-hidden">
                <div className="absolute inset-0 bg-[#f9fafb]">
                  <div style={{ backgroundImage: "radial-gradient(#e2e8f0 1px, transparent 1px)", backgroundSize: "20px 20px" }} className="w-full h-full opacity-50" />
                </div>
                <div className="w-64 h-32 relative z-10">
                  <div className="absolute inset-0 border-[3px] border-brand-primary rounded-[40px] opacity-20"></div>
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-12 h-0.5 bg-brand-primary"></div>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-12 h-0.5 bg-brand-primary"></div>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-brand-primary"></div>
                  <div className="absolute inset-1 rounded-[36px] bg-brand-cyan/5 border border-brand-cyan/20"></div>
                </div>
                <div className="absolute bottom-4 left-4 font-mono text-[10px] text-brand-cyan font-medium">XY: 104.2 / 88.0</div>
                <div className="absolute bottom-4 right-4 font-mono text-[10px] text-slate-400">CAL: ACTIVE</div>
                <div className="absolute top-4 left-4 border-l-2 border-t-2 border-brand-cyan w-4 h-4"></div>
                <div className="absolute top-4 right-4 border-r-2 border-t-2 border-brand-cyan w-4 h-4"></div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-xs uppercase font-bold text-brand-primary mb-6 tracking-widest border-b border-slate-100 pb-4">Optometric Prescription (OD)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <FormField label="Sphere (SPH)" type="text" defaultValue="-2.25" />
                <FormField label="Cylinder (CYL)" type="text" defaultValue="+0.50" />
                <FormField label="Axis" type="text" defaultValue="180°" />
              </div>
            </div>

            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-xs uppercase font-bold text-brand-primary mb-6 tracking-widest border-b border-slate-100 pb-4">Surface Details</h3>
              <div className="flex flex-col gap-4">
                <div
                  onClick={() => setActiveCoating("ar-onyx")}
                  className={cn(
                    "flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors",
                    activeCoating === "ar-onyx" ? "border-brand-primary/50 bg-slate-50" : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <div>
                    <p className="text-sm font-semibold text-brand-primary">Anti-Reflective Onyx</p>
                    <p className="text-xs text-slate-500 mt-1">Multi-layer nanocoating reducing glare by 99%</p>
                  </div>
                  <div className={cn(
                    "w-5 h-5 rounded-full border bg-white transition-all",
                    activeCoating === "ar-onyx" ? "border-[5px] border-brand-primary" : "border border-slate-300"
                  )} />
                </div>
                <div
                  onClick={() => setActiveCoating("hev-blue")}
                  className={cn(
                    "flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors",
                    activeCoating === "hev-blue" ? "border-brand-primary/50 bg-slate-50" : "border-slate-200 hover:border-slate-300"
                  )}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-700">HEV Blue Light Filter</p>
                    <p className="text-xs text-slate-500 mt-1">Filters out high-energy visible light</p>
                  </div>
                  <div className={cn(
                    "w-5 h-5 rounded-full border bg-white transition-all",
                    activeCoating === "hev-blue" ? "border-[5px] border-brand-primary" : "border border-slate-300"
                  )} />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Summary Box */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-brand-primary text-white p-8 rounded-xl h-full flex flex-col justify-between shadow-xl relative overflow-hidden">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-10">
                  <div>
                    <h2 className="text-2xl font-display font-medium mb-1 tracking-wide">AERO X1</h2>
                    <p className="text-[10px] text-brand-cyan/80 uppercase tracking-widest font-semibold mt-2">Titanium / Polymer</p>
                  </div>
                  <div className="bg-white/10 px-2 py-1 rounded text-[9px] font-mono tracking-widest border border-white/20">PREMIUM</div>
                </div>
                <ul className="space-y-6 text-sm">
                  <li className="flex flex-col gap-1 border-b border-white/10 pb-4">
                    <span className="text-white/50 text-xs font-medium">Frame Architecture</span>
                    <span className="font-semibold tracking-wide">Monoblock Grade 5</span>
                  </li>
                  <li className="flex flex-col gap-1 border-b border-white/10 pb-4">
                    <span className="text-white/50 text-xs font-medium">Lens Tech</span>
                    <span className="font-semibold tracking-wide">High-Index 1.74</span>
                  </li>
                  <li className="flex flex-col gap-1 border-b border-white/10 pb-4">
                    <span className="text-white/50 text-xs font-medium">Coating</span>
                    <span className="font-semibold tracking-wide">
                      {activeCoating === "ar-onyx" ? "AR-Onyx V2 Minimal" : "HEV Blue Filter"}
                    </span>
                  </li>
                </ul>
              </div>
              <div className="mt-12 relative z-10">
                <div className="flex justify-between items-end mb-8 font-display">
                  <span className="text-sm text-white/60 font-medium">Total Value</span>
                  <span className="text-3xl font-light tracking-tight text-white">$1,155.00</span>
                </div>
                <Button variant="outline-dark" className="w-full bg-white text-brand-primary hover:bg-slate-100 hover:text-brand-primary border-white">
                  Initialize Order
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
