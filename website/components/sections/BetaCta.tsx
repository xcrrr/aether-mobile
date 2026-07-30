import { Reveal } from '@/components/ui/Reveal';
import { DISCORD_URL, RELEASE_URL } from '@/lib/links';

export function BetaCta() {
  return (
    <section className="ink" style={{ background: 'var(--bg)' }}>
      <div className="shell hairline-top" style={{ padding: '104px 0 120px', textAlign: 'center' }}>
        <Reveal>
          <h2 className="display-2" style={{ maxWidth: 620, marginInline: 'auto' }}>
            It’s early. That’s the point.
          </h2>
          <p className="lede" style={{ maxWidth: 520, margin: '24px auto 0' }}>
            Aether is in open beta. Builds ship as installable APKs on GitHub, the source is public,
            and feedback lands directly with the people making it.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 40 }}>
            <a href={RELEASE_URL} target="_blank" rel="noreferrer" className="btn btn-primary">
              Download the APK
            </a>
            <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="btn btn-ghost">
              Join the Discord
            </a>
          </div>
          <p style={{ marginTop: 28, fontSize: 13, color: 'var(--muted)' }}>
            Free · Android 10+, arm64 · The model runs on your hardware, so a recent phone with 8 GB
            of RAM is recommended.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
