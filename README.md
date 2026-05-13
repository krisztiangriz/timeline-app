# Welcome to Timeline

[Timeline](https://krisztiangriz.github.io/timeline-app/) is a clever, privacy focused progressive web todo app, that collects tagged input and visualizes data.

## How it works

Timeline is hosted on Github, save the URL either in a browser or as a browser app and capture, organize and visualize your work. 

All data is stored in IndexedDB, locally, so nothing ever leaves your computer.

Explore the app today!

## Feature list

### Content structure & organization

- Pages & Hubs — Pages typed as general, colleague, candidate, or project; hubs group related child pages with configurable properties
- Block-Based Document Model — Pages support text, timeline, feedback, table, and visualization blocks arranged in configurable tabs with drag-and-drop reordering (including cross-tab)
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
- Component Insertion — ~ trigger to insert timeline, feedback, table, or visualization blocks inline
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
[Try the app today](https://krisztiangriz.github.io/timeline-app/). I hope you enjoy it!
