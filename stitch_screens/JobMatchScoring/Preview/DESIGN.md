# Midnight Glass Design System

### 1. Overview & Creative North Star
**Creative North Star: The Digital Curator**
Midnight Glass is a high-end editorial design system built for professional SaaS environments. It eschews the "standard" dashboard look in favor of a cinematic, deep-space aesthetic. By utilizing semi-transparent "glass" panels, neon accents, and a focus on content depth, it creates an environment that feels like a curated workspace rather than a spreadsheet.

The system breaks rigid grid layouts through **intentional asymmetry**: sidebar navigation remains grounded while the main stage utilizes floating containers and variable-width columns to drive eye movement toward primary actions.

### 2. Colors
Midnight Glass centers on a deep "Ink" foundation with vibrant "Electric Blue" triggers.

*   **Primary (#256af4):** Used for critical actions and brand presence. Often paired with a `text-shadow` (Neon Accent) to simulate luminescence.
*   **The "No-Line" Rule:** Sectioning is achieved through color shifts. Standard 1px solid borders are strictly prohibited for layout separation. Instead, use a background shift from `surface` (#101622) to `surface_container` (rgba(30, 41, 59, 0.4)).
*   **Surface Hierarchy & Nesting:** Depth is created by layering glass panels. A `surface_container` panel (with backdrop-blur) may host a `surface_container_highest` element to denote importance or interactivity.
*   **The "Glass & Gradient" Rule:** All floating elements (cards, headers, tooltips) must use `backdrop-filter: blur(12px)` and a semi-transparent border (`rgba(255, 255, 255, 0.1)`).
*   **Signature Textures:** Use subtle 3XL blurs of the Primary color in the background corners of sections to create "atmosphere."

### 3. Typography
The system uses **Manrope** exclusively, leveraging its geometric yet friendly grotesque character to bridge the gap between technical and editorial.

*   **Display / Large Headlines:** (2.25rem / 36px) Used for major page titles. High contrast against the background.
*   **Headlines:** (1.25rem / 20px) Bold weight. Used for section titles. Often paired with the "Neon Accent" effect.
*   **Body Text:** (1rem / 16px or 0.875rem / 14px) Use `text-slate-300` for standard body and `text-slate-100` for emphasized content.
*   **Labels & Metadata:** (0.75rem / 12px or 10px) Always uppercase with `tracking-widest` (letter-spacing) to create an architectural, blueprint feel.

**Typographic Rhythm:** The scale is tight but functional, emphasizing hierarchy through weight and color (white vs. slate-400) rather than massive size differences.

### 4. Elevation & Depth
Midnight Glass moves away from Material-style shadows, favoring **Tonal Layering**.

*   **The Layering Principle:** Hierarchy is defined by the transparency and blur level of the container. 
*   **Ambient Shadows:** When shadows are used (e.g., for floating action buttons or hero images), use the `shadow-lg` preset with an extremely low opacity of white (`shadow-white/5`) to create a "glow" rather than a "drop."
*   **The "Ghost Border" Fallback:** For buttons or input fields, use a 1px border at `0.1` opacity to define boundaries without closing off the space.
*   **Glassmorphism:** The `glass-panel` class is the primary container unit, utilizing a background of `rgba(30, 41, 59, 0.4)` and a `12px` backdrop-blur.

### 5. Components
*   **Buttons:** Primary buttons are solid `primary` hex with a `shadow-primary/20`. Secondary buttons use a dark `slate-800` base with no border.
*   **Input Fields:** Deep background (`slate-900`) with subtle `slate-700` borders. Focus states must glow with the `primary` color.
*   **Glass Cards:** Used for all main content sections. These must feature `rounded-2xl` (1rem) corners to soften the tech-heavy aesthetic.
*   **Chips:** Micro-labels use a `primary/10` background with a `1px border-primary/20` and 10px bold uppercase text.
*   **Side Navigation:** Fixed, non-glass surface to provide a "grounding" anchor for the floating main content.

### 6. Do's and Don'ts
*   **Do:** Use `backdrop-filter` on any element that overlaps another.
*   **Do:** Apply `tracking-widest` to all 10px - 12px labels.
*   **Don't:** Use solid white (#FFFFFF) for body text; use Slate-300 to reduce eye strain in dark mode.
*   **Don't:** Add heavy drop shadows to cards; let the background color shifts and backdrop blurs do the work of separation.
*   **Do:** Use 32px (8 units) spacing for major section gaps to maintain the editorial "breathable" feel.