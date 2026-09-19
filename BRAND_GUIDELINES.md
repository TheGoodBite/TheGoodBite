# OnlyGoodBites — Apple-Inspired Brand Identity & Design System

An ultra-minimalist, Apple-inspired design language for **OnlyGoodBites**: a smart mobile-first grocery decision app that helps users turn simple grocery lists into ranked product options with health scores, diet-fit badges, and estimated prices.

---

## 1. Primary Brand Logo: The Broccoli Bite 🥦

The official logo for **OnlyGoodBites** is an ultra-minimalist vector silhouette of a broccoli head with a clean bite taken out of the right side—inspired directly by the timeless Apple logo language.

### Logo Guidelines & Rationale

* **Subject**: A stylized, geometrically balanced broccoli head.
* **The Bite Mark**: A crisp circular cut on the right, instantly conveying "bites", taste, and smart grocery decisions.
* **Style**: Monochrome silhouette (Jet Black `#000000` or Pure White `#FFFFFF`), flat vector, no gradients or heavy shadows.
* **Usage**: App store icon, mobile navbar header logo, PWA splash screen, favicon.

---

### React / SVG Logo Component Snippet

Copy-pasteable React SVG component for the **Broccoli Bite** logo:

```tsx
export function BroccoliBiteLogo({ className = "w-8 h-8 text-black dark:text-white" }: { className?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 100 100" 
      fill="currentColor" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Stem */}
      <path d="M40 56C38 65 37 75 42 85C45 91 55 91 58 85C63 75 62 65 60 56Z" fill="currentColor" />
      <path d="M42 56L34 68M58 56L66 68" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      {/* Broccoli Florets with Bite Mark on Right */}
      <path 
        fillRule="evenodd" 
        clipRule="evenodd" 
        d="M50 18C41.7 18 34.6 22.5 31 29.2C27.5 28.1 23.6 29 20.8 31.8C16.8 35.8 16.8 42.2 20.8 46.2C19.6 49.5 20.2 53.3 22.5 56C25.8 59.8 31.2 60.8 35.6 58.7C40 60 45 60.5 50 60.5C54.5 60.5 59.2 60.1 63.5 58.9C67.8 60.8 73 59.9 76.3 56.4C77.5 55 78.3 53.3 78.6 51.5C76 51 73.8 49.5 72.5 47C70.5 43.1 71.5 38.3 75 35.5C73.8 30.5 69.8 26.8 64.7 26.2C61.3 21.2 55.9 18 50 18Z" 
        fill="currentColor" 
      />
    </svg>
  );
}
```

---

## 2. 📱 The 3 Core App Screens (UI Architecture & Design Specs)

Here is the complete designer specification for the **3 Core Screens** of the OnlyGoodBites web application, built around Apple's clean white aesthetic (`#FFFFFF`), iOS grey card surfaces (`#F5F5F7`), and Apple system colors.

```
+-----------------------------------------------------------------------------------+
| SCREEN 1: Main Grocery Dashboard    | SCREEN 2: Diet Mode Drawer    | SCREEN 3: AI Recipes & History    |
| - Header with Broccoli Bite logo    | - Active diet mode toggles    | - Recipe ideas from bought items  |
| - Grocery item list editor          | - Ranking weight customization | - Purchase history log            |
| - Horizontal product carousels      | - Plain-language disclaimers  | - Quick repeat add buttons        |
| - Interactive "Bought this" state   |                               |                                   |
+-----------------------------------------------------------------------------------+
```

---

### Screen 1: Main Grocery List & Product Carousels (Core Workspace)

The primary screen where users enter grocery items and explore horizontal carousels of ranked options.

#### Layout Structure & Wireframe

```txt
+------------------------------------------------------------------------+
| [🥦 OnlyGoodBites]                   [Saved Lists ▾]  [⚙️ Diets (2)]  |  <- Glass Header
+------------------------------------------------------------------------+
| 📥 Grocery List Editor                                                  |
| [ + Add item e.g. "Greek yogurt, chips" ] [ Rank Products ]             |
+------------------------------------------------------------------------+
| 🥣 Greek Yogurt  (3 options ranked)                                     |
|                                                                        |
| +---------------------+  +---------------------+  +------------------+ |
| | [ Product Photo ]   |  | [ Product Photo ]   |  | [ Product Photo ]| |
| | Fage Total 2%       |  | Chobani Less Sugar  |  | Oikos Triple 0   | |
| | $3.99 est.          |  | $4.29 est.          |  | $3.89 est.       | |
| | [🟢 88/100] [Nutri A]|  | [🟢 85/100] [Nutri A]|  | [🟢 86/100]       | |
| | [High Protein]      |  | [Low Sugar]         |  | [Zero Sugar]     | |
| | "Top protein ratio" |  | "Lower sugar"       |  | "No added sugar" | |
| | [ ✓ Bought this ]   |  | [   Bought this ]   |  | [   Bought this ]| |  <- Active vs Idle
| +---------------------+  +---------------------+  +------------------+ |
| <-------------------- Horizontal Scroll Carousel --------------------> |
+------------------------------------------------------------------------+
```

#### Component & Interaction Specifications for Screen 1

1. **Header Bar (`Navbar`)**:
   - Background: `bg-white/80 backdrop-blur-xl border-b border-black/[0.05] sticky top-0 z-50`
   - Elements: **Broccoli Bite** logo (`w-7 h-7 text-black`), App title (`Plus Jakarta Sans Bold`), Saved list pill button (`bg-[#F5F5F7] text-xs font-semibold rounded-full px-3 py-1.5`).

2. **Grocery Item Card Header**:
   - Title: `text-xl font-bold text-[#1D1D1F]` with item count badge.

3. **Product Carousel Cards (`ProductCard.tsx`)**:
   - Container: `w-[260px] flex-shrink-0 bg-[#F5F5F7] border border-black/[0.04] rounded-3xl p-4 flex flex-col justify-between`
   - Image Frame: Aspect ratio 1:1 image container on white background (`bg-white rounded-2xl p-2 mb-3 shadow-sm`).
   - Price: `$3.99 est.` rendered in `Space Grotesk` or `SF Mono` bold (`text-sm font-semibold text-[#1D1D1F]`).
   - Health Score Pill: `bg-[#34C759] text-white text-xs font-bold font-mono px-2.5 py-1 rounded-full`.
   - Diet Fit Badges: `bg-white text-slate-700 text-[11px] font-medium px-2 py-0.5 rounded-md border border-black/[0.06]`.

4. **"Bought This" Interactive Button (`BoughtButton.tsx`)**:
   - **Idle State**: Solid Black button `bg-black text-white hover:bg-[#1C1C1E] active:scale-95 transition-all rounded-2xl py-2.5 text-xs font-semibold`.
   - **Bought Active State**: `bg-[#34C759]/10 text-[#248A3D] border border-[#34C759]/30 rounded-2xl py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5`. Contains a green checkmark icon `✓`. Stores selection to history automatically.

---

### Screen 2: Diet Mode Packs & Scoring Filter Drawer

An iOS-style bottom sheet drawer where users select active diet filters that dynamically alter product rankings.

#### Layout Structure & Wireframe

```txt
+------------------------------------------------------------------------+
|                                  =====  (Drag Handle)                   |
| ⚙️ Choose Diet Mode Packs                                      [ Done ] |
| Customizes product scoring & ranking algorithms.                        |
+------------------------------------------------------------------------+
| ACTIVE DIET MODES                                                      |
|                                                                        |
| [ ✓ High Protein    ]  [ ✓ Low Sugar         ]  [   Diabetes-Conscious ] |
| Rewards protein content Penalizes sugars        Prioritizes high fiber |
| ( Active - iOS Green ) ( Active - iOS Green )  ( Tap to enable )     |
|                                                                        |
| [   Low Sodium      ]  [   Gluten-Free       ]  [   Heart-Conscious    ] |
| Penalizes salt         Prefer GF tags           Penalizes sat fats     |
+------------------------------------------------------------------------+
| 💡 HOW SCORING WORKS                                                   |
| Overall Score (0-100) = Price + Health + Diet Fit + Purchase History   |
| Disclaimers: Diet modes are general food preference filters, not       |
| medical advice.                                                        |
+------------------------------------------------------------------------+
```

#### Component Specifications for Screen 2

1. **Drawer Container (`DietModeDrawer.tsx`)**:
   - Backdrop: `bg-black/40 backdrop-blur-sm fixed inset-0 z-50`
   - Sheet: `bg-white rounded-t-[32px] p-6 max-w-lg mx-auto shadow-2xl border-t border-black/5`

2. **Diet Mode Toggle Chips**:
   - **Selected Chip**: `bg-[#34C759]/10 border-2 border-[#34C759] text-[#1D1D1F] p-4 rounded-2xl shadow-sm flex flex-col gap-1 transition-all`
   - **Unselected Chip**: `bg-[#F5F5F7] border border-black/[0.04] text-[#86868B] p-4 rounded-2xl hover:bg-[#EBEBEB] transition-all`
   - Icons: Includes status indicator (iOS green check for active).

3. **Plain-Language Disclaimer Box**:
   - `bg-[#F5F5F7] rounded-2xl p-4 text-xs text-[#86868B] border border-black/[0.04]`
   - Clearly states diet modes are food preference rankings, not medical treatments.

---

### Screen 3: AI Recipe Ideas & Bought History Hub

A dedicated view for paid users to turn bought grocery items into instant, simple recipes and manage purchase history.

#### Layout Structure & Wireframe

```txt
+------------------------------------------------------------------------+
| 💡 AI Recipe Ideas                                        [ ✦ Paid ]   |
| Based on items marked [Bought This] in your current list               |
+------------------------------------------------------------------------+
| +--------------------------------------------------------------------+ |
| | 🥣 High-Protein Yogurt Oat Bowl                                    | |
| | Uses: Plain Greek Yogurt, Oats  |  Prep: 5 mins  | Est: $1.40/serv | |
| | Fit: High Protein, Low Sugar                                       | |
| |                                                                    | |
| | Steps:                                                             | |
| | 1. Add 3/4 cup Greek yogurt to a bowl.                             | |
| | 2. Stir in 1/2 cup old fashioned oats.                             | |
| | 3. Top with cinnamon or fresh berries if available.                | |
| |                                                                    | |
| | [ 💾 Save Recipe ]                    [ 🍳 View Step-by-Step ]      | |
| +--------------------------------------------------------------------+ |
+------------------------------------------------------------------------+
| 📜 Bought History (3 Items Marked Bought Last Trip)                    |
|                                                                        |
| [✓] Fage Total 2% Greek Yogurt  -  $3.99  (Bought 2 days ago)        |
| [✓] Kraft Macaroni & Cheese     -  $1.79  (Bought 2 days ago)        |
|                                                                        |
| [ 🔄 Add All Previous Items to New List ]                              |
+------------------------------------------------------------------------+
```

#### Component Specifications for Screen 3

1. **AI Recipe Card (`RecipeCard.tsx`)**:
   - Container: `bg-white border border-black/[0.08] rounded-3xl p-6 shadow-sm`
   - Badge: `bg-emerald-50 text-[#248A3D] text-xs font-semibold px-3 py-1 rounded-full`
   - Step List: `space-y-2 text-sm text-[#1D1D1F] list-decimal pl-4`

2. **Bought History List (`BoughtHistoryDrawer.tsx`)**:
   - History Items: `flex items-center justify-between py-3 border-b border-black/[0.05]`
   - Repeat Action: `bg-[#F5F5F7] hover:bg-black hover:text-white transition-all text-xs font-semibold px-3 py-1.5 rounded-xl`.

---

## 3. Google Fonts Typography System

| Usage | Font Family | Weight | Purpose |
| :--- | :--- | :--- | :--- |
| **Headings & Hero** | `Plus Jakarta Sans` / `SF Pro Display` | 600 (SemiBold), 700 (Bold) | Clean geometric sans headings with crisp letterform spacing |
| **UI Controls & Body** | `Inter` / `SF Pro Text` | 400 (Regular), 500 (Medium) | Maximum clarity for product titles, ingredients, descriptions |
| **Scores & Prices** | `Space Grotesk` / `SF Mono` | 600 (SemiBold), 700 (Bold) | Numerical precision for health scores (`88/100`) & price tags |

```html
<!-- Google Fonts Import -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">
```

---

## 4. UI Color Palette & Design Tokens

### Light Theme Core Tokens

| Token Name | Hex Code | Visual Sample | Usage |
| :--- | :--- | :--- | :--- |
| `bg-primary` | `#FFFFFF` | ⬜ Pure White | Page background |
| `bg-secondary` | `#F5F5F7` | 🌫️ iOS Soft Grey | Carousel cards, input fields, container backgrounds |
| `text-primary` | `#1D1D1F` | ⬛ Apple Jet Black | Main headings, product titles |
| `text-secondary` | `#86868B` | 🩶 Apple Muted Grey | Secondary descriptions, weight units, estimated text |
| `ios-green` | `#34C759` | 🟩 iOS System Green | High health scores (80+), Nutri-Score A, active diet chips |
| `ios-orange` | `#FF9500` | 🟧 iOS System Orange | Medium health scores, price highlights |
| `ios-red` | `#FF3B30` | 🟥 iOS System Red | Low health scores, NOVA 4 warnings |
| `btn-primary` | `#000000` | ⬛ Solid Black | "Bought this" primary button, main CTA |

---

> [!TIP]
> **Developer Ready**: All colors, typography imports, and CSS custom variables in this document follow Tailwind CSS standards and map 1:1 to the Next.js components specified in `README.md`.
