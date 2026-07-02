# Aether Actions V1 — Tool Registry

Source of truth: `app/src/agent/ToolRegistry.ts` (`TOOL_SPECS`). The set is
closed: specs live in code, executors are injected, anything else is blocked.

## V1 tools

| Tool | Risk class | Args | What it wraps | Notes |
|---|---|---|---|---|
| `web_research` | `web_read` | `query` ≤300 | `webresearch/ResearchEngine.runResearch` (DDG → fetch → sanitize → grounded answer) | Budget 2 (3 in Auto/E4B); sources land in the receipt |
| `read_core` | `core_read` | `topic` ≤200 | `secondbrain/recall.selectRecall` over `MemoryStore` | Deterministic token-overlap; no model in selection |
| `read_attachments` | `local_read_scoped` | — | Pre-extracted text of files the user attached to this conversation | 2.5k chars/doc into context; never any other file |
| `create_artifact` | `artifact_draft` | `title` ≤120, `outline` ≤500 | Kernel-run dedicated model call over gathered data | Draft by default; Keep button saves; Auto mode saves to workspace |
| `ask_user` | `interaction` | `question` ≤200, `options` 2–4 | Existing QuestionCard UI, kernel pauses on a resolver | The card *is* the consent surface |
| `finish` | `terminal` | `answer` ≤12000 | Ends the task | Empty/token-only answers rejected |

## Risk taxonomy

`core_read`, `local_read_scoped`, `web_read`, `artifact_draft`, `interaction`,
`terminal`. Classes like `external_write`, `destructive`, `shell` deliberately do
not exist — there is nothing to gate because the tools don't exist, and
`PolicyEngine.decide` blocks any class outside the union anyway.

## Evaluated and deferred / rejected

| Candidate | Verdict | Why |
|---|---|---|
| Folder/workspace reading (SAF tree) | **Phase 2** | High value, needs a real scoped-grant UI + persisted tree URIs; not rushed into V1 |
| Local export / share sheet | **Phase 2** | External-write class; needs its own approval UX |
| Note/flashcard/structured generators | **Covered** | `create_artifact` already produces these as markdown |
| Reminder/notification proposals | **Phase 3** | Needs notification permission architecture |
| Background queue proposals | **Phase 3, maybe never** | Android WorkManager + honesty constraints; foreground-only for now |
| Patch/diff proposals over a code workspace | **Phase 3** | Depends on folder reading; E2B/E4B ability unproven |
| Sending email/messages, purchases, publishing | **Rejected** | Hard safety boundary |
| Shell, plugin installation, browser automation | **Rejected** | Hard safety boundary; also structurally impossible in this app |

## Adding a tool later (contract)

1. Add the spec to `TOOL_SPECS` with the narrowest honest risk class and strict
   arg validation.
2. Add the executor in `tools.ts`; it must normalize failures (`ok:false`) and
   never throw across the kernel boundary.
3. Update the PolicyEngine matrix if a new class is introduced (default is
   blocked).
4. Add kernel tests: policy decision per mode, injection via its output, failure
   honesty, receipt accuracy.
