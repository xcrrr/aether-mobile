# References

Full source list. Machine-readable version with per-variable mapping: `source-manifest.json`.

1. **Luccioni, A. S., Jernite, Y., & Strubell, E. (2024).** "Power Hungry Processing:
   Watts Driving the Cost of AI Deployment?" *ACM Conference on Fairness, Accountability,
   and Transparency (FAccT 2024).* https://arxiv.org/abs/2311.16863 — accessed 2026-07-03.
   Peer-reviewed conference paper. Supports: cloud data-center compute energy (low
   scenario).

2. **Husom, E. J., Goknil, A., Shar, L. K., & Sen, S. (2024, rev. 2026).** "The Price of
   Prompting: Profiling Energy Use in Large Language Models Inference." arXiv preprint.
   https://arxiv.org/abs/2407.16893 — accessed 2026-07-03. Preprint with explicit,
   reproducible methodology (Scaphandre + nvidia-smi). Supports: cloud data-center compute
   energy (central scenario).

3. **Li, P., Yang, J., Islam, M. A., & Ren, S. (2023, rev. 2025).** "Making AI Less
   'Thirsty': Uncovering and Addressing the Secret Water Footprint of AI Models."
   *Communications of the ACM* / arXiv preprint. https://arxiv.org/abs/2304.03271 —
   accessed 2026-07-03. Peer-reviewed / reputable preprint. Supports: the operational water
   formula, on-site WUE range, off-site EWIF (consumption) figure.

4. **Uptime Institute (2024).** "Global Data Center Survey 2024" / "Large data centers are
   mostly more efficient, analysis confirms." Uptime Institute Journal, 2024-02-07.
   https://journal.uptimeinstitute.com/large-data-centers-are-mostly-more-efficient-analysis-confirms/
   — accessed 2026-07-03. Industry association survey (14th annual). Supports: PUE
   low/central/high scenario bounds.

5. **Aslan, J., Mayers, K., Koomey, J. G., & France, C. (2018).** "Electricity Intensity of
   Internet Data Transmission: Untangling the Estimates." *Journal of Industrial Ecology,*
   22(4), 785-798. https://onlinelibrary.wiley.com/doi/full/10.1111/jiec.12630 — accessed
   2026-07-03. Peer-reviewed journal article. Supports: network transmission energy
   (central scenario).

6. **Google AI Edge team (2026-05-19).** "Blazing fast on-device GenAI with LiteRT-LM."
   Google Developers Blog. https://developers.googleblog.com/blazing-fast-on-device-genai-with-litert-lm/
   — accessed 2026-07-03. Official primary-source technical documentation. Supports: local
   decode throughput for Gemma 4 E2B on Android GPU (OpenCL) — the same model and engine
   Aether ships.

7. **XDA-Developers.** "Qualcomm Snapdragon 8 Gen 3 review." **NotebookCheck.net.**
   "Qualcomm Snapdragon 8 Gen 4 power draw revealed by new rumour." 2024. Technical
   benchmark journalism (measured, tool-based; not peer-reviewed). Supports: local
   incremental power-draw scenario bounds, clearly labeled as a proxy (see
   `limitations.md`).

8. **Huang, J., Qian, F., Gerber, A., Mao, Z. M., Sen, S., & Spatscheck, O. (2012).** "A
   Close Examination of Performance and Power Characteristics of 4G LTE Networks." *ACM
   MobiSys 2012,* pp. 225-238. Peer-reviewed conference paper. Cited as background for the
   client radio active-power assumption; the specific wattage figures used in this study
   are this study's own order-of-magnitude assumption, not a direct quotation from this
   paper — see `source-manifest.json` note on `client_radio_active_power_watts`.

9. **Aether repository (internal, primary source).** `app/src/models/registry.ts`,
   `app/src/llm/LiteRtService.ts`, `app/src/llm/engine.ts`, `app/CLAUDE.md`, `README.md`.
   Source of: model identity (Gemma 4 E2B / E4B), exact model file size, context window
   (4096 tokens), real token-limit anchors for workload sizing, and confirmation that no
   shipped energy telemetry exists.
