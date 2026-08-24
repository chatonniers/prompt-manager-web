# Prompt Manager Web

**Live app → https://chatonniers.github.io/prompt-manager-web/**

A web application for Solution Advisors to store, organise, and instantly copy demo prompts during live customer demos. Backed by **Supabase** (PostgreSQL + Auth + Realtime) with role-based access control.

> Built by Sylvain Chatonnier —  Solution Advisor, Supply Chain

---

## Features

| Feature | Details |
|---|---|
| **Prompt library** | Create, edit, duplicate prompts with title, multiple bodies, notes, tags |
| **Multiple prompt bodies** | Each card holds several prompt items (Step 1, Step 2…) — each with its own Copy button |
| **EN / FR bilingual** | Each prompt body has an optional French version; toggle with the FR/EN button |
| **Variable substitution** | Placeholders like `[CUSTOMER_NAME]` trigger a fill-in modal before copy |
| **Story Flow & Solution tags** | Organise by  solution and end-to-end story flow |
| **Autonomous Suite categories** | Group cards by Finance, Supply Chain, Spend, HCM, CX |
| **Systems & MCP credentials** | Attach landscape URLs and MCP endpoints (Client ID, Client Secret) to any card |
| **Card mode / Table mode** | Toggle between card grid and compact table view |
| **Favorites** | Star prompts; favorites appear first in the list |
| **Full-text search** | Searches title, prompt labels, bodies, tags, solutions, notes |
| **Smart sort** | Favorites → solution match → story-flow match → A–Z or relevance score |
| **Bulk select** | Checkbox on each card/row — bulk Export, Move category, Move flow, Delete |
| **File attachments** | Attach files to prompts — stored in Supabase Storage |
| **Import / Export JSON** | JSON export/import with Merge or Replace mode |
| **Admin catalog** | Manage Solutions, Story Flows, Categories, Systems with drag-to-reorder |
| **Visibility Rules** | Admin-configurable matrix: which statuses each role sees per workspace, which KPI pills appear |
| **Zoom controls** | − / % / + buttons to scale the card grid (0.5× – 2×), persisted |
| **Keyboard navigation** | Enter to flip a card to edit; Escape to flip back |
| **Resizable sidebar** | Drag the sidebar edge to resize; persisted across sessions |
| **Fullscreen mode** | Fullscreen toggle in the top bar |
| **Real-time sync** | Changes propagate instantly across open sessions via Supabase Realtime |

---

## Role-based access

| Role | Capabilities |
|---|---|
| **admin** | Full access — manage users, catalog, visibility rules, approve/reject publish requests |
| **editor** | Create and publish prompts, approve publish requests |
| **viewer** | Create private drafts, submit publish requests for admin/editor review |
| **blocked** | Read-only, cannot log in to the app |

**Publish request workflow:** a viewer sets a draft to "Public" then submits a publish request. An admin or editor reviews and approves/rejects it. All enforced at the database level via Supabase RLS policies.

---

## Tech stack

- **React 18 + Vite** — no UI library, custom CSS (indigo palette)
- **Supabase** — PostgreSQL database, Row Level Security, Auth (email/password), Realtime subscriptions, Storage
- **gh-pages** — deployed to GitHub Pages

---

## Local development

```bash
git clone https://github.com/chatonniers/prompt-manager-web.git
cd prompt-manager-web
npm install
npm run dev        # http://localhost:5173/prompt-manager-web/
```

Create a `.env.local` with your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Run `supabase/schema.sql` in your Supabase SQL Editor to set up tables and RLS policies.

## Deploy

```bash
npm run build
npx gh-pages -d dist
```

---

## Database schema

See [`supabase/schema.sql`](supabase/schema.sql) for the full schema including tables, RLS policies, triggers, and realtime configuration.

Key tables: `profiles`, `prompts`, `catalog`, `favorites`, `publish_requests`, `usage_events`, `sessions`.

---

## Related

- [ Demo Prompt Manager — Edge Extension](https://github.com/chatonniers/prompt-manager)
