# PROJECT_RULES.md — KinesioLive Core Invariants

> **Scope:** This project only (`d:\TP\Hackathon\Cometchat`).

---

## 🚨 1. COMETCHAT COMES FIRST & AUTOMATIC SKILL INVOCATION

1. **Automatic Skill Invocation (NO MANUAL PROMPTS NEEDED):**
   - The agent MUST **automatically inspect and execute the matching skill** in `.cometchat/skills/` (and `.agents/skills/`) whenever performing any CometChat task (initialization, login, messaging, calling, groups, presence, UI components, customization).
   - You do NOT need to remind or tell the agent to use the skills. The agent consults the dispatch table in `AGENTS.md` and opens the corresponding `SKILL.md` directly before modifying or creating code.
2. **CometChat is the Core:** It carries the product (calls, transient and custom messages, groups, presence, token auth). In every architectural or task trade-off, protect the CometChat path first. A feature that weakens or complicates CometChat loses.
3. **Follow CometChat RULES.md & Skills:** Before touching any CometChat area, inspect `.cometchat/skills/RULES.md` and the relevant skill file in `.cometchat/skills/`. Never code or answer from unverified training memory.
4. **MCP Before Code:** For all CometChat areas (init/login, groups, custom messages, transient messages, Calls v5, token auth), call the CometChat MCP first (docs search, fetch page, implementation bundle) and log every call in `COMETCHAT_INTEGRATION.md` with tool, query, page or bundle, last-verified date, and what it changed.
5. **Docs Beat Memory:** If official docs and memory conflict, the docs win. If the docs are silent on a point, mark the item `UNVERIFIED` and add a spike. Never invent SDK method names. Never read `node_modules` or `*.d.ts` for API surface.
6. **Skills Reference:** The upstream pack is cloned at `cometchat-skills/` (https://github.com/cometchat/cometchat-skills). It is read-only reference. Do not edit it, and do not import from it.
7. **No Credential Leaks:** The REST key and Auth Key stay strictly server-side. Auth tokens are server-minted. Never provision a CometChat app by guesswork (use the `@cometchat/skills-cli` flow).
8. **Append, Never Replace:** Preserve the user's existing code with additive diffs. Confirm before bulk edits.
9. **Frontend Gate:** Before starting any frontend work, message the user first so they can supply a design template.
10. **Phase Router & Verification:** For each day/milestone in `docs/implementation_plan.md`, adopt the designated persona and enforce the RRSI Verification Triad defined in `AGENTS.md`.
11. **Quota-Break Recovery Protocol:** Whenever the user switches accounts and says "continue" or "resume", never restart from scratch. Follow the Continuity Protocol in `AGENTS.md`: inspect disk and `docs/implementation_plan.md`, emit the 4-field state snapshot, and resume from the first unverified checkpoint.

---

## 🧭 2. Automatic Skill Dispatch Table

Whenever performing a task in the left column, the agent immediately reads the file in the right column:

| Task Domain | Auto-Activated Skill File |
|---|---|
| General Router / Entrypoint | `.cometchat/skills/cometchat/SKILL.md` |
| Calling from scratch / headless Calls v5 | `.cometchat/skills/cometchat-js-v5-sdk/SKILL.md` |
| React UI Kit v7 Core (init / login / providers) | `.cometchat/skills/cometchat-react-v7-core/SKILL.md` |
| React UI Kit v7 Calls | `.cometchat/skills/cometchat-react-v7-calls/SKILL.md` |
| Custom messages / HUD styling / Bubble custom | `.cometchat/skills/cometchat-react-v7-customization/SKILL.md` |
| Presence / Typing indicators | `.cometchat/skills/cometchat-react-v7-features/SKILL.md` |
| Onboarding / Scaffolding flow | `.cometchat/skills/cometchat-onboarding/SKILL.md` |
| Security / Token Auth | `.cometchat/skills/cometchat-security/SKILL.md` |

---

## ⚖️ 3. Precedence When Rules Overlap

- **How CometChat is integrated:** CometChat's `RULES.md` and skills win.
- **Project conventions:** Vite + React + TypeScript, pnpm, Framer Motion for interactive UI, PowerShell 5.1 compatibility, no secrets.
- **Testing:** Pose math, rep counter, and summary unit tests, plus a two-profile checklist and deployed-URL smoke test are approved. Do not add speculative CometChat wiring tests beyond the approved plan.
- **Git:** Never commit or push without explicit user consent.

---

## 🔌 4. Docs MCP Connection Reference
- **Antigravity config:** `cometchat` entry in `C:\Users\ASUS\.gemini\config\mcp_config.json` via `npx -y mcp-remote https://mcp.cometchat.com/mcp?ref=z2c`.
- **Claude CLI:** registered with `claude mcp add --transport http cometchat https://mcp.cometchat.com/mcp?ref=z2c`.
- **Codex config (reference):** `experimental_use_rmcp_client = true` plus `[mcp_servers.cometchat-docs]` with `url = "https://mcp.cometchat.com/mcp"`.
