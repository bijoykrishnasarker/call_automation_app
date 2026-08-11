<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# LeadOps AI

A modern, all-in-one **lead operations and AI employee platform** for local businesses. Built with Next.js 15, React 19, and Google Gemini for CRM, pipelines, campaigns, reviews, workflows, and AI-powered features.

---

## Tech Stack

| Category | Technologies |
|----------|--------------|
| **Framework** | Next.js 15 (App Router) |
| **UI** | React 19, TypeScript, Tailwind CSS 4 |
| **Charts** | Recharts |
| **Icons** | Lucide React |
| **AI** | Google Gemini (`@google/genai`) |

---

## Routes & Pages

| Route | Page | Description |
|-------|------|-------------|
| `/` | **Dashboard** | Overview, recent activity, contact stats, quick actions |
| `/conversations` | **Inbox** | Unified inbox for messages (SMS, email, social) |
| `/crm` | **Contacts** | Contact list, add/edit contacts, activity/tasks/notes |
| `/pipelines` | **Pipelines** | Deal pipelines (Kanban), stages, deal values |
| `/calendar` | **Calendar** | Appointments and scheduling |
| `/campaigns` | **Campaigns** | Marketing campaigns (email, SMS, push, social) |
| `/reviews` | **Reviews** | Reviews from Google, Facebook, Yelp, etc. |
| `/workflows` | **Workflows** | Automation workflows (triggers, actions, conditions) |
| `/ai-center` | **AI Center** | AI voice, chat, and review automation settings |
| `/settings` | **Settings** | App and account settings |
| `/login` | **Login** | Sign in, sign up, and forgot password (no shell) |

Authenticated routes use the same **App Shell** (sidebar + header). Unauthenticated users are redirected to `/login`.

---

## Folder Structure

```
bangladesh_CRM-main/
├── app/                    # Next.js App Router (routes & layouts)
│   ├── layout.tsx          # Root layout (AuthProvider, AuthGuard)
│   ├── page.tsx            # Dashboard (/)
│   ├── globals.css         # Global styles
│   ├── login/
│   │   └── page.tsx        # Login, sign up, forgot password
│   ├── ai-center/
│   │   └── page.tsx
│   ├── calendar/
│   │   └── page.tsx
│   ├── campaigns/
│   │   └── page.tsx
│   ├── conversations/
│   │   └── page.tsx
│   ├── crm/
│   │   └── page.tsx
│   ├── pipelines/
│   │   └── page.tsx
│   ├── reviews/
│   │   └── page.tsx
│   ├── settings/
│   │   └── page.tsx
│   └── workflows/
│       └── page.tsx
├── components/             # React UI components (one per main page + shared)
│   ├── AppShell.tsx        # Layout: sidebar + header (search, notifications, dark mode)
│   ├── AuthGuard.tsx       # Protects routes; redirects to /login when unauthenticated
│   ├── Sidebar.tsx         # Navigation sidebar
│   ├── Dashboard.tsx
│   ├── CRM.tsx
│   ├── Pipeline.tsx
│   ├── Conversations.tsx
│   ├── Calendar.tsx
│   ├── Campaigns.tsx
│   ├── Reviews.tsx
│   ├── Workflows.tsx
│   ├── AICenter.tsx
│   └── Settings.tsx
├── contexts/
│   ├── AppContext.tsx      # Global state: contacts, messages, pipelines, deals, notifications, dark mode
│   └── AuthContext.tsx     # Supabase auth: user, login, register, logout, resetPassword, session
├── lib/
│   └── supabase/
│       └── client.ts       # Browser Supabase client (NEXT_PUBLIC_* env vars)
├── data/
│   └── mockData.ts         # Mock contacts, messages, pipelines, deals, notifications
├── services/
│   └── geminiService.ts    # Gemini API: contact summary, email draft, sentiment analysis
├── types.ts                # Shared TypeScript types (Contact, Deal, Pipeline, etc.)
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## Features

- **Dashboard** – Contact stats, recent activity, quick navigation.
- **CRM** – Contacts with status (New Lead, Contacted, Booked, Won, Lost), tags, notes, tasks, and AI-generated summaries (Gemini).
- **Pipelines** – Deal stages and values; drag-and-drop style pipeline view.
- **Inbox** – Conversations by channel (SMS, email, Facebook, Instagram, WhatsApp, TikTok).
- **Calendar** – Appointments (Consultation, Service, Checkup) with status.
- **Campaigns** – Multi-channel campaigns with audience tags and basic stats (sent, delivered, opened, clicked).
- **Reviews** – Review aggregation and reply status (Google, Facebook, Yelp, Instagram, TikTok).
- **Workflows** – Visual workflow nodes (trigger, action, condition, delay) and connections.
- **AI Center** – Configuration for AI voice, chat tone, and review auto-reply; backend uses Gemini for summaries, email drafts, and sentiment.
- **Settings** – App preferences (e.g. dark mode is toggled from the header).
- **Notifications** – In-app notifications with links to relevant pages/tabs.

---

## Environment Variables

Create a `.env.local` in the project root:

```env
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

- **Gemini**: Required for AI features (contact summaries, email drafts, sentiment). Without it, AI services show an “unavailable” message.
- **Supabase**: Required for authentication (sign in, sign up, sign out, password reset). See below.

### Supabase Auth

Authentication is handled by [Supabase Auth](https://supabase.com/docs/guides/auth). Sign up may require **email confirmation** depending on your project’s Auth settings in the Supabase dashboard (Authentication → Providers → Email).

For **password reset**, configure the **Redirect URL** in your Supabase project (Authentication → URL Configuration) to include your app’s login page (e.g. `http://localhost:3000/login` for local dev and your production login URL). After clicking the reset link in the email, users are sent to that URL with a token in the hash; the app completes the flow and shows “Password updated.”

---

## Run Locally

**Prerequisites:** Node.js (and pnpm if you use the lockfile).

1. **Install dependencies**
   ```bash
   npm install
   ```
   or, if you use pnpm:
   ```bash
   pnpm install
   ```

2. **Set the Gemini API key**  
   Add `NEXT_PUBLIC_GEMINI_API_KEY` to [.env.local](.env.local) (see above).

3. **Run the app**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

4. **Build for production**
   ```bash
   npm run build
   npm run start
   ```

5. **Lint**
   ```bash
   npm run lint
   ```

---

## Data & State

- **Data** is in-memory and comes from `data/mockData.ts` (contacts, messages, pipelines, deals, notifications). Restarting the app resets changes.
- **Global state** is in `contexts/AppContext.tsx`: contacts (add/update), notifications, dark mode, and CRM action (e.g. which contact/tab to open). Each route typically renders one main component and passes context data as needed.

---

## AI Studio

You can view or extend this app in AI Studio:  
https://ai.studio/apps/temp/2
