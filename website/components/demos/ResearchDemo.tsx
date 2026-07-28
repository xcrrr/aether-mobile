'use client';
import { DemoPhone } from './kit/Phone';
import { c, radius, spacing, type } from './kit/tokens';
import { useDemoClock, prog, burst, typeSlice, loopOpacity } from './kit/timeline';
import {
  AssistantTurn, UserTurn, Composer, ActionPill,
  DemoKeyframes, type Block, blocksLen,
} from './kit/chat';
import { IconCheck, IconGlobe, IconMic, IconPaperclip } from './kit/icons';

/*
 * Demo 4 — Research. Mirrors the real pipeline in app/src/webresearch: up to
 * SEARCH_CANDIDATES sources are over-fetched in a parallel wave and read at
 * once (not one at a time), so the live card shows several sources "reading"
 * together, each landing on its own as read or failed — a dead page costs
 * nothing as long as three others come back. The finished answer carries
 * inline [n] markers and numbered source cards, matching
 * app/src/components/chat/ResearchCard.tsx exactly rather than the old
 * hr + "**Sources**" + plain-list rendering, which the app no longer has.
 */

const PROMPT = 'What’s new in small on-device language models for Android?';

const ANSWER: Block[] = [
  { kind: 'p', text: 'The center of gravity is small multimodal models. Gemma’s 2–4B releases now run fully on-device on recent Android phones through LiteRT, with vision folded into the same model file [1].' },
  { kind: 'p', text: 'Hardware moved too: NPU delegation is a first-class path on Android now, and 2026 flagship chips roughly double token speed for quantized models [2][3]. The practical ceiling is still memory — 4B-class models want about 4 GB of free RAM.' },
];
const ANSWER_LEN = blocksLen(ANSWER);

const SOURCES = [
  { domain: 'ai.google.dev', title: 'Gemma — on-device models' },
  { domain: 'developer.android.com', title: 'On-device AI on Android' },
  { domain: 'qualcomm.com', title: 'Snapdragon AI Engine' },
];

type LiveState = 'reading' | 'read' | 'failed';
/** One over-fetched wave: four candidates read in parallel — three land in
 *  the prompt, one fails and costs the answer nothing. */
const LIVE_SOURCES: Array<{ domain: string; title: string; state: LiveState; at: number }> = [
  { domain: 'ai.google.dev', title: 'Gemma — on-device models', state: 'read', at: 4300 },
  { domain: 'developer.android.com', title: 'On-device AI on Android', state: 'read', at: 4550 },
  { domain: 'reddit.com', title: 'r/Android — small LLMs thread', state: 'failed', at: 4700 },
  { domain: 'qualcomm.com', title: 'Snapdragon AI Engine', state: 'read', at: 4950 },
];

const TYPE_A = 700, TYPE_B = 2500;
const SEND = 2650;
const SEARCHING_AT = 2800;
const READING_AT = 3400;
const WRITING_AT = 5100;
const STREAM_A = WRITING_AT, STREAM_B = 11500;
const CARDS_AT = STREAM_B + 300;
const DURATION = 13000, HOLD = 4000;

function liveSourcesAt(t: number) {
  if (t < READING_AT) return [];
  return LIVE_SOURCES.map((s) => ({
    domain: s.domain,
    title: s.title,
    state: (t >= s.at ? s.state : 'reading') as LiveState,
  }));
}

function statusAt(t: number): string {
  if (t < READING_AT) return 'Searching the web';
  if (t < WRITING_AT) {
    const read = liveSourcesAt(t).filter((s) => s.state === 'read').length;
    return read > 0 ? `Read ${read} of 3 sources` : 'Opening sources';
  }
  return 'Writing from 3 sources';
}

/** Slow breathing dot for a source still in flight — the same demoPulse loop
 *  the live task card uses for its "working" indicator. */
function ReadingDot() {
  return <span style={{ width: 7, height: 7, borderRadius: 4, background: c.violet, animation: 'demoPulse 1.2s ease-in-out infinite' }} />;
}

function IconMinus({ size = 13, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" aria-hidden>
      <path d="M5 12h14" />
    </svg>
  );
}

function LiveSourceRow({ domain, title, state }: { domain: string; title: string; state: LiveState }) {
  const dim = state === 'failed';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, animation: 'demoRise 300ms var(--ease) both' }}>
      <span style={{ width: 14, display: 'flex', justifyContent: 'center', flex: 'none' }}>
        {state === 'read' && <IconCheck size={13} color={c.violet} strokeWidth={2.4} />}
        {state === 'failed' && <IconMinus size={13} color={c.textMuted} />}
        {state === 'reading' && <ReadingDot />}
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <div style={{ ...type.metadata, fontWeight: 600, color: dim ? c.textMuted : c.text, opacity: dim ? 0.55 : 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {domain}
        </div>
        <div style={{ ...type.metadata, color: c.textMuted, opacity: dim ? 0.55 : 1, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {state === 'failed' ? "couldn't be opened" : title}
        </div>
      </span>
    </div>
  );
}

/** Research in flight — mirrors ResearchLiveCard: a phase line, then one row
 *  per source showing whether it was read or failed, live. */
function ResearchLiveCard({ t }: { t: number }) {
  return (
    <div style={{
      background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: radius.md,
      padding: spacing.md, marginTop: spacing.xs, display: 'flex', flexDirection: 'column', gap: spacing.sm,
      animation: 'demoRise 300ms var(--ease) both',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
        <IconGlobe size={14} color={c.violet} strokeWidth={2} />
        <span style={{ ...type.status, fontWeight: 600, color: c.text }}>{statusAt(t)}</span>
      </div>
      {liveSourcesAt(t).map((s) => <LiveSourceRow key={s.domain} {...s} />)}
    </div>
  );
}

/** One numbered card in the finished answer's source list, matching
 *  ResearchSources: a chip with the citation number, title, and domain. */
function SourceCard({ n, domain, title }: { n: number; domain: string; title: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: spacing.sm,
      padding: '10px 12px', borderRadius: radius.md, border: `1px solid ${c.border}`, background: c.bgCard,
    }}>
      <span style={{
        width: 20, height: 20, borderRadius: radius.full, background: c.violetDim, flex: 'none', marginTop: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ ...type.metadata, fontWeight: 600, color: c.violet }}>{n}</span>
      </span>
      <span style={{ minWidth: 0 }}>
        <div style={{ ...type.label, color: c.text }}>{title}</div>
        <div style={{ ...type.metadata, color: c.textMuted, marginTop: 2 }}>{domain}</div>
      </span>
    </div>
  );
}

function ResearchSourceCards() {
  return (
    <div style={{ marginTop: spacing.md, display: 'flex', flexDirection: 'column', gap: spacing.sm, animation: 'demoRise 300ms var(--ease) both' }}>
      <div style={{ ...type.label, color: c.textMuted }}>{SOURCES.length} sources</div>
      {SOURCES.map((s, i) => <SourceCard key={s.domain} n={i + 1} domain={s.domain} title={s.title} />)}
    </div>
  );
}

export function ResearchDemo() {
  const { ref, t } = useDemoClock({ duration: DURATION, hold: HOLD, restAt: DURATION });

  const typed = typeSlice(PROMPT, t, TYPE_A, TYPE_B);
  const sent = t >= SEND;
  const revealed = burst(prog(t, STREAM_A, STREAM_B) * ANSWER_LEN);
  const streaming = t >= STREAM_A && t < STREAM_B;
  const generating = t >= SEARCHING_AT && t < STREAM_B;

  return (
    <div ref={ref} data-demo-root style={{ display: 'flex', justifyContent: 'center' }}>
      <DemoKeyframes />
      <DemoPhone
        mode="Fast"
        opacity={loopOpacity(t, DURATION, HOLD)}
        composer={
          <Composer
            value={sent ? '' : typed}
            caret={!sent && t >= TYPE_A && t < SEND}
            placeholder="Research the web..."
            generating={generating}
            barOpen
            pills={
              <>
                <span style={{ opacity: 0.5 }}>
                  <ActionPill icon={<IconPaperclip size={17} strokeWidth={1.8} color={c.border} />} label="Attach" />
                </span>
                <ActionPill icon={<IconGlobe size={17} strokeWidth={1.8} />} label="Research" active />
                <ActionPill icon={<IconMic size={17} strokeWidth={1.8} />} label="Voice" />
              </>
            }
          />
        }
      >
        {sent && <UserTurn text={PROMPT} />}
        {sent && t >= SEARCHING_AT && (t < STREAM_A
          ? <ResearchLiveCard t={t} />
          : (
            <AssistantTurn blocks={ANSWER} revealed={revealed}>
              {!streaming && t >= CARDS_AT && <ResearchSourceCards />}
            </AssistantTurn>
          ))}
      </DemoPhone>
    </div>
  );
}
