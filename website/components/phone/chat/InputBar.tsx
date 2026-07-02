import { colors, radius } from '@/lib/tokens';

export function InputBar() {
  return (
    <div style={{ backgroundColor: colors.bg, paddingTop: 8 }}>
      <div style={{ display: 'flex', marginBottom: 8 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            border: `1px solid ${colors.border}`,
            borderRadius: radius.full,
            padding: '5px 12px',
            fontFamily: 'var(--font-sans-stack)',
            fontSize: 12,
            fontWeight: 500,
            color: colors.textMuted,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: 999, background: colors.violet }} />
          Fast
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
        <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textMuted, fontSize: 22, fontFamily: 'var(--font-sans-stack)' }}>+</div>
        <div
          style={{
            flex: 1, backgroundColor: colors.bgInput, borderRadius: radius.xl,
            color: colors.textMuted, padding: '11px 16px', fontSize: 15, lineHeight: '21px',
            fontFamily: 'var(--font-sans-stack)',
          }}
        >
          Message Aether
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bgInput, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textMuted, fontSize: 18 }}>↑</div>
      </div>
      <div style={{ textAlign: 'center', fontFamily: 'var(--font-sans-stack)', fontSize: 11, color: colors.textMuted, padding: '8px 0' }}>
        Aether is an AI and can make mistakes.
      </div>
    </div>
  );
}
