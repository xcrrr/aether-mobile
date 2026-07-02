import { colors } from '@/lib/tokens';

export function TypingDots() {
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
      <div style={{ display: 'flex', gap: 5, padding: '6px 0' }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            data-dot
            style={{
              width: 6, height: 6, borderRadius: 999, backgroundColor: colors.textMuted,
              animation: `typingBlink 1.2s ${i * 0.2}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes typingBlink { 0%,80%,100% { opacity: 0.25; } 40% { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { [data-dot] { animation: none !important; } }
      `}</style>
    </div>
  );
}
