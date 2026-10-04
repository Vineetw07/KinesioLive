# Task Assignment: CometChat Headless Calls v5 & Chat SDK Spec Mining (Survey Agent 2)

## Role & Archetype
- TypeName: teamwork_preview_spec_miner
- Role: CometChat Specification Miner
- Working directory: d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_spec_miner_survey_d2_2/

## Context & Inputs
- User Request: `d:/TP/Hackathon/Cometchat/.agents/teamwork/ORIGINAL_REQUEST.md` (Section `## 2026-10-03T19:41:01Z`)
- Core CometChat Rules: `.cometchat/skills/RULES.md`
- Headless Calls v5 Guide: `.cometchat/skills/cometchat-js-v5-sdk/SKILL.md`
- Security & Token Lifecycles: `.cometchat/skills/cometchat-security/SKILL.md`
- Integration log: `COMETCHAT_INTEGRATION.md`
- Shared contract: `shared/contract.ts` or `shared/src/index.ts`
- Server endpoints: `server/src/index.ts` (`POST /api/session`)

## Mission & Questions to Investigate
1. What is the EXACT sequence of SDK calls for headless Calls SDK v5 session join?
   - `CometChat.init` -> `CometChat.login(authToken)` -> `calls.init` or `CometChatCalls.init`?
   - How is the token generated (`generateToken(sessionId, token)` or similar)?
   - How is session joined? What is the exact API for `startAudioMuted: true` on clinician?
2. What is the exact API and method signature for `CometChat.sendTransientMessage` targeted to a group GUID (`RECEIVER_TYPE.GROUP`), payload format, and receiving listener?
3. What is the exact API for sending custom messages (`kine.rep`, `kine.alert`, `kine.cue`) using `CometChat.sendCustomMessage`?
4. What is the exact API for `MessagesRequestBuilder` to fetch custom messages with `setGuid(guid).setCategories(['custom']).setLimit(30).build().fetchPrevious()`?
5. Verify how server-minted auth tokens from `POST /api/session` feed into both patient and clinician client instances.

## Output
Write your findings to `d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_spec_miner_survey_d2_2/report.md` and deliver `handoff.md`. Send a completion message when done.


## 2026-10-03T19:43:51Z
You are Survey Agent 2 (CometChat Specification Miner).
Your working directory is: d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_spec_miner_survey_d2_2/
Read your task assignment in d:/TP/Hackathon/Cometchat/.agents/teamwork/teamwork_preview_spec_miner_survey_d2_2/DISPATCH.md and ORIGINAL_REQUEST.md.
Investigate CometChat Headless Calls v5 SDK and Chat SDK specifications in .cometchat/skills/cometchat-js-v5-sdk/SKILL.md, .cometchat/skills/RULES.md, COMETCHAT_INTEGRATION.md, and shared contracts. Determine the exact SDK API sequence for Calls v5 join with startAudioMuted: true, sendTransientMessage (10Hz token bucket), and custom messages with fetchPrevious.
Write your findings to report.md and handoff.md in your working directory. Send a completion message back with send_message to recipient 81566c86-b749-47c0-8b25-a5af0578bdb3 when done.
