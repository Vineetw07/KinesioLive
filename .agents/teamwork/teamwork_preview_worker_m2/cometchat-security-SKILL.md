# Local copy of cometchat-security SKILL.md
Source: d:\TP\Hackathon\Cometchat\.agents\skills\cometchat-security\SKILL.md

Core Methodology:
1. REST API Key is strictly server-side.
2. Endpoint: POST https://{APP_ID}.api-{REGION}.cometchat.io/v3/users/{uid}/auth_tokens
   Headers:
     apikey: {REST_API_KEY}
     content-type: application/json
   Body:
     { "force": true }
3. User upsert: POST https://{APP_ID}.api-{REGION}.cometchat.io/v3/users
   Body: { "uid": "...", "name": "...", "role": "default" }
4. Group upsert: POST https://{APP_ID}.api-{REGION}.cometchat.io/v3/groups
   Body: { "guid": "...", "name": "...", "type": "public" }
   Add members: POST https://{APP_ID}.api-{REGION}.cometchat.io/v3/groups/{guid}/members
   Body: { "admins": ["dr-demo"], "participants": ["pt-demo"] }
5. Never expose API key to client.
