import { Reveal } from '@/components/ui/Reveal';

const ON_DEVICE = [
  'Model inference — every reply is generated on the phone',
  'Your conversations and chat history',
  'Core, Aether’s memory of you',
  'Images you attach, and what the model sees in them',
  'Text extracted from PDFs and documents',
];

const OVER_NETWORK = [
  'Downloading a model — once, when you choose one',
  'Research mode — web searches and page fetches, only while you use it',
  'Voice dictation — Android’s speech service, which may use the network depending on your device',
];

export function Boundaries() {
  return (
    <section id="privacy" className="ink" style={{ background: 'var(--bg)' }}>
      <div className="shell" style={{ padding: '112px 0 120px' }}>
        <Reveal>
          <p className="eyebrow" style={{ marginBottom: 20 }}>Privacy, in plain terms</p>
          <h2 className="display-2" style={{ maxWidth: 520 }}>
            Where things actually run.
          </h2>
          <p className="lede" style={{ maxWidth: 520, marginTop: 24 }}>
            There is no account and no Aether server. This is the complete list of what
            touches the network.
          </p>
        </Reveal>

        <div className="bounds-grid" style={{ marginTop: 64 }}>
          <Reveal>
            <div>
              <h3 className="display-3" style={{ marginBottom: 20 }}>On your phone</h3>
              <ul className="bounds-list">
                {ON_DEVICE.map((item) => (
                  <li key={item}>
                    <span className="accent-dot" style={{ marginTop: 9 }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div>
              <h3 className="display-3" style={{ marginBottom: 20 }}>Over the network</h3>
              <ul className="bounds-list">
                {OVER_NETWORK.map((item) => (
                  <li key={item}>
                    <span className="accent-dot" style={{ marginTop: 9, background: 'var(--muted)' }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.12}>
          <p className="body-copy" style={{ marginTop: 56, maxWidth: 560, fontSize: 16 }}>
            That’s the whole list. There is no backend to sync to and no server logs of your
            conversations — the app talks to the network only for the things above.
          </p>
        </Reveal>
      </div>

      <style>{`
        .bounds-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 64px;
        }
        .bounds-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 16px;
        }
        .bounds-list li {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          font-size: 16px;
          line-height: 1.55;
          color: var(--muted);
        }
        @media (max-width: 720px) {
          .bounds-grid { grid-template-columns: 1fr; gap: 48px; }
        }
      `}</style>
    </section>
  );
}
