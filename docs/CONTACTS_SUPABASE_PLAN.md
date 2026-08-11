# Plan: Integrate Contacts with Supabase

## Goal
- **Add** new contacts via the existing "New Contact" modal and persist them in Supabase.
- **Fetch** all contacts from Supabase (per logged-in user) so the Contacts list, Dashboard, and other features use database data instead of mock data.

---

## Current State

| Item | Location | Notes |
|------|----------|--------|
| **Contact type** | [types.ts](types.ts) | `id`, `firstName`, `lastName`, `email`, `phone`, `tags[]`, `status`, `company`, `address`, `city`, `state`, `zip`, `lastActivity`, `createdAt?`, `notes[]`, `tasks[]`, `source` |
| **Contacts state** | [contexts/AppContext.tsx](contexts/AppContext.tsx) | `contacts` from `INITIAL_CONTACTS` (mock), `addContact`, `updateContact` |
| **CRM usage** | [app/crm/page.tsx](app/crm/page.tsx), [components/CRM.tsx](components/CRM.tsx) | Passes `contacts`, `addContact`, `updateContact`; "New Contact" builds a `Contact` and calls `onAddContact(contact)` |
| **Other consumers** | Dashboard, Pipelines, Conversations, AppShell | Read `contacts` from `useApp()` |

---

## 1. Supabase: Table and RLS

### 1.1 Table `contacts`

Run in Supabase SQL Editor (or use a migration):

```sql
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text default '',
  company text,
  status text not null default 'New Lead',
  tags text[] default '{}',
  source text default 'Manual Entry',
  last_activity text default 'Just now',
  address text,
  city text,
  state text,
  zip text,
  notes jsonb default '[]',
  tasks jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index contacts_user_id_idx on public.contacts (user_id);
```

- **user_id**: ties each row to the authenticated user (for RLS and multi-tenant behavior).
- **notes** / **tasks**: store the same shape as in the app (array of objects); use JSONB so the app can read/write without extra tables for v1.

### 1.2 Row Level Security (RLS)

- Users may only see and modify their own contacts (`user_id = auth.uid()`).

```sql
alter table public.contacts enable row level security;

create policy "Users can read own contacts"
  on public.contacts for select
  using (auth.uid() = user_id);

create policy "Users can insert own contacts"
  on public.contacts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own contacts"
  on public.contacts for update
  using (auth.uid() = user_id);

create policy "Users can delete own contacts"
  on public.contacts for delete
  using (auth.uid() = user_id);
```

---

## 2. Data Mapping

| App (TypeScript) | Supabase column | Notes |
|------------------|-----------------|--------|
| `id` | `id` | UUID string |
| `firstName` | `first_name` | |
| `lastName` | `last_name` | |
| `email` | `email` | |
| `phone` | `phone` | |
| `company` | `company` | |
| `status` | `status` | Enum string: 'New Lead', 'Contacted', 'Booked', 'Won', 'Lost' |
| `tags` | `tags` | Array of strings |
| `source` | `source` | |
| `lastActivity` | `last_activity` | |
| `address`, `city`, `state`, `zip` | same | |
| `notes` | `notes` | JSONB array of `{ id, text, createdAt, type }` |
| `tasks` | `tasks` | JSONB array of `{ id, title, dueDate, completed }`; `dueDate` stored as ISO string, parsed to `Date` in app |
| `createdAt` | `created_at` | ISO string from DB → `Date` in app |

Helper functions: **rowToContact(row)** and **contactToRow(contact)** (and optionally **contactToInsert(contact)** without `id`/timestamps) to convert between DB snake_case/JSON and app `Contact` type.

---

## 3. Service Layer

**New file:** `lib/supabase/contacts.ts` (or `services/contactsService.ts`).

- **fetchContacts(userId: string): Promise<Contact[]]**  
  - `supabase.from('contacts').select('*').eq('user_id', userId).order('created_at', { ascending: false })`  
  - Map each row with `rowToContact(row)` and return.

- **createContact(userId: string, contact: Omit<Contact, 'id'>): Promise<Contact>**  
  - Build insert payload with `contactToInsert(contact)`, set `user_id: userId`.  
  - `supabase.from('contacts').insert(payload).select('*').single()`.  
  - Return `rowToContact(inserted)`.

- **updateContact(contact: Contact): Promise<Contact>**  
  - Build update payload from contact (no `user_id` change).  
  - `supabase.from('contacts').update(payload).eq('id', contact.id).eq('user_id', userId).select('*').single()`.  
  - Return `rowToContact(updated)`. Use `userId` from `useAuth().user?.id` (passed in or from caller).

All functions use the existing Supabase client from [lib/supabase/client.ts](lib/supabase/client.ts). The client already uses the anon key and the user’s JWT from the session, so RLS will apply.

---

## 4. AppContext Changes

**File:** [contexts/AppContext.tsx](contexts/AppContext.tsx).

- **State**
  - Replace `useState<Contact[]>(INITIAL_CONTACTS)` with:
    - `contacts: Contact[]`
    - `contactsLoading: boolean` (optional but recommended)
    - `contactsError: string | null` (optional)
  - Keep `notifications`, `darkMode`, `crmAction` as today.

- **Loading contacts**
  - When `user` is available (from `useAuth().user`), run a `useEffect` that:
    - Sets `contactsLoading = true`, `contactsError = null`.
    - Calls `fetchContacts(user.id)`.
    - On success: `setContacts(mapped)`.
    - On error: set `contactsError` (and optionally leave `contacts` as `[]`).
    - In `finally`: set `contactsLoading = false`.
  - Dependency: `user?.id` (and ensure `AppProvider` is rendered inside `AuthProvider` so `useAuth()` is available). If `user` is null, set `contacts` to `[]`.

- **addContact(contact)**
  - Only allow when `user` is present.
  - Call `createContact(user.id, contact)` (contact passed from CRM may include a temporary id; the service should ignore it and use the DB-generated id).
  - On success: either append the returned `Contact` to state (`setContacts(prev => [returned, ...prev])`) or refetch contacts.
  - On error: surface via `contactsError` or a callback; optionally keep optimistic update and revert on failure.

- **updateContact(contact)**
  - Call `updateContact(contact)` (service layer); ensure the service uses `user.id` for the RLS `eq('user_id', userId)`.
  - On success: replace the contact in state (`setContacts(prev => prev.map(c => c.id === contact.id ? updated : c))`).
  - On error: surface and optionally revert.

**Provider order:** Keep `AuthGuard` rendering `AppProvider` when the user is logged in, so `AppProvider` can use `useAuth()` inside.

---

## 5. CRM / UI Adjustments

- **Create flow**
  - [components/CRM.tsx](components/CRM.tsx) currently builds a `Contact` with `id: Date.now().toString()` and calls `onAddContact(contact)`.
  - No change required in the modal fields. The context’s `addContact` will call the service; the service returns the saved contact (with real `id`). Context can set state with that returned contact; CRM will then show the new contact in the list and can set `setSelectedContact(returned)` if the context exposes the created contact (e.g. by updating state so the new contact is in `contacts`, and CRM can find it by email or the returned id). Easiest: context adds the **returned** contact from `createContact` to state; CRM keeps calling `onAddContact(contact)` with the same payload, and the context replaces the temp id with the server contact when adding to state.
  - If the context refetches after create, then CRM should set `selectedContact` to the contact that matches the one just created (e.g. by email) after the refetch, or the context can return the created contact from `addContact` (e.g. callback or promise) so CRM can set `setSelectedContact(created)`. Simplest: `addContact` in context is `async (contact) => { const created = await createContact(user.id, contact); setContacts(prev => [created, ...prev]); return created; }` and in CRM `onAddContact` is called, then we need a way to get the created contact—either refetch and select by id, or make `onAddContact` a promise/callback that receives the created contact. So: change `onAddContact` to `(contact) => Promise<Contact | void>` or keep sync and in context after `createContact` we set state with the returned contact; CRM can use `useEffect` to set selectedContact to the first contact (newest) if we just added one, or we add an optional `onContactCreated?: (c: Contact) => void` to CRM. Clean approach: context `addContact` returns `Promise<Contact | null>`; CRM `handleCreateContact` does `const created = await onAddContact(contact); if (created) setSelectedContact(created);`. So we need to update the type of `onAddContact` to be async and return the created contact.
- **Update flow**
  - Already uses `onUpdateContact(updated)`; context will call `updateContact(updated)` and then update state. No UI change if the context implements the service call and state update as above.

- **Loading / error**
  - If context exposes `contactsLoading` and `contactsError`, CRM (and Dashboard) can show a loading state and an error message when appropriate.

---

## 6. Files to Add

| Path | Purpose |
|------|--------|
| `lib/supabase/contacts.ts` | `fetchContacts`, `createContact`, `updateContact`; `rowToContact`, `contactToRow` / `contactToInsert` mapping. |
| Optional: `supabase/migrations/YYYYMMDD_create_contacts.sql` | Same SQL as in section 1 for version-controlled migrations. |

---

## 7. Files to Modify

| Path | Changes |
|------|--------|
| [contexts/AppContext.tsx](contexts/AppContext.tsx) | Use `useAuth()`, load contacts from Supabase in `useEffect` when `user?.id` exists; implement `addContact` and `updateContact` with Supabase calls; optional `contactsLoading` / `contactsError`. |
| [components/CRM.tsx](components/CRM.tsx) | If `onAddContact` becomes async and returns the created contact: `handleCreateContact` await it and call `setSelectedContact(created)` when present. |
| [app/crm/page.tsx](app/crm/page.tsx) | No change if only passing the same `addContact`/`updateContact`; if their signatures change, adjust types only. |

---

## 8. Optional: Delete Contact

- Add `deleteContact(id: string)` in the service (delete where `id` and `user_id` match).
- Add RLS delete policy (already above).
- Expose `deleteContact` from context and optionally add a “Delete” action in the CRM detail view later.

---

## 9. Summary Flow

1. User logs in → `AppProvider` has `user` from `useAuth()`.
2. `useEffect` runs `fetchContacts(user.id)` → `setContacts(data)` (and loading/error).
3. Contacts list and Dashboard show data from Supabase.
4. User clicks “Add Contact” and submits → CRM calls `onAddContact(contact)` → context calls `createContact(user.id, contact)` → inserts in Supabase → context adds returned contact to state (and optionally returns it to CRM to set as selected).
5. User edits a contact → CRM calls `onUpdateContact(updated)` → context calls `updateContact(updated)` → Supabase update → context updates state.

End result: add and fetch contacts are fully backed by Supabase with per-user isolation via RLS.
