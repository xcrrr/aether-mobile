import { Reveal } from '@/components/ui/Reveal';

const BELIEFS = [
  {
    title: 'Local is the product.',
    body: 'The model is installed on your phone like any other app, and inference happens there. Once a model is downloaded, asking a question needs no connection at all.',
  },
  {
    title: 'Private by construction.',
    body: 'There is no Aether server and no account. Your conversations are stored on the phone — private because of where they live, not because a policy says so.',
  },
  {
    title: 'Online is a choice.',
    body: 'When you want the web, Research goes and gets it, with sources. When you don’t, your questions stay on the phone. The boundary is yours to draw, and it’s visible.',
  },
];

export function Premise() {
  return (
    <section className="shell hairline-top" style={{ padding: '104px 0 120px' }}>
      <div className="premise-grid">
        <Reveal>
          <p className="eyebrow" style={{ marginBottom: 20 }}>Why local-first</p>
          <h2 className="display-2" style={{ maxWidth: 460 }}>
            Most assistants are a window onto someone else’s computer.
          </h2>
          <p className="lede" style={{ maxWidth: 440, marginTop: 24 }}>
            Every question makes a round trip. Every memory lives in an account you can’t open.
            Aether starts from the opposite premise.
          </p>
        </Reveal>

        <div style={{ borderTop: '1px solid var(--line)' }}>
          {BELIEFS.map((b, i) => (
            <Reveal key={b.title} as="article" delay={i * 0.06}>
              <div style={{ padding: '30px 0', borderBottom: '1px solid var(--line)' }}>
                <h3 className="display-3">{b.title}</h3>
                <p className="body-copy" style={{ marginTop: 10 }}>{b.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      <style>{`
        .premise-grid {
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(300px, 1fr);
          gap: 72px;
          align-items: start;
        }
        @media (max-width: 840px) {
          .premise-grid { grid-template-columns: 1fr; gap: 48px; }
        }
      `}</style>
    </section>
  );
}
