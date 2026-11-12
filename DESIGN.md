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
