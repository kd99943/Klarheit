interface FaceCalibrationGuideProps {
  status: string;
  className?: string;
}

/**
 * Soft face oval guide shown while camera is live but face isn't locked.
 * Reduces "where do I put my face" friction on first open.
 */
export function FaceCalibrationGuide({ status, className }: FaceCalibrationGuideProps) {
  if (status === "tracking") return null;

  const isDenied =
    status === "permission-denied" || status === "unsupported" || status === "error";

  return (
    <div
      className={
        className ??
        "absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
      }
      data-testid="face-calibration-guide"
    >
      <div className="relative w-[min(42vw,280px)] aspect-[3/4]">
        <svg
          viewBox="0 0 200 260"
          className="w-full h-full"
          fill="none"
          aria-hidden="true"
        >
          {/* Face oval */}
          <ellipse
            cx="100"
            cy="125"
            rx="78"
            ry="100"
            stroke={isDenied ? "#94a3b8" : "#38bdf8"}
            strokeWidth="2"
            strokeDasharray="8 6"
            opacity="0.85"
          />
          {/* Eye line hint */}
          <line
            x1="48"
            y1="105"
            x2="152"
            y2="105"
            stroke={isDenied ? "#cbd5e1" : "#7dd3fc"}
            strokeWidth="1"
            opacity="0.5"
          />
          {/* Nose center tick */}
          <line
            x1="100"
            y1="100"
            x2="100"
            y2="150"
            stroke={isDenied ? "#cbd5e1" : "#7dd3fc"}
            strokeWidth="1"
            opacity="0.35"
          />
        </svg>
        {!isDenied && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-[-2rem] whitespace-nowrap text-[10px] uppercase tracking-widest font-bold text-white/90 bg-slate-900/70 px-3 py-1.5 rounded-full backdrop-blur">
            {status === "initializing"
              ? "准备中…"
              : status === "no-face"
                ? "将面部对准虚线框"
                : "请保持稳定"}
          </div>
        )}
      </div>
    </div>
  );
}
