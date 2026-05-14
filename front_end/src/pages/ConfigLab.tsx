import { useState } from "react";
import { ChevronRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { FormField } from "../components/ui/FormField";
import { cn } from "../lib/utils";
import { PageIntro } from "../components/ui/PageIntro";
import { SectionCard } from "../components/ui/SectionCard";

type Step = 1 | 2 | 3;
type CoatingOption = "ar-onyx" | "hev-blue";

export function ConfigLab() {
  const [activeStep, setActiveStep] = useState<Step>(1);
  const [activeCoating, setActiveCoating] = useState<CoatingOption>("ar-onyx");

  const steps = [
    { id: 1 as Step, label: "Prescription", description: "Sphere, cylinder, axis" },
    { id: 2 as Step, label: "Surface", description: "Coatings and lens behavior" },
    { id: 3 as Step, label: "Review", description: "Summary before order" },
  ];

  return (
    <div className="flex-1 flex overflow-hidden bg-surface-offwhite">
      <aside className="hidden lg:flex w-24 border-r border-slate-200 flex-col items-center py-8 gap-8 shrink-0 bg-white/50">
        {steps.map((step) => (
          <button
            key={step.id}
            onClick={() => setActiveStep(step.id)}
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-mono transition-colors",
              activeStep === step.id
                ? "bg-brand-primary text-white shadow-sm"
                : "border border-slate-200 text-slate-400 hover:border-brand-primary hover:text-brand-primary bg-white"
            )}
          >
            {String(step.id).padStart(2, "0")}
          </button>
        ))}
        <div className="mt-auto mb-4">
          <div className="w-[1px] h-24 bg-slate-200"></div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-y-auto w-full">
        <div className="p-5 sm:p-8 lg:p-12 pb-4">
          <PageIntro
            eyebrow="Swiss Precision Customization Interface"
            title="Config Lab"
            description="Tune prescription values, select the surface stack, and review the optical build before moving to secure checkout."
            actions={
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Engine</p>
                <p className="mt-2 text-2xl font-display font-medium text-brand-primary">v2.4</p>
              </div>
            }
          />
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3 lg:hidden">
            {steps.map((step) => (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(step.id)}
                className={cn(
                  "rounded-2xl border px-4 py-4 text-left transition-colors",
                  activeStep === step.id ? "border-brand-primary bg-white" : "border-slate-200 bg-white/70"
                )}
              >
                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{String(step.id).padStart(2, "0")}</p>
                <p className="mt-2 text-sm font-semibold text-brand-primary">{step.label}</p>
                <p className="mt-1 text-xs text-slate-500">{step.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 p-5 sm:p-8 lg:p-12 pt-4">
          <div className="lg:col-span-8 flex flex-col gap-8">
            <SectionCard className="relative overflow-hidden" contentClassName="p-5 sm:p-8">
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
            </SectionCard>

            <SectionCard
              eyebrow="Step 01"
              title="Optometric Prescription"
              description="Review the active prescription fields. Inputs stay in the existing payload shape expected by checkout."
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <FormField label="Sphere (SPH)" type="text" defaultValue="" hint="Quarter-step precision" />
                <FormField label="Cylinder (CYL)" type="text" defaultValue="" hint="Astigmatism correction" />
                <FormField label="Axis" type="text" defaultValue="" hint="0° to 180°" />
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Step 02"
              title="Surface Details"
              description="Choose the coating emphasis for the current optical build."
            >
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
                  <div className={cn("w-5 h-5 rounded-full border bg-white transition-all", activeCoating === "ar-onyx" ? "border-[5px] border-brand-primary" : "border border-slate-300")} />
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
                  <div className={cn("w-5 h-5 rounded-full border bg-white transition-all", activeCoating === "hev-blue" ? "border-[5px] border-brand-primary" : "border border-slate-300")} />
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="rounded-2xl border border-brand-primary/10 bg-brand-primary text-white p-6 sm:p-8 h-full flex flex-col justify-between shadow-xl relative overflow-hidden">
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
                <div className="mt-8 rounded-2xl bg-white/8 px-4 py-4 text-sm text-slate-200">
                  <div className="flex items-center gap-2 text-brand-cyan">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-[10px] uppercase tracking-[0.2em] font-semibold">Active Stage</span>
                  </div>
                  <p className="mt-2">{steps.find((step) => step.id === activeStep)?.description}</p>
                </div>
              </div>
              <div className="mt-12 relative z-10">
                <div className="flex justify-between items-end mb-8 font-display">
                  <span className="text-sm text-white/60 font-medium">Total Value</span>
                  <span className="text-3xl font-light tracking-tight text-white">$1,155.00</span>
                </div>
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveStep(activeStep === 3 ? 3 : ((activeStep + 1) as Step))}
                    className="w-full bg-white text-brand-primary py-4 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-slate-100 transition-colors rounded-sm flex items-center justify-center gap-2"
                  >
                    Next Step
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <Link to="/checkout" className="w-full">
                    <Button variant="outline-dark" className="w-full bg-transparent border-white/25">
                      Initialize Order
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
