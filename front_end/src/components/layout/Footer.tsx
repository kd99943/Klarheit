export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white px-5 py-4 sm:px-8 lg:px-12 flex flex-col gap-3 md:h-12 md:flex-row md:items-center md:justify-between text-[9px] uppercase tracking-[0.2em] text-slate-400 font-medium shrink-0">
      <span>© 2024 Klarheit. Geneva, CH.</span>
      <div className="flex flex-wrap gap-4 md:gap-8">
        <span>Compliance: ISO 12870</span>
        <span>Status: Calibrated</span>
      </div>
    </footer>
  );
}
