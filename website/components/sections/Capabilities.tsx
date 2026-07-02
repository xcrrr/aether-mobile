import { Reveal } from '@/components/ui/Reveal';

const ROWS = [
  {
    title: 'Two speeds of thought',
    body: 'Fast for quick answers, Thinking for deeper reasoning — two on-device models you can switch between mid-conversation.',
  },
  {
    title: 'It can look',
    body: 'Attach a photo or a screenshot and ask about it. Image understanding is part of the same on-device model, not an upload.',
  },
  {
    title: 'It can listen',
    body: 'Dictate instead of typing, using your phone’s Android speech recognition.',
  },
  {
    title: 'It can read documents',
    body: 'Hand it a PDF or Word file and ask about what’s inside. The text is extracted on the phone.',
  },
  {
    title: 'It can check the web — when you ask',
    body: 'Research searches, reads, and answers with citations. It’s the one part of Aether that goes online, and it runs only when you turn it on.',
  },
  {
    title: 'It can act, carefully',
    body: 'Structured question cards, copy-ready blocks, and early Agent Actions that carry small tasks through step by step. The newest parts are still visibly beta — that’s honest, and it’s the point of one.',
  },
];

export function Capabilities() {
  return (
    <section className="shell hairline-top" style={{ padding: '104px 0 120px' }}>
      <Reveal>
        <p className="eyebrow" style={{ marginBottom: 20 }}>What it can do</p>
        <h2 className="display-2" style={{ maxWidth: 560 }}>
          A small set of things, done properly.
        </h2>
      </Reveal>

      <div style={{ marginTop: 56, borderTop: '1px solid var(--line)' }}>
        {ROWS.map((r, i) => (
          <Reveal key={r.title} as="article" delay={Math.min(i * 0.04, 0.16)}>
            <div className="cap-row">
              <h3 className="display-3">{r.title}</h3>
              <p className="body-copy" style={{ fontSize: 16 }}>{r.body}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <style>{`
        .cap-row {
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(0, 1fr);
          gap: 24px 64px;
          padding: 30px 0;
          border-bottom: 1px solid var(--line);
        }
        @media (max-width: 720px) {
          .cap-row { grid-template-columns: 1fr; gap: 8px; }
        }
      `}</style>
    </section>
  );
}
