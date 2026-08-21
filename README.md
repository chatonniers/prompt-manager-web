# Prompt Manager Web

**Live app → https://chatonniers.github.io/prompt-manager-web/**

A standalone web application for SAP Solution Advisors to store, organise, and instantly copy demo prompts during live customer demos. Ported from the [SAP Demo Prompt Manager](https://github.com/chatonniers/prompt-manager) Edge extension — same features, no installation required.

> Built by Sylvain Chatonnier — SAP Solution Advisor, Supply Chain

---

## Features

| Feature | Details |
|---|---|
| **Prompt library** | Create, edit, duplicate prompts with title, multiple bodies, notes, tags |
| **Multiple prompt bodies** | Each card holds several prompt items (Step 1, Step 2…) — each with its own Copy button |
| **EN / FR bilingual** | Each prompt body has an optional French version; toggle with the FR/EN button |
| **Variable substitution** | Placeholders like `[CUSTOMER_NAME]` trigger a fill-in modal before copy |
| **Story Flow & Solution tags** | Organise by SAP solution and end-to-end story flow |
| **Autonomous Suite categories** | Group cards by Finance, Supply Chain, Spend, HCM, CX |
| **Systems & MCP credentials** | Attach landscape URLs and MCP endpoints (Client ID, Client Secret) to any card |
| **Favorites** | Star prompts; favorites appear first in the list |
| **Full-text search** | Searches card title, prompt labels, prompt bodies, tags, solutions, notes |
| **Smart sort** | Favorites → solution match → story-flow match → A–Z or relevance score |
| **Bulk select** | Checkbox on each card to select multiple — bulk Export, Move category, Move flow, Delete |
| **SAP URL detection** | Paste any SAP URL in Settings to auto-filter prompts by detected solution |
| **File attachments** | Attach files / ZIPs to prompts — stored locally in IndexedDB |
| **Import / Export JSON** | JSON export compatible with the Edge extension; import with Merge or Replace mode |
| **Share URL** | 🔗 button encodes your entire library as a gzip+base64 URL for instant sharing |
| **Admin catalog** | Manage Solutions, Story Flows, Categories, Systems with drag-to-reorder |
| **Zoom controls** | − / % / + buttons in the toolbar to scale the card grid (0.5× – 2×), persisted |
| **Keyboard navigation** | Enter to flip a card to edit; Escape to flip back |
| **Save feedback flash** | Green ring animation on a card after saving inline edits |
| **Resizable sidebar** | Drag the sidebar edge to resize; persisted across sessions |
| **Fullscreen mode** | Fullscreen toggle button in the top bar |
| **100% local** | All data lives in your browser — `localStorage` + `IndexedDB`, no server |

---

## Import / Export compatibility

Export files are fully interchangeable with the **SAP Demo Prompt Manager Edge extension**. JSON schema:

```json
{
  "prompts": [...],
  "catalog": { "solutions": [], "storyFlows": [], "categories": [], "systems": [] },
  "settings": {},
  "attachments": [{ "id", "promptId", "name", "type", "size", "data" }],
  "exportVersion": "1.1",
  "exportedAt": "ISO-8601"
}
```

Import supports two modes: **Merge** (keep existing, add new) or **Replace** (erase all, import fresh) with a confirmation step.

---

## Tech stack

- **React 18 + Vite 5** — no UI library, custom CSS (indigo palette)
- **localStorage** — prompts, catalog, settings, zoom level
- **IndexedDB** — binary file attachments
- **CompressionStream (gzip)** — share URL encoding
- **gh-pages** — deployed to GitHub Pages

---

## Local development

```bash
git clone https://github.com/chatonniers/prompt-manager-web.git
cd prompt-manager-web
npm install
npm run dev        # http://localhost:5173/prompt-manager-web/
```

## Deploy

```bash
npm run build
npx gh-pages -d dist
```

---

## Related

- [SAP Demo Prompt Manager — Edge Extension](https://github.com/chatonniers/prompt-manager)
