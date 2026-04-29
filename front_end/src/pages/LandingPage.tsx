import { Link } from "react-router-dom";
import { MoveRight } from "lucide-react";

export function LandingPage() {
  return (
    <div className="flex flex-col w-full">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        <div className="absolute inset-0 z-0 bg-surface-offwhite">
          <img
            className="w-full h-full object-cover opacity-20 mix-blend-luminosity"
            alt="Abstract minimal composition of translucent glass surfaces"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBbg0BvCGzar79JhHvOW2yp9ebM_f8m99eRPPsLoUxsRvHsu-6yUn9K_l167-aQYawDGASWbzQ-Rt0pmWrBYxa-qHY6asAHJpbNqO-gBd6wkj_XQl83d_IkNYQ7u3-LXmVpYm36uqKeKVzyYT5Lg7Yb2n5d3q4BDy_RZrlv9xj-PpJsBzlnyutm9UxAhPQMJbqFBjm3SjZTWLseD5BAImx9atjF5sU5A_sFcAjfIgl2Qme-oJoFUBsWOAW8__y_s8ygo2WmbNFpRw"
          />
        </div>
        <div className="relative z-10 text-center max-w-4xl px-8 mx-auto flex flex-col items-center">
          <p className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-[0.2em] mb-6 border-b border-slate-300/50 pb-2 inline-block font-semibold">
            Calibrated Precision
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-display font-light tracking-tight text-brand-primary mb-8 px-4 leading-[1.1]">
            LUMINA: THE <br className="hidden sm:block" /> ARCHITECTURE OF SIGHT
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto mb-12 font-light px-4">
            Engineered from aerospace-grade titanium and precision optics. Not
            just eyewear, but an instrument for vision.
          </p>
          <Link
            to="/virtual-studio"
            className="text-[10px] sm:text-xs border border-brand-primary px-8 py-4 uppercase tracking-widest text-brand-primary hover:bg-brand-primary hover:text-white transition-all duration-500 bg-white/50 backdrop-blur-md font-medium flex items-center gap-3 group"
          >
            Virtual Try-On
            <MoveRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
          </Link>
        </div>
      </section>

      {/* Technical Deconstruction */}
      <section className="py-24 sm:py-32 bg-white relative border-t border-slate-200/50">
        <div className="max-w-[1440px] mx-auto px-8 lg:px-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24 items-center">
            <div className="lg:col-span-4 flex flex-col gap-8 order-2 lg:order-1">
              <div className="pb-6 border-b border-slate-200/50">
                <h2 className="text-3xl sm:text-4xl font-display text-brand-primary mb-4 font-light tracking-tight">
                  Structural Integrity
                </h2>
                <p className="text-slate-600 font-light leading-relaxed">
                  Each frame is milled from a single block of Grade 5 Titanium,
                  ensuring a strength-to-weight ratio unmatched in traditional
                  optical manufacturing.
                </p>
              </div>
              <ul className="flex flex-col gap-8">
                <li className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded border border-slate-200 flex items-center justify-center shrink-0 mt-1">
                    <span className="text-brand-primary text-xs font-mono font-bold">01</span>
                  </div>
                  <div>
                    <h3 className="text-xs uppercase text-brand-primary mb-2 tracking-widest font-bold">
                      Micro-Hinges
                    </h3>
                    <p className="text-slate-500 text-sm font-light">
                      Frictionless, screwless articulation built to withstand 100,000 cycles without tolerance degradation.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded border border-slate-200 flex items-center justify-center shrink-0 mt-1">
                    <span className="text-brand-primary text-xs font-mono font-bold">02</span>
                  </div>
                  <div>
                    <h3 className="text-xs uppercase text-brand-primary mb-2 tracking-widest font-bold">
                      Ultralight Chassis
                    </h3>
                    <p className="text-slate-500 text-sm font-light">
                      Weighing under 14 grams total, providing an imperceptible fit for extended endurance.
                    </p>
                  </div>
                </li>
              </ul>
            </div>
            
            <div className="lg:col-span-8 relative min-h-[400px] sm:min-h-[600px] bg-slate-50 rounded-xl border border-slate-200/50 overflow-hidden group order-1 lg:order-2">
              <img
                className="w-full h-full object-cover mix-blend-multiply opacity-80"
                alt="Minimalist titanium wireframe glasses"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuB5PNc7Uu61y6GSyVZ9LgDxCAUnNCMlrFL57NtjWtDMd02mY5WOmi_6ob7FtTxa74Rq_DaFKNX7ZkXNvRBJlTzcRov4cu-FNkHNPEGokk8I_t3E4-BWU2EyP-rnHyyXXpA1yh59ugBSHeaHIipxZov6cQKFOyfFU5Xa-2aGX135sP9WMiNxMKH9peDMNYfA0M9VWyLCH-NYPQccjKNnyoeMuvVkzqbOHFjipueWNwTZ50Br0owb9VrepxqWIT2WKT5MXQjrYCIn3Q"
              />
              {/* Annotations */}
              <div className="absolute top-[25%] left-[20%] sm:left-[30%] flex items-center gap-2">
                <div className="w-2 h-2 rounded-full border-2 border-brand-primary bg-white"></div>
                <div className="w-8 sm:w-16 h-[1px] bg-brand-primary/50"></div>
                <span className="text-[9px] sm:text-[10px] text-brand-primary uppercase bg-white/80 px-2 py-1 backdrop-blur-sm border border-brand-primary/20 tracking-widest font-semibold">
                  Titanium Rim
                </span>
              </div>
              <div className="absolute bottom-[35%] right-[15%] sm:right-[25%] flex items-center gap-2">
                <span className="text-[9px] sm:text-[10px] text-brand-primary uppercase bg-white/80 px-2 py-1 backdrop-blur-sm border border-brand-primary/20 tracking-widest font-semibold">
                  Aero Pad
                </span>
                <div className="w-8 sm:w-16 h-[1px] bg-brand-primary/50"></div>
                <div className="w-2 h-2 rounded-full border-2 border-brand-primary bg-white"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Optics Section */}
      <section className="py-24 sm:py-32 bg-[#0A1121] text-white relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0A1121] to-brand-primary opacity-90 z-10"></div>
          <img
            className="w-full h-full object-cover z-0 opacity-40 mix-blend-screen"
            alt="Optical glass prisms"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAZ2Q6yFw45bUXMEMyOMUAuzu9UTUXP7VQ_8QGoZxEDpJ9JAmyg3NEfeVUNgQ0xye9aVeuAYCUn-XaKvMwMgrkKqk4F9_XVKTETwmU96j-t2Nq-NCAPWAOVHNvd3pSc6fsrMWSXstJSD1VsZCVOe_rHVLqkrp5VlRDFdzLxfwZUINcmCo_KE__4oOjad0a1oDDKCaDmXXwkSj-EPsQIPwJiwvSQiVUCSkx52f_Dhm4flQL58hMnCV9mL-zlYRGN0jEsMlR1Xe7KLg"
          />
        </div>
        <div className="max-w-[1440px] mx-auto px-8 lg:px-16 relative z-20">
          <div className="text-center mb-16 sm:mb-24">
            <p className="text-[10px] sm:text-xs text-brand-cyan uppercase tracking-[0.2em] mb-4 font-semibold">
              Optical Purity
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-light text-white tracking-tight">
              CALIBRATED REFRACTION
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="bg-white/5 border border-white/10 p-8 xl:p-10 backdrop-blur-xl hover:bg-white/10 transition-colors duration-500 rounded-lg">
              <div className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center mb-8 bg-white/5">
                <div className="w-4 h-4 bg-white rounded-full opacity-80"></div>
              </div>
              <h3 className="text-xl md:text-2xl font-display text-white mb-4 tracking-tight">CR-39 Resin</h3>
              <p className="text-sm text-slate-300 font-light leading-relaxed mb-8">
                Optical grade polymer offering superior clarity with half the weight of traditional glass lenses. Perfectly balances durability and optics.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-[9px] border border-white/20 px-3 py-1.5 rounded uppercase tracking-widest text-slate-300">UV400</span>
                <span className="text-[9px] border border-white/20 px-3 py-1.5 rounded uppercase tracking-widest text-slate-300">Anti-Reflective</span>
              </div>
            </div>
            
            {/* Card 2 */}
            <div className="bg-white/5 border border-white/10 p-8 xl:p-10 backdrop-blur-xl hover:bg-white/10 transition-colors duration-500 rounded-lg">
              <div className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center mb-8 bg-white/5 relative">
                <div className="w-4 h-4 border border-brand-cyan rounded-sm rotate-45"></div>
                <div className="absolute w-6 h-[1px] bg-brand-cyan/50"></div>
                <div className="absolute h-6 w-[1px] bg-brand-cyan/50"></div>
              </div>
              <h3 className="text-xl md:text-2xl font-display text-white mb-4 tracking-tight">Chromatic Control</h3>
              <p className="text-sm text-slate-300 font-light leading-relaxed mb-8">
                Proprietary tinting process filters specific wavelengths to enhance contrast and reduce ocular fatigue in high-glare environments.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-[9px] border border-white/20 px-3 py-1.5 rounded uppercase tracking-widest text-slate-300">Polarized</span>
                <span className="text-[9px] border border-white/20 px-3 py-1.5 rounded uppercase tracking-widest text-slate-300">HEV Blocking</span>
              </div>
            </div>
            
            {/* Card 3 */}
            <div className="bg-white/5 border border-white/10 p-8 xl:p-10 backdrop-blur-xl hover:bg-white/10 transition-colors duration-500 rounded-lg">
              <div className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center mb-8 bg-white/5">
                <div className="w-5 h-5 border border-white/40 rotate-45 backdrop-blur-sm bg-white/10"></div>
              </div>
              <h3 className="text-xl md:text-2xl font-display text-white mb-4 tracking-tight">Oleophobic Shield</h3>
              <p className="text-sm text-slate-300 font-light leading-relaxed mb-8">
                Nano-coating repels moisture and lipids, ensuring an unobstructed visual field in all environments and simplifying maintenance.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-[9px] border border-white/20 px-3 py-1.5 rounded uppercase tracking-widest text-slate-300">Scratch Resistant</span>
                <span className="text-[9px] border border-white/20 px-3 py-1.5 rounded uppercase tracking-widest text-slate-300">Hydrophobic</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 sm:py-32 bg-[#050B16] text-white relative">
        <div className="max-w-4xl mx-auto px-8 text-center flex flex-col items-center">
          <h2 className="text-4xl md:text-6xl font-display font-light text-white mb-8 tracking-tight">
            EXPERIENCE THE FIT
          </h2>
          <p className="text-base sm:text-lg text-slate-400 mb-12 max-w-xl mx-auto font-light">
            Utilize our advanced facial mapping technology to accurately preview the Lumina Collection from your device in real-time.
          </p>
          <Link
            to="/virtual-studio"
            className="text-[10px] sm:text-xs border border-white/30 px-10 py-5 uppercase tracking-widest text-white hover:bg-white hover:text-brand-primary transition-all duration-500 font-semibold flex items-center gap-4 group"
          >
            Start Virtual Studio
            <div className="w-5 h-5 flex items-center justify-center rounded-full border border-current group-hover:bg-brand-primary group-hover:text-white transition-colors">
              <span className="block w-1.5 h-1.5 bg-current rounded-full"></span>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
