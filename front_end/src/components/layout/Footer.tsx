export function Footer() {
  return (
    <footer className="h-12 border-t border-slate-200 bg-white px-8 lg:px-12 flex items-center justify-between text-[9px] uppercase tracking-[0.2em] text-slate-400 font-medium shrink-0">
      <span>© 2024 Lumina Optics Ltd. Geneva, CH.</span>
      <div className="hidden md:flex gap-8">
        <span>Compliance: ISO 12870</span>
        <span>Status: Calibrated</span>
      </div>
    </footer>
  );
}
