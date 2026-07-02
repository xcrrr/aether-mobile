import { colors, radius } from '@/lib/tokens';

/** User turns match the app: quiet dark surface with a hairline border. */
export function UserBubble({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
      <div
        data-user-bubble
        style={{
          maxWidth: '82%',
          backgroundColor: colors.bgInput,
          border: `1px solid ${colors.border}`,
          color: colors.text,
          fontFamily: 'var(--font-sans-stack)',
          fontSize: 15,
          lineHeight: '22px',
          padding: '10px 15px',
          borderRadius: radius.md,
          borderBottomRightRadius: radius.sm,
        }}
      >
        {text}
      </div>
    </div>
  );
}
