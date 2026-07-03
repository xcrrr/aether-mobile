'use client';
import { DemoPhone } from './kit/Phone';
import { c, type } from './kit/tokens';
import { useDemoClock, prog, burst, typeSlice, loopOpacity } from './kit/timeline';
import {
  AssistantTurn, UserTurn, Composer, ActionPill,
  DemoKeyframes, type Block, blocksLen,
} from './kit/chat';
import { AgentLiveCard, Milestone, ArtifactBlock, ReceiptRow } from './kit/agent';
import {
  IconBrain, IconGlobe, IconMic, IconPaperclip, IconPenLine, IconShieldCheck, IconSparkles,
} from './kit/icons';

/*
 * Demo 5 — Task. Meaningful work handed off: the live card shows calm
 * milestones (what got done, never internals), then the run resolves into a
 * short reply, a tangible artifact with Keep, and one honest receipt line.
 * Mirrors AgentLiveCard / AgentReceiptCard — no dashboard, no logs.
 */

const PROMPT = 'Make me a focused 7-day study plan for my networking exam.';

const REPLY: Block[] = [
  { kind: 'p', text: 'Done — the plan front-loads subnetting, since your Core notes flag it, and saves the last two days for full practice exams.' },
];
const REPLY_LEN = blocksLen(REPLY);

const TYPE_A = 700, TYPE_B = 2600;
const SEND = 2750;
const CARD_AT = 3000;
const MILESTONE_1 = 4700, MILESTONE_2 = 7500;
const RESOLVE = 8500;
const STREAM_B = 10100;
const ARTIFACT_AT = 10300, RECEIPT_AT = 10700, KEPT_AT = 12000;
const DURATION = 12600, HOLD = 4200;

export function TaskDemo() {
  const { ref, t } = useDemoClock({ duration: DURATION, hold: HOLD, restAt: DURATION });

  const typed = typeSlice(PROMPT, t, TYPE_A, TYPE_B);
  const sent = t >= SEND;
  const live = sent && t >= CARD_AT && t < RESOLVE;
  const resolved = t >= RESOLVE;
  const revealed = burst(prog(t, RESOLVE, STREAM_B) * REPLY_LEN);
  const generating = t >= CARD_AT && t < RESOLVE;

  return (
    <div ref={ref} data-demo-root style={{ display: 'flex', justifyContent: 'center' }}>
      <DemoKeyframes />
      <DemoPhone
        mode="Thinking"
        opacity={loopOpacity(t, DURATION, HOLD)}
        composer={
          <Composer
            value={sent ? '' : typed}
            caret={!sent && t >= TYPE_A && t < SEND}
            placeholder="Give Aether a task..."
            generating={generating}
            barOpen
            pills={
              <>
                <ActionPill icon={<IconPaperclip size={17} strokeWidth={1.8} />} label="Attach" />
                <ActionPill icon={<IconGlobe size={17} strokeWidth={1.8} />} label="Research" />
                <ActionPill icon={<IconSparkles size={17} strokeWidth={1.8} />} label="Task" active />
                <ActionPill icon={<IconShieldCheck size={17} strokeWidth={1.8} />} label="Ask first" />
                <ActionPill icon={<IconMic size={17} strokeWidth={1.8} />} label="Voice" />
              </>
            }
          />
        }
      >
        {sent && <UserTurn text={PROMPT} />}
        {live && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ ...type.name, color: c.textMuted, marginBottom: 6 }}>Aether</div>
            <AgentLiveCard status="Working on it">
              {t >= MILESTONE_1 && (
                <Milestone
                  icon={<IconBrain size={13} strokeWidth={1.8} />}
                  label="Checked your Core"
                  summary="exam June 12, weak on subnetting"
                />
              )}
              {t >= MILESTONE_2 && (
                <Milestone
                  icon={<IconPenLine size={13} strokeWidth={1.8} />}
                  label="Wrote a draft"
                  summary="7-day study plan"
                />
              )}
            </AgentLiveCard>
          </div>
        )}
        {resolved && (
          <AssistantTurn blocks={REPLY} revealed={revealed}>
            {t >= ARTIFACT_AT && (
              <div style={{ marginTop: 8 }}>
                <ArtifactBlock title="7-day study plan" kept={t >= KEPT_AT} />
              </div>
            )}
            {t >= RECEIPT_AT && <ReceiptRow summary="Completed · 2 steps" />}
          </AssistantTurn>
        )}
      </DemoPhone>
    </div>
  );
}
