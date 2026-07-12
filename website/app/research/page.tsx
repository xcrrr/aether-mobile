import type { Metadata } from 'next';
import { Nav } from '@/components/sections/Nav';
import { Footer } from '@/components/sections/Footer';
import { Reveal } from '@/components/ui/Reveal';
import { WorkloadBar } from '@/components/research/WorkloadBar';
import { ReturningNote } from '@/components/illustrations/ReturningNote';
import { getStudyResults, scenarioFor } from '@/lib/research';
import { GITHUB_URL } from '@/lib/links';

export const metadata: Metadata = {
  title: 'Research — Aether',
  description:
    'A transparent operational model of how local AI and cloud-based AI differ in electricity and water use, for matched workloads.',
  openGraph: {
    title: 'Research, without the theatre. — Aether',
    description:
      'An open operational model of how local AI and cloud-based AI differ in electricity and water use.',
    type: 'article',
    siteName: 'Aether',
  },
  twitter: {
    card: 'summary',
    title: 'Research, without the theatre. — Aether',
    description:
      'An open operational model of how local AI and cloud-based AI differ in electricity and water use.',
  },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function ResearchPage() {
  const study = getStudyResults();
  const eligible = study.headline_claim_eligibility.headline_claim_eligible;
  const headlineText = eligible
    ? study.headline_claim_eligibility.approved_headline_language
    : 'The data does not yet support a single headline reduction figure — see the results below.';

  return (
    <>
      <Nav />
      <main id="main" className="ink" style={{ background: 'var(--bg)' }}>
        {/* 1. Hero */}
        <section className="shell" style={{ padding: 'clamp(64px, 10vh, 108px) 0 88px' }}>
          <Reveal>
            <p className="eyebrow" style={{ marginBottom: 20 }}>Aether Environmental Inference Study v1</p>
            <h1 className="display-1" style={{ maxWidth: 780 }}>
              Research, without the theatre.
            </h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 28 }}>
              <span className="study-badge">Transparent operational model</span>
              <span className="study-badge study-badge-muted">{study.status === 'modeled' ? 'Modeled, not directly measured' : study.status}</span>
            </div>
            <p className="lede" style={{ maxWidth: 620, marginTop: 28 }}>
              {headlineText}
            </p>
            <div style={{ margin: '40px 0 8px' }}>
              <ReturningNote size="lg" />
            </div>
            <p className="body-copy" style={{ maxWidth: 620, marginTop: 16 }}>
              Scope: operational electricity and water for on-device chat inference only, across three
              matched, transparent workloads. Training, manufacturing, and non-AI usage are out of scope
              for this version — see below.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 36, alignItems: 'center' }}>
              <a href="#download" className="btn btn-primary">Download data and methodology</a>
              <a href="#sources" className="btn btn-ghost">See the sources</a>
            </div>
            <p style={{ marginTop: 24, fontSize: 13, color: 'var(--muted)' }}>
              Published {formatDate(study.generated_at)} · Study version v1
            </p>
          </Reveal>
        </section>

        {/* 2. The answer, in plain terms */}
        <section className="hairline-top">
          <div className="shell" style={{ padding: '80px 0' }}>
            <Reveal>
              <p className="eyebrow" style={{ marginBottom: 20 }}>The answer, in plain terms</p>
              <h2 className="display-2" style={{ maxWidth: 620 }}>
                Most AI work happens somewhere else. This asks what changes when it does not.
              </h2>
            </Reveal>
            <div className="answer-grid" style={{ marginTop: 48 }}>
              <Reveal>
                <div>
                  <h3 className="display-3" style={{ marginBottom: 14 }}>Electricity</h3>
                  <p className="body-copy">
                    {eligible
                      ? study.headline_claim_eligibility.approved_headline_language
                      : 'No electricity headline is published yet — the conservative scenario did not clear the bar.'}
                  </p>
                </div>
              </Reveal>
              <Reveal delay={0.06}>
                <div>
                  <h3 className="display-3" style={{ marginBottom: 14 }}>Water</h3>
                  <p className="body-copy">
                    {study.water_claim_eligibility.water_claim_eligible
                      ? study.water_claim_eligibility.approved_water_language
                      : 'No water headline is published yet — the conservative scenario did not clear the bar.'}
                  </p>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* 3. Results by workload */}
        <section className="hairline-top">
          <div className="shell" style={{ padding: '80px 0' }}>
            <Reveal>
              <p className="eyebrow" style={{ marginBottom: 20 }}>Results by workload</p>
              <h2 className="display-2" style={{ maxWidth: 620 }}>Three matched workloads, not one average prompt.</h2>
              <p className="lede" style={{ maxWidth: 560, marginTop: 20 }}>
                Central-scenario operational electricity per request. Full low/central/high ranges are in
                the downloadable data.
              </p>
            </Reveal>
            <div className="workload-grid" style={{ marginTop: 48 }}>
              {study.workloads.map((w, i) => {
                const s = scenarioFor(w, 'central');
                return (
                  <Reveal key={w.workload_id} delay={i * 0.06}>
                    <div className="workload-card">
                      <h3 className="display-3">{w.workload_label}</h3>
                      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '8px 0 24px' }}>
                        {w.output_tokens} output tokens · {w.input_tokens_incl_system_prompt} input tokens (incl. system prompt)
                      </p>
                      <WorkloadBar localWh={s.local_electricity_wh} cloudWh={s.cloud_electricity_wh.total} reductionPct={s.electricity_reduction_pct} />
                      <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 20 }}>
                        {s.electricity_reduction_pct.toFixed(0)}% lower, central scenario ·{' '}
                        <a href="/research-data/methodology.md" className="quiet-link">methodology</a>
                      </p>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* 4. Measured vs modeled */}
        <section className="hairline-top">
          <div className="shell" style={{ padding: '80px 0' }}>
            <Reveal>
              <p className="eyebrow" style={{ marginBottom: 20 }}>What is measured vs. modeled</p>
              <h2 className="display-2" style={{ maxWidth: 560 }}>No shipped Aether device has been instrumented yet.</h2>
            </Reveal>
            <div className="mvm-grid" style={{ marginTop: 48 }}>
              <Reveal>
                <div>
                  <h3 className="display-3" style={{ marginBottom: 16 }}>Measured</h3>
                  <ul className="bounds-list">
                    <li><span className="accent-dot" style={{ marginTop: 9 }} /><span>Gemma 4 E2B / E4B model file sizes, exact — read directly from the app&apos;s model registry.</span></li>
                    <li><span className="accent-dot" style={{ marginTop: 9 }} /><span>Context window (4,096 tokens) and real token limits used across the app&apos;s agent, chat, and research flows.</span></li>
                    <li><span className="accent-dot" style={{ marginTop: 9 }} /><span>Official decode throughput for Gemma 4 E2B on Android GPU, published by Google for the same engine Aether ships.</span></li>
                  </ul>
                </div>
              </Reveal>
              <Reveal delay={0.06}>
                <div>
                  <h3 className="display-3" style={{ marginBottom: 16 }}>Modeled</h3>
                  <ul className="bounds-list">
                    <li><span className="accent-dot" style={{ marginTop: 9, background: 'var(--muted)' }} /><span>Local device power draw during generation — a scenario range from published chipset benchmarks, not a direct LLM-inference measurement.</span></li>
                    <li><span className="accent-dot" style={{ marginTop: 9, background: 'var(--muted)' }} /><span>Cloud data-center compute energy, PUE, and water intensity — from peer-reviewed and official public sources.</span></li>
                    <li><span className="accent-dot" style={{ marginTop: 9, background: 'var(--muted)' }} /><span>Network and client radio energy — small, order-of-magnitude assumptions; their contribution to the total is minor either way.</span></li>
                  </ul>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* 5. How the calculation works */}
        <section className="hairline-top">
          <div className="shell" style={{ padding: '80px 0' }}>
            <Reveal>
              <p className="eyebrow" style={{ marginBottom: 20 }}>How the calculation works</p>
              <h2 className="display-2" style={{ maxWidth: 560 }}>Two paths, from request to reply.</h2>
            </Reveal>
            <div className="path-grid" style={{ marginTop: 48 }}>
              <Reveal>
                <div className="path-col">
                  <p className="eyebrow" style={{ marginBottom: 16 }}>Local</p>
                  <ol className="path-steps">
                    <li>Phone GPU generates the reply on-device</li>
                    <li>Electricity = generation time × incremental power draw</li>
                    <li>Water = that electricity × grid water-generation intensity</li>
                  </ol>
                </div>
              </Reveal>
              <Reveal delay={0.06}>
                <div className="path-col">
                  <p className="eyebrow" style={{ marginBottom: 16 }}>Cloud</p>
                  <ol className="path-steps">
                    <li>Request leaves the phone over the network</li>
                    <li>A data-center GPU generates the reply</li>
                    <li>Facility electricity = compute energy × PUE</li>
                    <li>Water = on-site cooling + grid-generation water, kept separate</li>
                    <li>Reply streams back over the network to the phone</li>
                  </ol>
                </div>
              </Reveal>
            </div>
            <Reveal delay={0.1}>
              <p className="body-copy" style={{ marginTop: 40, maxWidth: 640 }}>
                Exact formulas and unit conversions are in{' '}
                <a href="/research-data/calculation-notes.md" className="quiet-link" style={{ color: 'var(--accent)' }}>calculation-notes.md</a>.
              </p>
            </Reveal>
          </div>
        </section>

        {/* 6. Assumptions and sensitivity */}
        <section className="hairline-top">
          <div className="shell" style={{ padding: '80px 0' }}>
            <Reveal>
              <p className="eyebrow" style={{ marginBottom: 20 }}>Assumptions and sensitivity</p>
              <h2 className="display-2" style={{ maxWidth: 620 }}>What changes the outcome.</h2>
              <p className="lede" style={{ maxWidth: 580, marginTop: 20 }}>
                Even in the conservative pairing — Aether at the high end of its power-draw range, cloud
                at the low end of its energy range — the reduction holds for every tested workload.
              </p>
            </Reveal>
            <div style={{ marginTop: 40, overflowX: 'auto' }}>
              <table className="sensitivity-table">
                <thead>
                  <tr>
                    <th scope="col">Workload</th>
                    <th scope="col">Conservative (worst case for Aether)</th>
                    <th scope="col">Central scenario</th>
                  </tr>
                </thead>
                <tbody>
                  {study.sensitivity.conservative_gate_local_high_vs_cloud_low.map((g) => {
                    const central = study.sensitivity.central_vs_central.find((c) => c.workload_id === g.workload_id);
                    const label = study.workloads.find((w) => w.workload_id === g.workload_id)?.workload_label ?? g.workload_id;
                    return (
                      <tr key={g.workload_id}>
                        <td>{label}</td>
                        <td>{g.reduction_pct.toFixed(0)}% lower</td>
                        <td>{central?.reduction_pct.toFixed(0)}% lower</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Reveal delay={0.1}>
              <p className="body-copy" style={{ marginTop: 32, maxWidth: 640 }}>
                Water estimates carry more uncertainty than electricity estimates: on-site data-center
                cooling water intensity alone varies roughly 190x across the regions this study&apos;s
                source documents, versus roughly 1.7x for facility overhead (PUE). The modeled water range
                is correspondingly wider — see <a href="/research-data/limitations.md" className="quiet-link" style={{ color: 'var(--accent)' }}>limitations.md</a>.
              </p>
            </Reveal>
          </div>
        </section>

        {/* 7. What this study does not claim */}
        <section className="hairline-top">
          <div className="shell" style={{ padding: '80px 0' }}>
            <Reveal>
              <p className="eyebrow" style={{ marginBottom: 20 }}>What this study does not claim</p>
              <h2 className="display-2" style={{ maxWidth: 620 }}>Said plainly, not buried in a footnote.</h2>
            </Reveal>
            <Reveal delay={0.06}>
              <ul className="bounds-list" style={{ marginTop: 40, maxWidth: 720 }}>
                <li><span className="accent-dot" style={{ marginTop: 9, background: 'var(--muted)' }} /><span>No physical Aether device has been instrumented for direct power measurement yet.</span></li>
                <li><span className="accent-dot" style={{ marginTop: 9, background: 'var(--muted)' }} /><span>The cloud figures come from single-request lab measurements. Production services likely batch requests, which could lower real-world cloud energy below what is modeled here.</span></li>
                <li><span className="accent-dot" style={{ marginTop: 9, background: 'var(--muted)' }} /><span>Output quality between local and cloud responses is not compared or claimed to be equal.</span></li>
                <li><span className="accent-dot" style={{ marginTop: 9, background: 'var(--muted)' }} /><span>Model training, manufacturing, device end-of-life, and non-AI app usage are out of scope for this version.</span></li>
                <li><span className="accent-dot" style={{ marginTop: 9, background: 'var(--muted)' }} /><span>Results are not generalized beyond the three tested workloads and the stated reference device.</span></li>
              </ul>
            </Reveal>
            <Reveal delay={0.1}>
              <p style={{ marginTop: 28 }}>
                <a href="/research-data/limitations.md" className="quiet-link" style={{ color: 'var(--accent)' }}>Read the full limitations →</a>
              </p>
            </Reveal>
          </div>
        </section>

        {/* 8. Sources */}
        <section id="sources" className="hairline-top">
          <div className="shell" style={{ padding: '80px 0' }}>
            <Reveal>
              <p className="eyebrow" style={{ marginBottom: 20 }}>Sources</p>
              <h2 className="display-2" style={{ maxWidth: 560 }}>Every number traces to something you can check.</h2>
            </Reveal>
            <Reveal delay={0.06}>
              <ol className="source-list" style={{ marginTop: 40 }}>
                <li>Luccioni, Jernite &amp; Strubell (2024). <em>Power Hungry Processing: Watts Driving the Cost of AI Deployment?</em> ACM FAccT 2024. <a href="https://arxiv.org/abs/2311.16863" className="quiet-link" style={{ color: 'var(--accent)' }}>arxiv.org/abs/2311.16863</a></li>
                <li>Husom, Goknil, Shar &amp; Sen (2024). <em>The Price of Prompting: Profiling Energy Use in Large Language Models Inference.</em> <a href="https://arxiv.org/abs/2407.16893" className="quiet-link" style={{ color: 'var(--accent)' }}>arxiv.org/abs/2407.16893</a></li>
                <li>Li, Yang, Islam &amp; Ren (2023). <em>Making AI Less &quot;Thirsty&quot;: Uncovering and Addressing the Secret Water Footprint of AI Models.</em> Communications of the ACM. <a href="https://arxiv.org/abs/2304.03271" className="quiet-link" style={{ color: 'var(--accent)' }}>arxiv.org/abs/2304.03271</a></li>
                <li>Uptime Institute (2024). <em>Global Data Center Survey 2024.</em> <a href="https://journal.uptimeinstitute.com/large-data-centers-are-mostly-more-efficient-analysis-confirms/" className="quiet-link" style={{ color: 'var(--accent)' }}>journal.uptimeinstitute.com</a></li>
                <li>Aslan, Mayers, Koomey &amp; France (2018). <em>Electricity Intensity of Internet Data Transmission: Untangling the Estimates.</em> Journal of Industrial Ecology. <a href="https://onlinelibrary.wiley.com/doi/full/10.1111/jiec.12630" className="quiet-link" style={{ color: 'var(--accent)' }}>onlinelibrary.wiley.com</a></li>
                <li>Google AI Edge team (2026). <em>Blazing fast on-device GenAI with LiteRT-LM.</em> <a href="https://developers.googleblog.com/blazing-fast-on-device-genai-with-litert-lm/" className="quiet-link" style={{ color: 'var(--accent)' }}>developers.googleblog.com</a></li>
              </ol>
            </Reveal>
            <Reveal delay={0.1}>
              <p style={{ marginTop: 28 }}>
                <a href="/research-data/references.md" className="quiet-link" style={{ color: 'var(--accent)' }}>Full reference list, with what each source supports →</a>
              </p>
            </Reveal>
          </div>
        </section>

        {/* 9. Download */}
        <section id="download" className="hairline-top">
          <div className="shell" style={{ padding: '80px 0' }}>
            <Reveal>
              <p className="eyebrow" style={{ marginBottom: 20 }}>Download</p>
              <h2 className="display-2" style={{ maxWidth: 560 }}>Download data and methodology.</h2>
              <p className="lede" style={{ maxWidth: 560, marginTop: 20 }}>
                Every published number in this study is generated from these files by one script — nothing
                here is typed by hand.
              </p>
            </Reveal>
            <Reveal delay={0.06}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 36 }}>
                <a href="/research-data/results.json" className="btn btn-primary" download>results.json</a>
                <a href="/research-data/results.csv" className="btn btn-ghost" download>results.csv</a>
                <a href="/research-data/README.md" className="btn btn-ghost" download>README.md</a>
                <a href={`${GITHUB_URL}/tree/main/research/environmental-inference-study-v1`} className="btn btn-ghost" target="_blank" rel="noreferrer">
                  Full package on GitHub
                </a>
              </div>
              <p style={{ marginTop: 24, fontSize: 13, color: 'var(--muted)' }}>
                Study version v1 · Published {formatDate(study.generated_at)}
              </p>
            </Reveal>
          </div>
        </section>

        {/* 10. Final CTA */}
        <section className="hairline-top">
          <div className="shell" style={{ padding: '88px 0 104px', textAlign: 'center' }}>
            <Reveal>
              <h2 className="display-2" style={{ maxWidth: 560, marginInline: 'auto' }}>
                We will replace modeled inputs with direct device measurements as the study expands.
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 36 }}>
                <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="btn btn-ghost">Follow progress on GitHub</a>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />

      <style>{`
        .study-badge {
          display: inline-flex;
          align-items: center;
          height: 28px;
          padding: 0 12px;
          border-radius: 999px;
          border: 1px solid var(--line);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: var(--accent);
        }
        .study-badge-muted {
          color: var(--muted);
        }
        .answer-grid, .mvm-grid, .path-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 48px;
        }
        .workload-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
        }
        .workload-card {
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 28px;
        }
        .path-steps {
          margin: 0;
          padding-left: 20px;
          display: grid;
          gap: 12px;
          color: var(--muted);
          font-size: 15px;
          line-height: 1.5;
        }
        .path-steps li::marker {
          color: var(--accent);
        }
        .sensitivity-table {
          width: 100%;
          min-width: 480px;
          border-collapse: collapse;
          font-size: 14px;
        }
        .sensitivity-table th, .sensitivity-table td {
          text-align: left;
          padding: 12px 16px;
          border-bottom: 1px solid var(--line);
        }
        .sensitivity-table th {
          color: var(--muted);
          font-weight: 500;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .sensitivity-table td:first-child {
          color: var(--text);
          font-weight: 500;
        }
        .source-list {
          margin: 0;
          padding-left: 20px;
          display: grid;
          gap: 16px;
          color: var(--muted);
          font-size: 15px;
          line-height: 1.6;
          max-width: 760px;
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
        @media (max-width: 820px) {
          .answer-grid, .mvm-grid, .path-grid {
            grid-template-columns: 1fr;
            gap: 36px;
          }
          .workload-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}
