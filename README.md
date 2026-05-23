# Welcome to Timeline

<video width="640" height="480" src="https://github.com/user-attachments/assets/9056a1ef-9cc8-4565-adae-efc776ccc4f1" controls></video>
[Timeline](https://krisztiangriz.github.io/timeline-app/) is a privacy focused, minimal PWA where you can capture, organize and visualize your work.

## How it works

Timeline is hosted on Github, save the URL either in a browser or as a browser app and capture, organize and visualize your work. 

All data is stored in Dexie 4.4 (IndexedDB), locally, so nothing ever leaves your computer.

Explore the app today!

## Feature list

### Content structure & organization
- Pages & Hubs — Pages typed as general, colleague, candidate, or project; hubs group related child pages with configurable properties
- Block-Based Document Model — Pages support text, timeline, feedback, table, and visualization blocks arranged in configurable tabs
- Page Templates — Choose from tabbed, simple, text-only, or custom layouts on creation; hubs get standard (visualization + table) or table-only
- Drag & Drop Page Organization — Re-parent pages into hubs or move to root level from the Home table
- Archiving — Archive pages or entire hubs (cascades to children); toggle visibility in Settings

### Hub-level configurable properties

- Page-Scoped Properties — Dropdown properties shown on child page headers (e.g., Status, Role, Level) with named, colored options
- Feedback-Scoped Properties — Properties used in the feedback form (e.g., Sentiment, Dimension) with radio-button selection
- Property Editor — Full CRUD for properties and their options, including color picker per option
- Auto-Seeding — New child pages automatically get the first option of each page-scoped property

### Daily workflow & task management

- Daily Timeline / Work Log — Main timeline for daily entries with rich-text auto-save and chronological history
- Pending Tasks (Checkbox List) — Auto-checkbox section; checking items moves text to Today's entry; [] to insert checkboxes
- Filtered Pending — Non-main-timeline pages show only pending items that mention relevant pages, with cross-completion back to the main timeline
- Cross-References — Entries mentioning a page appear inline on that page's timeline, filtered to relevant lines

### Rich Text Editing & input
- Rich Text Editor — ContentEditable with formatting (bold/italic/underline), headings (H1-H3), lists (bullet/dash/numbered), links, date insertion, monospace, indent/outdent
- @-Mention Autocomplete — Configurable trigger characters per hub; dropdown inserts linked mention spans; collapsed mode shows trigger only
- Component Insertion — ~ trigger to insert timeline, feedback, table, or visualization blocks
- "Add Page" from Mentions — If no matches found, option to create a new page and auto-insert the mention
- Keyboard Shortcuts — Extensive shortcut support

### Feedback system

- Global Feedback Modal — Multi-subject feedback form accessible via Ctrl+Shift+F; searchable page lookup with chip selection
- Inline Feedback List — Per-page view with add/edit/delete and click-to-edit descriptions
- Hub-Aware Properties — Feedback type and dimension driven by hub-level feedback-scoped properties (with colored radio options)
- Time Range Filter — 3M / 6M / 12M / All toggle on the feedback list to filter by date

### Visualization & Analytics
- Configurable Chart Block — Per-page visualization with multiple charts; data sources include entry count, page count, property distribution, feedback by type/dimension/time/per-page
- Chart Types — Bar, Line, Area, Pie (donut with labels and percentages)
- Multi-Scope Selection — Charts can scope to specific pages, hubs (per-child breakdown), or all data
- Time Range Toggle — 3M / 6M / 12M / All (persisted per block in localStorage)
- Customizable Chart Palette — 6-color palette editable in Settings with color picker and reset to defaults
- Paired Layout — Time-series + pie chart combos shown side-by-side automatically

### Navigation & discovery

- Global Search — Command-palette-style (Ctrl+Shift+K) with fuzzy name matching, keyboard navigation, and "Add new page" action
- Breadcrumb Navigation — Contextual path (Home > Hub > Page) with clickable links
- Sortable Tables — Root page and hub tables with sortable columns (name, created, updated); sort preferences persisted per page

### Configuration & settings

- Chart Colors — Customizable 6-color palette with color picker and defaults reset
- Triggers — View/add/edit/remove mention trigger characters; toggle collapsed mode per hub
- Archived Pages — Toggle visibility
- Auto-Backup Frequency — Daily / weekly / monthly / off
- Onboarding Controls — Toggle contextual hints on/off; reset to replay welcome flow
- App Version — Displayed in Settings

### Onboarding & help

- Welcome Modal — Auto-shows on first visit with promotional video and app description
- Contextual Guides — Multi-step dismissable hints; infrastructure built, ready for wiring to features
- Help Modal — Keyboard shortcut reference

## Architecture Overview

### Information Architecture
Data Model

<img width="453" height="625" alt="Screenshot 2026-05-14 at 10 19 03" src="https://github.com/user-attachments/assets/c260457b-9429-4369-bd1c-4096be1c2b6c" />

### Page Hierarchy

    Timeline --> TimelineBlock["📋 timeline block<br/><small>pending tasks + daily entries</small>"]

    Projects --> ProjA["Project Alpha<br/><small>type: project</small>"]
    Projects --> ProjB["Project Beta<br/><small>type: project</small>"]
    Projects --> ProjMore["..."]

    Colleagues --> Alice["Alice<br/><small>type: colleague</small>"]
    Colleagues --> Bob["Bob<br/><small>type: colleague</small>"]
    Colleagues --> ColMore["..."]

    Candidates --> CandMore["..."]

### Block Types
| Block | Renders | Key Behaviors |
|-------|---------|---------------|
| `text` | Rich text editor | Formatting, mentions, links, checkboxes |
| `timeline` | Timeline view | Pending tasks, today editor, date-grouped history, cross-refs |
| `feedback` | Feedback list | Add/edit/delete, property-based categorization, time filtering |
| `table` | Child page list | Sortable columns, drag-to-reorder, property badges |
| `visualization` | Charts | Multiple configurable charts per block, 7 data sources |

### Cross-Reference System

<img width="392" height="200" alt="Screenshot 2026-05-14 at 10 24 28" src="https://github.com/user-attachments/assets/fdcc138e-f246-464d-ace1-0211dbd2bc6e" />

## Software Architecture
| Layer  | Technology |
| ------------- | ------------- |
| Frontend  | React 19 + TypeScript 6 |
| Routing  | React Router DOM 7 |
| Build | Vite 8 |
| Database | Dexie 4.4 (IndexedDB) |
| Charts | Recharts 3.8 |
| Deploy | GitHub Pages via GitHub Actions |
| PWA | Custom service worker |

### Application Layers

<img width="459" height="565" alt="Screenshot 2026-05-14 at 10 20 39" src="https://github.com/user-attachments/assets/f8b6eff2-e73f-46d3-bedf-499ec00155b9" />

### Routing & Component Map
| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `RootPage` | Flat page index table |
| `/timeline` | Redirect | → `/page/{main-timeline-id}` |
| `/colleagues` | `HubPage` | Colleague hub |
| `/colleagues/:id` | `DetailPage` | Colleague detail |
| `/candidates` | `HubPage` | Candidate hub |
| `/candidates/:id` | `DetailPage` | Candidate detail |
| `/projects` | `HubPage` | Project hub |
| `/projects/:id` | `DetailPage` | Project detail |
| `/page/:id` | `DetailPage` | Generic page detail |

### State Management
| Pattern | What | Where |
|---------|------|-------|
| React Context | Global modals, prefs, autocomplete, guides, toasts | `useAppContext`, `useAutocomplete`, `useOnboardingGuides`, `useToast` |
| Dexie `useLiveQuery` | All database reads (reactive) | Every data hook |
| localStorage | User preferences, onboarding, backup settings | Read on init, write on change |
| URL params | Current page/route | React Router |

### Service Worker Strategy
| Request Type | Strategy |
|---|---|
| Navigation | Network-first, fallback to cached `index.html` (SPA routing) |
| `/assets/*` (hashed) | Cache-first (immutable content-hashed files) |
| Video (`.mp4`, `.webm`, `.mov`) | Skip service worker (pass through to network) |
| Other same-origin GET | Network-first with cache fallback |

[Try the app today](https://krisztiangriz.github.io/timeline-app/). I hope you enjoy it!
