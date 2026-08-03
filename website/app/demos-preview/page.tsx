import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ChatDemo, SeeDemo, FilesDemo, ResearchDemo, CoreDemo } from '@/components/demos';

/* Internal inspection route only — Codex composes the real feature section.
   Not linked from the site.

   Defence in depth: this route is also disallowed in app/robots.ts and marked
   noindex/nofollow below, but production builds still emit and serve it unless
   gated here. Set NEXT_PUBLIC_ENABLE_DEMO_PREVIEW=1 in the environment to opt
   back into rendering it in a production build. */

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const demos = [
  ['Chat', ChatDemo],
  ['See', SeeDemo],
  ['Files', FilesDemo],
  ['Research', ResearchDemo],
  ['Core', CoreDemo],
] as const;

export default function DemosPreview() {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PUBLIC_ENABLE_DEMO_PREVIEW !== '1'
  ) {
    notFound();
  }

  return (
    <main className="shell" style={{ padding: '64px 0 96px' }}>
      <p className="eyebrow">Internal preview</p>
      <h1 className="display-3" style={{ marginTop: 8 }}>Product demos</h1>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '48px 32px', marginTop: 48,
      }}>
        {demos.map(([label, Demo]) => (
          <section key={label}>
            <p className="eyebrow" style={{ color: 'var(--muted)', marginBottom: 16 }}>{label}</p>
            <Demo />
          </section>
        ))}
      </div>
    </main>
  );
}
