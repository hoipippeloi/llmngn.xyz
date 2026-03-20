# Design System Quick Reference

Detailed reference guide for building consistent, premium design systems. Consult this
when establishing design foundations in Step 3 of the Atom of Thought process.

## Table of Contents

1. [Typography Systems](#typography-systems)
2. [Color Palette Construction](#color-palette-construction)
3. [Gradient and Glow Recipes](#gradient-and-glow-recipes)
4. [Glassmorphism Recipes](#glassmorphism-recipes)
5. [Spacing Scales](#spacing-scales)
6. [Shadow Systems](#shadow-systems)
7. [Border Radius Languages](#border-radius-languages)
8. [Responsive Breakpoints](#responsive-breakpoints)
9. [Animation Patterns](#animation-patterns)

---

## Typography Systems

### Recommended Font Pairings

| Heading | Body | Vibe | Best For |
|---------|------|------|----------|
| Inter | Inter | Clean, neutral, Swiss-style | Most versatile — works everywhere |
| Cal Sans | Inter | SaaS, modern product | SaaS landing pages, dashboards |
| Space Grotesk | DM Sans | Tech, developer tools | Dev tools, API products |
| Playfair Display | Source Sans 3 | Editorial, luxury | Agencies, luxury brands, portfolios |
| Sora | Nunito Sans | Friendly, approachable | Education, health, consumer apps |
| JetBrains Mono | Inter | Developer, terminal | CLI tools, code-heavy products |
| Clash Display | Satoshi | Bold, creative, startup | Creative agencies, bold startups |
| Manrope | Inter | Geometric, modern | AI products, modern SaaS |
| Cabinet Grotesk | General Sans | Bold, contemporary | Startup landing pages |

### Type Scale (1.250 — Major Third)

| Level | Size | Weight | Line Height | Letter Spacing | Usage |
|-------|------|--------|-------------|----------------|-------|
| Display | 72px / 4.5rem | 700-800 | 1.1 | -0.04em | Hero headlines |
| H1 | 48px / 3rem | 700 | 1.2 | -0.03em | Page titles |
| H2 | 36px / 2.25rem | 600-700 | 1.25 | -0.02em | Section headings |
| H3 | 24px / 1.5rem | 600 | 1.3 | -0.01em | Card titles, subsections |
| H4 | 20px / 1.25rem | 600 | 1.4 | 0 | Small headings, labels |
| Body | 16-18px / 1rem | 400 | 1.6 | 0 | Paragraphs, descriptions |
| Small | 14px / 0.875rem | 400 | 1.5 | 0.01em | Secondary text, captions |
| Caption | 12px / 0.75rem | 500 | 1.4 | 0.02em | Labels, badges, metadata |

### Fluid Typography with clamp()

```css
/* Scales smoothly between mobile and desktop sizes */
.display { font-size: clamp(2rem, 1rem + 3.76vw, 4.5rem); }
.h1      { font-size: clamp(1.75rem, 1rem + 2.5vw, 3rem); }
.h2      { font-size: clamp(1.5rem, 1rem + 1.67vw, 2.25rem); }
.h3      { font-size: clamp(1.25rem, 1rem + 0.83vw, 1.5rem); }
```

### Typography Best Practices

- Use negative letter-spacing on display/h1/h2 — this is what makes headings feel "designed"
- Max line width for readability: `max-width: 65ch` for body text
- Use `font-feature-settings: 'kern' 1, 'liga' 1` for professional kerning
- Mix weights within a heading for emphasis: "Build Faster With **Lumine** *Insights*"
- Italic accent words in heroes create visual interest without adding color

---

## Color Palette Construction

### Neutral Scale (11 stops)

```
50  — page backgrounds, subtle fills, light mode base
100 — alternate row backgrounds, hover states (light mode)
200 — borders, dividers, input outlines
300 — disabled states, subtle decorative elements
400 — placeholder text, muted icons
500 — secondary text, inactive nav items
600 — body text (dark mode primary text)
700 — headings, primary text (light mode)
800 — high-emphasis text, active states
900 — near-black, dark mode card backgrounds
950 — darkest backgrounds, dark mode page base
```

### Semantic Color Tokens

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| primary | 600 | 400 | CTAs, links, active states |
| primary-hover | 700 | 300 | Hover on primary elements |
| primary-subtle | 50 | 950 | Tinted backgrounds, badges |
| success | green-600 | green-400 | Positive actions, confirmations, growth indicators |
| warning | amber-600 | amber-400 | Caution states, attention needed |
| error | red-600 | red-400 | Errors, destructive actions, decline indicators |
| info | blue-600 | blue-400 | Informational elements, tips |

### Niche-Specific Palettes

**AI / SaaS Dark Theme**
```css
--bg-primary: #050510;      /* Near-black with blue undertone */
--bg-secondary: #0a0a1a;    /* Slightly elevated surface */
--bg-card: #0f0f23;         /* Card backgrounds */
--accent-primary: #6366f1;  /* Indigo for CTAs */
--accent-secondary: #8b5cf6;/* Purple for gradients */
--accent-glow: rgba(99, 102, 241, 0.15); /* Glow effects */
--text-primary: #f1f5f9;    /* Primary text */
--text-secondary: #94a3b8;  /* Muted text */
--border: rgba(255, 255, 255, 0.08); /* Subtle borders */
```

**Agency / Creative (Warm Dark)**
```css
--bg-primary: #0a0806;      /* Warm near-black */
--bg-secondary: #1a1410;    /* Warm dark brown */
--bg-card: #1f1a14;         /* Card with warmth */
--accent-primary: #d4956a;  /* Copper/terracotta */
--accent-secondary: #e8c49a;/* Gold/champagne */
--text-primary: #faf5f0;    /* Warm white */
--text-secondary: #a89888;  /* Warm gray */
--border: rgba(212, 149, 106, 0.15); /* Warm border */
```

**Fintech (Professional Light)**
```css
--bg-primary: #ffffff;
--bg-secondary: #f8fafc;
--bg-card: #ffffff;
--accent-primary: #2563eb;  /* Professional blue */
--accent-secondary: #1e40af;
--accent-success: #16a34a;  /* Green for positive trends */
--accent-error: #dc2626;    /* Red for negative trends */
--text-primary: #0f172a;
--text-secondary: #64748b;
--border: #e2e8f0;
```

**AI Support / Tech (Dark + Green)**
```css
--bg-primary: #030712;      /* Deep dark */
--bg-secondary: #0a1628;    /* Dark blue-tinged */
--bg-card: #0f1d32;
--accent-primary: #22c55e;  /* Green for trust/go */
--accent-secondary: #10b981;/* Emerald variant */
--accent-glow: rgba(34, 197, 94, 0.12);
--text-primary: #f0fdf4;    /* Slightly green-tinted white */
--text-secondary: #86efac;  /* Light green muted */
--border: rgba(34, 197, 94, 0.1);
```

### Dark Mode Rules

- Never use pure black (#000000) — always add a subtle color undertone
- Reduce primary color saturation by 10-20% to prevent eye strain
- Elevate surface layers with slightly lighter backgrounds, not stronger shadows
- Card backgrounds should be 1-2 steps lighter than the page background
- Ensure minimum 4.5:1 contrast ratio for body text, 3:1 for large display text
- Use opacity-based borders (rgba white) not solid color borders

---

## Gradient and Glow Recipes

### Hero Background Gradients

```css
/* Deep space — AI/SaaS products */
background: radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 50%, rgba(139,92,246,0.08) 0%, transparent 50%),
            #050510;

/* Warm agency — creative/portfolio */
background: radial-gradient(ellipse at 30% 20%, rgba(212,149,106,0.12) 0%, transparent 50%),
            radial-gradient(ellipse at 70% 80%, rgba(232,196,154,0.06) 0%, transparent 50%),
            #0a0806;

/* Tech emerald — fintech/support */
background: radial-gradient(ellipse at 50% 30%, rgba(34,197,94,0.08) 0%, transparent 50%),
            linear-gradient(180deg, #030712 0%, #0a1628 100%);
```

### Gradient Text

```css
.gradient-text {
  background: linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #6366f1 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

### Glow Effects

```css
/* Button glow */
.btn-glow {
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.3),
              0 0 40px rgba(99, 102, 241, 0.1);
}
.btn-glow:hover {
  box-shadow: 0 0 30px rgba(99, 102, 241, 0.4),
              0 0 60px rgba(99, 102, 241, 0.15);
}

/* Card edge glow */
.card-glow {
  position: relative;
}
.card-glow::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  background: linear-gradient(135deg, rgba(99,102,241,0.3), transparent 50%);
  z-index: -1;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
  padding: 1px;
}
```

---

## Glassmorphism Recipes

### Standard Glass Card

```css
.glass-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
}
```

### Highlighted Glass Card (Pricing "Recommended" Tier)

```css
.glass-card-featured {
  background: rgba(99, 102, 241, 0.08);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 16px;
  box-shadow: 0 0 30px rgba(99, 102, 241, 0.1),
              0 8px 32px rgba(0, 0, 0, 0.2);
}
```

### Tailwind Glassmorphism Classes

```html
<!-- Standard glass card -->
<div class="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">

<!-- Featured glass card -->
<div class="bg-indigo-500/10 backdrop-blur-xl border border-indigo-500/20 rounded-2xl p-8
            shadow-[0_0_30px_rgba(99,102,241,0.1)]">
```

---

## Spacing Scales

### 4px Base Scale

```
4   (1)   — tight internal gaps (icon-to-label inside buttons)
8   (2)   — compact spacing (inline elements, icon gaps)
12  (3)   — default internal padding (buttons, badges, chips)
16  (4)   — standard content gap (form fields, list items)
20  (5)   — comfortable spacing (between related elements)
24  (6)   — section internal padding (card content, grouped items)
32  (8)   — content block separation (between card groups)
40  (10)  — medium separation (between subsections)
48  (12)  — large content blocks (between major subsections)
64  (16)  — section padding on mobile
80  (20)  — section padding on tablet
96  (24)  — section padding on desktop (standard)
128 (32)  — hero/feature section padding on desktop (generous)
```

### Spacing Application Guide

| Element | Mobile | Tablet | Desktop |
|---------|--------|--------|---------|
| Section vertical padding | 48-64px | 64-80px | 80-128px |
| Card internal padding | 20-24px | 24-32px | 32-40px |
| Grid gap | 16px | 20-24px | 24-32px |
| Content max-width | 100% | 100% | 1200-1440px |
| Side padding | 16-20px | 24-32px | 32-48px |
| Hero vertical padding | 80px | 96px | 128px |
| Between heading and body | 12-16px | 16px | 16-20px |
| Between section heading and content | 32-40px | 40-48px | 48-64px |

---

## Shadow Systems

### Three-Level Hierarchy

```css
/* Level 1: Cards, subtle elevation */
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.04),
             0 1px 2px rgba(0, 0, 0, 0.06);

/* Level 2: Dropdowns, popovers, floating elements */
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.04),
             0 2px 4px rgba(0, 0, 0, 0.06);

/* Level 3: Modals, dialogs, overlay panels */
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.04),
             0 4px 6px rgba(0, 0, 0, 0.05);

/* Level 4: Heavy emphasis elements (optional) */
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.06),
             0 8px 10px rgba(0, 0, 0, 0.04);
```

### Colored Shadows (Premium Feel)

```css
/* Tint shadows with the primary color for polish */
--shadow-primary: 0 4px 14px rgba(99, 102, 241, 0.15);

/* Card with primary tint */
--shadow-card: 0 2px 8px rgba(0, 0, 0, 0.04),
               0 4px 16px rgba(99, 102, 241, 0.06);

/* Elevated card on hover */
--shadow-card-hover: 0 8px 24px rgba(0, 0, 0, 0.06),
                     0 4px 12px rgba(99, 102, 241, 0.12);
```

### Dark Mode Shadows

In dark themes, traditional box-shadows are nearly invisible. Use these alternatives:
- **Border glow**: `border: 1px solid rgba(primary, 0.15)` on hover
- **Background elevation**: slightly lighter card background on hover
- **Accent glow**: `box-shadow: 0 0 20px rgba(primary, 0.15)` for featured items
- **Inner glow**: `box-shadow: inset 0 1px 0 rgba(255,255,255,0.05)` for top edge highlight

---

## Border Radius Languages

| Language | Values | When to Use | Example Products |
|----------|--------|------------|-----------------|
| Sharp | 2-4px | Fintech, enterprise, data-heavy dashboards | Bloomberg, Reuters |
| Soft | 8-12px | SaaS, general purpose, balanced | Linear, Notion, Stripe |
| Rounded | 16-24px | Consumer, social, friendly | Spotify, Instagram |
| Full | 9999px | Pills, tags, avatars, toggle switches | Any — as accents |

**Consistency rule**: pick one language per project. The only exception is using `rounded-full` for specific elements (avatars, pills, toggles) within a soft or rounded system.

### Common Radius Assignments

```css
--radius-sm: 6px;    /* Inputs, small buttons, badges */
--radius-md: 12px;   /* Cards, modals, medium elements */
--radius-lg: 16px;   /* Large cards, sections, containers */
--radius-xl: 24px;   /* Feature sections, hero elements */
--radius-full: 9999px; /* Pills, avatars, circular buttons */
```

---

## Responsive Breakpoints

### Tailwind Defaults (Recommended)

| Token | Width | Target |
|-------|-------|--------|
| sm | 640px | Large phones (landscape) |
| md | 768px | Tablets (portrait) |
| lg | 1024px | Small laptops, tablets (landscape) |
| xl | 1280px | Standard desktops |
| 2xl | 1536px | Large / ultra-wide displays |

### Common Responsive Transformation Patterns

```
Grid columns:      4 → 3 → 2 → 1
Card layouts:      3-col → 2-col → 1-col stack
Pricing cards:     3 side-by-side → 3 stacked
Navigation:        full horizontal → hamburger drawer (< 768px)
Side-by-side:      row → column stack (< 768px)
Sidebar dashboard: visible → collapsible drawer (< 1024px)
Section padding:   128px → 80px → 48px
Font display:      72px → 48px → 32px
Hero layout:       text + visual side-by-side → stacked
Logo bar:          single row → 2 rows or carousel
Feature grid:      3-col alternating → single column
```

### Responsive Typography Scale

```css
/* Mobile → Desktop fluid scaling */
.display { font-size: clamp(2rem, 1rem + 3.76vw, 4.5rem); }
.h1      { font-size: clamp(1.75rem, 1rem + 2.5vw, 3rem); }
.h2      { font-size: clamp(1.5rem, 1rem + 1.67vw, 2.25rem); }
.body    { font-size: clamp(0.875rem, 0.8rem + 0.25vw, 1.125rem); }
```

---

## Animation Patterns

### Scroll Reveal (Intersection Observer)

```javascript
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('revealed');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

document.querySelectorAll('.reveal-on-scroll').forEach(el => observer.observe(el));
```

```css
.reveal-on-scroll {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.6s ease-out, transform 0.6s ease-out;
}
.reveal-on-scroll.revealed {
  opacity: 1;
  transform: translateY(0);
}
/* Stagger children */
.reveal-on-scroll:nth-child(2) { transition-delay: 0.1s; }
.reveal-on-scroll:nth-child(3) { transition-delay: 0.2s; }
.reveal-on-scroll:nth-child(4) { transition-delay: 0.3s; }
```

### Framer Motion Patterns (React)

```tsx
// Fade-up entrance
<motion.div
  initial={{ opacity: 0, y: 24 }}
  whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: "-50px" }}
  transition={{ duration: 0.6, ease: "easeOut" }}
>

// Staggered children
<motion.div variants={container} initial="hidden" whileInView="visible">
  {items.map(item => (
    <motion.div key={item.id} variants={child}>
      {item.content}
    </motion.div>
  ))}
</motion.div>

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } }
};
const child = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};
```

### Hover Micro-interactions

```css
/* Card lift + glow */
.card {
  transition: transform 0.2s ease-out, box-shadow 0.2s ease-out;
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 30px rgba(99, 102, 241, 0.12);
}

/* Button scale + glow */
.btn-primary {
  transition: transform 0.15s ease-out, box-shadow 0.15s ease-out;
}
.btn-primary:hover {
  transform: scale(1.02);
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.3);
}
.btn-primary:active {
  transform: scale(0.98);
}

/* Link underline reveal */
.nav-link {
  position: relative;
}
.nav-link::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 0;
  height: 2px;
  background: var(--accent-primary);
  transition: width 0.3s ease-out;
}
.nav-link:hover::after {
  width: 100%;
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  .reveal-on-scroll {
    opacity: 1;
    transform: none;
  }
}
```

---

## Premium Design Recipes (2025-2026)

### Bento Grid Layout

```css
.bento-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: minmax(200px, auto);
  gap: 16px;
}
.bento-grid .featured {
  grid-column: span 2;
  grid-row: span 2;
}
.bento-grid .wide {
  grid-column: span 2;
}
@media (max-width: 768px) {
  .bento-grid {
    grid-template-columns: 1fr;
  }
  .bento-grid .featured,
  .bento-grid .wide {
    grid-column: span 1;
    grid-row: span 1;
  }
}
```

### Noise/Grain Texture Overlay

```css
.grain-overlay::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
  opacity: 0.03;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
```

### Magnetic Button Effect (CSS + JS)

```css
.btn-magnetic {
  transition: transform 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
}
```

```javascript
document.querySelectorAll('.btn-magnetic').forEach(btn => {
  btn.addEventListener('mousemove', (e) => {
    const rect = btn.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) * 0.15;
    const y = (e.clientY - rect.top - rect.height / 2) * 0.15;
    btn.style.transform = `translate(${x}px, ${y}px)`;
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.transform = 'translate(0, 0)';
  });
});
```

### Animated Gradient Mesh Background

```css
.gradient-mesh {
  background:
    radial-gradient(at 40% 20%, rgba(99,102,241,0.15) 0%, transparent 50%),
    radial-gradient(at 80% 0%, rgba(139,92,246,0.1) 0%, transparent 50%),
    radial-gradient(at 0% 50%, rgba(59,130,246,0.08) 0%, transparent 50%),
    radial-gradient(at 80% 50%, rgba(168,85,247,0.06) 0%, transparent 50%),
    #050510;
  animation: meshShift 20s ease-in-out infinite alternate;
}
@keyframes meshShift {
  0%   { background-position: 0% 0%, 100% 0%, 0% 100%, 100% 100%; }
  100% { background-position: 100% 100%, 0% 100%, 100% 0%, 0% 0%; }
}
```

### Spotlight Cursor Effect

```css
.spotlight-container {
  position: relative;
  overflow: hidden;
}
.spotlight-container::after {
  content: '';
  position: absolute;
  width: 400px;
  height: 400px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%);
  pointer-events: none;
  transform: translate(-50%, -50%);
  transition: opacity 0.3s;
  opacity: 0;
}
.spotlight-container:hover::after {
  opacity: 1;
}
```
