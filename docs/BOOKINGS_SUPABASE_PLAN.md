# Plan: Integrate Bookings (Calendar) with Supabase

## Goal

- **Persist** bookings (appointments) in Supabase per user.
- **Load** bookings from Supabase so the Calendar page shows real data in Day, Week, and Month views.
- **Support** the existing UI: date navigation, Today, Day/Week/Month toggles, "+ New Booking" button, New Appointment modal (Title/Service, Contact, Date, Type, Start/End time), and display of events with contact name and type.

---

## Current State

| Item | Location | Notes |
|------|----------|--------|
| **Appointment type** | [types.ts](../types.ts) | `id`, `title`, `contactName` (string), `start` (Date), `end` (Date), `type` ('Consultation' \| 'Service' \| 'Checkup'), `status` ('Confirmed' \| 'Pending' \| 'Completed') |
| **State** | [components/Calendar.tsx](../components/Calendar.tsx) | Local state: `appointments` from `getInitialAppointments()` (mock), `view`, `currentDate`, `isModalOpen`, `newBooking` (title, contactName, date, startTime, endTime, type) |
| **UI** | [app/calendar/page.tsx](../app/calendar/page.tsx) | Renders `<Calendar />` with no props. Calendar has Day/Week/Month views, time grid, current-time line, New Appointment modal with text inputs for Title and Contact Name, date picker, Type dropdown (Service/Consultation/Checkup), Start/End time. No link to Contacts. |

---

## 1. Supabase: Table and RLS

### 1.1 Table `bookings`

Store one row per appointment. Use `contact_id` to link to the existing `contacts` table so the calendar shows which contact the booking is for and so we can use the same contact list in the New Appointment form.

```sql
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete restrict,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  type text not null default 'Service' check (type in ('Service', 'Consultation', 'Checkup')),
  status text not null default 'Pending' check (status in ('Pending', 'Confirmed', 'Completed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index bookings_user_id_idx on public.bookings (user_id);
create index bookings_contact_id_idx on public.bookings (contact_id);
create index bookings_start_at_idx on public.bookings (start_at);
```

- **user_id**: for RLS; each user only sees their own bookings.
- **contact_id**: FK to `contacts`; "Contact Name" in the UI becomes a dropdown of contacts (same as in Pipelines/Deals).
- **start_at** / **end_at**: single source of truth for date and time; app builds `Date` from these for display.
- **type**: matches existing UI options (Service, Consultation, Checkup).
- **status**: Pending, Confirmed, Completed (e.g. for checkmark and future filters).

### 1.2 Row Level Security (RLS)

```sql
alter table public.bookings enable row level security;

create policy "Users can read own bookings"
  on public.bookings for select
  using (auth.uid() = user_id);

create policy "Users can insert own bookings"
  on public.bookings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own bookings"
  on public.bookings for update
  using (auth.uid() = user_id);

create policy "Users can delete own bookings"
  on public.bookings for delete
  using (auth.uid() = user_id);
```

---

## 2. Data Mapping

| App (TypeScript) | Supabase column | Notes |
|------------------|-----------------|--------|
| `id` | `id` | UUID |
| `title` | `title` | |
| `contactId` | `contact_id` | New: FK; display name comes from contacts list |
| `contactName` | (derived) | From `contacts` by `contact_id` when rendering (or join in API) |
| `start` | `start_at` | Date from ISO string |
| `end` | `end_at` | Date from ISO string |
| `type` | `type` | 'Service' \| 'Consultation' \| 'Checkup' |
| `status` | `status` | 'Pending' \| 'Confirmed' \| 'Completed' |

The existing `Appointment` type uses `contactName: string`. For Supabase-backed data we have two options:

- **Option A (recommended):** Extend `Appointment` with optional `contactId?: string`. When loading from Supabase we set both `contactId` and `contactName` (contactName from contacts lookup). New Appointment form uses a contact dropdown (contactId); display continues to use contactName.
- **Option B:** Keep `Appointment` as-is and only set `contactName` when mapping from DB by joining or looking up contact in the app. No contactId on the type; form could still store contact_id in DB and resolve name for display.

Recommendation: **Option A** so the form submits `contactId` and the type stays consistent with Deals (contactId + display name from context).

---

## 3. Service Layer (`lib/supabase/bookings.ts`)

- **fetchBookings(userId: string, options?: { from?: Date; to?: Date }): Promise<Appointment[]>`  
  - Select from `bookings` where `user_id = userId`. Optionally filter by `start_at` between `from` and `to` for range queries (e.g. month view). Map rows to `Appointment`: `start`/`end` from `start_at`/`end_at` (ISO → Date), `contact_id` → `contactId`; `contactName` can be left empty in the row mapping and filled by the caller from contacts, or do a join with `contacts` and map `first_name || ' ' || last_name` to `contactName`.
- **createBooking(userId: string, payload: { contactId: string; title: string; startAt: Date; endAt: Date; type: Appointment['type']; status?: Appointment['status'] }): Promise<Appointment>**  
  - Insert row; return mapped appointment (contactName can be set by caller from contacts).
- **updateBooking(bookingId: string, payload: { contactId?: string; title?: string; startAt?: Date; endAt?: Date; type?: Appointment['type']; status?: Appointment['status'] }): Promise<void>**  
  - Update by id (RLS ensures ownership).
- **deleteBooking(bookingId: string): Promise<void>**  
  - Delete by id.

Mapping helpers: row → `Appointment` (id, title, contactId, contactName, start, end, type, status). If the service does not join contacts, the Calendar (or AppContext) should resolve contact names from `contacts` when building the list for the UI.

---

## 4. AppContext Changes

- **State:**  
  - `bookings: Appointment[]` — loaded from `fetchBookings(userId)` (and optionally filtered by range in Calendar).  
  - `bookingsLoading: boolean`, `bookingsError: string | null`.
- **Load on login:** In a `useEffect` depending on `user?.id`, call `fetchBookings(user.id)` and set state (and loading/error). Optionally load a wide range (e.g. current month ± 1) or full list; for large datasets, range-based fetching can be added later.
- **API for Calendar:**  
  - **addBooking(booking): Promise<Appointment | null>** — create in Supabase, append to `bookings`, return created (with contactName resolved from contacts).  
  - **updateBooking(id, payload): Promise<void>** — update in Supabase and in state.  
  - **deleteBooking(id): Promise<void>** — delete in Supabase and remove from state.

Contacts are already in context; when mapping bookings, resolve `contactName` from `contacts` by `contactId` so the calendar can display names without changing the DB shape.

---

## 5. Calendar Component Changes

- **Data source:** Use `bookings` (and optionally `bookingsLoading` / `bookingsError`) from `useApp()`. Remove local mock `getInitialAppointments()` and local `appointments` state for the list.
- **New Appointment modal:**  
  - Replace "Contact Name" text input with a **Contact** dropdown: list `contacts` from context, option value = `contact.id`, label = e.g. `${firstName} ${lastName}` (and optionally email). Store `contactId` in form state; on submit call `addBooking({ contactId, title, startAt, endAt, type, status })`.  
  - Keep Title/Service, Date, Type, Start Time, End Time as they are; combine date + start/end time into `startAt` and `endAt` (Date) for the API.
- **Display:** Continue to use `appointment.contactName` for display (resolved in context when building the list, or in Calendar from `contacts` by `appointment.contactId`). If context returns appointments with `contactName` already set, no change to current render logic.
- **Loading / error:** Show a loading state while `bookingsLoading`; show a message if `bookingsError`. Empty state: no message required if the list is simply empty.
- **Edit / delete (optional):** If you add inline edit or delete (e.g. click on an event), call `updateBooking` or `deleteBooking` from context. Not required for the first iteration.

---

## 6. Types

- In **types.ts**, extend `Appointment` with optional `contactId?: string` so that Supabase-backed appointments have a stable link to contacts. Keep `contactName` for display.
- Ensure `start` and `end` remain `Date` in the type; in the service layer convert to/from ISO strings for `start_at`/`end_at`.

---

## 7. Implementation Order

1. **Supabase:** Create `bookings` table and RLS (as in §1).
2. **types.ts:** Add `contactId?: string` to `Appointment` (optional but recommended).
3. **lib/supabase/bookings.ts:** Implement `fetchBookings`, `createBooking`, `updateBooking`, `deleteBooking` with row ↔ `Appointment` mapping; resolve or leave `contactName` for caller.
4. **AppContext:** Add `bookings`, `bookingsLoading`, `bookingsError`; load bookings when user is set; resolve `contactName` from `contacts` for each booking; expose `addBooking`, `updateBooking`, `deleteBooking`.
5. **Calendar:** Use `bookings` and context methods; replace Contact Name text input with Contact dropdown; submit with `contactId` and date/time; show loading/error states.

---

## 8. Edge Cases

- **Contact deleted:** `contact_id` has `on delete restrict`; deleting a contact with bookings will fail until those bookings are updated or deleted (or FK changed to set null if you add optional contact later).
- **Overlapping bookings:** No DB constraint; optional client-side or server-side check when creating/updating (e.g. warn if another booking exists in the same time range).
- **Time zones:** Store `start_at`/`end_at` as `timestamptz`; build `Date` from ISO in the app so the calendar uses the user’s local time. No extra work for v1 if the app always uses local.
- **Range fetching:** For very large numbers of bookings, `fetchBookings` can accept `from`/`to` and the Calendar can request only the visible range (e.g. current month); initial implementation can load all and filter in memory.

This plan keeps the existing Calendar UI and adds Supabase persistence with a contact-linked data model consistent with the rest of the app (Contacts, Pipelines, Deals).
