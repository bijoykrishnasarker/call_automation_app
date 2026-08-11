# Task 2 Plan: Save AI Receptionist Settings

## Objective

Implement app-level persistence for the AI Voice Receptionist settings: load existing settings from Supabase on page load, and save (create or update) settings from the UI via a Next.js API route. One row per organization; upsert by `organization_id`. No Vapi, webhooks, or phone provisioning—settings only. Saving is explicit via a **Save** button only (no autosave).

## Current State

- **Database:** Table `public.ai_receptionists` exists with: `id`, `organization_id`, `is_enabled`, `agent_name`, `voice`, `speed`, `live_transfer_number`, `answer_after_hours_only`, `created_at`, `updated_at`.
- **Frontend:** AI Center page and form UI exist with inputs: Active toggle, Agent name, Voice model, Speed, Only answer after hours, Live transfer number. Form is not yet wired to load from or save to Supabase.
- **Auth:** App uses Supabase Auth; user session is available. The app has a single source of truth for the current user’s `organization_id` (e.g. `profiles` or `organization_members`); this plan requires using one shared helper for resolution.

## Scope

- **In scope**
  - API routes: **GET** and **POST** `/api/ai-receptionist/settings` only.
  - Resolving `organization_id` via one shared helper (single source of truth).
  - Frontend: fetch settings on page load and prefill form; explicit **Save** button to persist (no autosave).
  - Validation of payload on the backend; upsert by `organization_id`.

- **Out of scope (explicit)**
  - Vapi, webhooks, phone provisioning, transcripts, appointment booking.
  - Multiple receptionist profiles per organization.
  - Non-US flows.

## Out of Scope

- Integrating with Vapi or any voice AI provider.
- Webhooks, phone provisioning, call transcripts, appointment booking.
- Supporting more than one AI receptionist config per organization for this task.
- Autosave; this phase uses an explicit Save button only.

## Assumptions

- One `ai_receptionists` row per organization; upsert key is `organization_id`.
- The app has a **single source of truth** for the current user’s `organization_id` (e.g. `profiles.organization_id` or a single org from `organization_members`). One shared helper must be used for all resolution; no ad-hoc logic in routes.
- AI Center settings page is authenticated-only; API requires authentication.
- UI form and layout exist; Task 2 only wires load/save and API.
- US-only: phone stored in US E.164.

## API Design

**Routes (only these two):**

- `GET /api/ai-receptionist/settings` — fetch settings for the current org.
- `POST /api/ai-receptionist/settings` — upsert settings for the current org.

### GET – Fetch settings

- **Route:** `GET /api/ai-receptionist/settings`
- **Auth:** Required. Resolve `organization_id` from the authenticated user via the **shared org-resolution helper** (no query/body param for org).
- **Response (200):** See **Example API responses** below for shapes.
- **Errors:** 401 unauthenticated; 403 no org/no access; 500 server/Supabase.

### POST – Upsert settings

- **Route:** `POST /api/ai-receptionist/settings`
- **Auth:** Required. Resolve `organization_id` **only** via the shared helper.
- **Request body (JSON):**
  - `is_enabled` (boolean)
  - `agent_name` (string)
  - `voice` (string)
  - `speed` (number)
  - `live_transfer_number` (string; empty string or US number; backend normalizes to E.164 for storage)
  - `answer_after_hours_only` (boolean)
- **Behavior:** Upsert by `organization_id`: update existing row or insert if none. Never use `organization_id` from the body.
- **Response (200):** `{ "settings": { ...saved row } }`. See **Example API responses** below.
- **Errors:** 400 validation; 401/403 same as GET; 500 server/Supabase.

### Example API responses

- **GET 200 – has row**
```json
{
  "settings": {
    "id": "uuid",
    "organization_id": "uuid",
    "is_enabled": true,
    "agent_name": "Sarah",
    "voice": "sarah",
    "speed": 1.0,
    "live_transfer_number": "+15551234567",
    "answer_after_hours_only": false,
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  }
}
```

- **GET 200 – no row**
```json
{
  "settings": null
}
```

- **POST 200 – success**
```json
{
  "settings": {
    "id": "uuid",
    "organization_id": "uuid",
    "is_enabled": false,
    "agent_name": "Sarah",
    "voice": "sarah",
    "speed": 1.0,
    "live_transfer_number": "",
    "answer_after_hours_only": false,
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  }
}
```

- **POST 400 – validation error**
```json
{
  "error": "Validation failed",
  "message": "agent_name is required"
}
```
(or a field-keyed object; keep one consistent shape so the frontend can show the message.)

- **401 Unauthorized**
```json
{
  "error": "Unauthorized",
  "message": "Authentication required"
}
```

- **403 Forbidden**
```json
{
  "error": "Forbidden",
  "message": "No organization access"
}
```

## Default values (first load when no row exists)

When `GET` returns `{ "settings": null }`, the frontend must initialize the form with these **explicit defaults** (do not leave them undefined or empty unless specified):

| Field | Default value |
|-------|----------------|
| `is_enabled` | `false` |
| `agent_name` | `"Sarah"` |
| `voice` | `"sarah"` |
| `speed` | `1.0` |
| `live_transfer_number` | `""` |
| `answer_after_hours_only` | `false` |

## Frontend Plan

- **State model (required)**
  - **formData** — object holding the six fields (is_enabled, agent_name, voice, speed, live_transfer_number, answer_after_hours_only). Updated on input change and when initial load completes.
  - **isLoadingInitial** — boolean; true while the initial GET is in flight. Used to show skeleton/disabled form and avoid showing empty or wrong data.
  - **isSaving** — boolean; true while the POST request is in flight. Used to disable the Save button and/or show a saving indicator.
  - **error** — string | null; set on API error (401, 403, 400, 500); cleared when user starts a new save or when initial load succeeds. Display inline or as toast.
  - **successMessage** — string | null; set briefly after a successful POST (e.g. "Settings saved"); clear after a short delay or on next user action. Display inline or as toast.

- **Page load**
  - On mount, set `isLoadingInitial = true`, `error = null`. Call `GET /api/ai-receptionist/settings`.
  - On 200: if `settings === null`, set `formData` to the **default values** above; otherwise set `formData` from `settings` (map `live_transfer_number` from E.164 to display format if needed). Then set `isLoadingInitial = false`.
  - On error: set `error` from response body or a generic message, set `isLoadingInitial = false`. Optionally set `formData` to defaults so the user can still edit and try saving.

- **Save action (explicit Save button only; no autosave)**
  - User clicks **Save**. Set `isSaving = true`, clear `error` and `successMessage`. Optionally validate on the client for UX.
  - Send **POST** `/api/ai-receptionist/settings` with current `formData` (six fields). Do not send `organization_id`.
  - On 200: set `formData` from `response.settings` (so form reflects stored values, including E.164 for phone if returned), set `successMessage`, then set `isSaving = false`. Clear successMessage after a short delay if desired.
  - On error: set `error` from response body or "Failed to save", set `isSaving = false`. Keep `formData` as-is so the user can fix and click Save again.

- **Loading / error / success UI**
  - While `isLoadingInitial`: disable form and/or show skeleton/spinner.
  - While `isSaving`: disable Save button and/or show saving indicator.
  - When `error`: show `error` (inline or toast); do not clear form.
  - When `successMessage`: show brief confirmation (toast or inline).

## Backend Plan

- **Route handler responsibilities**
  - Authenticate the request (e.g. Supabase session in the route).
  - Resolve `organization_id` **only** by calling the **shared org-resolution helper** (see below). If the helper returns null, return **403**. Do not infer org from query, headers, or body.
  - **GET:** Query `ai_receptionists` for `organization_id = :orgId` (one row). Return `{ settings: row }` or `{ settings: null }`.
  - **POST:** Parse body, validate (Validation rules), return 400 on failure. Normalize `live_transfer_number` to US E.164 for storage. Upsert by `organization_id`; return `{ settings: savedRow }`.

- **Supabase**
  - Use the server Supabase client that runs with the user’s JWT so RLS applies. Upsert with `onConflict: 'organization_id'`; require a unique constraint on `organization_id`.

- **Organization_id: single source of truth and shared helper**
  - The app **must** use one shared helper (e.g. `getOrganizationIdForUser(userId)` or `getCurrentOrganizationId()`) that reads from the app’s **single source of truth** (e.g. `profiles.organization_id`, or the single org from `organization_members` for the user). No route may resolve org in a different way (e.g. no ad-hoc queries or different tables in different routes).
  - Both GET and POST in `app/api/ai-receptionist/settings/route.ts` must call this helper. If it returns null, respond **403**. Document or type the helper’s location (e.g. `lib/auth/get-organization-id.ts`) so all future routes use it consistently.

## Validation Rules

- **agent_name:** Required, non-empty after trim; max length 128. Reject whitespace-only.
- **voice:** Required, non-empty string; fixed set or max length 64 per product.
- **speed:** Required number; min 0.5, max 2.0.
- **live_transfer_number:** Optional. If provided: normalize to digits only; if 11 digits and leading 1, treat as US; if 10 digits, prefix with 1. **Store in US E.164 only:** e.g. `+15551234567`. Reject invalid length or non-numeric. Empty string stored as empty string or null per schema.
- **is_enabled / answer_after_hours_only:** Boolean; accept only `true`/`false` (reject or coerce other values).
- **Backend:** Enforce in the API route; return 400 with a clear message (see example response).

## Security and Multi-Tenancy

- **Tenant isolation:** All reads/writes scoped by `organization_id`. Resolve `organization_id` only via the shared helper from the authenticated user; never from client.
- **RLS:** Policies on `ai_receptionists` so that rows are visible/editable only when `organization_id` matches the user’s org (using the same source of truth the helper uses).
- **API:** Return 403 when the helper returns null; do not use 404 in a way that leaks org existence.

## Data Flow

1. **Load:** User opens AI Center → frontend GET → API (auth → shared helper → org id → SELECT by org) → `{ settings: row | null }` → frontend sets `formData` (defaults or row) and `isLoadingInitial = false`.
2. **Save:** User edits form and clicks **Save** (no autosave) → frontend POST with `formData` → API (auth → shared helper → validate → normalize phone to E.164 → upsert) → `{ settings }` or error → frontend sets `successMessage` or `error`, `isSaving = false`.

## File/Folder Suggestions

- **API:** `app/api/ai-receptionist/settings/route.ts` — GET and POST handlers only.
- **Shared helper (required):** One module, e.g. `lib/auth/get-organization-id.ts`, that exports the single function used to resolve `organization_id` for the current user. Used by both GET and POST.
- **Validation:** `lib/ai-receptionist/validate-settings.ts` — request-body validation; used by POST.
- **Frontend:** Existing AI Center page/form; add state (`formData`, `isLoadingInitial`, `isSaving`, `error`, `successMessage`), fetch on mount, and Save button handler that calls POST.
- **Types:** `types/ai-receptionist.ts` or `lib/ai-receptionist/types.ts` — e.g. `AiReceptionistSettings`, request payload, API response shape.

## Implementation Steps

1. **Shared org helper** — Implement or designate the single helper that returns `organization_id` for the current user from the app’s source of truth. Ensure GET and POST will use only this helper.
2. **Validation** — Implement `validate-settings` (or equivalent) for the POST body; include `live_transfer_number` normalization to US E.164 for storage.
3. **GET route** — In `app/api/ai-receptionist/settings/route.ts`: auth → shared helper → 403 if null → SELECT one row by `organization_id` → return `{ settings: row | null }`.
4. **Unique constraint** — Ensure `ai_receptionists.organization_id` has a unique constraint for upsert.
5. **POST route** — In the same file: auth → shared helper → 403 if null → parse body → validate (400 on fail) → normalize phone to E.164 → upsert by `organization_id` → return `{ settings: savedRow }`.
6. **Frontend state** — Add `formData`, `isLoadingInitial`, `isSaving`, `error`, `successMessage` to the settings form component.
7. **Frontend load** — On mount: GET → set `formData` from response or **default values**; set `isLoadingInitial` false; handle error.
8. **Frontend save** — Wire **Save** button to POST with `formData`; set `isSaving`/`error`/`successMessage`; no autosave.
9. **RLS** — Confirm RLS on `ai_receptionists` enforces org isolation; test cross-org access returns 403 or empty.

## Testing Checklist

- **Happy path:** New org → load → defaults (Sarah, sarah, 1.0, etc.) → edit → Save → GET returns row; reload → form prefilled. Existing org → load → prefill → edit → Save → updated row.
- **Validation:** Empty agent_name → 400. Speed out of range → 400. Invalid phone → 400. Valid empty phone → 200; stored as "" or null.
- **Auth/tenancy:** No auth → 401. User with no org → 403. User A cannot read/update org B’s row.
- **Phone:** Input "5551234567" or "(555) 123-4567" → stored as `+15551234567`.
- **No autosave:** Changing a field and navigating away without clicking Save does not persist.

## Definition of Done

- Only **GET** and **POST** `/api/ai-receptionist/settings` implemented; no PUT.
- `organization_id` resolved only via the **shared helper**; 403 when it returns null.
- First load with no row uses **explicit default values**; Save is **explicit button only** (no autosave).
- `live_transfer_number` normalized and stored in US E.164 (e.g. +15551234567).
- Frontend state model includes **formData**, **isLoadingInitial**, **isSaving**, **error**, **successMessage**.
- Example response shapes (GET with/without row, POST success, 400, 401, 403) match the documented examples.
- Validation and RLS in place; testing checklist satisfied.

## Risks / Notes

- **Vapi later:** Stored shape (voice id, speed, agent name, E.164 number) should map easily to Vapi.
- **Single row per org:** Schema assumes one config per org; multiple profiles would need schema/API changes.
- **Org source of truth:** If the app does not yet have a single place that defines “current user’s org,” that must be in place before implementing; the shared helper must read from it only.
