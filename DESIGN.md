# Design System Specification: Tunnel Inspector

## 1. Overview & Creative North Star
**Creative North Star: "The Obsidian Lens"**
This design system moves away from the "boxy" utility of traditional developer tools toward a high-end, editorial experience. It treats data not as a spreadsheet, but as a prioritized stream of intelligence. By utilizing a deep, monochromatic foundation (Zinc-950) punctuated by hyper-functional neon accents, we create a UI that recedes into the background, allowing the developer’s code and traffic to take center stage. 

The aesthetic is defined by **Tonal Architecture**: hierarchy is established through shifts in darkness and light rather than structural lines, creating a "carved" rather than "constructed" feel.

## 2. Colors & Surface Philosophy
The palette is rooted in the "Deep Dark" spectrum, using the Zinc scale to define spatial depth.

### Surface Hierarchy & The "No-Line" Rule
To achieve a premium feel, **1px solid borders are prohibited for sectioning.** Boundaries must be defined solely through background color shifts.
*   **Base Layer:** `surface` (#131315) – The foundation of the application.
*   **Primary Panels:** `surface_container` (#201f22) – Main request list and inspector panels.
*   **Sub-Panels/Nesting:** `surface_container_high` (#2a2a2c) – Tab headers and nested detail views.
*   **Interaction State:** `surface_bright` (#39393b) – Only for active hover states to provide immediate tactile feedback.

### The Glass & Gradient Rule
Floating elements (Modals, Command Palettes, Tooltips) must use **Glassmorphism**.
*   **Token:** `surface_container_highest` (#353437) at 80% opacity.
*   **Effect:** `backdrop-blur: 12px`. This prevents the UI from feeling "pasted on" and maintains the sense of a continuous, deep environment.

### Accents & Semantic Logic
*   **Primary Action/Selection:** `primary` (#c0c1ff / Indigo-500 equivalent)
*   **HTTP Methods:**
    *   GET: `tertiary` (#4fdbc8 / Teal-400)
    *   POST: `amber-500` (via custom token mapping)
    *   DELETE: `error` (#ffb4ab / Red-400)
    *   PUT: `blue-400` (via custom token mapping)

## 3. Typography
The system employs a dual-typeface strategy to separate **Interface Guidance** from **Technical Data**.

*   **UI Interface (Inter):** Used for labels, navigation, and headers. Inter provides a neutral, highly legible sans-serif that feels "editorial" when paired with generous letter spacing in `label-sm`.
*   **Technical Data (JetBrains Mono):** Used for URLs, JSON payloads, and headers. The monospaced nature ensures character alignment, critical for debugging.

**Hierarchy Note:** 
Use `headline-sm` for the Request URL in the inspector to give it the weight of a title. Use `label-sm` with 0.05em tracking for metadata (Timestamp, Size, Latency) to create a sophisticated, "instrument-panel" look.

## 4. Elevation & Depth
Depth is achieved through **Tonal Layering** and **Ambient Shadows**.

*   **The Layering Principle:** A Request Detail card (`surface_container_low`) should sit on the Sidebar (`surface_container`). The transition should be felt, not seen.
*   **Ambient Shadows:** For floating menus, use a shadow with a 32px blur, 0px offset, and 8% opacity of `on_background`. This mimics a soft glow rather than a harsh drop shadow.
*   **The "Ghost Border" Fallback:** If a separator is required for accessibility in high-density tables, use `outline_variant` (#464554) at **15% opacity**. This creates a suggestion of a line that disappears into the dark background.

## 5. Components

### Request List Items (Cards)
*   **Layout:** No borders. Use a `surface` background for the container and `surface_container_low` for the individual item.
*   **State:** On hover, transition to `surface_bright`. 
*   **Spacing:** Use `spacing-3` (0.6rem) for vertical padding to maintain high density without crowding text.

### Method Badges (Chips)
*   **Styling:** No background fill. Use a "Ghost Border" (1px at 20% opacity) in the semantic color (e.g., Teal for GET).
*   **Text:** `label-sm` uppercase with bold weight. This creates a high-contrast, professional technical aesthetic.

### Code Blocks & JSON Trees
*   **Background:** `surface_container_lowest` (#0e0e10). 
*   **Nesting Indentation:** Use `spacing-4` (0.9rem) for clear visual recursion without needing vertical "guide lines."

### Action Buttons
*   **Primary:** Solid `primary_container` (#8083ff). No border. White text.
*   **Secondary:** Transparent background with `outline` (#908fa0) at 30% opacity.
*   **Shape:** `rounded-sm` (0.125rem). Sharp corners convey a professional, "engineered" feel.

## 6. Do's and Don'ts

### Do
*   **DO** use `JetBrains Mono` for any string that could be copied into a terminal.
*   **DO** use `surface_container_highest` for active tab states to create a "lifted" appearance.
*   **DO** leverage the `spacing-0.5` (0.1rem) for tight groupings of metadata icons.

### Don't
*   **DON'T** use pure white (#FFFFFF) for body text. Use `on_surface_variant` (#c7c4d7) to reduce eye strain in deep dark themes.
*   **DON'T** use 100% opaque borders. They break the "Obsidian Lens" illusion of depth.
*   **DON'T** use large corner radii. Stick to `sm` (0.125rem) or `md` (0.375rem) to keep the aesthetic "brutalist" and precise.