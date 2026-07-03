'use client';
import { c, radius, spacing, type } from './tokens';
import { IconCheck, IconFileText, IconSparkles } from './icons';

/* Mirrors app/src/components/chat/AgentTaskCard.tsx — the calm Task surface:
   live milestones while it runs, then an artifact block + one receipt line. */

export function Milestone({ icon, label, summary }: {
  icon: React.ReactNode; label: string; summary: string;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: spacing.sm,
      animation: 'demoRise 300ms var(--ease) both',
    }}>
      <span style={{ display: 'flex', color: c.textMuted, flex: 'none' }}>{icon}</span>
      <span style={{ ...type.chip, color: c.text, flex: 1, minWidth: 0 }}>
        {label}
        <span style={{ ...type.receipt, color: c.textMuted, fontWeight: 400 }}> — {summary}</span>
      </span>
      <IconCheck size={13} color={c.success} strokeWidth={2.2} />
    </div>
  );
}

/** Live task card: breathing violet dot, one honest status line, Stop always visible. */
export function AgentLiveCard({ status, children }: {
  status: string; children?: React.ReactNode;
}) {
  return (
    <div style={{
      background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: radius.md,
      padding: spacing.lg, marginTop: spacing.xs, display: 'flex', flexDirection: 'column', gap: spacing.sm,
      animation: 'demoRise 300ms var(--ease) both',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: c.violet, animation: 'demoPulse 1.4s ease-in-out infinite', flex: 'none' }} />
        <span style={{ ...type.status, color: c.textMuted, flex: 1 }}>{status}</span>
        <span style={{ ...type.chip, color: c.danger }}>Stop</span>
      </div>
      {children}
    </div>
  );
}

export function ArtifactBlock({ title, kept }: { title: string; kept: boolean }) {
  return (
    <div style={{
      background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: radius.md,
      padding: spacing.md, animation: 'demoRise 300ms var(--ease) both',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
        <IconFileText size={15} color={c.violet} strokeWidth={1.8} />
        <span style={{ ...type.label, color: c.text, flex: 1, minWidth: 0 }}>{title}</span>
        <span style={{ ...type.chip, color: c.violet }}>View</span>
        <span style={{ ...type.chip, color: kept ? c.success : c.violet }}>{kept ? 'Kept' : 'Keep'}</span>
      </div>
    </div>
  );
}

export function ReceiptRow({ summary }: { summary: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, marginTop: spacing.sm,
      animation: 'demoRise 300ms var(--ease) both',
    }}>
      <IconSparkles size={12} color={c.textMuted} strokeWidth={2} />
      <span style={{ ...type.receipt, color: c.textMuted, flex: 1 }}>{summary}</span>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: c.success }} />
    </div>
  );
}
