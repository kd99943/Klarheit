import { cn } from "../../lib/utils";

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
}

export function GlassPanel({ children, className }: GlassPanelProps) {
  return (
    <div
      className={cn(
        "bg-[#050B16]/60 backdrop-blur-3xl border border-white/10 rounded-xl shadow-[0_40px_80px_rgba(0,0,0,0.6)]",
        className
      )}
    >
      {children}
    </div>
  );
}
