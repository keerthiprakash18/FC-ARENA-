# FC ARENA design system

The signed-in interface uses a restrained football matchday style. Put the player, competition, score or next action first. Use the existing FC ARENA badge, club crests and stadium image. Display actual scores, rankings, activity and system metrics.

## Color and typography

- `apps/web/src/app/design-tokens.css` owns the shared palette and dimensions. Default navy `#102b46` anchors matchday surfaces. Gold `#d9b765` accents the default brand. Each club theme supplies its own active color, surface and contrast tokens.
- Use `--theme-text` for titles and primary copy, `--theme-text-secondary` for supporting copy, and `--theme-focus` for keyboard focus. Use success, warning and danger tokens for states with a readable label.
- Use the bundled variable Geist face for headings and body. Page titles scale from 1.8 to 3.05 rem. Use tabular numbers for scores, points and metric columns. Keep body text at a readable measure and let long player and team names wrap.

## Components and layout

- Use `FcPageHeader` for the title, short explanation and action. Use `BackHeader` for nested routes. Both render the same heading component. Use `FcSectionHeading` for a related group of content.
- Use `FcPanel`, `FcStatCard` and `FcNotice` for surfaces, measurements and status. Keep a 20 px card radius, 12 px control radius and 44 px minimum primary target. Use skeletons shaped like the expected content, a useful action for empty states, and retry where an error is recoverable.
- Start with one column. On wider screens, use the available space for the featured match, first-ranked player or work queue. Keep horizontal scrolling inside bracket and table regions. Preserve labels and reading order as columns reflow.
- Use the shared FC ARENA icon set. Give icon-only controls accessible names and keep visible labels on the five primary mobile tabs. Show the selected route in the tab bar and mobile drawer.

## Motion and accessibility

- Provide a short press response and use transform for movement. The mobile drawer follows a horizontal touch gesture and settles from its current position and release velocity. When it closes, focus returns to the opener.
- Respect reduced motion and forced colors. Keep a visible focus ring, an unobscured skip link, labelled form controls and announced status. Maintain light and dark readability across all club themes.
- Use English for interface and built-in help copy. Render player names, club names, messages and match evidence in the language entered by their authors.

The implementation applies the Apple Design interaction guidance and the Taste Design hierarchy and restraint principles. The [UI/UX Pro Max accessibility and responsive checks](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/src/ui-ux-pro-max/templates/base/quick-reference.md) guide browser review.

## V13 Obsidian Matchday visual foundation (candidate; not deployed)

The V13 review branch keeps the authored layer in `apps/web/src/app/obsidian-matchday.css` and appends its exact contents to the end of the **single imported** `arena-consolidated.css` runtime bundle, after all byte-preserved V12 sources. The V13 block is the reversible visual activation point; do not delete old CSS before screenshot and functionality parity.

**Default luxury-gold theme:** Obsidian Navy `#0C1722` for navigation and
matchday highlights, Porcelain `#F5F6F4` canvas, `#FFFFFF` cards,
`#14222E` primary text, `#536372` supporting text, Champagne Gold
`#D9B977` for honors or featured CTAs. Gold text on light cards uses
`#8A631F`, not the lighter fill hue. Dark mode uses `#0C131C` canvas,
`#141E2A` panels and `#F3F6F5` text.

Regular `FcPageHeader` and `BackHeader` screens now present quiet editorial
headings; **only featured** matchday / championship sections show dramatic
navy heroes. The Cup Center uses a calm, light listing with one featured dark
tournament while its organizer Studio remains unchanged. Dashboard, match
cards, honours, player identity, rankings, admin workbenches and shared
navigation use the same radius, spacing, color and focus conventions.
The source of competition rules, results and user content has not changed.

**Preserve preferences.** Classic Blue and all eleven additional club themes,
plus system/light/dark mode, are still supported. The V13 foundation gives
the default luxury-gold theme its own neutral product identity without
forcing users of other club themes to adopt it.

**Mobile and accessibility:** preserve the existing Android WebView safe
areas, tab labels, 44px+ controls, horizontal scrolling inside brackets,
tabular scores, visible focus, high-contrast/forced-colors mode, reduced
motion and real status labels. No live migrations or production changes are
part of the visual branch.

For implementation and test evidence, see
`docs/readiness/obsidian-matchday-v13.md`. Gate any release separately per
`AGENTS.md` and require visual screenshot review before merging.
