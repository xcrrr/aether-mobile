function formatWh(wh: number): string {
  if (wh < 0.01) return `${(wh * 1000).toFixed(2)} mWh`;
  return `${wh.toFixed(3)} Wh`;
}

/** A restrained, accessible two-row electricity comparison. No color-coded chart junk —
 *  one accent bar for local, one muted bar for cloud, exact numbers always shown as text. */
export function WorkloadBar({
  localWh,
  cloudWh,
  reductionPct,
}: {
  localWh: number;
  cloudWh: number;
  reductionPct: number;
}) {
  const max = Math.max(localWh, cloudWh);
  const localPct = Math.max((localWh / max) * 100, 2);
  const cloudPct = Math.max((cloudWh / max) * 100, 2);

  return (
    <div className="workload-bar" role="img" aria-label={`Local: ${formatWh(localWh)}. Cloud: ${formatWh(cloudWh)}. ${reductionPct.toFixed(0)} percent lower for local.`}>
      <div className="workload-bar-row">
        <span className="workload-bar-label">Local</span>
        <div className="workload-bar-track">
          <div className="workload-bar-fill local" style={{ width: `${localPct}%` }} />
        </div>
        <span className="workload-bar-value">{formatWh(localWh)}</span>
      </div>
      <div className="workload-bar-row">
        <span className="workload-bar-label">Cloud</span>
        <div className="workload-bar-track">
          <div className="workload-bar-fill cloud" style={{ width: `${cloudPct}%` }} />
        </div>
        <span className="workload-bar-value">{formatWh(cloudWh)}</span>
      </div>

      <style>{`
        .workload-bar { display: grid; gap: 10px; }
        .workload-bar-row {
          display: grid;
          grid-template-columns: 48px 1fr auto;
          align-items: center;
          gap: 12px;
        }
        .workload-bar-label {
          font-size: 12px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .workload-bar-track {
          height: 8px;
          background: var(--bg-deeper);
          border-radius: 999px;
          overflow: hidden;
        }
        .workload-bar-fill {
          height: 100%;
          border-radius: 999px;
        }
        .workload-bar-fill.local { background: var(--accent); }
        .workload-bar-fill.cloud { background: var(--muted); opacity: 0.55; }
        .workload-bar-value {
          font-variant-numeric: tabular-nums;
          font-size: 13px;
          color: var(--text);
          min-width: 74px;
          text-align: right;
        }
        @media (prefers-reduced-motion: no-preference) {
          .workload-bar-fill { transition: width 500ms cubic-bezier(0.22, 1, 0.36, 1); }
        }
      `}</style>
    </div>
  );
}
