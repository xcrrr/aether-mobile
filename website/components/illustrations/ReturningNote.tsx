'use client';
import { useEffect, useId, useRef, useState } from 'react';

/**
 * "The Returning Note" — a hand-drawn companion piece to the hero bookmark.
 *
 * Two overlapping sheets of paper, a bookmark slip tucked between them, a small
 * note that slides in and tucks itself under the front sheet, and three quiet
 * response lines that write themselves onto the front sheet. A thought stays
 * close, becomes useful, and returns. No system, no diagram.
 *
 * Self-contained deterministic SVG + one CSS timeline (7s, plays once), no
 * dependencies. Every element is authored in its FINAL, settled state as the
 * plain SVG default; the timeline only runs once the `.rn-run` class is added
 * by a native IntersectionObserver on first viewport entry (threshold 0.35,
 * disconnected immediately after). Under prefers-reduced-motion the CSS media
 * override freezes every animation, so the drawing always renders as a
 * genuine completed frame — never a paused mid-motion frame.
 */
export function ReturningNote({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  const rawId = useId().replace(/:/g, '');
  const roughId = `rnRough${rawId}`;
  const px = size === 'lg' ? 300 : 140;

  const [run, setRun] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el || run) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRun(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rootClass = `rn rn-${rawId}${run ? ' rn-run' : ''}`;

  return (
    <div style={{ width: px, height: px, aspectRatio: '1 / 1', flex: '0 0 auto' }}>
      <svg
        ref={svgRef}
        viewBox="0 0 240 240"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className={rootClass}
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        <style>{`
          .rn-${rawId} .rn-bookmark, .rn-${rawId} .rn-note {
            transform-box: fill-box;
          }
          .rn-${rawId} .rn-bookmark { transform-origin: 50% 88%; }
          .rn-${rawId} .rn-note { transform-origin: 50% 50%; }
          .rn-${rawId} .rn-breath { transform-box: view-box; transform-origin: 120px 130px; }

          .rn-${rawId} .rn-back, .rn-${rawId} .rn-front, .rn-${rawId} .rn-bookmark-outline,
          .rn-${rawId} .rn-line1, .rn-${rawId} .rn-line2, .rn-${rawId} .rn-line3 {
            stroke-dasharray: 1;
            stroke-dashoffset: 0;
          }

          .rn-${rawId}.rn-run .rn-hatch { animation: rnHatch${rawId} 7s ease both; }
          .rn-${rawId}.rn-run .rn-back { animation: rnBackDraw${rawId} 7s ease both, rnBackFill${rawId} 7s ease both; }
          .rn-${rawId}.rn-run .rn-front { animation: rnFrontDraw${rawId} 7s ease both, rnFrontFill${rawId} 7s ease both; }
          .rn-${rawId}.rn-run .rn-corner-tick { animation: rnCornerTick${rawId} 7s ease both; }
          .rn-${rawId}.rn-run .rn-ghost-front { animation: rnGhostFront${rawId} 7s ease both; }

          .rn-${rawId}.rn-run .rn-bookmark {
            animation: rnBookmarkOpacity${rawId} 7s ease both, rnBookmarkTransform${rawId} 7s linear both;
          }
          .rn-${rawId}.rn-run .rn-bookmark-outline { animation: rnBookmarkDraw${rawId} 7s ease both; }
          .rn-${rawId}.rn-run .rn-bookmark-ghost { animation: rnBookmarkGhost${rawId} 7s ease both; }
          .rn-${rawId}.rn-run .rn-bookmark-eyelet { animation: rnBookmarkEyelet${rawId} 7s ease both; }

          .rn-${rawId}.rn-run .rn-note {
            animation: rnNoteOpacity${rawId} 7s ease both, rnNoteTransform${rawId} 7s linear both;
          }

          .rn-${rawId}.rn-run .rn-line1 { animation: rnLine1${rawId} 7s ease both; }
          .rn-${rawId}.rn-run .rn-line2 { animation: rnLine2${rawId} 7s ease both; }
          .rn-${rawId}.rn-run .rn-line3 { animation: rnLine3${rawId} 7s ease both; }

          .rn-${rawId}.rn-run .rn-breath { animation: rnBreath${rawId} 9s ease-in-out infinite; animation-delay: 5.2s; }

          @keyframes rnHatch${rawId} {
            0%, 12.857% { opacity: 0; }
            18.571%, 100% { opacity: 0.9; }
          }
          @keyframes rnBackDraw${rawId} {
            0% { stroke-dashoffset: 1; }
            15.714%, 100% { stroke-dashoffset: 0; }
          }
          @keyframes rnBackFill${rawId} {
            0%, 4.286% { fill-opacity: 0; }
            15.714%, 100% { fill-opacity: 1; }
          }
          @keyframes rnFrontDraw${rawId} {
            0%, 5% { stroke-dashoffset: 1; }
            20%, 100% { stroke-dashoffset: 0; }
          }
          @keyframes rnFrontFill${rawId} {
            0%, 8.571% { fill-opacity: 0; }
            20%, 100% { fill-opacity: 1; }
          }
          @keyframes rnCornerTick${rawId} {
            0%, 17.143% { opacity: 0; }
            21.429%, 100% { opacity: 0.85; }
          }
          @keyframes rnGhostFront${rawId} {
            0%, 17.143% { opacity: 0; }
            21.429%, 100% { opacity: 0.3; }
          }
          @keyframes rnBookmarkOpacity${rawId} {
            0%, 17.143% { opacity: 0; }
            21.429%, 100% { opacity: 1; }
          }
          @keyframes rnBookmarkDraw${rawId} {
            0%, 17.143% { stroke-dashoffset: 1; }
            28.571%, 100% { stroke-dashoffset: 0; }
          }
          @keyframes rnBookmarkGhost${rawId} {
            0%, 24.286% { opacity: 0; }
            32.857%, 100% { opacity: 0.85; }
          }
          @keyframes rnBookmarkEyelet${rawId} {
            0%, 24.286% { opacity: 0; }
            32.857%, 100% { opacity: 1; }
          }
          @keyframes rnBookmarkTransform${rawId} {
            0% { transform: translateY(-9px) rotate(-1.2deg); }
            18.571% { transform: translateY(-9px) rotate(-1.2deg); animation-timing-function: cubic-bezier(0.45, 0.05, 0.3, 0.95); }
            31.429% { transform: translateY(0) rotate(0deg); animation-timing-function: linear; }
            44.286% { transform: translateY(0) rotate(0deg); animation-timing-function: ease-in-out; }
            49.048% { transform: translateY(0) rotate(1.4deg); animation-timing-function: ease-in-out; }
            53.810% { transform: translateY(0) rotate(-0.3deg); animation-timing-function: ease-in-out; }
            58.571%, 100% { transform: translateY(0) rotate(0deg); }
          }
          @keyframes rnNoteOpacity${rawId} {
            0%, 28.571% { opacity: 0; }
            42.857%, 100% { opacity: 1; }
          }
          @keyframes rnNoteTransform${rawId} {
            0% { transform: translate(-16px, 10px) rotate(7deg); }
            28.571% { transform: translate(-16px, 10px) rotate(7deg); animation-timing-function: cubic-bezier(0.45, 0.05, 0.3, 0.95); }
            42.857%, 100% { transform: translate(0, 0) rotate(0deg); }
          }
          @keyframes rnLine1${rawId} {
            0%, 57.143% { stroke-dashoffset: 1; }
            63.571%, 100% { stroke-dashoffset: 0; }
          }
          @keyframes rnLine2${rawId} {
            0%, 62.143% { stroke-dashoffset: 1; }
            68.571%, 100% { stroke-dashoffset: 0; }
          }
          @keyframes rnLine3${rawId} {
            0%, 67.143% { stroke-dashoffset: 1; }
            73.571%, 100% { stroke-dashoffset: 0; }
          }
          @keyframes rnBreath${rawId} {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.0035); }
          }

          @media (prefers-reduced-motion: reduce) {
            .rn-${rawId} * { animation: none !important; }
          }
        `}</style>

        <defs>
          <filter id={roughId} x="-4%" y="-4%" width="108%" height="108%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves={2} seed={13} result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale={2.2} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>

        <rect x="0" y="0" width="240" height="240" fill="var(--bg)" />

        <g filter={`url(#${roughId})`} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <g className="rn-breath">
            {/* ground hatch */}
            <g className="rn-hatch" stroke="#34312d" strokeWidth={3} opacity={0.9}>
              <path d="M 79.3,213.7 l 21.6,-6.7" />
              <path d="M 112.4,214.6 l 22.3,-6.2" />
              <path d="M 146.1,213.3 l 21.4,-6.8" />
            </g>

            {/* back sheet */}
            <g transform="rotate(2.1 126 115)">
              <path
                className="rn-back"
                pathLength={1}
                d="M 69.4,61.2 Q 111.6,55.6 151.9,58.8 Q 169.3,58.2 181.7,57.3 Q 185.2,95.7 183.6,116.3 Q 181.8,147.4 185.3,169.7 Q 147.5,172.9 111.3,171.2 Q 87.5,169.8 70.8,173.5 Q 67.7,139.5 69.4,115.7 Q 71.1,87.3 69.4,61.2 Z"
                fill="#1f1d1b"
                stroke="#b9b4ab"
                strokeWidth={2.1}
              />
            </g>

            {/* bookmark slip, rises from behind the front sheet's top edge */}
            <g transform="translate(150 76.8) rotate(-4)">
              <g className="rn-bookmark">
                <path
                  className="rn-bookmark-outline"
                  pathLength={1}
                  d="M -10.6,46.4 Q -12.3,10.7 -11.4,-24.6 Q -11.7,-38.3 -9.8,-43.6 Q -6.5,-46.9 0.4,-46.3 Q 7.2,-46.8 9.9,-43.2 Q 11.5,-37.9 11.2,-24.1 Q 11.9,10.8 10.7,46.7 Q 5.1,48.1 0.3,47.3 Q -5,47.9 -10.6,46.4 Z"
                  fill="#1c1a18"
                  stroke="#ece8df"
                  strokeWidth={2.6}
                />
                <path
                  className="rn-bookmark-ghost"
                  d="M -8.7,42.7 Q -10.2,10.3 -9.5,-21.7 Q -9.7,-33.8 -8.2,-38.5 Q -5.4,-41.3 0.3,-41 Q 6,-41.4 8.2,-38.2 Q 9.5,-33.5 9.3,-21.3 Q 9.9,10.5 8.9,43 Q 4.4,44.2 0.2,43.5 Q -4.2,44 -8.7,42.7 Z"
                  stroke="#b5b0a7"
                  strokeWidth={1.6}
                  strokeDasharray="5.5 4.5"
                  opacity={0.85}
                />
                <path
                  className="rn-bookmark-eyelet"
                  d="M -1.4,-42.7 Q 2.9,-43 2.7,-39.3 Q 2.5,-35.8 -1.2,-36.4 Q -4.4,-36.8 -4,-40.2 Q -3.7,-43 -1.4,-42.7 Z"
                  stroke="#ece8df"
                  strokeWidth={2}
                />
              </g>
            </g>

            {/* note card, tucks under the front sheet's lower-left edge */}
            <g transform="rotate(3.1 48 198)">
              <g className="rn-note">
                <path
                  d="M 31.3,188.7 Q 47.9,185.2 64.8,187.5 Q 66,196.9 64.5,199.8 Q 66.3,205.4 63.9,209.7 Q 47.5,211.5 31.6,209.3 Q 29.7,199.5 31.1,196.2 Q 29.5,192.2 31.3,188.7 Z"
                  fill="#201e1c"
                  stroke="#d0cbc2"
                  strokeWidth={2}
                />
                <path
                  d="M 37.9,198.7 Q 44.1,196.3 50.2,198.9 Q 53.3,200.2 57.1,198.1"
                  stroke="#b5b0a7"
                  strokeWidth={1.6}
                  opacity={0.7}
                />
              </g>
            </g>

            {/* front sheet, painted over the note's leading edge and the bookmark's base */}
            <g transform="rotate(-1.4 106 150)">
              <path
                className="rn-front"
                pathLength={1}
                d="M 47.7,94.4 Q 87.6,89.6 106.4,91.7 Q 129.9,89.8 164.6,93.8 Q 168.1,133.1 165.7,150.9 Q 168.2,183.8 164.9,206.6 Q 128.5,210.1 106.2,208.1 Q 82.3,209.9 47.2,206.3 Q 44.5,183.3 46.3,150.7 Q 44.7,120.9 47.7,94.4 Z"
                fill="#232120"
                stroke="#eae6de"
                strokeWidth={2.4}
              />
              <path className="rn-corner-tick" d="M 47.7,94.4 L 40.1,95.9" stroke="#eae6de" strokeWidth={2.4} opacity={0.85} />
              <path
                className="rn-ghost-front"
                d="M 46.6,178.4 Q 45.2,155.8 46.4,132.6 Q 46.8,120.1 46.1,108.7"
                stroke="#ece8df"
                strokeWidth={1.8}
                opacity={0.3}
              />

              {/* response lines, written onto the front sheet */}
              <path className="rn-line1" pathLength={1} d="M 62.2,124.3 Q 84.1,122.5 104.3,123.9 Q 114.2,124.4 120.1,123.3" stroke="#c7c2b8" strokeWidth={2} />
              <path className="rn-line2" pathLength={1} d="M 62.1,137.2 Q 80.2,135.7 96.3,137.1 Q 104.2,137.5 109.1,136.5" stroke="#c7c2b8" strokeWidth={2} />
              <path className="rn-line3" pathLength={1} d="M 62.3,150.2 Q 74.2,148.8 85.1,150.1 Q 90.2,150.4 93.1,149.5" stroke="#c7c2b8" strokeWidth={2} />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
