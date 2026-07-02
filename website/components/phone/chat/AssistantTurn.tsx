import { colors } from '@/lib/tokens';

/** Assistant replies match the app: muted name label, bare Newsreader serif body. */
export function AssistantTurn({ text, caret = false }: { text: string; caret?: boolean }) {
  return (
    <div style={{ marginBottom: 30 }}>
      <div
        style={{
          fontFamily: 'var(--font-sans-stack)',
          fontSize: 11,
          fontWeight: 500,
          color: colors.textMuted,
          marginBottom: 6,
          letterSpacing: '0.4px',
        }}
      >
        Aether
      </div>
      <div
        style={{
          fontFamily: 'var(--font-serif-stack)',
          fontSize: 16,
          lineHeight: '25px',
          color: colors.text,
          whiteSpace: 'pre-wrap',
        }}
      >
        {text}
        {caret && <span data-caret style={{ opacity: 0.7 }}>▍</span>}
      </div>
    </div>
  );
}
