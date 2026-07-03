import { Reveal } from '@/components/ui/Reveal';
import { DISCORD_URL } from '@/lib/links';

const FACTS = ['On-device model', 'No account', 'Android'];

export function Hero() {
  return (
    <section
      id="top"
      className="shell"
      style={{
        minHeight: 'calc(100svh - 64px)',
        padding: 'clamp(96px, 14vh, 160px) 0 clamp(72px, 10vh, 120px)',
      }}
    >
      <Reveal>
        <p className="eyebrow" style={{ marginBottom: 24 }}>Private AI assistant · Closed beta</p>
        <h1 className="display-1" style={{ maxWidth: 780 }}>
          The assistant that stays on your phone.
        </h1>
        <p className="lede" style={{ maxWidth: 560, marginTop: 28 }}>
          Aether runs a language model on the device in your hand. Your conversations — and
          what it remembers about you — live where you can read, edit, and delete them.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 36 }}>
          <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="btn btn-primary">
            Join the beta
          </a>
          <a href="#demo" className="btn btn-ghost">
            See it work
          </a>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 28px', marginTop: 44 }}>
          {FACTS.map((f) => (
            <span key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
              <span className="accent-dot" style={{ width: 5, height: 5 }} />
              {f}
            </span>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
