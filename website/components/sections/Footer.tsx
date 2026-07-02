import { DISCORD_URL, GITHUB_URL, RELEASE_URL } from '@/lib/links';

const LINKS = [
  { href: '#demo', label: 'See it work' },
  { href: '#memory', label: 'Memory' },
  { href: '#privacy', label: 'Privacy' },
  { href: RELEASE_URL, label: 'Releases', external: true },
  { href: GITHUB_URL, label: 'GitHub', external: true },
  { href: DISCORD_URL, label: 'Discord', external: true },
];

export function Footer() {
  return (
    <footer className="ink" style={{ background: 'var(--bg)' }}>
      <div className="shell hairline-top" style={{ padding: '48px 0 56px' }}>
        <div className="footer-row">
          <div>
            <span className="font-serif-display" style={{ fontSize: 22, color: 'var(--text)' }}>Aether</span>
            <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--muted)' }}>
              A private AI assistant for Android.
            </p>
          </div>
          <nav aria-label="Footer" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 24px' }}>
            {LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="quiet-link"
                style={{ fontSize: 14 }}
                {...(l.external ? { target: '_blank', rel: 'noreferrer' } : {})}
              >
                {l.label}
              </a>
            ))}
          </nav>
        </div>
        <p style={{ margin: '40px 0 0', fontSize: 12, color: 'var(--muted)' }}>
          © 2026 Aether · In closed beta
        </p>
      </div>

      <style>{`
        .footer-row {
          display: flex;
          justify-content: space-between;
          gap: 32px;
          flex-wrap: wrap;
          align-items: flex-start;
        }
      `}</style>
    </footer>
  );
}
