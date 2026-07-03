import { ChatDemo, SeeDemo, FilesDemo, ResearchDemo, TaskDemo } from '@/components/demos';

/* Internal inspection route only — Codex composes the real feature section.
   Not linked from the site. */

const demos = [
  ['Chat', ChatDemo],
  ['See', SeeDemo],
  ['Files', FilesDemo],
  ['Research', ResearchDemo],
  ['Task', TaskDemo],
] as const;

export default function DemosPreview() {
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
