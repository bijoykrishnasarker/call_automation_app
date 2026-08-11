# Vapi Booking Tools Checklist

This repo supports AI appointment booking by letting the assistant call two tools:

- `check_availability`
- `book_appointment`

Your code is implemented in both integration paths:

- MCP tools via `app/api/mcp/route.ts`
- Server tool calls via `app/api/vapi/webhook/route.ts`

## 1) Decide how Vapi will call tools

### Default: function tools → `/api/vapi/webhook` (works with Azure OpenAI)

When you save the Voice Receptionist, `POST /api/vapi/sync` loads the current Vapi assistant (`GET assistant`), merges **`messages`**, **`toolIds: []`**, and **`tools`** onto the existing **model** (so cluster / deployment IDs from the dashboard, e.g. “GPT 4o Mini Cluster”, stay intact), then `PATCH`es. That avoids a partial update leaving stale tools as `tools[0]` and breaking Azure with `function.name` empty.

In the Vapi UI, tools attached to the assistant live under **Assistants → [your assistant] → Tools**, not only under the global **Build → Tools** list (which can be empty while the assistant still has inline tools).

Sync attaches **Vapi function tools** (not MCP) whose `server.url` is **`{APP_BASE_URL}/api/vapi/webhook`**, as long as:

- **`APP_BASE_URL`** is your app’s **public** origin (or **`NEXT_PUBLIC_APP_URL`**, or Vercel **`VERCEL_URL`**).
- At least one of **Book appointments** or **Take messages** is enabled.

Tools attached match your toggles:

- Booking on: `check_availability`, `book_appointment`
- Take messages on: `take_message`

Each tool has an explicit **`function.name`**, which **Azure OpenAI** requires. If you previously saw `Invalid 'tools[0].function.name': empty string`, that came from **MCP** being mapped to Azure with an empty name—use this default path (re-save / sync after deploy).

### Option A: MCP tool calling (opt-in)

Set **`VAPI_ASSISTANT_MCP_ENABLED=true`** on the server. Sync will attach **one MCP tool** to `{APP_BASE_URL}/api/mcp` (Streamable HTTP / `shttp`) instead of the webhook function tools. The MCP server is `app/api/mcp/route.ts`.

Use this only if you prefer MCP discovery (e.g. OpenAI-hosted models). **Do not rely on MCP with Azure OpenAI** until Vapi fixes empty `function.name` on that path.

### Manual dashboard setup

- **MCP:** Point the MCP server to **`https://<your-domain>/api/mcp`**.
- **Webhook-style tools:** Point each function tool’s server URL to **`https://<your-domain>/api/vapi/webhook`** and use the tool names above.

Vapi should send **`tool-calls`** to the webhook; respond with **`200`** and `{ results: [{ toolCallId, result | error }] }`.

## 2) Tool argument contract (what the assistant should send)

### `check_availability`
Inputs:
- `requestedStartAt` (ISO8601 string)
- `durationMinutes` (number, default 30 if unknown)
- `requestedEndAt` (optional ISO8601 string)

Output (tool result text/JSON):
- `{ isAvailable: boolean, suggestedSlots: [{ startAt, endAt }, ...] }`

### `book_appointment`
Inputs:
- `customerName` (string)
- `customerPhone` (string; ideally E.164)
- `startAt` (ISO8601 string)
- `endAt` (ISO8601 string)
- `callNotes` (optional string)

Side effects:
- Upserts `contacts` by `user_id + phone`
- Appends a `contacts.notes[]` entry with `type: "call-log"`
- Creates a `bookings` row linked to the contact

## 3) Manual Test Checklist

### Pre-checks
1. In the UI, enable `Book appointments`.
2. Provision a connected phone number (so calls resolve to the correct org).
3. Ensure there is at least one `contacts` row OR allow the tools to create one from caller name/phone.

### Scenario A: Caller requests a free slot
1. Start a Vapi call and ask for an appointment time (e.g. “tomorrow at 3:00pm”).
2. The assistant should call `check_availability`.
3. Then the assistant should confirm and call `book_appointment`.
4. Verify in Supabase:
   - A new `contacts` note of `type="call-log"` contains the call summary.
   - A new `bookings` row exists with `title="Appointment"` and `type="Service"`.

### Scenario B: Caller requests an occupied slot
1. Create a booking for a known time.
2. Call and request the same time.
3. The assistant should call `check_availability` and receive `isAvailable=false`.
4. The assistant should present suggestedSlots and ask the caller to confirm one.
5. After confirmation, `book_appointment` should create the booking for the confirmed time.

### Scenario C: Tool fails due to race condition
1. Trigger a slot that becomes unavailable between availability check and booking.
2. `book_appointment` should return an error including `suggestedSlots`.
3. The assistant should call `check_availability` again and ask the caller to choose.

