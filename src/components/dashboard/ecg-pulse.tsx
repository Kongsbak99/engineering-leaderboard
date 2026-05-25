/**
 * A medical-monitor style ECG line that scrolls infinitely from right to
 * left. The trick: we render two identical cycles of the waveform inside
 * an SVG that's twice as wide as the visible window, then CSS-animate it
 * by exactly one cycle width — so when the animation loops back to 0, the
 * pixels on screen are identical to the previous frame.
 *
 * Server-component safe: no hooks, no state, no client boundary required.
 */

// One full ECG cycle (P / QRS complex / T) inside a 60-unit-wide,
// 24-unit-tall box. Baseline sits at y=12.
function ecgCycle(offsetX: number): string {
  const x = (n: number) => (offsetX + n).toFixed(1);
  return [
    `M ${x(0)} 12`,
    `L ${x(16)} 12`, // baseline
    `L ${x(19)} 10`, // P wave up
    `L ${x(22)} 12`, // P wave down
    `L ${x(26)} 12`, // flat
    `L ${x(28)} 13.5`, // Q wave dip
    `L ${x(30)} 4`, // R wave spike up
    `L ${x(32)} 19`, // S wave dip down
    `L ${x(35)} 12`, // back to baseline
    `L ${x(40)} 10.2`, // T wave up
    `L ${x(43)} 12`, // T wave end
    `L ${x(60)} 12`, // flat to end of cycle
  ].join(" ");
}

// Three cycles wide so the visible window stays fully covered even at the
// midpoint of the scroll. Animating by exactly one cycle width keeps the
// loop pixel-identical: the second cycle slides into the first cycle's
// position at the moment we reset.
const PATH = `${ecgCycle(0)} ${ecgCycle(60)} ${ecgCycle(120)}`;

export function ECGPulse({ className }: { className?: string }) {
  // `inline-block` (not inline-flex) is critical: it stops the inner SVG
  // from being flex-shrunk to the container's width. The SVG's intrinsic
  // 180px width must be preserved so the path renders at the same scale
  // its translate animation is calibrated against — otherwise the loop
  // desyncs and we get the "empty tail" effect on each cycle.
  return (
    <span
      aria-hidden="true"
      className={`ecg-window relative inline-block overflow-hidden align-middle ${className ?? ""}`}
    >
      <svg
        width={180}
        height={24}
        viewBox="0 0 180 24"
        fill="none"
        className="ecg-track block max-w-none"
      >
        <path
          d={PATH}
          stroke="#8aa2ff"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {/* Soft "phosphor" trailing fade on the right edge so the waveform
          appears to emerge from a glowing leading edge, like a CRT
          medical monitor. */}
      <span className="ecg-leader pointer-events-none absolute inset-y-0 right-0 w-4" />
    </span>
  );
}
