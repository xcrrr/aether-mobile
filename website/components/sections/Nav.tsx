import { DISCORD_URL } from '@/lib/links';

const LINKS = [
  { href: '#demo', label: 'See it work' },
  { href: '#memory', label: 'Memory' },
  { href: '#privacy', label: 'Privacy' },
];

export function Nav() {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'color-mix(in srgb, var(--bg) 88%, transparent)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <a
        href="#main"
        className="btn btn-primary"
        style={{ position: 'absolute', left: 16, top: -64, zIndex: 60, transition: 'none' }}
      >
        Skip to content
      </a>
      <nav className="shell" style={{ display: 'flex', alignItems: 'center', gap: 28, height: 64 }} aria-label="Main">
        <a
          href="#top"
          className="font-serif-display"
          style={{ fontSize: 22, color: 'var(--text)', textDecoration: 'none', letterSpacing: '-0.01em' }}
        >
          Aether
        </a>
        <div className="nav-links" style={{ display: 'flex', gap: 24, flex: 1 }}>
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="quiet-link" style={{ fontSize: 14, fontWeight: 500 }}>
              {l.label}
            </a>
          ))}
        </div>
        <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ minHeight: 40, padding: '0 18px', fontSize: 14, marginLeft: 'auto' }}>
          Join the beta
        </a>
      </nav>
      <style>{`
        header a[href="#main"]:focus-visible { top: 12px; }
        @media (max-width: 720px) {
          .nav-links { display: none !important; }
        }
      `}</style>
    </header>
  );
}
