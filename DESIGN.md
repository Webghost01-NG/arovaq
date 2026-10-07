---
name: Arovaq
description: Permissionless competition for onchain worlds.
colors:
  ink: "#101010"
  paper: "#f3f2ee"
  white: "#ffffff"
  ash: "#e4e3de"
  rule: "#b9b8b2"
  muted: "#65645f"
  quiet: "#888780"
typography:
  display:
    fontFamily: "Space Grotesk, Arial, sans-serif"
    fontSize: "clamp(3.55rem, 15vw, 6rem)"
    fontWeight: 600
    lineHeight: 0.86
    letterSpacing: "-0.045em"
  body:
    fontFamily: "Space Grotesk, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "IBM Plex Mono, Courier New, monospace"
    fontSize: "8px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.05em"
rounded:
  square: "0px"
spacing:
  xs: "8px"
  sm: "16px"
  md: "24px"
  lg: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.square}"
    padding: "0 16px"
    height: "46px"
  button-primary-hover:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "0 10px"
    height: "48px"
---

# Design System: Arovaq

## Overview

**Creative North Star: “The State Trace”**

Arovaq treats competition as a legible path through a game's existing canonical state. A seven-step trace moves from game and state, through the participant's baseline and target, into verification and reward. It gives each screen a product-specific visual grammar instead of relying on generic dashboard cards.

The interface pairs editorial scale with compact protocol notation. Large, tightly set headlines establish the stakes; ruled rows, exact numbers and monospace labels make the mechanics inspectable. The palette stays monochrome, with black surfaces marking active systems and important state changes.

**Key Characteristics:**
- Monochrome, high-contrast surfaces.
- Editorial headline scale balanced by technical labels.
- State progression shown as a connected trace and measured rail.
- Square geometry and thin rules instead of rounded card stacks.

## Colors

Black, warm off-white and a restrained gray scale carry the hierarchy; there is no accent hue.

### Primary
- **Signal Ink** (#101010): Headline and body text, primary controls, active rules, and the dark fields used for live game reads and verified outcomes.

### Neutral
- **Warm Paper** (#f3f2ee): Main canvas and input surfaces.
- **Proof White** (#ffffff): Text on dark surfaces, inverted controls, and highlighted trace steps.
- **Soft Ash** (#e4e3de): Quiet progress tracks and subdued separators.
- **Rule Gray** (#b9b8b2): Structural dividers and unfilled rules.
- **Read Gray** (#65645f): Secondary labels and supporting copy.
- **Quiet Gray** (#888780): Low-priority coordinates and decorative metadata only.

### Named Rules
**The State Trace Rule.** Arovaq screens should make the relationship between canonical game state, participant baseline, target, verification and reward easy to follow.

**The Monochrome Rule.** Use state inversion and typographic hierarchy to distinguish important states; do not introduce a brand accent color.

## Typography

**Display Font:** Space Grotesk (with Arial, sans-serif fallback)

**Body Font:** Space Grotesk (with Arial, sans-serif fallback)

**Label/Mono Font:** IBM Plex Mono (with Courier New, monospace fallback)

**Character:** Space Grotesk provides a compact, assertive editorial voice. IBM Plex Mono makes chain, game, status and measurement details read like system output.

### Hierarchy
- **Display** (600, `clamp(3.55rem, 15vw, 6rem)`, 0.86 line-height): Landing statement, tightly tracked and left aligned.
- **Headline** (500–600, roughly `clamp(2.65rem, 12vw, 6rem)`, 0.84–0.9 line-height): Screen titles and section statements.
- **Title** (400–500, 20–45px): Game, objective and outcome modules.
- **Body** (400, 12–15px, 1.45–1.6 line-height): Instructions and explanatory copy, kept to readable measures.
- **Label** (400–500, 8–10px, 0.04–0.075em, uppercase): Chain, game, event, state and form metadata.

### Named Rules
**The Scale Contrast Rule.** Pair one oversized statement with quiet but readable metadata; do not give every label headline weight.

## Layout

Wide screens use an editorial split: a large statement beside the state trace, then full-width mechanism and competition sections. The content uses a fluid page gutter (`clamp(22px, 5.2vw, 84px)`) and an 1800px outer limit. Competition rows align event number, objective, reward, available claims and window on one ruled grid.

At tablet and phone widths the hero and configuration become a deliberate vertical sequence. Competition rows compress into objective and reward, while detail views put participant progress before reward facts. At 390px, forms and receipt states remain single-column; horizontal overflow is not part of the layout.

## Elevation & Depth

The system is flat by default. Contrast, borders and full-width dark sections create depth. A single soft shadow separates the temporary transaction message from the page; it is a state overlay, not a card style.

### Shadow Vocabulary
- **Transaction Overlay** (`0 12px 34px #0002`): Temporary transaction feedback only.

### Named Rules
**The Flat-By-Default Rule.** Prefer rules and tonal inversion; reserve elevation for an overlay that must sit above current content.

## Shapes

Square corners are the norm (`0px` radius). Use one-pixel rules to describe boundaries and alignment. Inputs are open or underlined unless the input needs a complete outline, as with the progression delta control. Dark rectangles mark a strong action or a meaningful verified state.

## Components

### Buttons
- **Shape:** Square, one-pixel border for primary actions.
- **Primary:** Signal Ink background with Proof White type; 46px minimum height and 16px horizontal padding.
- **Hover / Focus:** Invert primary fill to Warm Paper; keep a visible two-pixel keyboard outline with offset.
- **Secondary / Quiet:** Text-led action with a bottom rule; use for navigation and refresh actions.

### Inputs / Fields
- **Style:** Transparent or Warm Paper surface, square corners, Signal Ink text and a one-pixel bottom rule.
- **Focus:** Visible two-pixel outline. On dark read surfaces, outline switches to white.
- **Error / Disabled:** State is communicated in text and contrast; retain native disabled semantics.

### Navigation
- **Style:** Sparse masthead with brand, chain identity, two destinations and wallet control. Active page uses a thin underline that grows from the left. On mobile, the destinations move below the wordmark.

### Competition Row
- **Character:** A ruled event record rather than a promotional tile.
- **Structure:** Number, game/objective, reward, claims and deadline. Hover inverts the row to black with white text.

### State Trace
- **Character:** Seven connected steps name the path from ONCHAIN GAME to REWARD.
- **Behavior:** Values reflect the participant's baseline, current state, target and verification status where the trace is used for a live participant.
- **Accessibility:** The sequence has a named ordered list; progress uses a labeled progressbar.

### Verification Receipt
- **Character:** A dark, high-contrast settlement record.
- **Structure:** Canonical verification, character identity, baseline-to-current movement, earned delta and reward amount.

## Do's and Don'ts

### Do:
- **Do** use rules, alignment and state inversion to structure the experience.
- **Do** make canonical numbers and participant-specific baselines visually prominent.
- **Do** keep chain and game metadata monospace and concise.
- **Do** reduce nonessential motion when `prefers-reduced-motion` is active.

### Don't:
- **Don't** use gradients, glass effects, pill-heavy controls or generic dashboard card grids.
- **Don't** imply chronological first achievement; settlement is by first valid claim.
- **Don't** use color to imply live mainnet deployment or reward activity that is not configured.
