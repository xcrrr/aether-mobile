'use client';
import { c, radius, sans, serif, type } from './tokens';
import {
  IconArrowUp, IconFileText, IconPlus, IconStopSquare, IconX,
} from './icons';

/* ---------- assistant content model ---------- */

export type Block =
  | { kind: 'p'; text: string }
  | { kind: 'li'; text: string }
  | { kind: 'hr' }
  | { kind: 'sources'; items: string[] };

export const blockLen = (b: Block): number =>
  b.kind === 'p' || b.kind === 'li' ? b.text.length
  : b.kind === 'hr' ? 4
  : b.items.join('').length;

export const blocksLen = (blocks: Block[]): number =>
  blocks.reduce((n, b) => n + blockLen(b), 0);

/** `**bold**` renders like the app's markdown: Newsreader 500, full white. */
function Inline({ text }: { text: string }) {
  const parts = text.split('**');
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <strong key={i} style={{ fontWeight: 500, color: c.text }}>{part}</strong>
          : <span key={i}>{part}</span>,
      )}
    </>
  );
}

function BlockView({ block, revealed }: { block: Block; revealed: number }) {
  if (revealed <= 0) return null;
  if (block.kind === 'hr') {
    return <div style={{ height: 1, background: c.border, margin: '10px 0' }} />;
  }
  if (block.kind === 'sources') {
    return (
      <div style={{ padding: '6px 0' }}>
        {block.items.map((item, i) => {
          const used = block.items.slice(0, i).reduce((sum, prev) => sum + prev.length, 0);
          const slice = Math.max(0, Math.min(item.length, revealed - used));
          if (slice <= 0) return null;
          return (
            <div key={i} style={{ ...type.assistantBody, color: c.text }}>
              {i + 1}. <span style={{ color: c.violet }}>{item.slice(0, slice)}</span>
            </div>
          );
        })}
      </div>
    );
  }
  const text = block.text.slice(0, revealed);
  if (block.kind === 'li') {
    return (
      <div style={{ display: 'flex', gap: 8, padding: '2px 0 2px 4px' }}>
        <span style={{ ...type.assistantBody, color: c.text }}>•</span>
        <div style={{ ...type.assistantBody, color: c.text, flex: 1 }}><Inline text={text} /></div>
      </div>
    );
  }
  return (
    <div style={{ ...type.assistantBody, color: c.text, padding: '6px 0', whiteSpace: 'pre-wrap' }}>
      <Inline text={text} />
    </div>
  );
}

/**
 * An assistant turn, exactly as the app renders one: muted name label, then
 * bare serif prose on the canvas — no bubble, no avatar. `revealed` is how
 * many characters of the block list are visible (streaming).
 */
export function AssistantTurn({ blocks, revealed, children }: {
  blocks: Block[];
  revealed: number;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 32, animation: 'demoRise 300ms var(--ease) both' }}>
      <div style={{ ...type.name, color: c.textMuted, marginBottom: 6 }}>Aether</div>
      {blocks.map((b, i) => {
        const len = blockLen(b);
        const used = blocks.slice(0, i).reduce((sum, prev) => sum + blockLen(prev), 0);
        const slice = Math.max(0, Math.min(len, revealed - used));
        return <BlockView key={i} block={b} revealed={slice} />;
      })}
      {children}
    </div>
  );
}

/** In-place status while Research works — the app streams `_status_` italics. */
export function StatusTurn({ text }: { text: string }) {
  return (
    <div style={{ marginBottom: 32, animation: 'demoRise 300ms var(--ease) both' }}>
      <div style={{ ...type.name, color: c.textMuted, marginBottom: 6 }}>Aether</div>
      <div style={{ fontFamily: serif, fontStyle: 'italic', fontSize: 16, lineHeight: '25px', color: c.text }}>
        {text}
      </div>
    </div>
  );
}

export function TypingDots() {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ ...type.name, color: c.textMuted, marginBottom: 6 }}>Aether</div>
      <div style={{ display: 'flex', gap: 5, padding: '6px 2px' }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{
            width: 6, height: 6, borderRadius: 999,
            background: i === 1 ? c.violet : c.textMuted,
            animation: `demoDot 1.2s ${i * 0.18}s ease-in-out infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

/* ---------- user side ---------- */

export function FileCard({ name, meta }: { name: string; meta: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, maxWidth: 240,
      background: c.bgInput, borderRadius: radius.md, padding: '9px 11px',
    }}>
      <span style={{
        width: 34, height: 34, borderRadius: radius.sm, background: c.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none',
      }}>
        <IconFileText size={18} color={c.violet} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ ...type.label, color: c.text, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
        <span style={{ ...type.metadata, color: c.textMuted, display: 'block', marginTop: 1 }}>{meta}</span>
      </span>
    </div>
  );
}

/** A user turn: attachments stacked above the quiet bordered bubble, right-aligned. */
export function UserTurn({ text, attachment }: { text: string; attachment?: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8,
      marginBottom: 24, animation: 'demoRise 300ms var(--ease) both',
    }}>
      {attachment}
      <div style={{
        maxWidth: '82%', background: c.bgInput, border: `1px solid ${c.border}`,
        color: c.text, ...type.input, padding: '10px 15px',
        borderRadius: radius.md, borderBottomRightRadius: radius.sm,
      }}>
        {text}
      </div>
    </div>
  );
}

/* ---------- composer ---------- */

export function ActionPill({ icon, label, active }: {
  icon: React.ReactNode; label: string; active?: boolean;
}) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: '7px 11px', borderRadius: radius.md,
      background: active ? c.violetDim : c.bg,
      border: `1px solid ${active ? 'rgba(124,58,237,0.14)' : c.border}`,
      ...type.label, color: active ? c.violet : c.text,
    }}>
      <span style={{ display: 'flex', color: active ? c.violet : c.textMuted }}>{icon}</span>
      {label}
    </span>
  );
}

/** The composer-side attachment preview chip (image thumb or file icon). */
export function ComposerChip({ name, meta, thumb }: {
  name: string; meta: string; thumb?: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 8,
      background: c.bgCard, border: `1px solid ${c.border}`,
      borderRadius: radius.sm, padding: '6px 8px',
      animation: 'demoRise 300ms var(--ease) both',
    }}>
      {thumb ?? (
        <span style={{
          width: 40, height: 40, borderRadius: radius.sm, background: c.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconFileText size={18} color={c.violet} />
        </span>
      )}
      <span>
        <span style={{ ...type.label, color: c.text, display: 'block' }}>{name}</span>
        <span style={{ ...type.metadata, color: c.textMuted, display: 'block', marginTop: 1 }}>{meta}</span>
      </span>
      <span style={{ display: 'flex', padding: 2, marginLeft: 4, color: c.textMuted }}>
        <IconX size={15} />
      </span>
    </div>
  );
}

export function VisionBadge() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, paddingLeft: 2,
      animation: 'demoRise 300ms var(--ease) both',
    }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: c.success }} />
      <span style={{ ...type.caption, color: c.textMuted }}>Vision active</span>
    </div>
  );
}

/**
 * The app's composer: optional pills bar and attachment chip, plus button,
 * input with typed text + caret, and the send/stop control with the real
 * state colors (violet ready · gray idle · red stop while generating).
 */
export function Composer({ value = '', placeholder = 'Message Aether', generating = false, caret = false, pills, chip, badge, barOpen = false }: {
  value?: string;
  placeholder?: string;
  generating?: boolean;
  caret?: boolean;
  pills?: React.ReactNode;
  chip?: React.ReactNode;
  badge?: React.ReactNode;
  barOpen?: boolean;
}) {
  const ready = value.length > 0;
  const sendBg = generating ? c.danger : ready ? c.violet : c.bgInput;
  return (
    <div style={{ background: c.bg, paddingTop: 6 }}>
      {chip}
      {badge}
      {pills && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>{pills}</div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
        <span style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.textMuted }}>
          {barOpen ? <IconX size={20} strokeWidth={1.8} /> : <IconPlus size={21} strokeWidth={1.8} />}
        </span>
        <div style={{
          flex: 1, background: c.bgInput, border: `1px solid ${c.border}`,
          borderRadius: radius.lg, padding: '10px 15px', minHeight: 42,
          ...type.input, color: value ? c.text : c.textMuted,
        }}>
          {value || placeholder}
          {caret && <span style={{ opacity: 0.7, color: c.text }}>▍</span>}
        </div>
        <span style={{
          width: 40, height: 40, borderRadius: 999, background: sendBg, flex: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 160ms var(--ease)',
        }}>
          {generating
            ? <IconStopSquare color={c.white} />
            : <IconArrowUp size={19} color={ready ? c.white : c.textMuted} strokeWidth={2.2} />}
        </span>
      </div>
      <div style={{ textAlign: 'center', ...type.metadata, color: c.textMuted, padding: '8px 0 0', fontFamily: sans }}>
        Aether is an AI and can make mistakes. Replies run on-device.
      </div>
    </div>
  );
}

/** Keyframes shared by every demo — mount once per demo root. */
export function DemoKeyframes() {
  return (
    <style>{`
      @keyframes demoRise { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: none; } }
      @keyframes demoDot { 0%, 80%, 100% { opacity: 0.28; transform: scale(0.82); } 40% { opacity: 1; transform: scale(1.16); } }
      @keyframes demoPulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
      @media (prefers-reduced-motion: reduce) {
        [data-demo-root] * { animation: none !important; transition: none !important; }
      }
    `}</style>
  );
}
