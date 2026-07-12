'use client';

import { useEffect } from 'react';

/**
 * Premium, distance-scaled smooth scrolling for in-page anchor links.
 *
 * - Intercepts clicks on any <a href="#id"> (and "/#id") that resolves to an
 *   on-page element, and animates the scroll instead of the browser's jump.
 * - Duration scales with distance, clamped to 500–800ms so short hops still feel
 *   quick and long hops never drag.
 * - Offsets by the sticky topbar height (--nav-h) so headings aren't hidden.
 * - Respects prefers-reduced-motion: falls back to an instant, offset-correct jump
 *   (via CSS scroll-margin-top) and leaves the native anchor behavior alone.
 * - Keeps the URL hash in sync and honors a hash present on direct page load.
 */

const MIN_MS = 500;
const MAX_MS = 800;

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function navOffset() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--nav-h');
  const h = parseInt(raw, 10);
  return (Number.isFinite(h) ? h : 64) + 12;
}

// easeInOutCubic
function ease(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function targetTop(el: HTMLElement) {
  const y = el.getBoundingClientRect().top + window.scrollY - navOffset();
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return Math.max(0, Math.min(y, max));
}

function smoothTo(el: HTMLElement) {
  const start = window.scrollY;
  const end = targetTop(el);
  const dist = Math.abs(end - start);
  if (dist < 2) return;

  const duration = Math.min(MAX_MS, Math.max(MIN_MS, dist * 0.5));
  const startedAt = performance.now();

  function step(now: number) {
    const t = Math.min(1, (now - startedAt) / duration);
    window.scrollTo(0, start + (end - start) * ease(t));
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function idFromHref(href: string | null): string | null {
  if (!href) return null;
  // matches "#id", "/#id", "https://site/#id" — anything with a hash fragment
  const hash = href.includes('#') ? href.slice(href.indexOf('#') + 1) : '';
  return hash ? decodeURIComponent(hash) : null;
}

export function SmoothScroll() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const link = (e.target as Element | null)?.closest('a');
      if (!link) return;

      // ignore new-tab / cross-origin links
      if (link.target && link.target !== '_self') return;
      if (link.origin && link.origin !== window.location.origin) return;

      const id = idFromHref(link.getAttribute('href'));
      if (!id) return;

      // "#main" wrapper resolves too, which is fine (scrolls to top region)
      const el = document.getElementById(id);
      if (!el) return;

      // let reduced-motion users get the native, offset-correct jump
      if (prefersReducedMotion()) {
        e.preventDefault();
        el.scrollIntoView();
        history.pushState(null, '', `#${id}`);
        return;
      }

      e.preventDefault();
      smoothTo(el);
      history.pushState(null, '', `#${id}`);
    }

    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  // land on the right section (offset-correct) for direct loads like /#features
  useEffect(() => {
    const id = idFromHref(window.location.hash);
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    // wait a frame so fonts/layout settle before measuring
    const raf = requestAnimationFrame(() => {
      window.scrollTo(0, targetTop(el));
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return null;
}
