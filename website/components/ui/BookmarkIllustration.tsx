'use client';
import { useId } from 'react';

/**
 * "The Bookmark" — hand-drawn hero illustration. A naive white-pencil bookmark
 * waits while pages of thoughts ("notes", "plans", "ideas") sketch themselves
 * into a stack around it, then it seats down to hold the place: Aether keeps
 * your place so you can continue.
 *
 * Self-contained deterministic SVG + CSS loop (20s), no dependencies.
 * Under prefers-reduced-motion it renders the completed static drawing.
 * Not yet mounted anywhere — built for later hero integration.
 */
export function BookmarkIllustration({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const roughId = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 640 480"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="A hand-drawn bookmark resting between pages of notes"
      className={`aether-bookmark ${className ?? ''}`}
      style={style}
    >
      <title>A hand-drawn bookmark resting between pages of notes</title>
      <style>{`
        .aether-bookmark .abk-w0 path, .aether-bookmark .abk-w1 path, .aether-bookmark .abk-w2 path,
        .aether-bookmark .abk-ol {
          stroke-dasharray: 1;
          stroke-dashoffset: 0;
        }
        .aether-bookmark .abk-lift, .aether-bookmark .abk-thread,
        .aether-bookmark .abk-pgA, .aether-bookmark .abk-pgB, .aether-bookmark .abk-pgC {
          transform-box: fill-box;
        }
        .aether-bookmark .abk-lift { transform-origin: 50% 75%; animation: abkLift 20s cubic-bezier(0.45, 0.05, 0.3, 0.95) infinite; }
        .aether-bookmark .abk-thread { transform-origin: 15% 0%; animation: abkThread 20s ease-in-out infinite; }
        .aether-bookmark .abk-pgA { animation: abkPgA 20s ease-in-out infinite; }
        .aether-bookmark .abk-pgB { animation: abkPgB 20s ease-in-out infinite; }
        .aether-bookmark .abk-pgC { animation: abkPgC 20s ease-in-out infinite; }
        .aether-bookmark .abk-olA { animation: abkOlA 20s ease-in-out infinite; }
        .aether-bookmark .abk-olB { animation: abkOlB 20s ease-in-out infinite; }
        .aether-bookmark .abk-olC { animation: abkOlC 20s ease-in-out infinite; }
        .aether-bookmark .abk-inkA { animation: abkInkA 20s ease infinite; }
        .aether-bookmark .abk-w0 path { animation: abkW0 20s ease infinite; }
        .aether-bookmark .abk-w1 path { animation: abkW1 20s ease infinite; }
        .aether-bookmark .abk-w2 path { animation: abkW2 20s ease infinite; }
        .aether-bookmark .abk-w0 path:nth-child(2) { animation-delay: -19.87s; }
        .aether-bookmark .abk-w0 path:nth-child(3) { animation-delay: -19.74s; }
        .aether-bookmark .abk-w0 path:nth-child(4) { animation-delay: -19.61s; }
        .aether-bookmark .abk-w0 path:nth-child(5) { animation-delay: -19.48s; }
        .aether-bookmark .abk-w0 path:nth-child(6) { animation-delay: -19.35s; }
        .aether-bookmark .abk-w0 path:nth-child(7) { animation-delay: -19.22s; }
        .aether-bookmark .abk-w1 path:nth-child(2) { animation-delay: -19.87s; }
        .aether-bookmark .abk-w1 path:nth-child(3) { animation-delay: -19.74s; }
        .aether-bookmark .abk-w1 path:nth-child(4) { animation-delay: -19.61s; }
        .aether-bookmark .abk-w1 path:nth-child(5) { animation-delay: -19.48s; }
        .aether-bookmark .abk-w1 path:nth-child(6) { animation-delay: -19.35s; }
        .aether-bookmark .abk-w1 path:nth-child(7) { animation-delay: -19.22s; }
        .aether-bookmark .abk-w1 path:nth-child(8) { animation-delay: -19.09s; }
        .aether-bookmark .abk-w2 path:nth-child(2) { animation-delay: -19.87s; }
        .aether-bookmark .abk-w2 path:nth-child(3) { animation-delay: -19.74s; }
        .aether-bookmark .abk-w2 path:nth-child(4) { animation-delay: -19.61s; }
        .aether-bookmark .abk-w2 path:nth-child(5) { animation-delay: -19.48s; }
        .aether-bookmark .abk-w2 path:nth-child(6) { animation-delay: -19.35s; }
        .aether-bookmark .abk-w2 path:nth-child(7) { animation-delay: -19.22s; }
        .aether-bookmark .abk-w2 path:nth-child(8) { animation-delay: -19.09s; }
        /* notes label: writes once its sheet has risen; fades as the sheet recedes */
        @keyframes abkW0 {
          0%, 12% { stroke-dashoffset: 1; opacity: 1; }
          17% { stroke-dashoffset: 0; opacity: 1; }
          86% { stroke-dashoffset: 0; opacity: 1; }
          91% { stroke-dashoffset: 0; opacity: 0; }
          95% { stroke-dashoffset: 1; opacity: 0; }
          100% { stroke-dashoffset: 1; opacity: 1; }
        }
        /* plans label: writes after its sheet slips in; the sheet's own fade handles the exit */
        @keyframes abkW2 {
          0%, 24.4% { stroke-dashoffset: 1; }
          30% { stroke-dashoffset: 0; }
          86% { stroke-dashoffset: 0; }
          94%, 100% { stroke-dashoffset: 1; }
        }
        /* ideas label: last to write */
        @keyframes abkW1 {
          0%, 36.4% { stroke-dashoffset: 1; }
          41% { stroke-dashoffset: 0; }
          80% { stroke-dashoffset: 0; }
          88%, 100% { stroke-dashoffset: 1; }
        }
        /* bookmark: hovers alone, reacts to each arrival, then seats down into the stack */
        @keyframes abkLift {
          0%, 8% { transform: translateY(-7px) rotate(-1.1deg); }
          12% { transform: translateY(-7.6px) rotate(-0.6deg); }
          20% { transform: translateY(-7px) rotate(-1.1deg); }
          25% { transform: translateY(-7.5px) rotate(-1.5deg); }
          33%, 40% { transform: translateY(-7px) rotate(-1.1deg); }
          46% { transform: translateY(0.9px) rotate(0.15deg); }
          50%, 88% { transform: translateY(0) rotate(0deg); }
          96%, 100% { transform: translateY(-7px) rotate(-1.1deg); }
        }
        @keyframes abkThread {
          0%, 9% { transform: rotate(0deg); }
          13% { transform: rotate(2.6deg); }
          18% { transform: rotate(0.4deg); }
          24% { transform: rotate(-2deg); }
          29% { transform: rotate(0.3deg); }
          35% { transform: rotate(1.8deg); }
          40% { transform: rotate(0deg); }
          45% { transform: rotate(-3deg); }
          52% { transform: rotate(0.6deg); }
          57%, 86% { transform: rotate(0deg); }
          92% { transform: rotate(2.2deg); }
          98%, 100% { transform: rotate(0deg); }
        }
        /* notes sheet: rises into place first, nudged by later arrivals, recedes last */
        @keyframes abkPgA {
          0%, 4% { transform: translate(0, 26px) rotate(-1.5deg); }
          12% { transform: translate(0, -1.2px) rotate(0.25deg); }
          15% { transform: translate(0, 0) rotate(0deg); }
          23% { transform: translate(1.8px, 0.5px) rotate(0.18deg); }
          28% { transform: translate(0, 0) rotate(0deg); }
          35% { transform: translate(-1.3px, 0.4px) rotate(-0.12deg); }
          39% { transform: translate(0, 0) rotate(0deg); }
          46% { transform: translate(0, 1px) rotate(0deg); }
          50%, 86% { transform: translate(0, 0) rotate(0deg); }
          96%, 100% { transform: translate(0, 26px) rotate(-1.5deg); }
        }
        /* plans sheet: slips in behind second, recedes second */
        @keyframes abkPgB {
          0%, 15% { transform: translate(-26px, 20px) rotate(-2deg); opacity: 0; }
          18% { opacity: 1; }
          24% { transform: translate(0, 0) rotate(0deg); }
          35% { transform: translate(-1px, 0.3px) rotate(-0.08deg); }
          39% { transform: translate(0, 0) rotate(0deg); }
          46% { transform: translate(0, 0.7px) rotate(0deg); }
          50%, 77% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          85%, 100% { transform: translate(-26px, 20px) rotate(-2deg); opacity: 0; }
        }
        /* ideas sheet: joins last, recedes first */
        @keyframes abkPgC {
          0%, 27% { transform: translate(22px, 22px) rotate(1.8deg); opacity: 0; }
          30% { opacity: 1; }
          36% { transform: translate(0, 0) rotate(0deg); }
          46% { transform: translate(0, 0.5px) rotate(0deg); }
          50%, 69% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          77%, 100% { transform: translate(22px, 22px) rotate(1.8deg); opacity: 0; }
        }
        /* sheet outlines sketch themselves in as each page arrives */
        @keyframes abkOlA {
          0%, 4% { stroke-dashoffset: 0.55; fill-opacity: 0.5; }
          13% { stroke-dashoffset: 0; fill-opacity: 1; }
          86% { stroke-dashoffset: 0; fill-opacity: 1; }
          96%, 100% { stroke-dashoffset: 0.55; fill-opacity: 0.5; }
        }
        @keyframes abkOlB {
          0%, 15% { stroke-dashoffset: 1; fill-opacity: 0; }
          25% { stroke-dashoffset: 0; fill-opacity: 1; }
          84% { stroke-dashoffset: 0; fill-opacity: 1; }
          90%, 100% { stroke-dashoffset: 1; fill-opacity: 0; }
        }
        @keyframes abkOlC {
          0%, 27% { stroke-dashoffset: 1; fill-opacity: 0; }
          37% { stroke-dashoffset: 0; fill-opacity: 1; }
          76% { stroke-dashoffset: 0; fill-opacity: 1; }
          82%, 100% { stroke-dashoffset: 1; fill-opacity: 0; }
        }
        /* front-sheet scribbles and corner ticks arrive with the notes sheet */
        @keyframes abkInkA {
          0%, 13% { opacity: 0; }
          17.5% { opacity: 1; }
          86% { opacity: 1; }
          91%, 100% { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .aether-bookmark * { animation: none !important; }
        }
      `}</style>
      <defs>
        <filter id={roughId} x="-4%" y="-4%" width="108%" height="108%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves={2} seed={7} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={2.2} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>

      <g filter={`url(#${roughId})`} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <g transform="translate(325 285) scale(1.16) translate(-325 -285)">
          {/* ground hatch shadow */}
          <g stroke="#34312d" strokeWidth={3.5} opacity={0.9}>
            <path d="M 276,430 l 28,-8.5" />
            <path d="M 310,432 l 28,-8.5" />
            <path d="M 344,434 l 28,-8.5" />
            <path d="M 378,434.5 l 28,-8.5" />
            <path d="M 410,433 l 26,-8" />
          </g>

          {/* sheet C (back) — "ideas" */}
          <g transform="rotate(2.2 327 268)">
            <g className="abk-pgC">
              <path
                pathLength={1} className="abk-ol abk-olC"
                d="M 228,155 Q 280,150.5 330,152.2 Q 382,153.5 427,151.8 Q 430.5,210 429,268 Q 428,326 430.6,381 Q 380,384.5 328,383.4 Q 276,382.5 230.5,384.6 Q 226.5,326 228.2,268 Q 229.5,212 228,155 Z"
                fill="#1f1d1b" stroke="#b9b4ab" strokeWidth={2.1}
              />
              <g className="abk-w1" transform="translate(252,173) scale(1.05) rotate(-1.2)" stroke="#ded9cf" strokeWidth={2}>
                <path pathLength={1} d="M 1.2,-9.5 Q 1.9,-4.5 1.5,0" />
                <path pathLength={1} d="M 1.5,-13.6 l 0.12,0.12" />
                <path pathLength={1} d="M 11.5,-8.6 Q 7.2,-9.3 6.4,-5.2 Q 5.8,-1 9.6,-0.3 Q 12.4,0.1 12.3,-3.4" />
                <path pathLength={1} d="M 12.8,-16.5 Q 12.3,-8 12.5,0.3" />
                <path pathLength={1} d="M 16,-4.8 Q 20.6,-5.4 20.3,-7.4 Q 19.9,-9.4 17.6,-8.7 Q 15.2,-7.8 15.5,-4.4 Q 15.8,-0.8 18.9,-0.6 Q 20.9,-0.6 21.9,-1.8" />
                <path pathLength={1} d="M 28.6,-8.3 Q 24.6,-9 24,-4.9 Q 23.5,-0.9 27.2,-0.5 Q 29.6,-0.3 29.5,-4.6" />
                <path pathLength={1} d="M 29.4,-8.8 Q 29.3,-4 30,0.2" />
                <path pathLength={1} d="M 37.8,-8.2 Q 34.4,-9 34.2,-6.8 Q 34,-4.9 36.4,-4.4 Q 38.9,-3.9 38.6,-1.9 Q 38.3,0.2 34.8,-0.5" />
              </g>
            </g>
          </g>

          {/* sheet B (middle) — "plans" */}
          <g transform="rotate(-1.6 314 289)">
            <g className="abk-pgB">
              <path
                pathLength={1} className="abk-ol abk-olB"
                d="M 211,183 Q 262,178.6 314,180.4 Q 367,182 417,180 Q 420.4,236 419,290 Q 418,345 420.8,396.5 Q 368,399.8 316,398.2 Q 263,397 213.6,399.4 Q 209.4,344 211.6,290 Q 213,234 211,183 Z"
                fill="#201e1c" stroke="#d0cbc2" strokeWidth={2.3}
              />
              <g className="abk-w2" transform="translate(256,197) scale(1.05) rotate(1)" stroke="#ded9cf" strokeWidth={2}>
                <path pathLength={1} d="M 1.3,-8.8 Q 1.9,-2 1.6,5.6" />
                <path pathLength={1} d="M 1.7,-7.4 Q 5.9,-9.5 6.7,-5.5 Q 7.3,-1.9 3.3,-1.5 Q 2.3,-1.4 1.8,-2" />
                <path pathLength={1} d="M 11.9,-15.8 Q 11.3,-7.5 12,0.2" />
                <path pathLength={1} d="M 20.2,-8.2 Q 16.2,-8.9 15.7,-4.8 Q 15.3,-0.8 18.9,-0.4 Q 21.2,-0.2 21.1,-4.5" />
                <path pathLength={1} d="M 21,-8.7 Q 20.9,-3.9 21.6,0.3" />
                <path pathLength={1} d="M 26.1,-8.9 Q 26.6,-4 26.3,0.1" />
                <path pathLength={1} d="M 26.4,-6.4 Q 28.5,-9.6 30.5,-8 Q 31.9,-6.7 31.7,-3.2 Q 31.6,-1.2 31.9,0.2" />
                <path pathLength={1} d="M 39.4,-8.1 Q 36,-8.9 35.8,-6.7 Q 35.6,-4.8 38,-4.3 Q 40.5,-3.8 40.2,-1.8 Q 39.9,0.3 36.4,-0.4" />
              </g>
            </g>
          </g>

          {/* bookmark, inserted between sheet B and sheet A */}
          <g transform="translate(371 212) rotate(-5)">
            <g className="abk-lift">
              <path
                d="M -29.4,68 Q -31.2,10 -30,-46 Q -29.4,-82 -30.8,-104 Q -29.9,-122.5 -9,-126.6 Q 0,-128.2 9.5,-126.4 Q 29.8,-122.6 30.4,-103.5 Q 29.2,-80 30.2,-46 Q 31.4,8 29.6,68"
                fill="#1c1a18" stroke="#ece8df" strokeWidth={3}
              />
              <path
                d="M -21.4,60 Q -22.8,6 -21.8,-44 Q -21.2,-78 -22,-98 Q -21.4,-113.5 -7,-116.8 Q 0,-118 7.5,-116.6 Q 21.6,-113.4 21.9,-97.5 Q 21,-76 21.7,-42 Q 22.6,8 21.2,60"
                stroke="#b5b0a7" strokeWidth={1.7} strokeDasharray="6.5 5.5" opacity={0.85}
              />
              <path d="M -0.5,-110.2 Q 3.9,-110 4,-106.2 Q 4.1,-102.4 0.2,-102.2 Q -4,-102 -4.1,-106 Q -4.2,-109.8 -0.5,-110.2" stroke="#ece8df" strokeWidth={2.2} />
              <g className="abk-thread">
                <path d="M 3.5,-104.5 Q 14,-99 15.5,-86 Q 16,-75 9.5,-70.5" stroke="#cfcac1" strokeWidth={2} opacity={0.95} />
              </g>
              {/* pencil re-strokes */}
              <path d="M -31.8,-20 Q -32.6,-56 -31.6,-88" stroke="#ece8df" strokeWidth={2} opacity={0.3} />
              <path d="M -23,-120.5 Q -9,-126.8 7,-125.6" stroke="#ece8df" strokeWidth={2} opacity={0.3} />
            </g>
          </g>

          {/* sheet A (front) — "notes" and quiet scribbles */}
          <g transform="rotate(0.9 328 311)">
            <g className="abk-pgA">
              <path
                pathLength={1} className="abk-ol abk-olA"
                d="M 219,211 Q 272,206.4 328,208.3 Q 383,210 433,208 Q 436.6,262 435.2,312 Q 434,364 436.4,412.5 Q 384,415.8 328,414 Q 272,412.4 221.8,415.2 Q 217.2,362 219.4,312 Q 221,258 219,211 Z"
                fill="#232120" stroke="#eae6de" strokeWidth={2.6}
              />
              {/* corner overshoot ticks */}
              <g className="abk-inkA">
                <path d="M 219,211.2 L 210.5,212.2" stroke="#eae6de" strokeWidth={2.4} opacity={0.9} />
                <path d="M 221.8,415.2 l -2,7" stroke="#eae6de" strokeWidth={2.2} opacity={0.85} />
              </g>
              <g className="abk-w0" transform="translate(255,246) scale(1.05) rotate(-0.8)" stroke="#c7c2b8" strokeWidth={2}>
                <path pathLength={1} d="M 1,-8.8 Q 1.5,-4 1.2,0.1" />
                <path pathLength={1} d="M 1.3,-6.3 Q 3.4,-9.5 5.4,-7.9 Q 6.8,-6.6 6.6,-3.1 Q 6.5,-1.1 6.8,0.2" />
                <path pathLength={1} d="M 13.4,-8.7 Q 10,-8.9 9.8,-4.9 Q 9.6,-1 13,-0.7 Q 16.3,-0.5 16.2,-4.6 Q 16.1,-8.5 13.4,-8.7" />
                <path pathLength={1} d="M 21.2,-13.8 Q 20.8,-6.5 21.3,-0.4 Q 21.5,0.1 22.7,-0.6" />
                <path pathLength={1} d="M 18.6,-9.2 Q 21.2,-9.9 24.1,-9.4" />
                <path pathLength={1} d="M 27.9,-4.7 Q 32.5,-5.3 32.2,-7.3 Q 31.8,-9.3 29.5,-8.6 Q 27.1,-7.7 27.4,-4.3 Q 27.7,-0.7 30.8,-0.5 Q 32.8,-0.5 33.8,-1.7" />
                <path pathLength={1} d="M 41,-8.2 Q 37.6,-9 37.4,-6.8 Q 37.2,-4.9 39.6,-4.4 Q 42.1,-3.9 41.8,-1.9 Q 41.5,0.2 38,-0.5" />
              </g>
              <g className="abk-inkA">
                <g stroke="#6f6a64" strokeWidth={2} opacity={0.9}>
                  <path d="M 252,278 Q 300,275.8 344,277.4 Q 380,278.6 408,276.8" />
                  <path d="M 252,300 Q 296,297.9 340,299.5 Q 370,300.6 394,299" />
                  <path d="M 252,322 Q 282,320.2 310,321.6 Q 326,322.2 336,321" />
                </g>
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
