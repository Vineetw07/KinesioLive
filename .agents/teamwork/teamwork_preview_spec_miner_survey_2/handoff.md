# Specification Handoff Report: CometChat v3 REST API & Token Service Backend

**Date:** 2026-10-03T18:45:00Z  
**Author:** `teamwork_preview_spec_miner_survey_2` (Specification Miner)  
**Target:** Parent Orchestrator (`9487c73c-a518-4671-9239-e3fe46a74968`)  
**Workspace:** `d:\TP\Hackathon\Cometchat`  

---

## 1. Observation

### 1.1 Direct File Observations
1. **`ORIGINAL_REQUEST.md` (lines 26–37):**
   > "R2. Express Backend & CometChat REST Token Service (`@kinesio/server`)
   > In `server/src/`, implement Express + TypeScript server using `tsx`, `dotenv`, and `cors`, reading `COMETCHAT_APP_ID`, `COMETCHAT_REGION`, and keys from root `.env`:
   > - `GET /api/health`: Returns `{ status: "ok", uptime: number, timestamp: number }`.
   > - `POST /api/session`:
   >   1. Accepts `SessionRequest`. Generates session ID `kine-<timestamp>` if not provided.
   >   2. Maps role to deterministic UID (`dr-demo` for clinician, `pt-demo` for patient).
   >   3. User Upsert: Calls CometChat REST `POST https://{APP_ID}.api-{REGION}.cometchat.io/v3/users` to ensure `{ uid, name, role }` exists (preventing `404: ERR_UID_NOT_FOUND`).
   >   4. Group Upsert: Calls CometChat REST `POST https://{APP_ID}.api-{REGION}.cometchat.io/v3/groups` (`guid: sessionId`, `name: "Session " + sessionId`, `type: "public"`) and ensures both `dr-demo` and `pt-demo` are added.
   >   5. Auth Token Minting: Calls CometChat REST `POST https://{APP_ID}.api-{REGION}.cometchat.io/v3/users/{uid}/auth_tokens` with `apiKey` in headers (`apikey: process.env.COMETCHAT_REST_API_KEY || process.env.COMETCHAT_AUTH_KEY`).
   >   6. Returns sanitized `SessionResponse`.
   >   7. Validates credentials on boot: logs user-friendly diagnostic warning if keys are missing or truncated (`...`)."

2. **`docs/trd.md` (Section 4, lines 165–174):**
   > "`POST /api/session`:
   > - Request Body: `{ role: "clinician" | "patient", sessionId?: string }`
   > - Lifecycle Execution:
   >   1. If `sessionId` omitted, generates session GUID (`kine-<timestamp>`).
   >   2. Upserts user accounts via CometChat REST `POST /v3/users` (ensures `dr-demo` and `pt-demo` exist before token minting to prevent `404: ERR_UID_NOT_FOUND`).
   >   3. Creates CometChat group via `POST /v3/groups` (`guid: sessionId`, `type: public`) with both users pre-added as participants (ensuring message permissions).
   >   4. Generates Auth Tokens via `POST /v3/users/{uid}/auth_tokens` using server REST API Key.
   >   5. Returns `{ sessionId, authToken, uid, appId, region }` to client.
   > - `GET /api/health`: Health probe validating CometChat REST reachability and node process uptime."

3. **`docs/audit.md` (lines 11–18):**
   > "Zero Credential Leakage:
   > - Target: The CometChat REST API Key and Auth Key must never reach client bundles.
   > - Verification: Continuous grep/regex scan on `dist/` before deployment...
   > - Express backend acts as the sole token mint. Client only receives short-lived Auth Tokens via `POST /api/session`."

4. **`.cometchat/skills/cometchat-security/SKILL.md` (lines 17–25, 38–43):**
   > "| Auth Key | client, dev only | quick login(uid) in development; can mint a session for ANY user — never ship it |
   > | Auth token | client, per user | production login with a per-user token... tied to one UID; revocable |
   > | REST API Key | server only | mint tokens, manage users/roles; full power — never in a client |"
   > "POST https://{APP_ID}.api-{REGION}.cometchat.io/v3/users/{uid}/auth_tokens
   > apikey: {REST_API_KEY} # server-side secret
   > content-type: application/json"

5. **`.cometchat/skills/RULES.md` (lines 21–25):**
   > "Auth key is dev-only client-side; teach server-side token exchange for production. Never hardcode; never echo the auth key to stdout.
   > The login UID must exist in the app... login(uid) does not create users."

6. **Root `.env` Audit (executed non-disclosively via Node.js):**
   - `COMETCHAT_APP_ID`: present (length: 17, `has_dots: false`, non-empty)
   - `COMETCHAT_REGION`: present (length: 2, e.g. "in", `has_dots: false`, non-empty)
   - `COMETCHAT_AUTH_KEY`: present (length: 35, `has_dots: true` — **contains literal ellipsis `...`**, copied truncated from dashboard)
   - `COMETCHAT_REST_API_KEY`: **absent** from `.env`.

7. **CometChat Official OpenAPI Specifications (fetched via CometChat MCP):**
   - Base URL: `https://{appId}.api-{region}.cometchat.io/v3`
   - Authentication Header: `apikey: <key>` (Note: Header is lowercase `apikey`. In response bodies, JSON property is `apiKey`).
   - `POST /v3/users`: accepts `{ uid: string, name: string, role?: string, withAuthToken?: boolean }`. If `role` is omitted, defaults to `"default"`. If an unconfigured role is passed, CometChat returns `ERR_ROLE_NOT_FOUND`.
   - `POST /v3/groups`: accepts `{ guid: string, name: string, type: "public", members?: { admins?: string[], participants?: string[] } }`. Returns HTTP 200 with group data, or HTTP 400 with `ERR_GUID_ALREADY_EXISTS`.
   - `POST /v3/groups/{guid}/members`: accepts `{ admins?: string[], participants?: string[] }`. If a member is already joined, handles gracefully without error or returns `ERR_ALREADY_JOINED`.
   - `POST /v3/users/{uid}/auth_tokens`: accepts `{ force?: boolean }`. Returns HTTP 200 with `{ data: { uid: string, authToken: string, createdAt: number } }`.
   - Error Guide (`/articles/error-guide`): Documents standard codes including `AUTH_ERR_EMPTY_APIKEY`, `AUTH_ERR_APIKEY_NOT_FOUND`, `AUTH_ERR_INVALID_APPID`, `ERR_UID_NOT_FOUND`, `ERR_GUID_NOT_FOUND`, `ERR_GUID_ALREADY_EXISTS`, `ERR_ALREADY_JOINED`, `ERR_ROLE_NOT_FOUND`, `ERR_BAD_REQUEST`.

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | User REST | User Create / Upsert | Creates a new CometChat user account idempotently; prevents `404: ERR_UID_NOT_FOUND` during token minting and login. | `POST /v3/users`<br>Headers: `apikey: <key>`, `Content-Type: application/json`<br>Body: `{ uid, name, role?, withAuthToken? }` | HTTP 200 OK<br>`{ data: { uid, name, role, status, createdAt, authToken? } }` | If user already exists: returns HTTP 400 Bad Request (`ERR_BAD_REQUEST` / UID exists). Server treats as idempotent success. Invalid key: 401/403 `AUTH_ERR_APIKEY_NOT_FOUND`. Invalid role: 400 `ERR_ROLE_NOT_FOUND`. | CometChat MCP `fetch_cometchat_doc_page(/rest-api/users/create)` & `docs/trd.md` Section 4 |
| 2 | User REST | User Lookup | Retrieves user details by UID to verify existence and profile fields. | `GET /v3/users/{uid}`<br>Headers: `apikey: <key>` | HTTP 200 OK<br>`{ data: { uid, name, role, status, createdAt } }` | HTTP 404 `ERR_UID_NOT_FOUND` if user does not exist. | CometChat MCP `fetch_cometchat_doc_page(/rest-api/users/get)` |
| 3 | Group REST | Group Create with Members | Creates a session group GUID and pre-adds participants during creation. | `POST /v3/groups`<br>Headers: `apikey: <key>`, `Content-Type: application/json`<br>Body: `{ guid, name, type: "public", members: { admins: [...], participants: [...] } }` | HTTP 200 OK<br>`{ data: { guid, name, type, membersCount, conversationId, createdAt } }` | HTTP 400 `ERR_GUID_ALREADY_EXISTS` if group already created. Server treats as idempotent success and proceeds to member assignment. | CometChat MCP `fetch_cometchat_doc_page(/rest-api/groups/create)` & `docs/trd.md` Section 4 |
| 4 | Group REST | Member Assignment | Adds admins or participants to an existing session group. | `POST /v3/groups/{guid}/members`<br>Headers: `apikey: <key>`, `Content-Type: application/json`<br>Body: `{ admins?: [...], participants?: [...] }` | HTTP 200 OK<br>`{ data: { admins?: {...}, participants?: {...} } }` | HTTP 400 `ERR_ALREADY_JOINED` (or member success `false`) if user already member. Server handles gracefully as no-op. | CometChat MCP `fetch_cometchat_doc_page(/rest-api/group-members/add-members)` |
| 5 | Token REST | Auth Token Minting | Generates an auth token for a specific user UID so client SDKs can authenticate without API keys. | `POST /v3/users/{uid}/auth_tokens`<br>Headers: `apikey: <key>`, `Content-Type: application/json`<br>Body: `{ force: true }` | HTTP 200 OK<br>`{ data: { uid, authToken, createdAt } }` | HTTP 404 `ERR_UID_NOT_FOUND` if user does not exist; HTTP 401/403 `AUTH_ERR_APIKEY_NOT_FOUND` if API key invalid. | CometChat MCP `fetch_cometchat_doc_page(/rest-api/auth-tokens/create)` |
| 6 | Server API | Health Probe | Returns process uptime, status, and configuration health. | `GET /api/health` | HTTP 200 OK<br>`{ status: "ok", uptime: number, timestamp: number }` | HTTP 500 if server process fails. | `ORIGINAL_REQUEST.md` R2 & `docs/trd.md` Section 4 |
| 7 | Server API | Session Minting | Accepts session request, resolves/creates session ID, deterministically upserts users (`dr-demo`, `pt-demo`), creates group, mints auth token, and returns sanitized credentials. | `POST /api/session`<br>Body: `{ role: "clinician" \| "patient", sessionId?: string }` | HTTP 200 OK<br>`{ sessionId: string, authToken: string, uid: string, appId: string, region: string }` | HTTP 400 if `role` is invalid/missing; HTTP 502/500 if CometChat REST calls fail. | `ORIGINAL_REQUEST.md` R2 & `docs/trd.md` Section 4 |
| 8 | Diagnostics | Boot Credential Diagnostics | Scans environment variables on process startup and logs non-blocking, actionable warnings for missing or truncated keys. | Startup scan of `process.env` | Console warnings (`[WARN] ...`) | Logs warning without throwing, allowing `/api/health` to serve and enabling debuggability. | `ORIGINAL_REQUEST.md` R2.7 |

---

## 3. Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Boot Diagnostics | `.env` has `COMETCHAT_AUTH_KEY` ending in `...` | Node probe confirmed length 35 with literal `...`. Boot validation must detect `key.includes('...')` and log clear instructions to copy full key from Dashboard eye icon. |
| 2 | Boot Diagnostics | `COMETCHAT_REST_API_KEY` missing in `.env` | Server must fall back to `process.env.COMETCHAT_AUTH_KEY` as `effectiveApiKey = process.env.COMETCHAT_REST_API_KEY || process.env.COMETCHAT_AUTH_KEY`. |
| 3 | User Upsert | User already exists in CometChat (`POST /v3/users`) | Returns HTTP 400 with duplicate UID error. Server upsert helper must catch HTTP 400 (or `ERR_UID_ALREADY_EXISTS` / duplicate message) and treat it as a successful no-op. |
| 4 | User Upsert | User role `"clinician"` or `"patient"` unconfigured in Dashboard | CometChat throws HTTP 400 `ERR_ROLE_NOT_FOUND`. Server must either omit `role`, use `"default"`, or gracefully fall back to `"default"` upon `ERR_ROLE_NOT_FOUND`. |
| 5 | Group Upsert | Group already exists (`POST /v3/groups`) | CometChat returns HTTP 400 with `ERR_GUID_ALREADY_EXISTS`. Server catches this, skips group creation, and proceeds to ensure members are added via `/v3/groups/{guid}/members`. |
| 6 | Group Members | Member already joined in group (`POST /v3/groups/{guid}/members`) | Returns HTTP 200 with individual status or HTTP 400 `ERR_ALREADY_JOINED`. Server must treat duplicate membership as a non-fatal success. |
| 7 | Session Request | `sessionId` omitted in `POST /api/session` | Server auto-generates deterministic format: `kine-${Date.now()}`. |
| 8 | Session Request | Invalid role provided (e.g. `{ role: "admin" }`) | Server validates input schema and immediately returns HTTP 400 Bad Request: `{ error: "Invalid role. Expected 'clinician' or 'patient'." }`. |
| 9 | Client Security | `client/` imports server secrets | Forbidden by architecture and audit rule. Verified via regex scan: `client/` only ever receives sanitized `SessionResponse` from `POST /api/session`. |

---

## 4. Logic Chain

1. **Premise (Requirement R2 & TRD Section 4):**
   - The token backend must serve `GET /api/health` and `POST /api/session`.
   - To prevent client SDK runtime crashes (`ERR_UID_NOT_FOUND`), users must exist before auth tokens are minted.
   - To enable WebRTC room joining (`CometChatCalls.joinSession`) and telemetry exchange (`CometChat.sendTransientMessage`), a group matching `sessionId` must exist with both participants pre-added.

2. **Observation on Endpoints & Authentication:**
   - From CometChat OpenAPI specs (`users/create`, `groups/create`, `auth-tokens/create`), all Chat APIs are hosted at `https://{APP_ID}.api-{REGION}.cometchat.io/v3`.
   - The authentication header must be lowercase `apikey: <key>`.
   - An `authOnly` key (Auth Key) can create users and mint auth tokens; a `fullAccess` key (REST API Key) can also create groups. Using `process.env.COMETCHAT_REST_API_KEY || process.env.COMETCHAT_AUTH_KEY` provides dual compatibility.

3. **Observation on `.env` State:**
   - The actual `.env` file contains `COMETCHAT_APP_ID`, `COMETCHAT_REGION`, and `COMETCHAT_AUTH_KEY`.
   - `COMETCHAT_AUTH_KEY` has `has_dots: true` (contains `...` truncation from the UI).
   - `COMETCHAT_REST_API_KEY` is currently absent from `.env`.
   - Therefore, boot credential validation is essential: the server must warn that `COMETCHAT_AUTH_KEY` appears truncated and `COMETCHAT_REST_API_KEY` is unset.

4. **Observation on Idempotency:**
   - When multiple sessions open or two tabs join the same session (clinician and patient), `POST /api/session` is invoked independently.
   - The first invocation creates the group and users; the second invocation receives `ERR_GUID_ALREADY_EXISTS` and existing user errors.
   - Thus, the backend must implement idempotent upserts for both users and groups, never throwing unhandled 400/409 errors on collisions.

5. **Observation on Client-Server Contract:**
   - The client expects `SessionResponse`: `{ sessionId, authToken, uid, appId, region }`.
   - No private keys or REST API keys are returned in `SessionResponse`.

---

## 5. Detailed API Specification Matrix

### 5.1 User Upsert Endpoint
- **URL:** `POST https://{APP_ID}.api-{REGION}.cometchat.io/v3/users`
- **Headers:**
  ```http
  apikey: {REST_API_KEY || AUTH_KEY}
  Content-Type: application/json
  Accept: application/json
  ```
- **Payload:**
  ```json
  {
    "uid": "dr-demo",
    "name": "Dr. Demo",
    "role": "default"
  }
  ```
  *(Patient counterpart uses `uid: "pt-demo"`, `name: "Patient Demo"`).*
- **Expected Success (200 OK):**
  ```json
  {
    "data": {
      "uid": "dr-demo",
      "name": "Dr. Demo",
      "role": "default",
      "status": "offline",
      "createdAt": 1727980000
    }
  }
  ```
- **Collision Error (400 Bad Request):**
  ```json
  {
    "error": {
      "code": "ERR_BAD_REQUEST",
      "message": "UID already exists."
    }
  }
  ```
  *Handler:* Ignore if error message or code signifies existing UID.

### 5.2 Group Upsert Endpoint
- **URL:** `POST https://{APP_ID}.api-{REGION}.cometchat.io/v3/groups`
- **Headers:**
  ```http
  apikey: {REST_API_KEY || AUTH_KEY}
  Content-Type: application/json
  Accept: application/json
  ```
- **Payload:**
  ```json
  {
    "guid": "kine-1727980000000",
    "name": "Session kine-1727980000000",
    "type": "public",
    "members": {
      "admins": ["dr-demo"],
      "participants": ["pt-demo"]
    }
  }
  ```
- **Expected Success (200 OK):**
  ```json
  {
    "data": {
      "guid": "kine-1727980000000",
      "name": "Session kine-1727980000000",
      "type": "public",
      "membersCount": 2,
      "createdAt": 1727980000
    }
  }
  ```
- **Collision Error (400 Bad Request):**
  ```json
  {
    "error": {
      "code": "ERR_GUID_ALREADY_EXISTS",
      "message": "A group with this GUID already exists."
    }
  }
  ```
  *Handler:* When `ERR_GUID_ALREADY_EXISTS` is encountered, call Group Member Assignment (`POST /v3/groups/{guid}/members`) to ensure both participants are present.

### 5.3 Group Member Assignment Endpoint
- **URL:** `POST https://{APP_ID}.api-{REGION}.cometchat.io/v3/groups/{guid}/members`
- **Headers:**
  ```http
  apikey: {REST_API_KEY || AUTH_KEY}
  Content-Type: application/json
  Accept: application/json
  ```
- **Payload:**
  ```json
  {
    "admins": ["dr-demo"],
    "participants": ["pt-demo"]
  }
  ```
- **Expected Success (200 OK):**
  ```json
  {
    "data": {
      "admins": { "dr-demo": { "success": true } },
      "participants": { "pt-demo": { "success": true } }
    }
  }
  ```
  *Handler:* If user is already joined, CometChat returns `ERR_ALREADY_JOINED` or `success: false`. Treat as non-fatal.

### 5.4 Auth Token Minting Endpoint
- **URL:** `POST https://{APP_ID}.api-{REGION}.cometchat.io/v3/users/{uid}/auth_tokens`
- **Headers:**
  ```http
  apikey: {REST_API_KEY || AUTH_KEY}
  Content-Type: application/json
  Accept: application/json
  ```
- **Payload:**
  ```json
  {
    "force": true
  }
  ```
- **Expected Success (200 OK):**
  ```json
  {
    "data": {
      "uid": "dr-demo",
      "authToken": "dr-demo_1727980000abcdef1234567890",
      "createdAt": 1727980000
    }
  }
  ```

### 5.5 Express Backend Health Endpoint
- **Route:** `GET /api/health`
- **Status:** `200 OK`
- **Payload:**
  ```json
  {
    "status": "ok",
    "uptime": 45.2,
    "timestamp": 1727980000000
  }
  ```

### 5.6 Express Backend Session Endpoint
- **Route:** `POST /api/session`
- **Headers:** `Content-Type: application/json`
- **Payload (`SessionRequest`):**
  ```json
  {
    "role": "clinician",
    "sessionId": "kine-1727980000000"
  }
  ```
- **Status:** `200 OK`
- **Payload (`SessionResponse`):**
  ```json
  {
    "sessionId": "kine-1727980000000",
    "authToken": "dr-demo_1727980000abcdef1234567890",
    "uid": "dr-demo",
    "appId": "<app-id>",
    "region": "in"
  }
  ```

---

## 6. Caveats

1. **Truncated Auth Key:** The current `.env` contains a truncated Auth Key ending in `...`. Any live HTTP call using this key against CometChat servers will fail with `401 Unauthorized` (`AUTH_ERR_APIKEY_NOT_FOUND`). The developer will need to paste the full Auth Key or REST API Key from the dashboard into `.env`. The backend must provide a clear boot diagnostic to surface this immediately.
2. **REST API Key Scope:** Group creation (`POST /v3/groups`) typically requires `fullAccess` scope (REST API Key). If only `authOnly` (Auth Key) is configured, group creation may return `AUTH_ERR_NO_ACCESS`. The backend should handle this gracefully and guide the user if `COMETCHAT_REST_API_KEY` is required.
3. **Roles Dependency:** If a custom role name like `"clinician"` is passed in `POST /v3/users` without having been created in the CometChat dashboard, CometChat returns `ERR_ROLE_NOT_FOUND`. Sticking to `"default"` or omitting `role` is the most resilient approach.

---

## 7. Conclusion

All authoritative specifications for the CometChat v3 REST token service backend have been discovered, cross-verified with official OpenAPI definitions via the CometChat MCP, and documented with exact HTTP contracts, schemas, error behaviors, and edge cases. The implementation team can build `@kinesio/server` adhering directly to these specifications.

---

## 8. Verification Method

1. **Verify Documentation & Schemas:**
   Inspect this file and verify endpoints against live CometChat documentation:
   ```powershell
   # Call CometChat MCP tool or curl
   curl -s https://www.cometchat.com/docs/rest-api/users/create.md
   ```
2. **Verify Environment Variable State:**
   ```powershell
   node -e "const fs=require('fs'); const lines=fs.readFileSync('.env','utf8').split('\n'); lines.forEach(l=>{const m=l.match(/^\s*([^#=\s]+)\s*=\s*(.*?)\s*$/); if(m) console.log(m[1]+': len='+m[2].length+', has_dots='+m[2].includes('...'));});"
   ```
   *Expected Output:*
   - `COMETCHAT_APP_ID`: len=17, has_dots=false
   - `COMETCHAT_REGION`: len=2, has_dots=false
   - `COMETCHAT_AUTH_KEY`: len=35, has_dots=true
3. **Verify Zero Secrets in Documentation:**
   ```powershell
   Select-String -Path ".agents/teamwork/teamwork_preview_spec_miner_survey_2/handoff.md" -Pattern "COMETCHAT_AUTH_KEY=.*[a-zA-Z0-9]"
   ```
