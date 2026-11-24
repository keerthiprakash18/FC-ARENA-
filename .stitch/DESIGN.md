---
name: FC ARENA Matchday
colors:
  surface: '#ffffff'
  surface-dim: '#f5f6f4'
  surface-dark: '#141e2a'
  canvas-dark: '#0c131c'
  on-surface: '#14222e'
  on-surface-variant: '#536372'
  on-surface-dark: '#f3f6f5'
  on-surface-variant-dark: '#b7c5d0'
  primary: '#142b40'
  on-primary: '#ffffff'
  gold: '#d9b977'
  gold-ink: '#8a631f'
  on-gold: '#17202a'
  outline: '#718392'
  outline-variant: '#e2e7e8'
  success: '#23815c'
  danger: '#ba3948'
---

# Design System: FC ARENA Matchday

Extracted from the Next.js application on 24 November 2026. Runtime sources:
`apps/web/src/app/design-tokens.css`, the final `obsidian-matchday.css`
section of `arena-consolidated.css`, shared FC components and the auth CSS
module. Theme custom properties, rather than individual page colors, are the
authority. The thirteen older source sections are retained in their existing
order; consolidation requires separate visual parity verification.

## 1. Visual Theme & Atmosphere

FC ARENA is a football competition workspace with navy identity, warm gold
highlights and calm neutral surfaces. Match identity, opponents, official
scores and ranking numbers carry the emphasis. Stadium imagery belongs to
welcome, competition identity and featured match moments. Utility screens
such as fixture lists, standings and analytics start with compact editorial
headings so the user reaches their task quickly.

Premium quality comes from hierarchy and restraint: one clear match action,
legible player names, consistent controls and purposeful space. Avoid giving
every block a separate glowing frame. Use disclosure for supplementary rules
and explanations while keeping their entry points visible.

## 2. Color Palette & Roles

### Primary Foundation
- Porcelain canvas `#f5f6f4` and white surface `#ffffff` separate page and content.
- Matchday navy `#0c1722` anchors the desktop rail and featured identities.
- Dark canvas `#0c131c`, panel `#141e2a` and elevated panel `#1b2936` provide depth.

### Accent & Interactive
- Deep navy `#142b40` is the light-mode primary action with white text.
- Warm gold `#d9b977` is a feature fill; use dark ink `#17202a` on that fill.
- Readable gold `#8a631f` is the light-mode text accent. Dark mode uses
  `#e6c681` with dark ink for a filled primary action.
- Saved club palettes remain supported. Resolve colors from `--theme-*`
  tokens rather than imposing the gold palette on every club.

### Typography & Text Hierarchy
- Light primary ink `#14222e`, secondary ink `#536372`, muted ink `#607080`.
- Dark primary ink `#f3f6f5`, secondary ink `#b7c5d0`, muted ink `#a7b8c6`.
- Structural light divider `#e2e7e8` is distinct from control border `#718392`.
  Dark dividers use `#293a49`; dark controls use `#748b9e`.

### Functional States
- Success `#23815c` and danger `#ba3948` pair with subdued light-mode surfaces.
- Dark success `#79dba7` and danger `#ffa0aa` preserve visibility on navy.
- Status always includes a readable word; selected filters expose pressed
  state and a physical underline rather than relying on color alone.

## 3. Typography Rules

Bundled variable Geist provides a clean, compact sans-serif. System fonts
provide fallback for scripts outside the bundled Latin subset. Keep optical
sizing enabled and avoid adding remote font requests.

### Hierarchy & Weights
- Editorial page titles: 29.6–44.8px, weight 735, line height 1.16.
- Section titles: roughly 17–22px, weight 700.
- Body text: 14–16px, weight 400–600, line height 1.5–1.65.
- Supporting labels: 12–13px; avoid long strings of tiny uppercase text.
- Metric values: 28–36px, weight 740; scores and rankings use tabular figures.
- Heading tracking is around -0.025em; body tracking remains normal.
  Use solid text over feature backgrounds; avoid transparent gradient text.

### Spacing Principles
Use a 4px base scale with 8/12/16/24/32px steps. Keep label-to-value gaps
smaller than gaps between sections. Long names wrap in identity contexts;
compact lists retain access to the full identity through the team dialog.

## 4. Component Stylings

### Buttons
Controls are at least 44px tall with 11px corner radii. A primary action has
a solid theme fill; secondary actions have a neutral surface and a control
border. Keyboard focus uses a 3px outline with visible offset. Hover and
press feedback is brief and obeys reduced-motion preferences.

### Cards & Match Containers
Standard cards use 16px radii, feature panels 20px, and restrained borders.
Use one surface for a related list with internal dividers rather than a
column of disconnected cards. A match card preserves opponent identities,
fixture status, kickoff information and one direct entry action. Guidance
can sit below the action without repeating the same destination.

### Navigation
The desktop rail is navy with a quiet selected surface and gold indicator.
Mobile has five labeled destinations: Home, League, Cups, Matches and More.
Honor bottom safe-area insets and retain enough scroll padding to expose the
last actionable content. Tournament section navigation remains available.

### Inputs & Forms
Inputs use theme surfaces, readable labels, 44–48px minimum height and
visible focus. Auth inputs use 16px text to avoid unwanted mobile zoom.
Mandatory DOB/WhatsApp validation and social-provider availability are
behavioral contracts, unaffected by visual polish.

### Rankings & Awards
Rank, player identity, score and official/provisional state come before
explanatory copy. Keep seasonal podiums and real ratings intact. Tournament
honours explain where individual and team awards live through a disclosure.
Rank history is accessible through its own disclosure so current rankings
remain the primary task. Do not invent ratings, winners or historical ranks.

## 5. Layout Principles

### Grid & Structure
Preserve the current application shell and route structure. Standard content
is a single flow on mobile. At 1100px and above, a populated dashboard pairs
welcome and next match in an 0.8:1.2 grid. Empty or hidden next-match states
retain the full-width welcome and their original onboarding actions.

### Whitespace Strategy
Use 16px mobile edges and responsive 16–28px panel spacing. Compact utility
headers bring filters and data into view; feature panels may be more spacious.

### Alignment & Visual Balance
Left-align explanatory text and section titles. Align numbers consistently.
Keep opponent identities balanced across the score/versus marker. Preserve
all owner/admin controls without making them the visual focus for players.

### Responsive Behavior & Touch
Check 320–1440px, both display modes, Android user agents, all saved club
palettes, keyboard focus, 200% text and forced colors. Filter grids reflow by
available space and rem-based label width. No horizontal page overflow.

## 6. Design System Notes for Stitch Generation

### Language to Use
Calm football workspace, editorial matchday hierarchy, navy identity,
porcelain surfaces, warm gold detail, legible official statistics.

### Color References
Use the functional colors above. Dark feature panels may have a restrained
navy-to-navy gradient or the existing stadium photograph. Ordinary pages use
plain surfaces and solid ink.

### Component Prompts
- A fixture workspace with a compact heading, visible match scope and
  responsive labeled filters, followed by readable opponent match cards.
- An awards screen that leads with real seasonal rankings, then accessible
  tournament races and one divided list of award categories.
- A responsive dashboard with one next match action and distinct onboarding
  tasks, using the existing five-tab mobile navigation.

### Incremental Iteration
Preserve domain rules, URLs, theme preferences and permissions. Validate
populated, empty, loading and error states. Review actual screenshots and
keyboard behavior before treating a visual change as release-ready.
