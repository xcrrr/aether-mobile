import { colors } from '@/lib/tokens';

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M3 5.5h14M3 10h14M3 14.5h9" stroke={colors.text} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="2.6" stroke={colors.text} strokeWidth="1.4" />
      <path
        d="M10 2.2v2M10 15.8v2M2.2 10h2M15.8 10h2M4.5 4.5l1.4 1.4M14.1 14.1l1.4 1.4M15.5 4.5l-1.4 1.4M5.9 14.1l-1.4 1.4"
        stroke={colors.text}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** The real app's chat header: menu · Aether wordmark · settings gear. */
export function TopBar() {
  return (
    <div
      style={{
        position: 'relative',
        zIndex: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '44px 16px 12px',
        borderBottom: `1px solid ${colors.border}`,
        background: colors.bg,
      }}
    >
      <span style={{ width: 24, display: 'flex' }}><MenuIcon /></span>
      <span
        style={{
          flex: 1,
          textAlign: 'center',
          fontFamily: 'var(--font-sans-stack)',
          fontWeight: 600,
          fontSize: 17,
          letterSpacing: '-0.2px',
          color: colors.text,
        }}
      >
        Aether
      </span>
      <span style={{ width: 24, display: 'flex', justifyContent: 'flex-end' }}><GearIcon /></span>
    </div>
  );
}
