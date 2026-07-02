import { Reveal } from '@/components/ui/Reveal';
import { colors, radius } from '@/lib/tokens';

const ENTRIES = [
  { text: 'Cabin gate code is 4182', from: 'from a conversation' },
  { text: 'Prefers short, direct answers', from: 'from a conversation' },
  { text: 'Planning a hiking trip in September', from: 'from a conversation' },
];

/** A restrained rendition of the app's Core screen, built from the app's own
 *  dark palette — a truthful simplified visual, not a fake dashboard. */
function CorePanel() {
  return (
    <div
      aria-label="Illustration of Core, Aether's on-device memory"
      role="img"
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: radius.xl,
        padding: '24px 22px',
        maxWidth: 400,
        width: '100%',
        boxShadow: '0 24px 64px -32px rgba(20, 18, 26, 0.35)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 18 }}>
        <span style={{ fontFamily: 'var(--font-serif-stack)', fontWeight: 500, fontSize: 20, color: colors.text }}>Core</span>
        <span style={{ fontFamily: 'var(--font-sans-stack)', fontSize: 11, color: colors.textMuted, letterSpacing: '0.4px' }}>
          stored on this phone
        </span>
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {ENTRIES.map((e) => (
          <div
            key={e.text}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              background: colors.bgInput,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.md,
              padding: '12px 14px',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: colors.violet, marginTop: 7, flex: 'none' }} />
            <div>
              <div style={{ fontFamily: 'var(--font-sans-stack)', fontSize: 14, lineHeight: '20px', color: colors.text }}>{e.text}</div>
              <div style={{ fontFamily: 'var(--font-sans-stack)', fontSize: 11, color: colors.textMuted, marginTop: 3 }}>{e.from}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 16, fontFamily: 'var(--font-sans-stack)', fontSize: 12, color: colors.textMuted }}>
        <span>Edit</span>
        <span>Delete</span>
      </div>
    </div>
  );
}

export function Memory() {
  return (
    <section id="memory" className="shell hairline-top" style={{ padding: '104px 0 120px' }}>
      <div className="memory-grid">
        <Reveal>
          <p className="eyebrow" style={{ marginBottom: 20 }}>Core · Aether’s memory</p>
          <h2 className="display-2" style={{ maxWidth: 480 }}>
            It remembers like a notebook, not a server.
          </h2>
          <p className="body-copy" style={{ maxWidth: 460, marginTop: 24, fontSize: 17 }}>
            Aether can distill what matters from your conversations — people, projects,
            preferences — into Core, its on-device memory. Core is yours to open: read what
            it knows, correct it, or delete it entirely.
          </p>
          <p className="body-copy" style={{ maxWidth: 460, marginTop: 16, fontSize: 17 }}>
            Nothing about you accumulates somewhere you can’t see.
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <CorePanel />
          </div>
        </Reveal>
      </div>

      <style>{`
        .memory-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(320px, 0.9fr);
          gap: 72px;
          align-items: center;
        }
        @media (max-width: 840px) {
          .memory-grid { grid-template-columns: 1fr; gap: 48px; }
        }
      `}</style>
    </section>
  );
}
