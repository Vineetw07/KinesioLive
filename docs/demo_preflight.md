# KinesioLive Demo Pre-Flight Checklist

## Environment (5 minutes before recording)
- [ ] Render service is warm: `curl https://kinesiolive.onrender.com/api/health` returns `{"status":"ok",...}`
- [ ] Chrome Profile A (Patient): navigate to `https://kinesiolive.onrender.com/?role=patient`
- [ ] Chrome Profile B (Clinician): navigate to `https://kinesiolive.onrender.com/?role=clinician`
- [ ] Both profiles: camera permission granted (HTTPS from Render ensures this works)
- [ ] Clinician: click "Copy Patient Invite Link" — paste URL into Patient tab and confirm matching sessionId
- [ ] Patient: confirm skeleton canvas overlay appears and rep counter reads 0
- [ ] Clinician: confirm "Patient in Session: Active" presence indicator

## Demo Pacing (84s target — 6s safety buffer under 90s hard limit)
| Time | Screen | Action | Narration |
|---|---|---|---|
| 00:00–00:08 | IDE/Console | Show `COMETCHAT_INTEGRATION.md` with MCP tool calls visible | "Our agent verified CometChat APIs directly via the MCP..." |
| 00:08–00:18 | Split screen | Patient joins → Clinician presence flips to Active | "Secure CometChat Calls v5 session begins..." |
| 00:18–00:32 | Patient + Clinician HUD | 2 clean squats → HUD shows real-time joint angles | "10 Hz transient pose telemetry, zero DB overhead..." |
| 00:32–00:48 | Clinician HUD | Patient caves left knee → valgus alert fires "+11.2%" | "Custom message alert with measured deviation value..." |
| 00:48–01:08 | Both screens | Clinician clicks "Knees Out" → Patient sees cyan toast → corrects | "Coaching cue persisted to group history, patient corrects in real time..." |
| 01:08–01:24 | Summary view | Clinician clicks "End Session" → Summary bento renders | "Group history IS the medical log — fetched via fetchPrevious()..." |

## Submission Tweet (post immediately after upload)
```
Just built KinesioLive for #ZeroToChat with @CometChat! 🏋️

Real-time biomechanical telerehab:
→ CometChat Calls v5 WebRTC video
→ 10 Hz transient pose telemetry (no DB overhead)
→ Persisted kine.rep / kine.alert custom messages
→ 24 MCP-verified API calls in COMETCHAT_INTEGRATION.md

[VIDEO LINK] | [GITHUB LINK]

#ZeroToChat @CometChat
```
