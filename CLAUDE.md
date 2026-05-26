# Timeline App — OpenCode Configuration

## Project Overview
A privacy-focused, minimal progressive web app for capturing, organizing and
visualizing work. Built with React + Dexie (IndexedDB) + Vite. Deployed to
GitHub Pages as a PWA.

## Tech Stack
- **Frontend:** React 19, TypeScript 6 (strict mode), CSS Modules
- **Database:** Dexie (IndexedDB) — local-first, no backend
- **Charts:** Recharts (lazy-loaded via ConfigurableViz)
- **Build:** Vite with manual chunks (react, dexie, recharts vendor splits)
- **Deploy:** GitHub Pages at `/timeline-app/` base path

## Build & Deploy
```bash
npm run build    # tsc -b && vite build && node scripts/generate-sw.mjs
git push         # triggers GitHub Actions deploy
```

## Key Architecture Decisions

### Data Model
- DB schema version: **18** (Dexie, IndexedDB)
- All data is local — no server, no auth
- Pages have `role` field for special pages: `main-timeline`, `colleague-hub`,
  `candidate-hub`, `project-hub`
- Pending tasks live ONLY on the main-timeline page (`isPending: true`)
- Filtered pending shown on other pages via cross-ref (read-only)

### Block Model — One Block Per Tab
- **Each tab contains exactly one block** — enforced at DB level
- Block types: `text`, `timeline`, `feedback`, `visualization` (user-facing: "Charts")
- `table` blocks are hub-only (page-level, no tabs)
- Hub pages are hardcoded to `visualization` + `table` — no tabs, no Layout editing
- Main timeline page is special — page-level `timeline` block, no tabs
- Add/remove blocks by adding/removing tabs in the Edit Page modal
- **No `~` insertion menu** — blocks are only created via tab creation
- **No page templates** — tabs are configured directly in the Layout section
- Block `order` field removed — one block per tab, ordering not needed

### State Management
- No Redux/Zustand — Dexie `useLiveQuery` for reactive DB state
- `AutocompleteProvider` shares `allPages` across the app (single subscription,
  stabilized via `pagesEqual` shallow comparison — skips `updatedAt`/`editCount`)
- `ModalContext` + `MentionInsertContext` + `PreferencesContext` split from
  `AppContext` (editors subscribe only to `MentionInsertContext`, not modal state)
- `ToastProvider` — shared toast queue, `useToast()` hook

### Component Patterns
- Route-level lazy loading (RootPage, HubPage, DetailPage)
- Modal lazy loading (PageForm, FeedbackModal, SettingsModal, HelpModal,
  OnboardingModal)
- `RichTextEditor` uses `contentEditable` with `lastSetValue` ref to prevent
  DOM resets on re-render (critical for mention detection)
- `RichTextDisplay` uses `useSyncExternalStore` for lazy DOMPurify loading
  (single module-level load, all instances notified simultaneously)
- `BlockList`, `TextBlock`, and `ComponentBlockContent` wrapped in `memo`
- `CrossRefRow` — lightweight memoized component for read-only cross-ref entries
- `useNavigateToPage()` hook for stable mention navigation callbacks
- `DropdownPortal` component for dropdowns inside modals (escapes overflow)
- Page CRUD operations (`addPage`, `updatePage`, `deletePage`, `updateTabs`,
  `archivePage`, `unarchivePage`) are plain exported async functions — stable
  references, no hook wrapper

### Service Worker
- Custom SW (no Workbox) in `src/sw-template.js`
- Post-build script: `scripts/generate-sw.mjs` generates precache manifest
- Only critical assets precached (vendor chunks + CSS + HTML)
- Lazy chunks cached on first use via cache-first strategy
- Navigation uses stale-while-revalidate (instant shell, background update)
- Video files skipped (not cached)

## Code Style Preferences

### CSS
- CSS Modules only — no inline styles except for dynamic values
- Design tokens via CSS custom properties in `src/styles/tokens.css`
- `var(--color-*)`, `var(--space-*)`, `var(--font-*)` for all values
- `will-change: transform, opacity` on animated elements
- `:focus-visible` for keyboard focus indicators (not `:focus`)

### Typography Scale
- Page title:      22px / 28px / bold / `--color-text-primary`
- h1 (Title):      20px / 28px / bold / `--color-text-primary`
- h2 (Heading):    18px / 24px / bold / `--color-text-primary`
- h3 (Sub heading): 16px / 20px / semibold (600) / `--color-text-primary`
- Body:            14px / 24px / regular

### Colors
- All design tokens in `src/styles/tokens.css` (light + dark theme)
- `--color-text-placeholder`: `#8B9BB5` (light), `#7B8FA6` (dark) — meets 4.5:1
- `--color-negative`: `#E53E3E` (light) — meets 4.5:1 on white
- Trigger characters: always `ui-monospace, 'SF Mono', Monaco, 'Cascadia Mono',
  monospace`

### React Patterns
- Prefer `useCallback` with ref pattern for stable callbacks over broad deps
- Use `useRef` to avoid re-running effects when values change but identity
  doesn't matter (e.g., `showToastRef.current = showToast`)
- `safeStorage` utility for all localStorage access (handles Safari private
  browsing quota errors)
- All async DB writes wrapped in try/catch with `showToast('Failed to...')`
- `useSyncExternalStore` for module-level singleton state (e.g., DOMPurify load)

## Key Constraints / Gotchas

### RichTextEditor
- Uses `contentEditable` — DOM resets break mention detection
- `lastSetValue` ref prevents overwriting DOM when parent passes same value
- `emitChange()` MUST update `lastSetValue.current` before calling `onChange`
- `blurTimer` stored in ref and cleaned up on unmount
- DOMPurify is lazy-loaded (not in initial bundle)
- No `~` component insertion — blocks only added via tabs in Edit Page modal
- Mention detection extracted to `useMentionDetection.ts` hook
- Pending mention insert extracted to `usePendingMentionInsert.ts` hook
- Checkbox handling extracted to `useCheckboxHandling.ts` hook

### Mentions
- `enrichMentionHtml` uses a module-level cache keyed by `allPages` reference
- Collapsed mentions: `data-collapsed="true"` + CSS `::before` shows trigger char
- `collapseMentions` prop scopes collapse to timeline blocks only
- Non-collapsed mentions: `color: inherit` + always underlined

### Timeline / Pending
- Pending section only on main-timeline page (full editor)
- Other pages show filtered pending (read-only, cross-ref from main timeline)
- Filtered pending uses `usePendingEntry(pageId)` — NOT `useTimelineEntries`
- `useCrossRefEntries` uses `*tagRefs` multi-entry Dexie index

### Charts
- Recharts lazy-loaded via `ConfigurableViz` (separate vendor chunk: ~110KB gz)
- ChartRenderer split into 6 modules: `chartConstants`, `chartHooks`,
  `ChartContainer`, `EntryCharts`, `FeedbackCharts`, `PropertyChart`
- `palette` passed as prop from `ConfigurableViz` (single `useChartPalette` call)
- `AddChartModal` uses shared `DropdownPortal` (no local reimplementation)
- `useAllEntries(monthCount)` scoped by date range — not full table scan
- Feedbacks scoped by date range in `ConfigurableViz`
- Pie charts: donut style (55%/85% inner/outer radius) with right-side labels
- Single-series charts use `FALLBACK_COLOR` (#B8C5DB grey)
- "Visualization" block type is labeled "Charts" in the UI

### Modal System
- `Modal.tsx` has focus trap (Tab/Shift+Tab cycling), auto-focus on open
- Auto-focus uses `didAutoFocus` ref — fires only ONCE per open, not on
  every `confirmDisabled` change
- `overflow: hidden` on `.modal` is intentional — do NOT remove
- Dropdowns inside modals MUST use `DropdownPortal` to escape overflow clipping

### Auto-Backup
- `useAutoBackup()` called in `App` (top-level) — NOT inside any provider
- Uses custom events (`backup-success`, `backup-failed`) for toast feedback
- `BackupToastListener` component inside `ToastProvider` catches events
- Timer uses `[]` deps with ref pattern — do NOT add `showToast` to deps

### Service Worker
- Seeding uses DB-based idempotent check inside a Dexie transaction
- SW cache name includes content hash — changes on every build

## Accessibility Standards
- All interactive `<div>`/`<span>` need `tabIndex={0}`, `role`, `onKeyDown`
- Hover-only actions need `:focus-within` CSS fallback
- Toast container: `aria-live="polite"`, `role="status"`
- Search dropdowns: use `DropdownPortal` + tracks scroll via capture listener
- ContextMenu: full keyboard nav (ArrowUp/Down, Enter, Escape), `role="menu"`
- PropertyRow: full keyboard nav (ArrowUp/Down, Enter, Escape), `role="listbox"`
- ColorPicker: arrow grid nav + Enter/Escape, `role="listbox"`
- Custom radio/checkbox buttons: `role="radio"`/`role="checkbox"` + `aria-checked`
- Form inputs: `aria-label` for inputs without `<label>` elements
- Tab groups: `role="tablist"` + `role="tab"` + `aria-selected`

## Commit Style
- Short imperative: `Fix auto-backup timer: use ref pattern for stable deps`
- Group related changes: `Accessibility: contrast fixes, keyboard nav, ARIA`
- No emoji in commit messages

## File Structure Notes
- `src/hooks/useNavigateToPage.ts` — shared mention navigation
- `src/hooks/useBlocks.ts` — `useBlocks` query hook + `updateBlock` plain export
- `src/utils/safeStorage.ts` — safe localStorage wrapper
- `src/utils/mentionEnricher.ts` — HTML enrichment with module-level cache
- `src/components/DropdownPortal/DropdownPortal.tsx` — portal for modal dropdowns
- `src/constants/colors.ts` — chart color palette (source of truth)
- `scripts/generate-sw.mjs` — post-build SW manifest generator
