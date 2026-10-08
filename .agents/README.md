# Repository skills

Seven installed skill folders are vendored as actual files under `.agents/skills`.
This is the [repository discovery path supported by Codex](https://learn.chatgpt.com/docs/build-skills).
The global installations remain unchanged. Review date: 2026-10-09.

## Contents and redistribution

| Skill | Source | License evidence |
| --- | --- | --- |
| impeccable | [pbakaus/impeccable, skill-v4.1.3](https://github.com/pbakaus/impeccable/tree/c0f495212236129c2e92aaf7714a3a9914569d13) | Apache-2.0; `LICENSE`, `NOTICE.md`, and third-party MIT licenses included |
| frontend-design | Installed skill; [anthropics/skills](https://github.com/anthropics/skills) | Original Apache-2.0 `LICENSE.txt` retained |
| imagegen | Installed OpenAI system skill | Original Apache-2.0 `LICENSE.txt` retained |
| tailwind-design-system | [wshobson/agents](https://github.com/wshobson/agents/tree/46891e7e60da0e52baf1050b7b6391b64e84c6d9) | MIT; upstream `LICENSE` added |
| shadcn | [shadcn-ui/ui](https://github.com/shadcn-ui/ui/tree/0132174664c07d41262fb51012d0cc782e458e6c) | MIT; upstream `LICENSE.md` added |
| make-interfaces-feel-better | [jakubkrehel/make-interfaces-feel-better](https://github.com/jakubkrehel/make-interfaces-feel-better/tree/35545ea1512ad59fa463e6b1f95ca9c052981fe6) | MIT; upstream `LICENSE` added |
| web-design-guidelines | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills/tree/063bee94c3f4df8453406c830b0a7df0f2860278) | Upstream README explicitly declares MIT; retained as `UPSTREAM-README.md`, with MIT terms in `LICENSE.txt` |

- Upstream links identify license evidence; they do not assert every installed file is from that revision.
- All 168 Impeccable package files match its published 4.1.3 Codex package byte for byte.
- Its `document` and `critique` commands remain at `impeccable/reference/document.md` and `impeccable/reference/critique.md`. Scripts, agents, detector, and nested references retain their names and layout.
- Impeccable third-party notices cover platform guidance and the bundled modern-screenshot library. Their MIT licenses came from [platform-design-skills](https://github.com/ehmo/platform-design-skills/blob/dc2be825d8b439caea78e9eaa8fb3ac23b0ff3e9/LICENSE) and [modern-screenshot](https://github.com/qq15725/modern-screenshot/blob/792d6db7411839c62940a6e930161f8e376e817f/LICENSE).
- No installed skill source was edited. Added files supply attribution, licensing, and packaging checks.
- One empty local runtime cache, `impeccable/scripts/.impeccable/hook.cache.json`, is excluded from Git. It is not a supporting package resource.
- Targeted checks found no credentials, personal paths, private contact details, or private business context in the copied files. Public author names and copyright notices are retained.
- No global configuration, credentials, history, or unrelated skills are included.

## Verification

```sh
python .agents/verify-skills.py
node .agents/skills/impeccable/scripts/detect.mjs --help
python .agents/skills/imagegen/scripts/image_gen.py --help
```

`skill-files.json` records every shipped skill file, its size, SHA-256 digest, and whether it came from the installed folder or added license evidence. The verifier checks completeness, bytes, and the absence of filesystem links. Local verification also checked 116 JavaScript module/Python scripts for syntax errors. These checks do not establish cloud tool or API availability.

## Cloud dependencies and limits

- Instruction-only skills need no package installation. Read their `SKILL.md` and linked references before use.
- Impeccable core scripts require Node.js; its release specifies Node >=22.18.0. Regex detection works without additional packages.
- Static HTML detection additionally needs `htmlparser2`, `css-select`, `css-tree`, and `domutils`. Install these only if needed in the cloud setup, with versions matching the [release dependency declarations](https://github.com/pbakaus/impeccable/blob/c0f495212236129c2e92aaf7714a3a9914569d13/package.json). Live copy editing optionally uses `@babel/parser`; Svelte helpers depend on the project's Svelte installation.
- Some optional Impeccable scripts launch Playwright, Puppeteer, or the system browser. The user's embedded-browser-only policy takes precedence: do not run those launch paths without an explicit policy exception. Use available embedded browser tooling, or report that the check is unavailable.
- shadcn operations need the appropriate Node package runner and registry access when invoked; copying its instructions does not install components.
- web-design-guidelines fetches its rules from the URL in `SKILL.md`; verify network access before an audit.
- Imagegen instructions do not provide an image-generation tool, authentication, or API access. Verify the cloud task's actual tool inventory first.
- Imagegen's optional API fallback needs Python and `openai`; `Pillow` supports image processing and the chroma-key helper. It also requires `OPENAI_API_KEY` and explicit approval for API fallback. Never print or commit a key, and do not make a billable generation request just to check packaging.
- If built-in image generation is unavailable in the cloud, report the gap. Artwork can be generated locally and transferred through a supported file flow later.

Use the configured [cloud environment setup](https://learn.chatgpt.com/docs/environments/cloud-environment) for necessary script dependencies. No cloud setup or authentication has been changed by this packaging work.

## Cloud task handoff

Launch from the pushed skills branch, then use the prompt in `cloud-verification-prompt.md`. Verify skills and capabilities first. A visual revamp needs its own reviewed design and implementation scope; this handoff does not authorize changes to application behavior or production.
