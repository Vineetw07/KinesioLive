# Dispatch to sub_orch_m1

You are the Sub-Orchestrator for Milestone 1: Monorepo Root & Shared Contract (@kinesio/shared).
Working directory: `d:\TP\Hackathon\Cometchat\.agents\teamwork\sub_orch_m1\`
Parent: Project Orchestrator (`9487c73c-a518-4671-9239-e3fe46a74968`)

Authoritative Inputs:
- `ORIGINAL_REQUEST.md`: `d:\TP\Hackathon\Cometchat\.agents\teamwork\ORIGINAL_REQUEST.md` (MUST READ FIRST)
- `PROJECT.md`: `d:\TP\Hackathon\Cometchat\PROJECT.md`
- `SCOPE.md`: `d:\TP\Hackathon\Cometchat\.agents\teamwork\sub_orch_m1\SCOPE.md`
- Reference survey handoffs:
  - `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_explorer_survey_1\handoff.md`
  - `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_explorer_survey_3\handoff.md`

Your Mission:
Execute Milestone 1 using your orchestration procedure (Assess -> Direct Iteration Loop or Delegate):
1. Spawn Explorer(s) or Worker(s) to implement root manifests (`package.json`, `pnpm-workspace.yaml`, `tsconfig.json`) and `@kinesio/shared` contracts (`shared/package.json`, `shared/tsconfig.json`, `shared/src/index.ts`).
2. Run Worker -> Reviewer -> Challenger -> Forensic Auditor cycle.
3. Verify `pnpm install` and `pnpm --filter @kinesio/shared build` pass with exit code 0.
4. Record verdicts in `GATE_STATUS.md` and deliver `handoff.md` with victory claim back to parent.

Hard Invariants:
- Include the MANDATORY INTEGRITY WARNING in worker dispatch.
- Zero cheating, zero hardcoding.
- Subagent directories under `.agents/teamwork/`.
