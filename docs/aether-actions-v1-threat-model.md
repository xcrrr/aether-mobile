# Aether Actions V1 — Threat Model

Scope: the agent path added in V1. Baseline: everything the chat app already
enforced (safety.ts SSRF guards, sanitized web text, no shell, no accounts, no
arbitrary filesystem API in the app at all) still applies.

## Trust boundaries

1. **User goal → kernel**: trusted as intent, still clamped in prompts.
2. **Model output → kernel**: untrusted *proposal*. Only `parse.ts` reads it, only
   validated tool+args survive, and the PolicyEngine ignores everything else.
3. **Tool output → prompts**: fully untrusted data. Passes `scrubUntrusted`
   (Gemma control tokens stripped, `__aether_action`/`__aether_question` markers
   removed, hard char clamp) and is framed as data, never instructions.
4. **Web → device**: unchanged research pipeline — scheme allow-list, private-host
   and redirect re-validation, size/time caps (`webresearch/safety.ts`,
   `ContentFetcher.ts`).
5. **Storage**: tasks/artifacts are local AsyncStorage only; nothing leaves the
   device except research GET requests.

## Threats and mitigations

| # | Threat | Attack path | Deterministic mitigation | Test |
|---|---|---|---|---|
| 1 | Direct prompt injection | Goal text tells agent to "grant yourself file access" | No such tool exists; unknown tools blocked; policy never reads prompt text | Kernel: self-grant test |
| 2 | Indirect web injection | Malicious page embeds action JSON / control tokens | `scrubUntrusted` on every tool detail + step summary; only model output is parsed for actions | Kernel: injection suite; prompts tests |
| 3 | Malicious document | Attached PDF/docx carries instructions or markers | Same scrubbing; attachments are pre-extracted text, clamped to 2.5k chars per doc | prompts scrub tests |
| 4 | Core memory poisoning | A poisoned memory instructs the agent | Recall is deterministic token-overlap (no model in selection); recalled text is scrubbed like any tool detail | scrub tests; recall is unchanged from chat |
| 5 | Tool-result injection | Executor returns hostile `summary`/`detail` | Summaries scrubbed before prompt reuse; details scrubbed + clamped; receipts render as text | Kernel: hostile-summary test |
| 6 | Permission escalation | Model proposes privileged tool / extra args / "mode": "auto" | Closed registry (specs are code); undeclared args stripped; mode lives in kernel state fixed at start | Kernel: self-grant + mode tests; registry tests |
| 7 | Path traversal / arbitrary file read | Model invents a `path` arg | No tool takes a path. `read_attachments` reads only pre-extracted text of user-picked files (SAF) | Registry: extra-arg strip test |
| 8 | SSRF / private hosts / redirects | Research lured to internal endpoints | Unchanged `safety.ts` + redirect re-validation | Existing webresearch suite |
| 9 | Data exfiltration | Web tool used to send Core data out | Research is GET-only with a model-written *query* (≤300 chars, user-visible in receipt); no POST tool exists. Residual risk: a query could embed short private strings — mitigated by receipt visibility and Strict mode approval | Receipt shows query args |
| 10 | Fake action completion | Model claims success | Only executor `ok` sets `executed`; receipts are ledger projections | Kernel: failed-tool + receipt tests |
| 11 | Infinite / retry loops | Model repeats an action or fails forever | Repeat-hash blocking, retry cap 1, malformed cap 2, step/model-call/wall-clock budgets | Kernel: loop/budget suite |
| 12 | Runaway after cancel | Steps continue post-stop | Cancel flag checked after every await; `Llama.stop()`; pending prompts resolved | Kernel: cancellation suite |
| 13 | Crash dishonesty | Process death leaves "running" tasks | `markInterruptedTasks()` at startup; receipts state interruption | taskStorage tests |
| 14 | Confused deputy via ask_user | Hostile content phrases a question to trick the user | Question card renders as plain text (no markdown links tapped into actions); options are just strings sent back | UI renders text only |
| 15 | Supply chain | New deps for the agent | Zero new dependencies added | package.json diff |
| 16 | Background abuse | Hidden work after app close | No background execution exists in V1; foreground only, by design | Architecture doc |
| 17 | Receipt manipulation | Model writes its own receipt | Model never sees or produces receipt structures | buildReceipt is code-only |

## Model role vs policy role vs user role

- **Model**: proposes one action per step; writes answer/artifact text.
- **Policy engine (code)**: decides auto/approval/blocked; enforces budgets,
  loop caps, retries; fixes mode and scope at task start.
- **User**: picks the mode, approves flagged steps, answers questions, can stop
  at any time, keeps or discards artifact drafts.

## Known limitations (honest)

- A hostile web page can still *influence* content: wrong facts in an answer or
  artifact, or steering which safe tool runs next. Bounded by budgets and the
  closed tool set; not eliminated. This is inherent to using retrieved text.
- Research queries are model-written; short private strings from context could
  appear in a query (threat #9). Strict mode shows the query before it runs.
- Sanitization is deny-list based (control tokens + markers). Novel jailbreak
  phrasing still reaches the model as data; the defense is that *nothing the
  model can output* escapes the registry + policy + budgets.
- All injection tests run against mocks in Jest; on-device adversarial testing
  with real Gemma outputs is still required (see verification doc).
