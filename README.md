# WhatsApp Sales Assistant Console Demo

Desktop-first demo web app that looks and feels like a premium WhatsApp Web operator console for a real estate sales assistant.

The app is built to:

- load real inventory from a CSV
- run in `demo` or `live` mode
- receive inbound WhatsApp-style messages
- analyze the conversation in structured form
- rank matching listings from the real inventory
- generate operator-reviewed AI drafts through Ollama
- let a human edit and send the final message

## Project path

`C:\Users\rsoli\Documents\Scripts\whatsapp_sales_console_demo`

## Real inventory source

Default CSV path:

`C:\Users\rsoli\Documents\Scripts\flamingobeachrealty_recopilado_2026-04-20\featured_listing_details.csv`

You can change it with `INVENTORY_CSV_PATH` in `.env.local`.

## Tech stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- SWR
- Papa Parse
- Ollama via local HTTP API

## Modes

### Demo mode

- seeded local conversations load instantly
- ideal for client presentations
- no external webhook dependency required

### Live mode

- uses the same UI
- reads live conversations that arrive through the built-in Meta-compatible webhook endpoint
- endpoint:
  - `GET/POST /api/webhook/meta`
- also includes explicit WhatsApp API routes:
  - `GET /api/whatsapp/connection`
  - `POST /api/whatsapp/messages`

## Setup

1. Open a terminal:

```powershell
cd C:\Users\rsoli\Documents\Scripts\whatsapp_sales_console_demo
```

2. Create local env file:

```powershell
Copy-Item .env.example .env.local
```

3. Update `.env.local` as needed:

```env
INVENTORY_CSV_PATH=C:\Users\rsoli\Documents\Scripts\flamingobeachrealty_recopilado_2026-04-20\featured_listing_details.csv
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2:3b
DEFAULT_MODE=demo
META_VERIFY_TOKEN=
LOCAL_SECRETS_JSON_PATH=C:\Users\rsoli\Documents\Scripts\whatsapp_sales_console_demo\secrets.whatsapp.local.json
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_APP_SECRET=
WHATSAPP_GRAPH_API_VERSION=v23.0
WHATSAPP_EXTERNAL_WEBHOOK_URL=https://test-webhook-endpoint-luxz.onrender.com/
```

4. Make sure Ollama is running locally.

Example:

```powershell
ollama serve
```

If the selected model is not downloaded yet:

```powershell
ollama pull llama3.2:3b
```

5. Start the app:

```powershell
npm run dev
```

6. Open:

`http://localhost:3000`

## What the UI shows

- left sidebar with conversation list
- central WhatsApp-like chat area
- operator composer with manual control
- visible AI draft block before send
- three editable suggestion styles
- right panel with:
  - lead stage
  - temperature
  - intent
  - sentiment
  - budget detection
  - preferred zones
  - property type
  - bedrooms
  - time horizon
  - objections
  - conversation memory
  - matched listings with explainable reasons

## Real inventory handling

Inventory is loaded on the server from the configured CSV and normalized dynamically.

Current loader behavior:

- infers schema from headers
- maps raw fields into normalized listing objects
- supports price, beds, baths, location, status, type, description, thumbnails, and URLs
- builds searchable text for ranking
- ranks listings by:
  - zone match
  - property type match
  - feature keywords
  - bedroom proximity
  - budget proximity
  - transcript keyword overlap

If the CSV is missing, the UI shows a clean inventory error state with the configured path.

## Ollama integration

Draft generation uses Ollama first and falls back to a deterministic heuristic draft only when Ollama is unavailable.

Environment variables:

- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`

The draft endpoint is:

- `POST /api/conversations/:id/draft`

It returns:

- proposed reply text
- tone label
- confidence
- compact decision summary
- matched listings used
- extracted entities
- three suggested replies

## Live webhook integration

Meta-compatible webhook route:

- `GET /api/webhook/meta`
  - verification handshake
- `POST /api/webhook/meta`
  - ingests WhatsApp payloads into the live conversation store

Health endpoint:

- `GET /api/healthz`

To use this app directly as a webhook target in the future, set:

- `META_VERIFY_TOKEN`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_APP_SECRET` (recommended for signature validation)
- `LOCAL_SECRETS_JSON_PATH` if you want the access token and other secrets in a local JSON file instead of `.env.local`

Current implementation also supports mirroring inbound webhook payloads to:

- `WHATSAPP_EXTERNAL_WEBHOOK_URL`

Default mirror target:

- `https://test-webhook-endpoint-luxz.onrender.com/`

## Demo seed conversations included

- Buyer looking in Flamingo with budget and ocean view
- Foreign buyer asking for beachfront inventory
- Investor asking about ROI and appreciation
- Family asking for 3 or 4 bedrooms in gated communities
- Prospect asking for visit coordination
- Lead asking about financing with vague budget

## Architecture notes

### Server modules

- `src/lib/server/inventory-service.ts`
  - CSV loading, normalization, ranking
- `src/lib/server/conversation-store.ts`
  - in-memory demo/live conversation store
- `src/lib/server/conversation-analyzer.ts`
  - structured rule-based analysis engine
- `src/lib/server/draft-engine.ts`
  - Ollama-powered draft generation with safe fallback
- `src/lib/server/ollama.ts`
  - adapter for local Ollama server

### API routes

- `src/app/api/dashboard/route.ts`
- `src/app/api/conversations/[id]/insights/route.ts`
- `src/app/api/conversations/[id]/draft/route.ts`
- `src/app/api/conversations/[id]/send/route.ts`
- `src/app/api/conversations/[id]/simulate-inbound/route.ts`
- `src/app/api/webhook/meta/route.ts`
- `src/app/api/healthz/route.ts`

### Frontend

- `src/components/sales-console-app.tsx`
  - desktop-first operator console layout and interactions

## Useful demo flow

1. Open the app in `demo` mode.
2. Select `Amelia Grant`.
3. Watch the system detect:
   - Flamingo
   - budget around 900k
   - 3 bedrooms
   - ocean view preference
4. Review the matched listings.
5. Review the AI draft.
6. Click one of the suggested reply variants.
7. Edit the composer.
8. Send the demo reply.
9. Use `Inject demo inbound` to show continuous analysis refresh.

## Validation done

The project has already been validated locally with:

```powershell
npm run lint
npm run build
```

## Notes for future production work

- persist conversations to a database instead of memory
- add outbound WhatsApp Cloud API sending
- add signature validation for Meta webhook security
- add richer support for image/document/audio/location message types
- add operator auth and assignment workflows
- add analytics and lead scoring persistence
