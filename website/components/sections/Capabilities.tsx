'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChatDemo, CoreDemo, FilesDemo, ResearchDemo, SeeDemo } from '@/components/demos';
import { Reveal } from '@/components/ui/Reveal';

const FEATURES = [
  {
    title: 'Chat',
    hint: 'Fast answers or deeper reasoning, in the same conversation.',
    body: 'Talk to Aether naturally and choose the pace that fits the moment: Fast for everyday questions, Thinking when a request needs more care.',
    points: ['Fast and Thinking modes', 'Streaming replies', 'Conversation-first interface'],
    Demo: ChatDemo,
  },
  {
    title: 'See',
    hint: 'Ask about a photo, screenshot, or visual note.',
    body: 'Add an image and Aether can read what is visible, then turn it into a useful answer inside the same chat surface.',
    points: ['Image context in chat', 'Practical visual summaries', 'Useful follow-up prompts'],
    Demo: SeeDemo,
  },
  {
    title: 'Files',
    hint: 'Bring selected documents into the answer.',
    body: 'Choose a file when the question depends on source material. Aether uses the document as context instead of making you paste around it.',
    points: ['PDF and document context', 'Grounded summaries', 'Copy-ready decisions and risks'],
    Demo: FilesDemo,
  },
  {
    title: 'Research',
    hint: 'Use the web deliberately when freshness matters.',
    body: 'When current information matters, Research goes online on purpose: it searches, reads, and returns an answer with sources.',
    points: ['Explicit web mode', 'Readable progress states', 'Sources in the answer'],
    Demo: ResearchDemo,
  },
  {
    title: 'Core',
    hint: 'Useful details, kept across every conversation.',
    body: 'Mention something concrete — a goal, a project, someone you work with — and Aether can keep it, grounded in the exact words you used rather than a guess. It lives in Core, held only on this device, where you can see what it kept, correct it, or remove it.',
    points: ['On-device only', 'Grounded in what you said', 'Browse, edit, or delete'],
    Demo: CoreDemo,
  },
] as const;

type FeatureTitle = (typeof FEATURES)[number]['title'];

export function Capabilities() {
  const [activeTitle, setActiveTitle] = useState<FeatureTitle>('Chat');
  const active = FEATURES.find((feature) => feature.title === activeTitle) ?? FEATURES[0];
  const ActiveDemo = active.Demo;

  return (
    <section id="features" className="capabilities-overview ink hairline-top" aria-labelledby="capabilities-title">
      <div className="shell capabilities-grid">
        <div className="capabilities-copy">
          <Reveal>
            <p className="eyebrow" style={{ marginBottom: 20 }}>Overview</p>
            <h2 id="capabilities-title" className="display-2">
              What Aether can do
            </h2>
            <p className="body-copy capabilities-lede">
              Aether keeps its core tools close to the conversation, so context turns into something you can use.
            </p>
          </Reveal>

          <div className="feature-stack" role="list" aria-label="Aether feature categories">
            {FEATURES.map((feature, index) => {
              const isActive = feature.title === active.title;
              const panelId = `feature-panel-${feature.title.toLowerCase()}`;
              const buttonId = `feature-button-${feature.title.toLowerCase()}`;

              return (
                <Reveal key={feature.title} delay={Math.min(index * 0.035, 0.14)}>
                  <article className={`feature-item${isActive ? ' is-active' : ''}`} role="listitem">
                    <button
                      id={buttonId}
                      type="button"
                      className="feature-trigger"
                      aria-expanded={isActive}
                      aria-controls={panelId}
                      onClick={() => setActiveTitle(feature.title)}
                    >
                      <span className="feature-index">{String(index + 1).padStart(2, '0')}</span>
                      <span className="feature-title-wrap">
                        <span className="feature-title">{feature.title}</span>
                        {!isActive && <span className="feature-hint">{feature.hint}</span>}
                      </span>
                    </button>

                    <AnimatePresence initial={false}>
                      {isActive && (
                        <motion.div
                          id={panelId}
                          role="region"
                          aria-labelledby={buttonId}
                          className="feature-panel"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                        >
                          <div className="feature-panel-inner">
                            <p>{feature.body}</p>
                            <ul aria-label={`${feature.title} highlights`}>
                              {feature.points.map((point) => (
                                <li key={point}>{point}</li>
                              ))}
                            </ul>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </div>

        <Reveal delay={0.08}>
          <div className="overview-phone" aria-live="polite" aria-label={`${active.title} product demo`}>
            <div className="overview-phone-stage">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={active.title}
                  className="overview-demo"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                >
                  <ActiveDemo />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </Reveal>
      </div>

      <style>{`
        .capabilities-overview {
          background: #242424;
          padding: 112px 0 124px;
        }

        .capabilities-grid {
          display: grid;
          grid-template-columns: minmax(0, 0.92fr) minmax(320px, 0.78fr);
          align-items: center;
          gap: clamp(56px, 8vw, 112px);
        }

        .capabilities-copy {
          min-width: 0;
        }

        .capabilities-lede {
          max-width: 540px;
          margin-top: 18px;
          font-size: 17px;
        }

        .feature-stack {
          margin-top: 52px;
          border-top: 1px solid rgba(241, 241, 239, 0.14);
        }

        .feature-item {
          position: relative;
          border-bottom: 1px solid rgba(241, 241, 239, 0.14);
          transition: border-color 220ms var(--ease);
        }

        .feature-item.is-active {
          border-bottom-color: rgba(241, 241, 239, 0.24);
        }

        .feature-trigger {
          width: 100%;
          border: 0;
          background: transparent;
          color: var(--text);
          display: grid;
          grid-template-columns: 44px 1fr;
          gap: 14px;
          padding: 24px 0 22px;
          text-align: left;
          cursor: pointer;
          font: inherit;
        }

        .feature-trigger:hover .feature-title,
        .feature-trigger:focus-visible .feature-title {
          color: #ffffff;
        }

        .feature-index {
          padding-top: 6px;
          font-size: 12px;
          line-height: 1;
          font-weight: 600;
          letter-spacing: 0.08em;
          color: var(--muted);
          transition: color 220ms var(--ease), opacity 220ms var(--ease);
        }

        .feature-item.is-active .feature-index {
          color: var(--accent);
        }

        .feature-title-wrap {
          min-width: 0;
          display: grid;
          gap: 7px;
        }

        .feature-title {
          font-family: var(--font-serif-stack);
          font-weight: 500;
          font-variation-settings: 'opsz' 32;
          font-size: clamp(25px, 3.1vw, 34px);
          line-height: 1.1;
          color: rgba(241, 241, 239, 0.78);
          transition: color 220ms var(--ease);
        }

        .feature-item.is-active .feature-title {
          color: var(--text);
        }

        .feature-hint {
          max-width: 420px;
          font-size: 14px;
          line-height: 1.45;
          color: rgba(185, 185, 180, 0.72);
        }

        .feature-panel {
          overflow: hidden;
        }

        .feature-panel-inner {
          padding: 0 0 28px 58px;
          max-width: 520px;
          color: var(--muted);
        }

        .feature-panel-inner p {
          margin: 0;
          font-size: 16px;
          line-height: 1.66;
        }

        .feature-panel-inner ul {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 10px;
          list-style: none;
          margin: 18px 0 0;
          padding: 0;
        }

        .feature-panel-inner li {
          border-top: 1px solid rgba(241, 241, 239, 0.18);
          padding-top: 8px;
          min-width: min(156px, 100%);
          font-size: 13px;
          line-height: 1.35;
          color: rgba(241, 241, 239, 0.78);
        }

        .overview-phone {
          display: flex;
          justify-content: center;
          align-items: center;
          min-width: 0;
        }

        .overview-phone-stage {
          width: min(100%, 382px);
          min-height: min(740px, calc((100vw - 48px) * 2.06));
          position: relative;
          display: flex;
          align-items: flex-start;
          justify-content: center;
        }

        .overview-demo {
          width: 100%;
        }

        .overview-demo [data-demo-root] {
          width: 100%;
        }

        @media (max-width: 920px) {
          .capabilities-overview {
            padding: 88px 0 104px;
          }

          .capabilities-grid {
            grid-template-columns: 1fr;
            gap: 44px;
          }

          .feature-stack {
            margin-top: 40px;
          }

          .overview-phone-stage {
            width: min(100%, 360px);
            min-height: min(740px, calc((100vw - 40px) * 2.06));
          }
        }

        @media (max-width: 640px) {
          .capabilities-overview {
            padding: 76px 0 92px;
          }

          .feature-trigger {
            grid-template-columns: 34px 1fr;
            gap: 10px;
            padding: 22px 0 20px;
          }

          .feature-panel-inner {
            padding-left: 44px;
          }

          .feature-panel-inner ul {
            display: grid;
            gap: 10px;
          }

          .feature-panel-inner li {
            min-width: 0;
          }
        }
      `}</style>
    </section>
  );
}
