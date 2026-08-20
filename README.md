# Prompt Manager Web

**Live app → https://chatonniers.github.io/prompt-manager-web/**

A standalone web application for SAP Solution Advisors to store, organise, and instantly copy demo prompts during live customer demos. Ported from the [SAP Demo Prompt Manager](https://github.com/chatonniers/prompt-manager) Edge extension — same features, no installation required.

> Built by Sylvain Chatonnier — SAP Solution Advisor, Supply Chain

---

## Features

| Feature | Details |
|---|---|
| **Prompt library** | Create, edit, delete prompts with title, body, notes, tags |
| **EN / FR bilingual** | Each prompt has an optional French body; toggle with the FR/EN button |
| **Story Flow & Solution tags** | Organise by SAP solution (S/4HANA, IBP, Ariba, Joule…) and end-to-end flow |
| **Favorites** | Star prompts; favorites appear first in the list |
| **Full-text search** | Weighted scoring across title, tags, solutions, body, notes |
| **Smart sort** | Favorites → solution match → story-flow match → A–Z or score |
| **SAP URL detection** | Paste any SAP URL in Settings to auto-filter prompts by detected solution |
| **File attachments** | Attach files / ZIPs to prompts — stored locally in IndexedDB |
| **Import / Export** | JSON export compatible with the Edge extension (v1.0 & v1.1) |
| **Admin catalog** | Add, rename (with cascade), delete Solutions, Story Flows, Landscapes |
| **Resizable sidebar** | Drag the sidebar edge to resize; persisted across sessions |
| **100% local** | All data lives in your browser — `localStorage` + `IndexedDB`, no server |

---

## Import / Export compatibility

Export files are fully interchangeable with the **SAP Demo Prompt Manager Edge extension**. Same JSON schema:

```json
{
  "prompts": [...],
  "catalog": { "solutions": [], "storyFlows": [], "landscapes": [] },
  "settings": {},
  "attachments": [{ "id", "promptId", "name", "type", "size", "data" }],
  "exportVersion": "1.1",
  "exportedAt": "ISO-8601"
}
```

---

## Tech stack

- **React 18 + Vite 5** — no UI library, custom CSS (indigo palette)
- **localStorage** — prompts, catalog, settings
- **IndexedDB** — binary file attachments
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
npm run deploy     # builds + pushes to gh-pages branch
```

---

## Related

- [SAP Demo Prompt Manager — Edge Extension](https://github.com/chatonniers/prompt-manager)
