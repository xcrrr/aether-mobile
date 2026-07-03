'use client';
import { useEffect, useRef, useState } from 'react';
import { PhoneFrame } from '../../phone/PhoneFrame';
import { c, sans, type } from './tokens';
import { IconMenu, IconPlus, IconChevronDown } from './icons';

/** The real app's chat header: menu · wordmark + mode chip · new chat. */
export function DemoHeader({ mode }: { mode: 'Fast' | 'Thinking' }) {
  return (
    <div style={{
      position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 12,
      padding: '40px 14px 10px', background: c.bg, borderBottom: `1px solid ${c.border}`,
    }}>
      <span style={{ width: 24, display: 'flex', color: c.text }}><IconMenu size={22} /></span>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <span style={{ ...type.wordmark, color: c.text }}>Aether</span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, paddingTop: 2,
          fontFamily: sans, fontSize: 12, fontWeight: 600, color: c.textMuted,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: c.textMuted }} />
          {mode}
          <IconChevronDown color={c.textMuted} />
        </span>
      </div>
      <span style={{ width: 24, display: 'flex', justifyContent: 'flex-end', color: c.text }}>
        <IconPlus size={21} />
      </span>
    </div>
  );
}

/**
 * One demo = one phone playing a deterministic recording. The screen is the
 * app's chat layout: header, conversation pinned to the bottom, composer.
 * Scales itself to its container width (360px design size) so Codex can drop
 * it into any column.
 */
export function DemoPhone({ mode, opacity = 1, children, composer }: {
  mode: 'Fast' | 'Thinking';
  opacity?: number;
  children: React.ReactNode;
  composer: React.ReactNode;
}) {
  const wrap = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setScale(Math.min(1, entry.contentRect.width / 360));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrap} style={{ width: '100%', maxWidth: 360, height: 740 * scale }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: 360 }}>
        <PhoneFrame>
          <DemoHeader mode={mode} />
          <div style={{
            position: 'relative', flex: 1, overflow: 'hidden', opacity,
            padding: '20px 16px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          }}>
            <div>{children}</div>
          </div>
          <div style={{ position: 'relative', padding: '0 12px 10px', opacity }}>
            {composer}
          </div>
        </PhoneFrame>
      </div>
    </div>
  );
}
