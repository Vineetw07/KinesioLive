# Dispatch to teamwork_preview_explorer_survey_3

## Objective
Survey specifications for `@kinesio/shared` and `@kinesio/client`:
1. Shared biomechanical contracts from `docs/trd.md#Section-2` and `ORIGINAL_REQUEST.md`:
   - Exact definitions for `KinePosePayload`, `SquatPhase`, `KineRepPayload`, `KineAlertPayload`, `KineCuePayload`, `KineSessionMarkerPayload`, `KineMessage`, `SessionRequest`, `SessionResponse`.
   - Exports, package structure, tsconfig requirements.
2. Client workspace scaffolding requirements:
   - React 18/19 + Vite + TypeScript + Vitest + Framer Motion setup in `client/`.
   - Required dependencies: `@cometchat/calls-sdk-javascript@^5`, `@cometchat/chat-sdk-javascript@^4`, `@mediapipe/tasks-vision`, `@kinesio/shared`.
   - `vite.config.ts` requirements: proxy `/api` to `http://localhost:5000`, `define: { global: 'window' }`.
   - Secret scan requirements: REST API Key and Auth Key must never be imported in `client/` (`client/src/*`).
3. Examine what files or skeletons already exist in `shared/` or `client/` if any.

## Constraints & Inputs
- Authoritative user request: `d:\TP\Hackathon\Cometchat\.agents\teamwork\ORIGINAL_REQUEST.md` (MUST READ FIRST)
- Working directory: `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_explorer_survey_3\`
- Do NOT write or modify source code. Read-only survey.
- Output report: `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_explorer_survey_3\handoff.md`

## 2026-10-03T18:35:50Z
[Message] timestamp=2026-10-03T18:35:50Z sender=9487c73c-a518-4671-9239-e3fe46a74968 priority=MESSAGE_PRIORITY_HIGH content=Your working directory is: d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_explorer_survey_3\
Read your dispatch file at: d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_explorer_survey_3\DISPATCH.md
MANDATORY: Read ORIGINAL_REQUEST.md at: d:\TP\Hackathon\Cometchat\.agents\teamwork\ORIGINAL_REQUEST.md before starting work.

Task:
Survey the shared TypeScript contracts and client workspace requirements:
1. Examine docs/trd.md (Section 2) and ORIGINAL_REQUEST.md to detail all interfaces: KinePosePayload, SquatPhase, KineRepPayload, KineAlertPayload, KineCuePayload, KineSessionMarkerPayload, KineMessage, SessionRequest, SessionResponse.
2. Examine client requirements: React 18/19 + Vite + TypeScript + Vitest + Framer Motion in client/, dependencies (@cometchat/calls-sdk-javascript@^5, @cometchat/chat-sdk-javascript@^4, @mediapipe/tasks-vision, @kinesio/shared), vite.config.ts proxy and define: { global: 'window' }, and secret isolation rules.
Write your complete findings to handoff.md in your working directory and notify the parent orchestrator.
Do not modify or write source code.
