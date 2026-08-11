# VAPI Canonical Webhook Integration

## Endpoint

- Route: `POST /api/vapi/webhook`
- Content type: `application/json` only
- Auth verification:
  - `VAPI_WEBHOOK_AUTH_MODE=off|optional|required`
  - shared secret header: `x-vapi-secret` (or Bearer token fallback)
  - signature header: `x-vapi-signature` / `x-vapi-signature-256` (HMAC SHA-256 over raw body)
  - TLS enforcement: `VAPI_WEBHOOK_REQUIRE_TLS=true` validates `x-forwarded-proto=https`
- Status codes:
  - `200` processed, or duplicate no-op
  - `400` invalid JSON/content type
  - `401/403` auth failed
  - `409` duplicate delivery ID with different payload, or booking slot conflict
  - `422` canonical validation failure
  - `500` internal processing error

## Canonical Schema

### Contact (projection)

- `external_contact_id text not null`
- `first_name text not null`
- `last_name text not null`
- `middle_name text null`
- `email text null`
- `primary_phone text not null`
- `mobile_phone text null`
- `company text null`
- `job_title text null`
- `source text not null`
- `notes text null`
- `created_at timestamptz not null`

### Appointment (projection)

- `external_appointment_id text not null`
- `contact_external_id text not null`
- `start_time_utc timestamptz not null`
- `end_time_utc timestamptz not null`
- `date date not null`
- `timezone text not null`
- `duration_minutes integer not null`
- `subject text not null`
- `location text null`
- `calendar_id text null`
- `recurrence jsonb null`
- `status text not null`
- `notes text null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

All date-time values are stored in UTC ISO 8601 for `*_time_utc`, while preserving the source timezone and local calendar date.

## Mapping Rules (VAPI -> Canonical)

- `provider_delivery_id`:
  1. `x-vapi-delivery-id`
  2. `x-webhook-id`
  3. payload id
  4. fallback deterministic hash key (`eventType:callId:sha256(rawBody)`)
- `provider_call_id`: `message.call.id` -> `message.callId` -> `body.callId`
- `organization_id`:
  1. call/assistant metadata (`organization_id`/`organizationId`)
  2. `vapi_phone_numbers.e164_number = to_number`
  3. `vapi_assistants.vapi_assistant_id = assistant_id`
- `external_contact_id`:
  - if Vapi contact id exists: `vapi:<provider_contact_id>`
  - else deterministic: `vapi:<organization_id>:<normalized_phone>`
- `external_appointment_id`:
  - deterministic: `vapi:<provider_call_id>:appointment:<resource_id_or_start_utc>`
- `first_name`, `middle_name`, `last_name`: parsed from caller full name
- `email`: normalized lower-case
- `primary_phone` / `mobile_phone`: normalized E.164
- `appointment.start_time_utc`, `end_time_utc`:
  - if ISO with offset provided, parse directly
  - else resolve from `localDate + localTime + timezone`
  - reject invalid/missing timezone or invalid local timestamp
- `appointment.date`: local calendar date in original timezone

## Idempotency + Retry

- Receipts table: `public.vapi_webhook_receipts` (unique `provider_delivery_id`)
- Projection table: `public.vapi_event_projections` (unique `projection_key`)
- Dead letter table: `public.vapi_webhook_dead_letters`
- Policy:
  - same delivery id + same payload hash + already processed => `200 duplicate`
  - same delivery id + different payload hash => `409 conflict`
  - failed processing increments attempts and schedules `next_retry_at` with exponential backoff
  - exhausted retries => dead letter row inserted

## Supabase Data Model + Constraints

Migration: `supabase/migrations/20260414052000_vapi_canonical_webhooks.sql`

Creates/updates:

- extends `public.contacts` with canonical columns and indexes
- `public.appointments` with:
  - unique `(organization_id, external_appointment_id)`
  - FK `(organization_id, contact_external_id) -> contacts(organization_id, external_contact_id)`
  - FK `contact_id -> contacts(id)`
  - optional `legacy_booking_id -> bookings(id)`
- `public.vapi_webhook_receipts`
- `public.vapi_webhook_dead_letters`
- `public.vapi_event_projections`

RLS:

- `appointments`: org-member select + modify policies
- receipts/dead letters/projections: org-member select policies
- webhook write path uses Supabase service-role key in server route

## Test Strategy

Automated tests:

- `lib/vapi/verify-webhook.test.ts`
  - shared secret valid/invalid
  - signature valid
- `lib/vapi/normalize-webhook.test.ts`
  - full payload -> canonical contact + appointment
  - partial payload with optional fields missing
  - invalid appointment timestamp
- `lib/vapi/time.test.ts`
  - timezone conversion to UTC
  - invalid DST local time rejection
  - ambiguous DST fallback handling

Run locally:

```bash
pnpm install
pnpm typecheck
pnpm test
```

Representative payload scenarios and expected DB outcomes:

1. Full data payload
   - Contact upserted (`contacts.external_contact_id` deterministic)
   - Appointment upserted (`appointments.external_appointment_id` deterministic)
   - `calls`/`call_events`/`call_transcripts` inserted once
2. Partial payload (optional fields missing)
   - Contact created/updated with null optional fields
   - No appointment row unless required appointment fields are resolvable
3. Invalid datetime payload
   - `422` or tool error result with explicit validation issue
   - No appointment upsert
4. DST transition payload with timezone
   - UTC timestamps reflect configured disambiguation mode
   - warning recorded for ambiguous local time

## Deployment

1. Apply migration in Supabase SQL editor or via CLI.
2. Set environment variables:
   - `VAPI_WEBHOOK_AUTH_MODE`
   - `VAPI_WEBHOOK_SECRET` and/or `VAPI_WEBHOOK_SIGNING_SECRET`
   - `VAPI_WEBHOOK_REQUIRE_TLS`
   - `VAPI_WEBHOOK_MAX_ATTEMPTS`
   - `VAPI_WEBHOOK_RETRY_BASE_SECONDS`
   - `VAPI_DEFAULT_TIMEZONE`
3. Re-sync assistant from `/ai-center` so webhook server/tool metadata are refreshed.
4. Validate webhook delivery with Vapi test calls.

## Rollback

- App rollback: redeploy previous build.
- Data rollback:
  - disable webhook processing by setting `VAPI_WEBHOOK_AUTH_MODE=required` with rotated secret, or remove Vapi webhook URL temporarily
  - keep canonical tables intact for audit
  - if needed, remove only canonical projections from `appointments` and `vapi_*` webhook tables by `provider='vapi'` and delivery window
