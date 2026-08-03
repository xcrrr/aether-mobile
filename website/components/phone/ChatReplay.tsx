'use client';
import { PhoneFrame } from './PhoneFrame';
import { DemoHeader } from '@/components/demos/kit/Phone';
import { AssistantTurn, UserTurn, TypingDots, Composer, DemoKeyframes } from '@/components/demos/kit/chat';
import { resolveTimeline, type Beat } from './useTypewriter';

/**
 * The phone screen, rendered for a given conversation progress (0..1). Pure —
 * the scroll choreography lives in the section that drives `progress`.
 *
 * The screen is built from the same kit the feature demos use, so the mission
 * phone and the demo phones can't drift apart from each other or from the app.
 */
export function ChatReplayView({ beats, progress }: { beats: Beat[]; progress: number }) {
  const state = resolveTimeline(beats, progress);
  const streaming = state.streamingIndex >= 0;
  return (
    <PhoneFrame>
      <DemoKeyframes />
      <DemoHeader mode="Fast" />
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden', padding: '20px 16px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <div>
          {state.shown.map((b, i) =>
            b.role === 'user'
              ? <UserTurn key={i} text={b.text} />
              : <AssistantTurn key={i} blocks={[{ kind: 'p', text: b.text }]} revealed={b.text.length} />,
          )}
          {streaming && (
            state.revealed.length === 0
              ? <TypingDots />
              : <AssistantTurn blocks={[{ kind: 'p', text: state.revealed }]} revealed={state.revealed.length} caret />
          )}
        </div>
      </div>
      <div style={{ position: 'relative', padding: '0 12px 10px' }}>
        <Composer />
      </div>
    </PhoneFrame>
  );
}
