# i18n Language Toggle — Design Spec

## Goal

Add Chinese/English language switching to the Klarheit frontend so the application is fully usable by Chinese-speaking users. All user-facing text across every page, component, and interaction must be translatable.

## Button Placement

### Desktop Navbar

Position: in the `Global Actions` div, between the session info element and the Checkout button.

```
┌─────────────────────────────────────────────────────────────────────┐
│  KLARHEIT    Collections  Config Lab  AR Studio    [EN|中]  [CHECKOUT]  [👤]  │
└─────────────────────────────────────────────────────────────────────┘
```

- Style: `text-[10px] uppercase tracking-widest font-mono`, matching the session info aesthetic
- Current language: full opacity (white when scrolled/dark, brand-primary when light)
- Other language: reduced opacity, clickable to switch
- Separator: vertical bar `|` between "EN" and "中"
- Responsive: hidden below `sm` breakpoint in the top bar; always visible in mobile nav menu

### Mobile Navigation Menu

Add a language toggle row at the bottom of the mobile nav dropdown, styled consistently with the nav item links (bordered, rounded-xl, uppercase tracking).

## Tech Stack

- **Library**: `react-i18next` + `i18next`
- **Storage**: `localStorage` key `klarheit-locale`, default `en`
- **Detection**: no auto-detection; always default to English on first visit

## File Structure

```
front_end/src/
  i18n/
    index.ts                    ← i18next initialization
    locales/
      en/
        common.json             ← Navbar, Footer, AuthDrawer, FormField, Button, ErrorBoundary
        landing.json            ← LandingPage
        collections.json        ← CollectionsPage
        ar-studio.json          ← ARVirtualStudio
        config-lab.json         ← ConfigLab
        checkout.json           ← Checkout
        account.json            ← MyAccountPage
        confirmation.json       ← OrderConfirmationPage
      zh/
        common.json
        landing.json
        collections.json
        ar-studio.json
        config-lab.json
        checkout.json
        account.json
        confirmation.json
```

## Translation Key Convention

Keys use dot-separated paths scoped by component/section:

```json
{
  "nav.collections": "Collections",
  "nav.configLab": "Config Lab",
  "nav.arStudio": "AR Studio",
  "nav.checkout": "Checkout",
  "hero.title": "Precision Optics",
  "hero.subtitle": "Engineered in Geneva"
}
```

Flat structure within each namespace (no deep nesting beyond one dot level for grouping).

## Components and Pages to Translate

| Namespace | Source File(s) | Scope |
|---|---|---|
| `common` | Navbar, Footer, AuthDrawer, FormField, Button, ErrorBoundary, ProtectedRoute | Nav items, account menu, form labels, button text, error messages |
| `landing` | LandingPage | Hero, brand story, optics showcase, CTA |
| `collections` | CollectionsPage | Product names, descriptions, selection UI |
| `ar-studio` | ARVirtualStudio | Color picker labels, instructions, placeholders |
| `config-lab` | ConfigLab | 3-step wizard: prescription form, lens/coating options, review step |
| `checkout` | Checkout | Customer info form, prescription display, payment area, order summary |
| `account` | MyAccountPage | Profile section, order history table, quick actions |
| `confirmation` | OrderConfirmationPage | Confirmation message, timeline steps |

## Locale-Aware Formatting

### Currency

- English: `Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })`
- Chinese: `Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" })`

A shared helper `formatPrice(amount)` in `src/lib/utils.ts` reads the current i18n locale and formats accordingly.

### Dates

- English: `toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })`
- Chinese: `toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })`

A shared helper `formatDate(dateString)` in `src/lib/utils.ts`.

## What Does NOT Change

- Brand name "Klarheit" — always Latin script
- Technical standards ("ISO 12870") — always Latin
- Route paths (`/collections`, `/config-lab`, etc.) — always English
- API calls and backend — unaffected
- Session ID format in Navbar — always Latin alphanumeric

## Persistence

- Language choice saved to `localStorage` under key `klarheit-locale`
- On app load, i18next reads from localStorage before rendering
- Default language: `en` (no browser language auto-detection)

## Implementation Order

1. Install `react-i18next` and `i18next` dependencies
2. Create `src/i18n/index.ts` configuration
3. Create English translation JSON files (extract from existing JSX)
4. Create Chinese translation JSON files
5. Wrap app in `I18nextProvider` (via `main.tsx`)
6. Add language toggle to Navbar (desktop + mobile)
7. Update each page/component to use `useTranslation()` hook
8. Update `formatPrice` and `formatDate` helpers for locale awareness
9. Test both languages across all pages
