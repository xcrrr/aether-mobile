import { Reveal } from '@/components/ui/Reveal';
import { BookmarkIllustration } from '@/components/ui/BookmarkIllustration';
import { DISCORD_URL } from '@/lib/links';

export function Hero() {
  return (
    <section id="top" className="shell hero-section">
      <div className="hero-grid">
        <Reveal>
          <div className="hero-copy">
            <p className="eyebrow" style={{ marginBottom: 24 }}>Private AI assistant · Closed beta</p>
            <h1 className="display-1">
              Think without starting over.
            </h1>
            <p className="lede" style={{ marginTop: 28 }}>
              Aether keeps the context behind your work close, so conversations can build instead of reset.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 36 }}>
              <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="btn btn-primary">
                Join the beta
              </a>
              <a href="#mission" className="btn btn-ghost">
                See it work
              </a>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="hero-visual" aria-hidden="true">
            <BookmarkIllustration className="hero-bookmark" />
          </div>
        </Reveal>
      </div>

      <style>{`
        .hero-section {
          width: min(1180px, 100% - 48px);
          min-height: calc(100svh - 64px);
          display: flex;
          align-items: center;
          padding: clamp(40px, 7vh, 72px) 0;
        }
        .hero-grid {
          width: 100%;
          display: grid;
          grid-template-columns: minmax(0, 0.84fr) minmax(420px, 1.12fr);
          gap: clamp(48px, 6vw, 88px);
          align-items: center;
        }
        .hero-copy {
          max-width: 560px;
        }
        .hero-copy .lede {
          max-width: 500px;
        }
        .hero-visual {
          display: flex;
          justify-content: center;
          align-items: center;
          min-width: 0;
          overflow: visible;
        }
        .hero-bookmark {
          display: block;
          width: clamp(620px, 54vw, 760px);
          max-width: none;
          height: auto;
        }
        @media (max-width: 900px) {
          .hero-section {
            min-height: calc(100svh - 64px);
            padding: clamp(48px, 8vh, 82px) 0;
          }
          .hero-grid {
            grid-template-columns: 1fr;
            gap: 52px;
          }
          .hero-copy,
          .hero-copy .lede {
            max-width: 620px;
          }
          .hero-visual {
            justify-content: center;
          }
          .hero-bookmark {
            width: min(108%, 640px);
          }
        }
        @media (max-width: 560px) {
          .hero-section {
            min-height: auto;
            padding: 74px 0 68px;
          }
          .hero-grid {
            gap: 42px;
          }
          .hero-bookmark {
            width: min(116%, 520px);
          }
        }
      `}</style>
    </section>
  );
}
