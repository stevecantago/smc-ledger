Inspect .agents/skills, read the relevant SKILL.md files, and verify supporting files and dependencies before starting the revamp.

This task is the preparation and verification stage only. Do not begin the revamp or modify application files yet.

1. Confirm the repository is stevecantago/smc-ledger and record the checked-out branch and commit. Read .agents/README.md.
2. Run `python .agents/verify-skills.py`. Confirm all seven packages and supporting assets exist as actual files. Read each SKILL.md and Impeccable's reference/document.md and reference/critique.md without invoking their design workflows yet.
3. Check installed runtimes and relevant package availability. Run the two help checks in the README. Distinguish instruction-only packages from optional script dependencies. Report needed setup changes; do not install unnecessary packages or modify application dependencies.
4. Inspect the actual available tools for built-in image generation. Separately check API fallback package/key presence without printing secret values. A copied skill, package installation, or present key is not proof of a working authenticated generation service. Do not make billable API calls. Report image capability as available, unavailable, or unverified with evidence.
5. For interactive browser work use only Codex's embedded browser. Do not launch a native browser through any skill script. If the embedded browser is unavailable, report the blocker and ask for direction before browser work.
6. Report file and dependency checks, license notices, missing capabilities, and the next action. If cloud image generation is unavailable, identify the supported file flow for receiving locally generated artwork. Do not invent an upload mechanism.

Stop after the verification report. Do not deploy, merge, change external systems, access production data, or generate artwork. The visual revamp requires a separately reviewed scope and design.
