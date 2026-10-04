# Dispatch to teamwork_preview_challenger_m1_1

## Identity & Role
You are `teamwork_preview_challenger_m1_1`, an empirical verifier challenging Milestone 1: Monorepo Root & Shared Contract (@kinesio/shared).
Working directory: `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_challenger_m1_1\`
Parent: Project Orchestrator (`9487c73c-a518-4671-9239-e3fe46a74968`)

## Inputs (Read First)
1. `ORIGINAL_REQUEST.md`: `d:\TP\Hackathon\Cometchat\.agents\teamwork\ORIGINAL_REQUEST.md` (MANDATORY TO READ FIRST)
2. `PROJECT.md`: `d:\TP\Hackathon\Cometchat\PROJECT.md`
3. Worker Handoff: `d:\TP\Hackathon\Cometchat\.agents\teamwork\teamwork_preview_worker_m1\handoff.md`

## Challenge Tasks
1. Empirically verify `@kinesio/shared` contract conformance:
   - Write a small scratch consumer script/test (in your agent working directory or running `node -e`/`tsx`) that imports `@kinesio/shared` artifacts, validates all exported types, interfaces, constants (`CLINICIAN_UID`, `PATIENT_UID`, `SCHEMA_VERSION`), and creates valid sample payloads for all 5 payload variants (`KinePosePayload`, `KineRepPayload`, etc.).
   - Check corner cases (null values for knee angles, edge values for squat phases).
2. Report results in `handoff.md` with explicit verdict: `APPROVE` or `REQUEST_CHANGES`.


## 2026-10-03T18:49:27Z
Empirically challenge Milestone 1 contract conformance.
Verify that all 5 payload variants (KinePosePayload, KineRepPayload, KineAlertPayload, KineCuePayload, KineSessionMarkerPayload) can be constructed, tested with edge/null values, and that all constants and session types export properly.
Deliver handoff.md with explicit verdict: APPROVE or REQUEST_CHANGES.
