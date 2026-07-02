import { PhoneFrame } from './PhoneFrame';
import { UserBubble } from './chat/UserBubble';
import { AssistantTurn } from './chat/AssistantTurn';
import { TypingDots } from './chat/TypingDots';
import { InputBar } from './chat/InputBar';
import { TopBar } from './chat/TopBar';
import { resolveTimeline, type Beat } from './useTypewriter';

/**
 * The phone screen, rendered for a given conversation progress (0..1). Pure —
 * the scroll choreography lives in the section that drives `progress`.
 */
export function ChatReplayView({ beats, progress }: { beats: Beat[]; progress: number }) {
  const state = resolveTimeline(beats, progress);
  const streaming = state.streamingIndex >= 0;
  return (
    <PhoneFrame>
      <TopBar />
      <div style={{ position: 'relative', flex: 1, overflow: 'hidden', padding: '20px 16px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <div>
          {state.shown.map((b, i) =>
            b.role === 'user'
              ? <UserBubble key={i} text={b.text} />
              : <AssistantTurn key={i} text={b.text} />,
          )}
          {streaming && (
            state.revealed.length === 0
              ? <TypingDots />
              : <AssistantTurn text={state.revealed} caret />
          )}
        </div>
      </div>
      <div style={{ position: 'relative', padding: '0 12px 12px' }}>
        <InputBar />
      </div>
    </PhoneFrame>
  );
}
