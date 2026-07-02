import { colors } from '@/lib/tokens';

export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: 360, height: 740, borderRadius: 46, padding: 11,
        background: 'linear-gradient(160deg, #262626, #0a0a0a)',
        border: '1px solid #0a0a0a',
        boxShadow:
          '0 32px 80px -24px rgba(20, 18, 26, 0.5), 0 0 0 1px rgba(255,255,255,0.05), inset 0 0 0 2px #000',
        position: 'relative',
      }}
    >
      <div
        style={{
          width: '100%', height: '100%', borderRadius: 36, overflow: 'hidden',
          background: colors.bg, position: 'relative', display: 'flex', flexDirection: 'column',
        }}
      >
        {children}
      </div>

      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 22,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 12,
          height: 12,
          borderRadius: 999,
          background: '#000',
          boxShadow: 'inset 0 0 0 2px #111',
          zIndex: 5,
        }}
      />
    </div>
  );
}
