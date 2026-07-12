import { Reveal } from '@/components/ui/Reveal';
import { ReturningNote } from '@/components/illustrations/ReturningNote';
import { getStudyResults } from '@/lib/research';

/** Quiet, small research proof block. Only shows a numeric claim when the study's own
 *  calculation says it has earned one — see headline_claim_eligibility in results.json. */
export function ResearchProof() {
  const study = getStudyResults();
  const eligible = study.headline_claim_eligibility.headline_claim_eligible;

  return (
    <section className="ink hairline-top" style={{ background: 'var(--bg)' }}>
      <div className="shell" style={{ padding: '64px 0' }}>
        <Reveal>
          <div className="research-proof">
            <div className="research-proof-copy">
              <div>
                <p className="eyebrow" style={{ marginBottom: 12 }}>Research, without the theatre.</p>
                <p className="body-copy" style={{ maxWidth: 480 }}>
                  An open operational model of how local AI and cloud-based AI differ in electricity and
                  water use.
                </p>
                {eligible && (
                  <>
                    <p style={{ marginTop: 16, fontSize: 17, color: 'var(--text)', maxWidth: 480 }}>
                      {study.headline_claim_eligibility.approved_headline_language}
                    </p>
                    <p style={{ marginTop: 6, fontSize: 13, color: 'var(--muted)' }}>
                      Modeled across transparent local-device and cloud-infrastructure scenarios.
                    </p>
                  </>
                )}
              </div>
              <a href="/research" className="quiet-link research-proof-link">
                Read the methodology →
              </a>
            </div>
            <div className="research-proof-art">
              <ReturningNote size="sm" />
            </div>
          </div>
        </Reveal>
      </div>
      <style>{`
        .research-proof {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 32px;
        }
        .research-proof-copy {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 24px;
        }
        .research-proof-art {
          justify-self: end;
        }
        .research-proof-link {
          font-size: 14px;
          font-weight: 500;
          white-space: nowrap;
        }
        @media (max-width: 760px) {
          .research-proof {
            grid-template-columns: 1fr;
          }
          .research-proof-art {
            justify-self: start;
          }
        }
      `}</style>
    </section>
  );
}
