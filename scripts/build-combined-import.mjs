import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const INPUT_PATH = resolve('/Users/krisztian.griz/Documents/Code/timeline-app/combined-export.json');
const OUTPUT_PATH = resolve('/Users/krisztian.griz/Documents/Code/timeline-app/combined-import.json');

// Pages to remove
const PAGES_TO_REMOVE = new Set([8, 9, 10]);
// Block IDs belonging to pages 8, 9, 10
const BLOCKS_TO_REMOVE = new Set([13, 14, 15, 16, 17, 18, 19, 20, 21]);

const NOW = new Date('2025-06-01').toISOString();

// ─── Input reading helper ──────────────────────────────────────────────────

async function readInput() {
  // 1. Check for a custom path passed as CLI argument
  const cliPath = process.argv[2];
  if (cliPath) {
    const resolved = resolve(cliPath);
    if (!existsSync(resolved)) {
      console.error(`Error: File not found: ${resolved}`);
      process.exit(1);
    }
    console.log(`Reading from CLI argument: ${resolved}`);
    return readFileSync(resolved, 'utf-8');
  }

  // 2. Check if the default file exists
  if (existsSync(INPUT_PATH)) {
    console.log(`Reading from ${INPUT_PATH}...`);
    return readFileSync(INPUT_PATH, 'utf-8');
  }

  // 3. Try reading from stdin (piped data)
  if (!process.stdin.isTTY) {
    console.log('Reading from stdin...');
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    const input = Buffer.concat(chunks).toString('utf-8');
    if (input.trim().length === 0) {
      console.error('Error: stdin was empty.');
      process.exit(1);
    }
    return input;
  }

  // 4. Nothing available — show help
  console.error(`
Error: No input data available.

This script needs your database export JSON as input. You can provide it in one of three ways:

  1. Place the export file at the default path:
     ${INPUT_PATH}

  2. Pass the file path as a CLI argument:
     node scripts/build-combined-import.mjs /path/to/your-export.json

  3. Pipe the export data via stdin:
     cat /path/to/your-export.json | node scripts/build-combined-import.mjs
     # or
     pbpaste | node scripts/build-combined-import.mjs

To get your export JSON, use the app's export/backup feature.
`);
  process.exit(1);
}

// ─── Timeline Entry Data ────────────────────────────────────────────────────

const meridianEntries = [
  ["2025-05-28", "• Initial call with Meridian Capital about portal redesign\n• They're unhappy with current vendor's work\n• Scheduled follow-up for next week"],
  ["2025-06-02", "• Project kickoff with Meridian Capital\n• Scope: full redesign of investor portal\n• Discovery phase starts next week\n• Primary stakeholders: CFO, Head of Product, 2 PMs"],
  ["2025-06-04", "• Set up project channels and tools\n• Access granted to existing portal\n• Initial heuristic review started"],
  ["2025-06-06", "• Completed heuristic evaluation of current portal\n• 34 issues identified, categorized by severity\n• Shared findings with client PM"],
  ["2025-06-09", "• Stakeholder interview 1: CFO\n    • Wants real-time portfolio views\n    • Frustrated with PDF-only reporting\n• Stakeholder interview 2: Head of Product\n    • Mobile access is #1 priority from investors"],
  ["2025-06-11", "• Stakeholder interview 3: PM (Marcus)\n• Stakeholder interview 4: PM (Leah)\n• Both flagged navigation complexity as top issue"],
  ["2025-06-13", "• Stakeholder interview 5: Lead Developer\n    • Tech constraints around real-time data\n• Stakeholder interview 6: Customer Success lead\n    • Top support tickets: password resets, finding documents"],
  ["2025-06-16", "• Completed all stakeholder interviews\n• Synthesis in progress\n• Identified key pain points: navigation, reporting views, mobile access\n• Competitive analysis underway"],
  ["2025-06-18", "• Competitive analysis: reviewed 6 competitor portals\n• Documented patterns for portfolio dashboards\n• Moodboard and reference library created"],
  ["2025-06-23", "• User journey mapping session with client team\n• Mapped 4 primary user flows\n• Identified 7 drop-off points in current experience"],
  ["2025-06-25", "• Analytics review of current portal\n    • 68% of users never visit document center\n    • Average session: 2.3 minutes\n    • Mobile traffic: 41% but 89% bounce rate"],
  ["2025-06-30", "• Discovery synthesis complete\n• Prepared presentation for leadership review\n• Key recommendation: mobile-first redesign with progressive disclosure"],
  ["2025-07-02", "• Dry run of discovery presentation internally\n• Refined narrative and recommendations\n• Added ROI projections based on analytics"],
  ["2025-07-08", "• Presented discovery findings to leadership\n• Positive reception, greenlit full redesign\n• Wireframing sprint starts next week\n• Team expanded: 2 designers, 1 researcher"],
  ["2025-07-10", "• Onboarded second designer to the project\n• Divided workstreams: portfolio/dashboard vs. documents/settings\n• Established design principles with client"],
  ["2025-07-14", "• Wireframing sprint day 1\n• Portfolio overview: 3 layout concepts explored\n• Sketching session with client PM for quick validation"],
  ["2025-07-15", "• Wireframing sprint day 2\n• Transaction history: filtering and search patterns\n• Card sorting exercise with 5 investors for document taxonomy"],
  ["2025-07-16", "• Wireframing sprint day 3\n• Document center: upload, categorize, search\n• Navigation structure: tested 3 approaches with paper prototypes"],
  ["2025-07-17", "• Wireframing sprint day 4\n• Settings, notifications, user preferences\n• Internal review and alignment session"],
  ["2025-07-18", "• Wireframing sprint day 5\n• Consolidated all screens into clickable prototype\n• Scheduled usability testing for next week"],
  ["2025-07-22", "• Usability testing day 1: 3 participants\n• Portfolio flow tested well\n• Navigation confusion on document center entry point"],
  ["2025-07-23", "• Usability testing day 2: 3 participants\n• Transaction search mental model mismatch\n• All participants expected date-range filter first"],
  ["2025-07-24", "• Usability testing day 3: 2 participants\n• Settings flow clear and intuitive\n• Mobile prototype tested positively"],
  ["2025-07-28", "• Usability test synthesis\n• 12 findings, 5 critical\n• Iteration plan created and shared with client"],
  ["2025-07-31", "• Wireframe iteration round 1 complete\n• Navigation restructured based on test findings\n• Client sign-off on revised information architecture"],
  ["2025-08-04", "• Wireframes v1 complete for core flows\n    • Portfolio overview\n    • Transaction history\n    • Document center\n• Stakeholder feedback session scheduled for Thursday"],
  ["2025-08-07", "• Stakeholder feedback session held\n• CFO very positive on portfolio dashboard\n• Head of Product wants more emphasis on alerts/notifications\n• Minor revisions needed"],
  ["2025-08-11", "• Visual design exploration started\n• 3 style directions prepared\n• Aligning with Meridian brand guidelines"],
  ["2025-08-13", "• Style direction presentation to client\n• Direction B selected: clean, data-forward, subtle gradients\n• Typography and color palette locked"],
  ["2025-08-18", "• High-fidelity mockups started on portfolio dashboard\n• Component library setup in Figma\n• Design tokens defined"],
  ["2025-08-21", "• Major pivot on navigation structure after usability testing\n    • Tab-based approach abandoned\n    • Moving to sidebar + contextual panels\n• 3 rounds of iteration needed"],
  ["2025-08-25", "• Navigation redesign iteration 1\n• Sidebar prototype built and tested internally\n• Feels more scalable, better for future modules"],
  ["2025-08-27", "• Navigation redesign iteration 2\n• Added contextual panels for quick actions\n• Client PM reviewed and approved direction"],
  ["2025-09-01", "• Navigation redesign iteration 3 — final\n• Responsive behavior defined for tablet and mobile\n• Full sign-off from client"],
  ["2025-09-04", "• Hi-fi designs: transaction history complete\n• Filtering patterns finalized\n• Export functionality designed"],
  ["2025-09-08", "• Hi-fi designs: document center complete\n• Upload flow, categorization, bulk actions\n• Permission levels visualized"],
  ["2025-09-11", "• Hi-fi designs: notifications and alerts\n• Push notification opt-in flow\n• Email digest preferences"],
  ["2025-09-15", "• High-fidelity designs in progress\n• Design system tokens established\n• Weekly syncs with dev team started\n• First sprint handoff planned for October"],
  ["2025-09-18", "• Component library v1 complete (48 components)\n• Documented usage guidelines\n• Shared with dev team for implementation planning"],
  ["2025-09-22", "• Dev team technical review of designs\n• Flagged chart rendering performance concerns\n• Agreed on progressive loading approach"],
  ["2025-09-25", "• Prepared sprint 1 handoff package\n• Annotated specs, interaction notes, edge cases\n• Dev estimation session held"],
  ["2025-09-29", "• Final QA on sprint 1 designs\n• 6 edge cases documented\n• Error states and empty states designed"],
  ["2025-10-02", "• Sprint 1 handoff meeting\n• Walked dev team through all screens\n• Q&A session, 14 clarification questions resolved"],
  ["2025-10-06", "• Sprint 1 handoff complete\n    • Login, onboarding, portfolio dashboard\n• Dev team flagged accessibility concerns on charts\n• QA checklist created"],
  ["2025-10-09", "• Addressed accessibility issues on chart components\n• Added ARIA labels and keyboard navigation\n• Screen reader testing completed"],
  ["2025-10-13", "• Sprint 2 design finalization\n• Transaction history final review\n• Search autocomplete behavior documented"],
  ["2025-10-16", "• Design QA on sprint 1 dev build\n• 8 discrepancies found, tickets logged\n• Most are spacing and typography issues"],
  ["2025-10-20", "• Sprint 2 prep: filtering edge cases\n• What happens with 10,000+ transactions?\n• Pagination vs. infinite scroll decision: pagination won"],
  ["2025-10-23", "• Sprint 2 handoff prep complete\n• Demo of interactive prototype to stakeholders\n• CFO impressed with real-time portfolio updates"],
  ["2025-10-27", "• Client requested additional reporting module — not in original scope\n• Internal discussion on capacity and timeline impact\n• Preparing options for client"],
  ["2025-10-30", "• Presented 3 options for reporting module inclusion\n• Client chose phased approach: basic reports in v1, advanced in v2\n• SOW amendment in progress"],
  ["2025-11-03", "• Sprint 2 handoff: transaction history, filtering, search\n• Client requested additional reporting module not in scope\n    • Negotiated phased approach\n• Positive dev feedback on design documentation quality"],
  ["2025-11-06", "• Started basic reporting module wireframes\n• 4 report types identified with client\n• Template-based approach for efficiency"],
  ["2025-11-10", "• Design QA on sprint 2 build\n• Much better implementation quality\n• Only 3 minor issues"],
  ["2025-11-13", "• Sprint 3 design: document center finalized\n• Drag-and-drop upload interactions detailed\n• Bulk action patterns documented"],
  ["2025-11-17", "• Sprint 3 design: notifications system\n• Push notification templates designed\n• Preference center interactions mapped"],
  ["2025-11-20", "• Sprint 3 design: settings and account management\n• Security settings flow (2FA, session management)\n• Profile editing"],
  ["2025-11-24", "• Sprint 3 handoff prep\n• All designs annotated and ready\n• Sprint planning session with dev"],
  ["2025-12-01", "• Sprint 3: document center, notifications, settings\n• Beta release to internal users at client\n• 47 bug tickets raised, 12 design-related\n• Holiday freeze starting Dec 20"],
  ["2025-12-04", "• Triaging beta feedback\n• Prioritized design bugs by severity\n• 4 critical, 5 medium, 3 low"],
  ["2025-12-08", "• Fixed critical design bugs\n    • Chart tooltip positioning\n    • Mobile menu overlap\n    • Document upload progress indicator\n    • Transaction filter reset behavior"],
  ["2025-12-11", "• Fixed medium priority design bugs\n• Updated component library with fixes\n• Shared beta feedback summary with leadership"],
  ["2025-12-15", "• Pre-holiday wrap up\n• All critical bugs resolved\n• Medium bugs scheduled for January\n• Team going on holiday freeze"],
  ["2026-01-06", "• Back from holiday break\n• Reviewed outstanding tickets\n• New PM (Rachel) replacing Marcus — introductions made"],
  ["2026-01-13", "• Post-holiday ramp up\n• Addressed remaining design bugs from beta\n• Reporting module discovery started (phase 2)\n• Client stakeholder changes: new PM replacing Marcus"],
  ["2026-01-16", "• Onboarding Rachel (new PM) on project history\n• Shared design documentation and decision log\n• She seems very detail-oriented"],
  ["2026-01-20", "• Reporting module: stakeholder interviews\n• 3 interviews with portfolio managers\n• Key need: customizable dashboard widgets"],
  ["2026-01-23", "• Reporting module wireframes started\n• Widget-based layout approach\n• Drag-and-drop customization"],
  ["2026-01-27", "• Reporting wireframes v1 complete\n• Internal review session\n• 2 concerns: performance with many widgets, print layout"],
  ["2026-01-30", "• Addressed performance concern: max 8 widgets per view\n• Print layout: simplified single-column version\n• Client review scheduled"],
  ["2026-02-03", "• Client review of reporting wireframes\n• Approved with minor changes\n• Moving to high-fidelity"],
  ["2026-02-06", "• Reporting module hi-fi designs started\n• Reusing existing component library\n• New chart types needed: waterfall, heat map"],
  ["2026-02-10", "• Reporting module wireframes complete\n• User testing with 5 investors\n    • Very positive on new portfolio view\n    • Confusion on document categorization\n• Iterating on document taxonomy"],
  ["2026-02-13", "• Document taxonomy revised based on user feedback\n• Reduced from 12 categories to 7\n• Auto-categorization rules defined"],
  ["2026-02-17", "• Reporting module hi-fi complete\n• Handoff package prepared\n• Final sprint planning with dev"],
  ["2026-02-20", "• Final sprint handoff\n• Dev team confident on timeline\n• Production release planning started"],
  ["2026-02-24", "• Design QA on latest build\n• 5 issues found, all minor\n• Overall quality very high"],
  ["2026-03-03", "• Production readiness review\n• All design work complete\n• Training materials drafted"],
  ["2026-03-10", "• Onboarding flow tutorial designed\n• Tooltips and contextual help created\n• Video walkthrough storyboarded"],
  ["2026-03-17", "• Final design QA pass\n• Production release scheduled for April 1\n• Training materials and onboarding flow delivered\n• Winding down to maintenance mode"],
  ["2026-03-24", "• Pre-launch checklist reviewed\n• All design assets delivered\n• App store screenshots prepared"],
  ["2026-03-31", "• Final sign-off from all stakeholders\n• Release go/no-go meeting: GO\n• Celebration dinner planned"],
  ["2026-04-01", "• Production launched\n• Monitoring dashboards active\n• Standby for any critical issues"],
  ["2026-04-03", "• 2 minor visual bugs reported post-launch\n• Fixed same day, deployed\n• User adoption looking strong"],
  ["2026-04-07", "• Production launched successfully\n• Minor post-launch fixes (3 tickets)\n• Transition to BAU support\n• Project retrospective held"],
  ["2026-04-14", "• Retrospective outcomes documented\n• Case study preparation started\n• Transitioning to maintenance mode, check-ins monthly"],
];

const catalystEntries = [
  ["2025-09-15", "• Brainstormed idea for AI design toolkit during team lunch\n• Pain point: documentation takes 30% of design time\n• Worth exploring further"],
  ["2025-09-22", "• Initial idea discussed at practice meeting\n• Goal: build internal AI-powered design toolkit\n• Research phase: what tools exist, what gaps do we have"],
  ["2025-09-29", "• Started landscape analysis\n• Testing Galileo AI, Diagram, Musho\n• None solve our specific documentation problem"],
  ["2025-10-06", "• Continued tool evaluation\n• Tested 4 more tools: Uizard, Visily, Creatie, Locofy\n• All focused on generation, not documentation"],
  ["2025-10-14", "• Completed landscape analysis of 12 AI design tools\n• Identified 3 key opportunities:\n    • Automated component documentation\n    • AI-driven layout suggestions\n    • Design-to-code pipeline"],
  ["2025-10-21", "• Drafted pitch deck for leadership\n• ROI calculation: 40% time savings on documentation = 6 hours/week per designer\n• Requested budget for Q1 2026"],
  ["2025-10-28", "• Refined pitch based on feedback from practice lead\n• Added competitive positioning angle\n• Scheduled presentation for next week"],
  ["2025-11-04", "• Pitched to leadership, got budget approval for Q1 2026\n• Small team: 1 designer, 1 engineer (part-time)\n• MVP scope defined: component documentation generator"],
  ["2025-11-11", "• Requirements gathering for MVP\n• Interviewed 6 designers about documentation pain points\n• Biggest issue: keeping docs in sync with design changes"],
  ["2025-11-18", "• Technical architecture discussion with engineering\n• Figma plugin API capabilities reviewed\n• LLM integration approaches mapped"],
  ["2025-11-25", "• User stories written for MVP\n• Prioritized using MoSCoW method\n• Must-have: auto-generate component usage docs from Figma file"],
  ["2025-12-02", "• Technical spike on LLM integration\n• Evaluated Claude, GPT-4, and Gemini for design token parsing\n• Claude selected for structured output quality"],
  ["2025-12-09", "• Proof of concept: parsed a simple button component\n• Generated usage documentation automatically\n• Quality surprisingly good but needs refinement for complex components"],
  ["2025-12-16", "• Extended PoC to handle component variants\n• Works for up to 5 variants cleanly\n• More complex components need iterative prompting\n• Good stopping point before holiday"],
  ["2026-01-06", "• Development started\n• First prototype: Figma plugin that generates component docs\n• Weekly demos to practice team for feedback"],
  ["2026-01-08", "• Plugin scaffold set up\n• Basic UI: select component → generate button → output panel\n• API integration with Claude working"],
  ["2026-01-10", "• First end-to-end flow working\n• Select button component → generates markdown documentation\n• Includes: props, usage guidelines, do/don't examples"],
  ["2026-01-13", "• Added support for component sets\n• Auto-detects variants and documents differences\n• Prompt engineering to improve output consistency"],
  ["2026-01-15", "• Error handling and edge cases\n• What if component has no variants?\n• What if component is too complex (100+ layers)?"],
  ["2026-01-17", "• Output formatting improvements\n• Added code snippet generation for common frameworks\n• React and Vue examples auto-generated"],
  ["2026-01-20", "• Internal demo to practice team\n• Positive reactions\n• Feature requests: batch processing, export to Notion"],
  ["2026-01-22", "• Added batch processing — document entire component library at once\n• Performance optimization needed for large files\n• Rate limiting Claude API calls"],
  ["2026-01-24", "• Export to Markdown files working\n• Notion integration deferred — too much API complexity for now\n• Focus on core quality"],
  ["2026-01-27", "• Alpha version shared with 4 designers for testing\n• Positive reception on speed improvement\n• Issues with complex component variants\n• Iteration on prompt engineering"],
  ["2026-01-29", "• Alpha feedback session\n• 3 out of 4 testers found it genuinely useful\n• Accuracy issues: sometimes hallucinates prop names\n• Added validation step against actual Figma properties"],
  ["2026-01-31", "• Fixed hallucination issues with property validation\n• Added confidence scoring to outputs\n• Low confidence items flagged for human review"],
  ["2026-02-03", "• Started work on layout suggestion feature\n• Analyzing existing designs for spacing patterns\n• Building heuristic rules + AI hybrid approach"],
  ["2026-02-05", "• Layout analyzer v1: detects inconsistent spacing\n• Highlights issues and suggests corrections\n• Uses design system tokens as reference"],
  ["2026-02-07", "• Layout analyzer v2: alignment detection\n• Finds elements that are almost-but-not-quite aligned\n• Suggests snapping to nearest grid point"],
  ["2026-02-10", "• Combined documentation + layout tools into single plugin\n• Unified UI redesigned\n• Tab-based interface: Document, Analyze, Settings"],
  ["2026-02-12", "• Settings panel: customize output format, select AI model, set confidence threshold\n• User preferences saved locally"],
  ["2026-02-14", "• Internal hackathon: built design-to-code prototype in 8 hours\n• Generates React components from Figma selections\n• Rough but promising — uses Tailwind CSS"],
  ["2026-02-17", "• Added layout suggestion feature\n    • Analyzes existing designs and proposes spacing/alignment fixes\n• Internal hackathon built design-to-code prototype\n• Growing interest from engineering practice"],
  ["2026-02-19", "• Engineering practice lead reached out about collaboration\n• They want to use our design-to-code output in their workflow\n• Scheduled joint session for next week"],
  ["2026-02-21", "• Joint session with engineering team\n• Aligned on output format requirements\n• They'll contribute to the code generation templates"],
  ["2026-02-24", "• Preparing for beta launch to full team\n• Bug fixes and polish\n• Onboarding flow within plugin"],
  ["2026-02-26", "• Usage analytics integration\n• Tracking: features used, time saved, error rates\n• Anonymous and opt-in"],
  ["2026-02-28", "• Beta testing guide written\n• FAQ document prepared\n• Slack channel created for feedback"],
  ["2026-03-03", "• Beta launch prep: final testing\n• Fixed 3 edge case crashes\n• Performance: generates docs in under 4 seconds average"],
  ["2026-03-05", "• Soft beta launch to 6 designers\n• Walked each through the plugin\n• First day: 14 documentation generations, 8 layout analyses"],
  ["2026-03-07", "• Beta day 3: usage picking up\n• 2 bug reports, both minor UI issues\n• One designer using it for every new component"],
  ["2026-03-10", "• Beta release to full design team (12 users)\n• Usage tracking implemented\n• Average 3.2 uses per designer per day\n• Feature requests flooding in"],
  ["2026-03-12", "• Triaging feature requests\n• Top 3: Storybook integration, version history, team-wide style rules\n• Prioritizing Storybook integration"],
  ["2026-03-14", "• Started Storybook integration\n• Generates stories alongside component docs\n• Engineering team providing templates"],
  ["2026-03-17", "• Storybook integration v1 working\n• Auto-generates stories with controls for each prop\n• Dev team testing with real project"],
  ["2026-03-19", "• Design-to-code quality improvements\n• Better handling of auto-layout → flexbox\n• Responsive breakpoint detection"],
  ["2026-03-21", "• Prepared all-hands presentation\n• Compiled usage metrics and testimonials\n• ROI data: 38% time savings confirmed (close to 40% target)"],
  ["2026-03-24", "• Rehearsed presentation\n• Added live demo segment\n• Backup plan if demo fails"],
  ["2026-03-26", "• More feature work: team-wide style rules\n• Define spacing, color, typography rules\n• Plugin enforces rules and flags violations"],
  ["2026-03-28", "• Style rules engine working\n• Configurable per-project\n• Integrates with layout analyzer"],
  ["2026-03-31", "• Presented at practice all-hands\n• Leadership wants to expand: design-to-code as priority for Q2\n• Hiring dedicated engineer for the project\n• Budget doubled"],
  ["2026-04-02", "• Started writing job description for dedicated engineer\n• Requirements: Figma plugin API, LLM experience, React\n• Posting next week"],
  ["2026-04-07", "• Q2 roadmap planning\n• Design-to-code v1 as primary deliverable\n• Target: generate production-ready React components"],
  ["2026-04-10", "• Design-to-code architecture planning\n• Component detection and classification\n• Token mapping to CSS variables"],
  ["2026-04-14", "• Prototype: design-to-code for simple components (buttons, inputs, cards)\n• Output quality: 70% production-ready, 30% needs manual tweaks\n• Goal: get to 90%+"],
  ["2026-04-17", "• Client project partnership confirmed for real-world testing\n• Meridian team will use design-to-code on their component library\n• Real feedback loop established"],
  ["2026-04-21", "• Design-to-code v1 in development\n• Partnership with client projects for real-world testing\n• Exploring productization for client offerings\n• Roadmap planning for remainder of year"],
  ["2026-04-25", "• Interviewed 2 engineer candidates\n• One very promising: LLM experience + design tools background\n• Second round scheduled"],
];

const northstarEntries = [
  ["2025-07-28", "• Sales pitch for Northstar Financial\n• Mobile banking app for retail customers\n• Greenfield project, no legacy constraints\n• Pitch deck and case studies presented"],
  ["2025-08-04", "• Won the pitch\n• 6-month engagement confirmed\n• Team: 3 designers, working closely with their product team\n• Contracts being finalized"],
  ["2025-08-11", "• Won the pitch for Northstar Financial\n• Greenfield mobile banking app for retail customers\n• 6-month engagement, team of 3 designers\n• Kickoff in 2 weeks"],
  ["2025-08-14", "• Internal team kickoff\n• Assigned roles: lead, UI specialist, researcher\n• Research plan drafted\n• Competitive landscape review started"],
  ["2025-08-18", "• Competitor audit: analyzed Monzo, Revolut, Chime, N26, Cash App, Nubank, Starling, Ally\n• Documented patterns, differentiators, and gaps\n• Shared findings with client"],
  ["2025-08-20", "• Research recruitment started\n• Screening survey sent to 200 potential participants\n• Targeting: 18-35, mobile-first banking users"],
  ["2025-08-22", "• Stakeholder alignment workshop with client\n• Business goals: 50k users in 6 months, 4.5+ app store rating\n• Target audience refined\n• Success metrics defined"],
  ["2025-08-25", "• Discovery phase started\n• 12 user interviews scheduled\n• Competitor audit of 8 banking apps\n• Stakeholder alignment workshop held"],
  ["2025-08-27", "• User interview day 1: 4 interviews\n• Common theme: \"I just want to check my balance fast\"\n• Transaction categorization mentioned by all 4"],
  ["2025-08-28", "• User interview day 2: 4 interviews\n• Budgeting tools: mixed feelings, most abandoned after initial setup\n• Push notifications: wanted for large transactions only"],
  ["2025-08-29", "• User interview day 3: 4 interviews\n• Card management: freeze/unfreeze is must-have\n• International transfers: big pain point with existing banks"],
  ["2025-09-01", "• Research synthesis started\n• Affinity mapping: 156 data points clustered\n• Emerging themes: speed, simplicity, control"],
  ["2025-09-03", "• Persona development\n• 3 personas: Quick Checker, Budget Planner, Power User\n• Quick Checker represents 60% of target audience"],
  ["2025-09-05", "• Journey mapping session\n• Mapped: first-time setup, daily check, transfer money, manage card, budget review\n• Key moments of friction identified"],
  ["2025-09-08", "• User research synthesis complete\n    • Key insight: users want speed over features\n    • Biggest frustration: transaction categorization\n• Personas and journey maps delivered"],
  ["2025-09-10", "• Research findings presentation to client\n• Strong alignment on \"speed first\" design principle\n• Client wants to add biometrics — added to scope"],
  ["2025-09-12", "• Design principles workshop\n• Established 5 principles: Speed, Clarity, Control, Delight, Trust\n• Will guide all design decisions"],
  ["2025-09-15", "• Information architecture defined\n• 4 main tabs: Home, Payments, Cards, Profile\n• Flat hierarchy, minimal nesting"],
  ["2025-09-18", "• Design sprint preparation\n• Materials prepared, schedule confirmed\n• Client participants identified\n• Room booked for full week"],
  ["2025-09-22", "• Design sprint day 1: Map and Define\n• Mapped the \"first 5 minutes\" experience\n• Defined sprint question: How might we make checking balance feel instant?"],
  ["2025-09-23", "• Design sprint day 2: Sketch\n• 8 participants sketched solutions\n• \"Crazy 8s\" generated 64 concepts\n• Strongest ideas: gesture-based balance, pre-loaded dashboard"],
  ["2025-09-24", "• Design sprint day 3: Decide\n• Voted on concepts\n• Winner: pre-loaded dashboard with gesture shortcuts\n• Storyboard created for prototype"],
  ["2025-09-25", "• Design sprint day 4: Prototype\n• Built clickable prototype in Figma\n• Core flow: open app → see balance → recent transactions → quick transfer"],
  ["2025-09-26", "• Design sprint day 5: Test\n• 5 participants tested prototype\n• 4/5 completed core flow in under 10 seconds\n• Confusion on gesture shortcuts — needs onboarding"],
  ["2025-09-29", "• Design sprint week 1\n    • Core flows: account overview, transfers, payments\n    • Lo-fi prototyping and rapid testing\n• Stakeholders very engaged, daily check-ins"],
  ["2025-10-01", "• Sprint 2 prep: card management and budgeting\n• Reviewed competitor approaches\n• Simplified budgeting concept based on research (auto-categorize only)"],
  ["2025-10-06", "• Design sprint 2 day 1: Card management flows\n• Physical and virtual card management\n• Freeze, replace, set limits, travel mode"],
  ["2025-10-07", "• Design sprint 2 day 2: Budgeting tools\n• Auto-categorization engine concepts\n• Monthly spending breakdown visualization"],
  ["2025-10-08", "• Design sprint 2 day 3: Notifications\n• Notification preferences: granular control\n• Smart notifications: only alert for unusual activity"],
  ["2025-10-09", "• Design sprint 2 day 4: Prototype\n• Built card management and budgeting prototype\n• Connected with sprint 1 prototype for full flow"],
  ["2025-10-10", "• Design sprint 2 day 5: Test\n• 8 participants\n• Card management: intuitive, no issues\n• Budgeting: too complex, needs simplification"],
  ["2025-10-13", "• Design sprint week 2\n    • Card management, budgeting tools, notifications\n    • Tested with 8 participants\n    • Major finding: budgeting tool too complex, needs simplification"],
  ["2025-10-15", "• Budgeting redesign: stripped to essentials\n• Monthly spending overview only (no manual budgets)\n• Category breakdown with trends\n• Retested with 3 participants — much better"],
  ["2025-10-17", "• Sprint results presentation to client\n• Excited about gesture-based interactions\n• Agreed on simplified budgeting approach\n• Approved move to high-fidelity"],
  ["2025-10-20", "• Visual design exploration started\n• 3 mood boards created\n• Client brand guidelines reviewed and extended for digital"],
  ["2025-10-22", "• Color palette exploration\n• Dark mode as default (matches fintech trend)\n• Accent colors for categories and status"],
  ["2025-10-24", "• Typography selection\n• Tested 4 font families at small sizes on device\n• Selected: Inter for UI, Space Grotesk for headings"],
  ["2025-10-27", "• High-fidelity designs started\n• Design system built from scratch (iOS + Android)\n• Motion design principles established\n• Weekly client presentations"],
  ["2025-10-29", "• Iconography system designed\n• 48 custom icons for banking actions\n• Consistent 24px grid, 2px stroke"],
  ["2025-10-31", "• Component library: foundational elements\n• Buttons, inputs, cards, lists, bottom sheets\n• Dark and light mode variants"],
  ["2025-11-03", "• Hi-fi: Home screen / dashboard\n• Balance card with gesture hint\n• Recent transactions with smart categorization icons"],
  ["2025-11-05", "• Hi-fi: Payments flow\n• Send money, request money, scheduled payments\n• Recipient management"],
  ["2025-11-07", "• Hi-fi: Card management screens\n• Card details, freeze toggle, limits, travel mode\n• Virtual card creation flow"],
  ["2025-11-10", "• Hi-fi: Spending overview\n• Monthly breakdown, category details, trends\n• Comparison with previous months"],
  ["2025-11-12", "• Hi-fi: Profile and settings\n• Security settings, notification preferences, appearance\n• Account management"],
  ["2025-11-14", "• Hi-fi: Onboarding flow\n• KYC process, ID verification, biometric setup\n• Tutorial for gesture shortcuts"],
  ["2025-11-17", "• First major client review\n    • 90% approval on visual direction\n    • Pushback on budgeting feature scope\n    • Negotiated reduced initial scope with post-launch iteration\n• Dev team onboarded"],
  ["2025-11-19", "• Motion design system created\n• Micro-interactions for key moments\n• Page transitions, loading states, success animations"],
  ["2025-11-21", "• Dev team onboarding session\n• Walked through design system, component structure, naming conventions\n• Set up shared Figma access and Slack channel"],
  ["2025-11-24", "• Sprint planning with dev\n• Sprint 1: auth, onboarding, home screen\n• 2-week sprints, design stays 1 sprint ahead"],
  ["2025-11-26", "• Accessibility audit of all designs\n• Checked contrast ratios, touch targets, screen reader flow\n• 4 critical issues found"],
  ["2025-11-28", "• Fixed accessibility issues\n    • Increased contrast on secondary text\n    • Enlarged touch targets on card actions\n    • Added haptic feedback annotations\n    • Screen reader order documented"],
  ["2025-12-01", "• Sprint 1 handoff: auth, onboarding, home\n• Detailed specs, interaction annotations, assets exported\n• Dev Q&A session"],
  ["2025-12-03", "• Sprint 2 design prep: payments and transfers\n• Edge cases documented: failed transfers, pending states, limits exceeded\n• Currency formatting for international"],
  ["2025-12-05", "• Design QA on first dev build\n• Onboarding flow implemented well\n• Home screen: 5 issues (spacing, animation timing)"],
  ["2025-12-08", "• Sprint handoffs began\n    • Authentication, onboarding, account overview\n• Accessibility audit completed\n    • 4 critical issues found and resolved\n• Holiday break plan agreed"],
  ["2025-12-10", "• Sprint 2 handoff: payments and transfers\n• Interactive prototype for dev reference\n• Error state designs for every scenario"],
  ["2025-12-12", "• Worked on app store presence\n• Screenshots, feature graphics, description copy\n• Preview video storyboarded"],
  ["2025-12-15", "• Pre-holiday checkpoint with client\n• Progress on track\n• January focus: card management, testing round 2\n• Team taking break Dec 20 - Jan 5"],
  ["2026-01-06", "• Back from holiday break\n• Reviewed dev progress on sprints 1 and 2\n• Sprint 3 planning: card management"],
  ["2026-01-08", "• Sprint 3 design: card management finalized\n• Added biometric re-authentication for sensitive actions\n• Virtual card number reveal animation"],
  ["2026-01-10", "• Client added biometric authentication requirement for all transactions over $500\n• Designing FaceID/TouchID prompt patterns\n• 1 week additional work"],
  ["2026-01-13", "• Resumed after break\n• Transfers and payments handed off\n• Client added biometric authentication requirement\n    • 1 week additional design work\n• User testing round 2 planned"],
  ["2026-01-15", "• Biometric patterns designed\n• Contextual prompts: when and why we ask for biometrics\n• Fallback to PIN flow"],
  ["2026-01-17", "• Sprint 3 handoff: card management + biometrics\n• Design QA on sprint 2 build\n• Payments flow looking good"],
  ["2026-01-20", "• User testing round 2 recruitment\n• 8 participants confirmed\n• Test script written covering full app flow"],
  ["2026-01-22", "• Built comprehensive test prototype\n• Connected all flows end-to-end\n• Simulated real data for realistic testing"],
  ["2026-01-24", "• Test run with internal team\n• Found 2 prototype bugs, fixed\n• Timing: full test takes 35 minutes per participant"],
  ["2026-01-27", "• User testing day 1: 4 participants\n• Task completion: all completed core flows\n• Transfer confirmation wording caused hesitation"],
  ["2026-01-28", "• User testing day 2: 4 participants\n• Biometric prompt timing felt natural\n• Card freeze/unfreeze: \"love how simple this is\"\n• One participant confused by spending categories"],
  ["2026-01-30", "• Testing synthesis\n• Task completion rate: 94%\n• SUS score: 82\n• Transfer confirmation needs rewording\n• Category labels need review"],
  ["2026-02-03", "• User testing round 2 with prototype\n    • Task completion rate: 94%\n    • SUS score: 82 (excellent)\n    • Minor tweaks to transfer confirmation flow"],
  ["2026-02-05", "• Applied testing findings\n• Transfer confirmation: added amount preview and recipient photo\n• Category labels: used plain language instead of banking jargon"],
  ["2026-02-07", "• Testing results presentation to client\n• Very positive reaction to SUS score\n• Board approved budget increase for marketing push"],
  ["2026-02-10", "• Sprint 4 design: notifications and settings\n• Smart notification rules engine\n• Quiet hours, per-category controls"],
  ["2026-02-12", "• Sprint 4: settings screens finalized\n• Dark/light mode toggle with preview\n• Language selection, currency preferences"],
  ["2026-02-14", "• Sprint 4 handoff\n• All remaining screens delivered\n• Design QA checklist shared with dev"],
  ["2026-02-17", "• Design QA sprint 3 build: card management\n• 8 issues found, mostly animation timing\n• One layout break on smaller screens — fixed"],
  ["2026-02-19", "• Working on marketing assets\n• App Store screenshots: 6 screens highlighting key features\n• Feature graphic for Play Store"],
  ["2026-02-21", "• Preview video: 15-second app store preview\n• Scripted, key screens selected\n• Animations exported for video editor"],
  ["2026-02-24", "• Final handoffs: notifications, settings, card management\n• Design QA in progress with dev builds\n• Found 23 implementation discrepancies, logged tickets\n• App store assets preparation started"],
  ["2026-02-26", "• Reviewing implementation discrepancies with dev team\n• 15 resolved same day (spacing, colors)\n• 8 require design clarification — provided annotations"],
  ["2026-02-28", "• All 23 discrepancies resolved\n• Full app walkthrough with client\n• Minor polish items identified"],
  ["2026-03-03", "• Polish sprint: loading states, empty states, error states\n• Ensured every screen has appropriate feedback\n• Skeleton loading for data-heavy screens"],
  ["2026-03-05", "• Polish sprint: haptic feedback mapping\n• Documented which interactions trigger haptics\n• Success: light tap. Error: double tap. Biometric: medium"],
  ["2026-03-07", "• Final design QA pass started\n• Going screen by screen through production build\n• Comparing pixel-perfect with designs"],
  ["2026-03-10", "• Design QA complete\n• All critical discrepancies resolved\n• App store screenshots and marketing materials delivered\n• Soft launch to 500 beta users"],
  ["2026-03-12", "• Beta launched to 500 users\n• Monitoring feedback channels\n• First 24 hours: 3 bug reports, all minor"],
  ["2026-03-14", "• Beta day 3: 89% daily active rate\n• User feedback: \"so fast\", \"love the dark mode\"\n• 1 UX issue: transfer scheduling not obvious enough"],
  ["2026-03-17", "• Beta week 1 summary: 4.6/5 average rating\n• Fixed transfer scheduling visibility\n• Added tooltip on first use"],
  ["2026-03-19", "• Beta feedback: some users want spending alerts\n• Quick design for budget threshold notifications\n• Implemented in 2 days by dev team"],
  ["2026-03-21", "• Beta week 2: usage stabilizing at healthy levels\n• Daily sessions average: 3.2 per user\n• Average session duration: 47 seconds (speed goal achieved)"],
  ["2026-03-24", "• Beta feedback: 4.6/5 average rating\n• 3 UX improvements identified and designed\n• Public launch scheduled for April 15\n• Project wrap-up and case study preparation"],
  ["2026-03-26", "• Final beta improvements designed and handed off\n• Marketing team preparing launch campaign\n• Press kit materials designed"],
  ["2026-03-28", "• Launch readiness review\n• All parties confirmed: go for April 15\n• Contingency plan for critical bugs"],
  ["2026-03-31", "• Case study draft written\n• Before/after metrics compiled\n• Client testimonial recorded"],
  ["2026-04-02", "• Final app store submission materials reviewed\n• Screenshots localized for 3 markets\n• Description A/B test variants prepared"],
  ["2026-04-07", "• App store submission confirmed\n• Review process: 24-48 hours expected\n• Team on standby for any review issues"],
  ["2026-04-10", "• App store approved on both iOS and Android\n• Scheduled release for April 15 midnight\n• Launch party planned with client"],
  ["2026-04-15", "• Public launch successful\n• 12,000 downloads in first week\n• Handover documentation complete\n• Project closed, retro scheduled"],
  ["2026-04-17", "• Day 2: trending in Finance category (#14)\n• Media coverage: 2 fintech blogs featured the app\n• No critical bugs reported"],
  ["2026-04-21", "• First week metrics review with client\n• 12,000 downloads, 78% retention day 1\n• App store rating: 4.7 stars (42 reviews)\n• Client extremely happy"],
  ["2026-04-24", "• Project retrospective held\n• Wins: research-led approach, sprint methodology, close collaboration\n• Improvements: earlier dev involvement, better scope management\n• Case study published internally"],
  ["2026-04-28", "• Final handover meeting\n• Design system ownership transferred to client\n• Maintenance SLA discussed for potential follow-up engagement\n• Team celebrating with dinner"],
];

// ─── Feedback Data ──────────────────────────────────────────────────────────

const meridianFeedbacks = [
  { type: "positive", description: "Client Head of Product: \"This is the best design work we've seen from any vendor\"", createdAt: "2025-10-15T09:00:00.000Z" },
  { type: "negative", description: "Dev team frustrated with incomplete specs on chart interactions during Sprint 1", createdAt: "2025-10-20T09:00:00.000Z" },
  { type: "positive", description: "Rachel (new PM): \"The documentation quality made my onboarding so much easier\"", createdAt: "2025-11-10T09:00:00.000Z" },
  { type: "positive", description: "Beta user feedback overwhelmingly positive — NPS score of 72 vs. previous 34", createdAt: "2025-12-08T09:00:00.000Z" },
  { type: "neutral", description: "Scope creep on reporting module added 3 weeks to timeline", createdAt: "2026-01-20T09:00:00.000Z" },
  { type: "negative", description: "User testing revealed document categorization was confusing — required rework", createdAt: "2026-02-10T09:00:00.000Z" },
  { type: "positive", description: "Dev lead: \"Best design handoffs I've worked with in 10 years\"", createdAt: "2026-03-05T09:00:00.000Z" },
  { type: "positive", description: "CFO personally thanked the team during all-hands for the portal transformation", createdAt: "2026-04-10T09:00:00.000Z" },
];

const catalystFeedbacks = [
  { type: "positive", description: "Practice lead: \"This could fundamentally change how we deliver design work\"", createdAt: "2025-11-06T09:00:00.000Z" },
  { type: "neutral", description: "Some designers concerned about AI replacing parts of their workflow", createdAt: "2026-02-03T09:00:00.000Z" },
  { type: "negative", description: "Alpha tester: documentation sometimes hallucinates prop names that don't exist", createdAt: "2026-01-29T09:00:00.000Z" },
  { type: "positive", description: "Beta testers report 40% time savings on documentation tasks", createdAt: "2026-03-14T09:00:00.000Z" },
  { type: "positive", description: "Engineering practice requested collaboration after seeing the demo", createdAt: "2026-04-01T09:00:00.000Z" },
  { type: "positive", description: "Leadership doubled budget and approved dedicated hire after all-hands presentation", createdAt: "2026-04-02T09:00:00.000Z" },
];

const northstarFeedbacks = [
  { type: "positive", description: "Client CEO at mid-project review: \"You've exceeded our expectations in every way\"", createdAt: "2025-11-20T09:00:00.000Z" },
  { type: "negative", description: "Dev team escalated concerns about design handoff completeness for card management module", createdAt: "2026-01-28T09:00:00.000Z" },
  { type: "positive", description: "User testing results praised by client board — used to justify additional marketing investment", createdAt: "2026-02-07T09:00:00.000Z" },
  { type: "neutral", description: "Client requested biometric auth late in process — added 1 week to timeline", createdAt: "2026-01-10T09:00:00.000Z" },
  { type: "positive", description: "Beta user quote featured in client newsletter: \"Finally a banking app that doesn't make me want to scream\"", createdAt: "2026-03-28T09:00:00.000Z" },
  { type: "positive", description: "Client CTO: \"The design system you built is better than what we could have hired internally for\"", createdAt: "2026-04-15T09:00:00.000Z" },
  { type: "neutral", description: "Post-launch analytics show budgeting feature has low adoption — validates earlier scope reduction decision", createdAt: "2026-04-22T09:00:00.000Z" },
  { type: "positive", description: "4.7 app store rating in first week with 78% day-1 retention", createdAt: "2026-04-24T09:00:00.000Z" },
];

// ─── Helper functions ───────────────────────────────────────────────────────

function makeTimelineEntry(pageId, date, text) {
  return {
    pageId,
    date,
    text,
    tagRefs: [],
    isPending: false,
    createdAt: new Date(date).toISOString(),
    updatedAt: new Date(date).toISOString(),
  };
}

function makeFeedback(subjectId, fb) {
  return {
    subjectId,
    type: fb.type,
    description: fb.description,
    createdAt: fb.createdAt,
  };
}

// ─── Main ───────────────────────────────────────────────────────────────────

const raw = await readInput();
const data = JSON.parse(raw);

const stats = {
  pagesRemoved: 0,
  layoutsRemoved: 0,
  blocksRemoved: 0,
  entriesRemoved: 0,
  feedbacksRemoved: 0,
  chartConfigsRemoved: 0,
  pagesAdded: 0,
  layoutsAdded: 0,
  blocksAdded: 0,
  entriesAdded: 0,
  feedbacksAdded: 0,
  chartConfigsAdded: 0,
};

// 1. Remove pages with id 8, 9, 10
const originalPageCount = data.pages.length;
data.pages = data.pages.filter(p => !PAGES_TO_REMOVE.has(p.id));
stats.pagesRemoved = originalPageCount - data.pages.length;

// 2. Remove layouts where pageId is 8, 9, or 10
const originalLayoutCount = data.layouts.length;
data.layouts = data.layouts.filter(l => !PAGES_TO_REMOVE.has(l.pageId));
stats.layoutsRemoved = originalLayoutCount - data.layouts.length;

// 3. Remove blocks where pageId is 8, 9, or 10
const originalBlockCount = data.blocks.length;
data.blocks = data.blocks.filter(b => !PAGES_TO_REMOVE.has(b.pageId));
stats.blocksRemoved = originalBlockCount - data.blocks.length;

// 4. Remove timelineEntries where pageId is 8, 9, or 10
const originalEntryCount = data.timelineEntries.length;
data.timelineEntries = data.timelineEntries.filter(e => !PAGES_TO_REMOVE.has(e.pageId));
stats.entriesRemoved = originalEntryCount - data.timelineEntries.length;

// 5. Remove feedbacks where subjectId is 8, 9, or 10
const originalFeedbackCount = data.feedbacks.length;
data.feedbacks = data.feedbacks.filter(f => !PAGES_TO_REMOVE.has(f.subjectId));
stats.feedbacksRemoved = originalFeedbackCount - data.feedbacks.length;

// 6. Remove chartConfigs referencing pages 8, 9, 10 or blocks 13-21
const originalChartCount = data.chartConfigs.length;
data.chartConfigs = data.chartConfigs.filter(cc => {
  // Check if blockId references a removed block
  if (BLOCKS_TO_REMOVE.has(cc.blockId)) return false;
  // Check scopes array for page references
  if (cc.scopes && Array.isArray(cc.scopes)) {
    for (const scope of cc.scopes) {
      if (scope.type === 'page' && PAGES_TO_REMOVE.has(scope.pageId)) return false;
    }
  }
  return true;
});
stats.chartConfigsRemoved = originalChartCount - data.chartConfigs.length;

// ─── Add new pages ─────────────────────────────────────────────────────────

const newPages = [
  { id: 35, name: "Meridian", type: "project", parentId: 3, description: "", createdAt: NOW, updatedAt: NOW, editCount: 0 },
  { id: 36, name: "Catalyst", type: "project", parentId: 3, description: "", createdAt: NOW, updatedAt: NOW, editCount: 0 },
  { id: 37, name: "Northstar", type: "project", parentId: 3, description: "", createdAt: NOW, updatedAt: NOW, editCount: 0 },
];
data.pages.push(...newPages);
stats.pagesAdded = newPages.length;

// ─── Add layouts for new projects ──────────────────────────────────────────
// Each project gets 3 tabs: Timeline, Feedback, Visualization
// Sequential IDs starting from 57

let layoutId = 57;
const newLayouts = [];

for (const pageId of [35, 36, 37]) {
  newLayouts.push(
    { id: layoutId++, pageId, name: "Timeline", type: "timeline", order: 0, createdAt: NOW, updatedAt: NOW },
    { id: layoutId++, pageId, name: "Feedback", type: "feedback", order: 1, createdAt: NOW, updatedAt: NOW },
    { id: layoutId++, pageId, name: "Visualization", type: "visualization", order: 2, createdAt: NOW, updatedAt: NOW },
  );
}
data.layouts.push(...newLayouts);
stats.layoutsAdded = newLayouts.length;

// ─── Add blocks for new projects ───────────────────────────────────────────
// Each project gets 3 blocks: timeline block, feedback block, visualization block
// Sequential IDs starting from 91

let blockId = 91;
const newBlocks = [];

// Layout IDs: 57=Meridian Timeline, 58=Meridian Feedback, 59=Meridian Visualization
//             60=Catalyst Timeline, 61=Catalyst Feedback, 62=Catalyst Visualization
//             63=Northstar Timeline, 64=Northstar Feedback, 65=Northstar Visualization

const projectLayoutMapping = [
  { pageId: 35, timelineLayoutId: 57, feedbackLayoutId: 58, vizLayoutId: 59 },
  { pageId: 36, timelineLayoutId: 60, feedbackLayoutId: 61, vizLayoutId: 62 },
  { pageId: 37, timelineLayoutId: 63, feedbackLayoutId: 64, vizLayoutId: 65 },
];

const projectBlocks = {}; // Track viz block IDs for chart configs

for (const pm of projectLayoutMapping) {
  const timelineBlockId = blockId++;
  const feedbackBlockId = blockId++;
  const vizBlockId = blockId++;
  
  projectBlocks[pm.pageId] = { timelineBlockId, feedbackBlockId, vizBlockId };

  newBlocks.push(
    { id: timelineBlockId, pageId: pm.pageId, layoutId: pm.timelineLayoutId, type: "timeline", order: 0, config: {}, createdAt: NOW, updatedAt: NOW },
    { id: feedbackBlockId, pageId: pm.pageId, layoutId: pm.feedbackLayoutId, type: "feedback", order: 0, config: {}, createdAt: NOW, updatedAt: NOW },
    { id: vizBlockId, pageId: pm.pageId, layoutId: pm.vizLayoutId, type: "visualization", order: 0, config: {}, createdAt: NOW, updatedAt: NOW },
  );
}
data.blocks.push(...newBlocks);
stats.blocksAdded = newBlocks.length;

// ─── Add chart configs for new projects ────────────────────────────────────
// entry-count area chart + feedback-sentiment area chart per project visualization block

const newChartConfigs = [];

for (const pageId of [35, 36, 37]) {
  const vizBlockId = projectBlocks[pageId].vizBlockId;
  
  newChartConfigs.push(
    {
      blockId: vizBlockId,
      type: "area",
      metric: "entry-count",
      scopes: [{ type: "page", pageId }],
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      blockId: vizBlockId,
      type: "area",
      metric: "feedback-sentiment",
      scopes: [{ type: "page", pageId }],
      createdAt: NOW,
      updatedAt: NOW,
    },
  );
}
data.chartConfigs.push(...newChartConfigs);
stats.chartConfigsAdded = newChartConfigs.length;

// ─── Add timeline entries (no id field) ────────────────────────────────────

const newTimelineEntries = [
  ...meridianEntries.map(([date, text]) => makeTimelineEntry(35, date, text)),
  ...catalystEntries.map(([date, text]) => makeTimelineEntry(36, date, text)),
  ...northstarEntries.map(([date, text]) => makeTimelineEntry(37, date, text)),
];
data.timelineEntries.push(...newTimelineEntries);
stats.entriesAdded = newTimelineEntries.length;

// ─── Add feedbacks (no id field) ───────────────────────────────────────────

const newFeedbacks = [
  ...meridianFeedbacks.map(fb => makeFeedback(35, fb)),
  ...catalystFeedbacks.map(fb => makeFeedback(36, fb)),
  ...northstarFeedbacks.map(fb => makeFeedback(37, fb)),
];
data.feedbacks.push(...newFeedbacks);
stats.feedbacksAdded = newFeedbacks.length;

// ─── Write output ──────────────────────────────────────────────────────────

writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2), 'utf-8');

console.log('\n✅ Build complete! Written to combined-import.json\n');
console.log('Summary:');
console.log(`  Pages removed: ${stats.pagesRemoved}`);
console.log(`  Layouts removed: ${stats.layoutsRemoved}`);
console.log(`  Blocks removed: ${stats.blocksRemoved}`);
console.log(`  Timeline entries removed: ${stats.entriesRemoved}`);
console.log(`  Feedbacks removed: ${stats.feedbacksRemoved}`);
console.log(`  Chart configs removed: ${stats.chartConfigsRemoved}`);
console.log('');
console.log(`  Pages added: ${stats.pagesAdded}`);
console.log(`  Layouts added: ${stats.layoutsAdded}`);
console.log(`  Blocks added: ${stats.blocksAdded}`);
console.log(`  Timeline entries added: ${stats.entriesAdded}`);
console.log(`  Feedbacks added: ${stats.feedbacksAdded}`);
console.log(`  Chart configs added: ${stats.chartConfigsAdded}`);
console.log('');
console.log(`Output: ${OUTPUT_PATH}`);
