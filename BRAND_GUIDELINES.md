# MetaEdge Brand & Design Guidelines
`Version 1.0.0` • `Sovereign Cypherpunk Design System`

This document serves as the canonical specification for the **MetaEdge** visual identity, user experience patterns, typographic rules, and interface elements. It ensures that any developer or designer cloning this codebase can replicate, scale, and evolve the application with absolute fidelity and zero design doubt.

---

## 1. Visual Identity & Brand Concept

MetaEdge is designed as a **sovereign, trustless social-trading hub**. Its aesthetic combines the high-fidelity clarity of institutional trading terminals with the sleek, atmospheric mood of cypherpunk culture.

*   **Design Paradigm:** Flat-skeuomorphic hybrid. Elements are grounded in a deep cosmic abyss, separated by high-contrast, glowing borders rather than heavy drop shadows.
*   **The Vibe:** Technical, secure, high-integrity, clean, and highly legible. 
*   **Anti-Slop Directive:** No fake telemetry, artificial container port lines, mock system grids, or simulated CLI lines in the margins. The interface relies on humble, literal labels (e.g., "Current Price", "Market Feed") and pristine layout alignment to convey quality.

---

## 2. Color Palette System

MetaEdge operates on a precise dark-ambient palette. Colors are grouped semantically to establish hierarchy and draw focus to actionable elements.

### Base Backgrounds & Canvases
| Layer | Tailwind Class | Color Description | Purpose |
| :--- | :--- | :--- | :--- |
| **Abyss** | `bg-slate-950` | Pitch-black charcoal | Global application background |
| **Slate Panel** | `bg-slate-900/40` | Dark charcoal with transparency | Content cards, section holders |
| **Recessed Wells** | `bg-slate-950/40` | Recessed dark charcoal | Order book views, input backings, status tags |

### Borders & Dividers
| Type | Tailwind Class | Purpose |
| :--- | :--- | :--- |
| **Default Border** | `border-slate-800/80` | Subtle separations between cards, panels, and sections |
| **Focus Border** | `focus:border-indigo-500` | Applied on active inputs or selected buttons |
| **Active Highlight** | `border-indigo-500/30` | Selected active list items or tab cards |

### Brand Accents & Semantic States
*   **Brand Primary:** Indigo Purple (`#6366f1` / `text-indigo-400`, `bg-indigo-600`) - Used for highlights, active icons, and primary action buttons.
*   **Bullish/Success State:** Emerald Green (`#10b981` / `text-emerald-400`, `bg-emerald-500/10`) - Used for positive price change, buy orders, long positions, and active statuses.
*   **Bearish/Risk State:** Rose Red (`#f43f5e` / `text-rose-400`, `bg-rose-500/10`) - Used for negative price change, sell orders, short positions, and liquidation prices.
*   **Neutral Text (Primary):** `text-slate-200` (off-white) - Default color for core content, headings, and data values.
*   **Neutral Text (Secondary):** `text-slate-400` / `text-slate-500` (cool gray) - Used for metadata, labels, and secondary paragraphs.

---

## 3. Typographic System

MetaEdge utilizes a dual-font typographic architecture, matching the nature of information to the appropriate font face:

### 1. The Human Interface: **Inter**
*   **Font Family:** `font-sans` ("Inter", sans-serif)
*   **Where to Use:** Core navigation links, general prose, titles, button labels, descriptions, and conversational copy.
*   **Styling Rule:** Keep tracking tight (`tracking-tight`) on headings for an elegant, editorial aesthetic.

### 2. The Telemetry & Quantitative Layer: **JetBrains Mono**
*   **Font Family:** `font-mono` ("JetBrains Mono", monospace)
*   **Where to Use:** Currency values, asset prices, trade sizes, timestamps, leverage values (`20x`), contract sizes, audit logs, and cryptographic identifiers (e.g., owner IDs, contract hashes).
*   **Styling Rule:** Always render quantitative financial values in uppercase, monospaced letters to align figures and columns perfectly.

---

## 4. Component Construction Specs

### Standard Content Cards
To keep the UI cohesive, all cards must follow this pattern:
```tsx
<div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 md:p-6">
  {/* Card Content */}
</div>
```

### Form Inputs & Textareas
All form elements must be recessed, readable, and highly focused:
```tsx
<input
  type="text"
  className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 outline-none transition-all font-mono text-xs"
/>
```

### Action Buttons
1.  **Primary Interactive Button:**
    ```tsx
    <button className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-sans font-medium rounded-xl py-2.5 text-xs transition-all cursor-pointer">
      Primary Action
    </button>
    ```
2.  **Secondary Outline/Subtle Button:**
    ```tsx
    <button className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-sans rounded-xl text-xs transition-all cursor-pointer">
      Secondary Action
    </button>
    ```

---

## 5. Iconography Standards

All icons are imported exclusively from `lucide-react`. 

### Icon Rules
*   **Dimensions:** Default icons to `w-4 h-4` or `w-5 h-5` depending on scale. Never allow icons to swell out of proportion.
*   **Stroke Weight:** Ensure strokes remain clean (default is `2` or standard weight).
*   **Semantic Alignments:**
    *   `Coins`, `TrendingUp`, `TrendingDown` -> Market rates, currency tickers.
    *   `Users`, `Bot` -> Co-trading rooms, automated trading agents.
    *   `ArrowRightLeft`, `BarChart3` -> Trading desk, order placement, executions.
    *   `Landmark`, `ShieldCheck` -> Treasury vaults, security audits.
    *   `Network` -> Influence graph and evidence mapping.

---

## 6. Micro-Animations & State Transitions

To deliver a polished feel, interface changes are never abrupt.
*   **Transition Classes:** Always include Tailwind’s `transition-all` or `transition-colors` on interactive elements (`hover:`, `focus:`).
*   **Sway & Scale:** Use subtle scale updates on button clicks (`active:scale-[0.98]`).
*   **Screen Entrances:** Use a simple `.fade-in` utility for screen transitions.
    ```css
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .fade-in {
      animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    ```

---

## 7. Cloning & Porting Checklist

When copying this codebase or applying its style guidelines to another service:
1.  **Configure Theme in Global CSS:**
    Ensure `src/index.css` imports Google Fonts for "Inter" and "JetBrains Mono" and sets up Tailwind `--font-sans` and `--font-mono`.
2.  **Verify Asset Ticker Synchronicity:**
    Ensure all components that render prices (such as `TokenMarketChart`, `TradingHub`, and `AgentWorkshop`) fetch state synchronized via the central server-side `/api/prices` endpoint. This prevents split-brain ticker differences.
3.  **Validate on Host Container:**
    Always bind local development servers strictly to `0.0.0.0:3000` as defined in the reverse proxy routing configurations.
4.  **Preserve State Persistence:**
    Ensure state changes write directly to `/db.json` on the server rather than keeping them purely transiently in RAM. This protects mock-trade fills, rooms, and agent statuses across restarts.
