# i18n Language Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Chinese/English language switching across the entire Klarheit frontend with a toggle button in the Navbar.

**Architecture:** react-i18next with per-page JSON translation namespaces. A `LanguageToggle` component in the Navbar switches locale, persisted to localStorage. Locale-aware `formatPrice` and `formatDate` helpers handle currency/date formatting.

**Tech Stack:** react-i18next, i18next, localStorage

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `front_end/src/i18n/index.ts` | i18next initialization with localStorage backend |
| Create | `front_end/src/i18n/locales/en/common.json` | Navbar, Footer, AuthDrawer, FormField, ErrorBoundary, ProtectedRoute strings |
| Create | `front_end/src/i18n/locales/en/landing.json` | LandingPage strings |
| Create | `front_end/src/i18n/locales/en/collections.json` | CollectionsPage strings |
| Create | `front_end/src/i18n/locales/en/ar-studio.json` | ARVirtualStudio strings |
| Create | `front_end/src/i18n/locales/en/config-lab.json` | ConfigLab strings |
| Create | `front_end/src/i18n/locales/en/checkout.json` | Checkout strings |
| Create | `front_end/src/i18n/locales/en/account.json` | MyAccountPage strings |
| Create | `front_end/src/i18n/locales/en/confirmation.json` | OrderConfirmationPage strings |
| Create | `front_end/src/i18n/locales/zh/common.json` | Chinese translations for common |
| Create | `front_end/src/i18n/locales/zh/landing.json` | Chinese translations for landing |
| Create | `front_end/src/i18n/locales/zh/collections.json` | Chinese translations for collections |
| Create | `front_end/src/i18n/locales/zh/ar-studio.json` | Chinese translations for AR studio |
| Create | `front_end/src/i18n/locales/zh/config-lab.json` | Chinese translations for config lab |
| Create | `front_end/src/i18n/locales/zh/checkout.json` | Chinese translations for checkout |
| Create | `front_end/src/i18n/locales/zh/account.json` | Chinese translations for account |
| Create | `front_end/src/i18n/locales/zh/confirmation.json` | Chinese translations for confirmation |
| Create | `front_end/src/components/layout/LanguageToggle.tsx` | Language toggle button component |
| Modify | `front_end/src/main.tsx` | Import i18n init |
| Modify | `front_end/src/lib/utils.ts` | Add `formatPrice` and `formatDate` helpers |
| Modify | `front_end/src/components/layout/Navbar.tsx` | Add LanguageToggle to desktop + mobile nav |
| Modify | `front_end/src/components/layout/Footer.tsx` | Use translations |
| Modify | `front_end/src/pages/LandingPage.tsx` | Use translations |
| Modify | `front_end/src/pages/CollectionsPage.tsx` | Use translations + locale-aware price |
| Modify | `front_end/src/pages/ARVirtualStudio.tsx` | Use translations |
| Modify | `front_end/src/pages/ConfigLab.tsx` | Use translations + locale-aware price |
| Modify | `front_end/src/pages/Checkout.tsx` | Use translations + locale-aware price/date |
| Modify | `front_end/src/pages/MyAccountPage.tsx` | Use translations + locale-aware price/date |
| Modify | `front_end/src/pages/OrderConfirmationPage.tsx` | Use translations + locale-aware price |
| Modify | `front_end/src/components/auth/AuthDrawer.tsx` | Use translations |
| Modify | `front_end/src/auth/ProtectedRoute.tsx` | Use translations |
| Modify | `front_end/src/components/ErrorBoundary.tsx` | Use translations (via i18next directly, not hook) |

---

### Task 1: Install Dependencies

**Files:**
- Modify: `front_end/package.json`

- [ ] **Step 1: Install react-i18next and i18next**

```bash
cd front_end && npm install react-i18next i18next
```

- [ ] **Step 2: Verify installation**

```bash
cd front_end && node -e "require('i18next'); require('react-i18next'); console.log('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add front_end/package.json front_end/package-lock.json
git commit -m "deps: add i18next and react-i18next"
```

---

### Task 2: Create i18n Configuration

**Files:**
- Create: `front_end/src/i18n/index.ts`

- [ ] **Step 1: Create the i18n configuration file**

```typescript
// front_end/src/i18n/index.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import enCommon from "./locales/en/common.json";
import enLanding from "./locales/en/landing.json";
import enCollections from "./locales/en/collections.json";
import enArStudio from "./locales/en/ar-studio.json";
import enConfigLab from "./locales/en/config-lab.json";
import enCheckout from "./locales/en/checkout.json";
import enAccount from "./locales/en/account.json";
import enConfirmation from "./locales/en/confirmation.json";

import zhCommon from "./locales/zh/common.json";
import zhLanding from "./locales/zh/landing.json";
import zhCollections from "./locales/zh/collections.json";
import zhArStudio from "./locales/zh/ar-studio.json";
import zhConfigLab from "./locales/zh/config-lab.json";
import zhCheckout from "./locales/zh/checkout.json";
import zhAccount from "./locales/zh/account.json";
import zhConfirmation from "./locales/zh/confirmation.json";

const savedLocale = localStorage.getItem("klarheit-locale") ?? "en";

i18n.use(initReactI18next).init({
  resources: {
    en: {
      common: enCommon,
      landing: enLanding,
      collections: enCollections,
      "ar-studio": enArStudio,
      "config-lab": enConfigLab,
      checkout: enCheckout,
      account: enAccount,
      confirmation: enConfirmation,
    },
    zh: {
      common: zhCommon,
      landing: zhLanding,
      collections: zhCollections,
      "ar-studio": zhArStudio,
      "config-lab": zhConfigLab,
      checkout: zhCheckout,
      account: zhAccount,
      confirmation: zhConfirmation,
    },
  },
  lng: savedLocale,
  fallbackLng: "en",
  ns: ["common"],
  defaultNS: "common",
  interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (lng) => {
  localStorage.setItem("klarheit-locale", lng);
});

export default i18n;
```

Note: This file will initially fail to compile because the JSON imports don't exist yet. The JSON files are created in Tasks 3-4. After those tasks complete, this file will compile. This is expected — we commit the skeleton now and it resolves once translation files are added.

- [ ] **Step 2: Commit**

```bash
git add front_end/src/i18n/index.ts
git commit -m "feat(i18n): add i18next configuration with localStorage persistence"
```

---

### Task 3: Create English Translation Files

**Files:**
- Create: `front_end/src/i18n/locales/en/common.json`
- Create: `front_end/src/i18n/locales/en/landing.json`
- Create: `front_end/src/i18n/locales/en/collections.json`
- Create: `front_end/src/i18n/locales/en/ar-studio.json`
- Create: `front_end/src/i18n/locales/en/config-lab.json`
- Create: `front_end/src/i18n/locales/en/checkout.json`
- Create: `front_end/src/i18n/locales/en/account.json`
- Create: `front_end/src/i18n/locales/en/confirmation.json`

- [ ] **Step 1: Create `en/common.json`**

```json
{
  "nav.collections": "Collections",
  "nav.configLab": "Config Lab",
  "nav.arStudio": "AR Studio",
  "nav.checkout": "Checkout",
  "nav.session": "Session",
  "nav.signIn": "Sign in",
  "nav.openAccount": "Open account",
  "nav.verifiedAccount": "Verified Account",
  "nav.myAccount": "My Account",
  "nav.profile": "Profile",
  "nav.myOrders": "My Orders",
  "nav.prescriptionProfile": "Prescription Profile",
  "nav.config": "Config",
  "nav.signOut": "Sign Out",
  "nav.exit": "Exit",
  "nav.menu": "Menu",
  "nav.signInMessage": "Sign in or create your account to save your optical profile.",
  "nav.signedInReady": "Signed in and ready to manage orders and prescriptions",

  "footer.copyright": "© 2024 Klarheit. Geneva, CH.",
  "footer.compliance": "Compliance: ISO 12870",
  "footer.status": "Status: Calibrated",

  "auth.authentication": "Authentication",
  "auth.signIn": "Sign In",
  "auth.register": "Register",
  "auth.welcomeBack": "Welcome Back",
  "auth.createAccount": "Create Account",
  "auth.defaultMessage": "Sign in to save your prescription and continue your custom order.",
  "auth.emailAddress": "Email Address",
  "auth.password": "Password",
  "auth.firstName": "First Name",
  "auth.lastName": "Last Name",
  "auth.signingIn": "Signing In...",
  "auth.continue": "Continue",
  "auth.creatingAccount": "Creating Account...",
  "auth.minimumChars": "Minimum 8 characters",

  "protected.restoringSession": "Restoring secure session...",
  "protected.accountRequired": "Account Required",
  "protected.signInToContinue": "Sign in to continue",

  "error.somethingWentWrong": "Something went wrong",
  "error.unexpectedError": "An unexpected error occurred while rendering this page. Please try refreshing.",
  "error.refreshPage": "Refresh Page"
}
```

- [ ] **Step 2: Create `en/landing.json`**

```json
{
  "hero.eyebrow": "Calibrated Precision",
  "hero.title": "LUMINA: THE ARCHITECTURE OF SIGHT",
  "hero.subtitle": "Engineered from aerospace-grade titanium and precision optics. Not just eyewear, but an instrument for vision.",
  "hero.virtualTryOn": "Virtual Try-On",
  "hero.browseCollection": "Browse Collection",
  "hero.leadTime.label": "Lead Time",
  "hero.leadTime.value": "10 day optical build",
  "hero.fitAccuracy.label": "Fit Accuracy",
  "hero.fitAccuracy.value": "98.2% studio match",
  "hero.material.label": "Material",
  "hero.material.value": "Grade 5 titanium shell",

  "structure.title": "Structural Integrity",
  "structure.description": "Each frame is milled from a single block of Grade 5 Titanium, ensuring a strength-to-weight ratio unmatched in traditional optical manufacturing.",
  "structure.microHinges.title": "Micro-Hinges",
  "structure.microHinges.description": "Frictionless, screwless articulation built to withstand 100,000 cycles without tolerance degradation.",
  "structure.ultralight.title": "Ultralight Chassis",
  "structure.ultralight.description": "Weighing under 14 grams total, providing an imperceptible fit for extended endurance.",
  "structure.titaniumRim": "Titanium Rim",
  "structure.aeroPad": "Aero Pad",

  "optics.eyebrow": "Optical Purity",
  "optics.title": "CALIBRATED REFRACTION",
  "optics.cr39.title": "CR-39 Resin",
  "optics.cr39.description": "Optical grade polymer offering superior clarity with half the weight of traditional glass lenses. Perfectly balances durability and optics.",
  "optics.cr39.tag1": "UV400",
  "optics.cr39.tag2": "Anti-Reflective",
  "optics.chromatic.title": "Chromatic Control",
  "optics.chromatic.description": "Proprietary tinting process filters specific wavelengths to enhance contrast and reduce ocular fatigue in high-glare environments.",
  "optics.chromatic.tag1": "Polarized",
  "optics.chromatic.tag2": "HEV Blocking",
  "optics.oleophobic.title": "Oleophobic Shield",
  "optics.oleophobic.description": "Nano-coating repels moisture and lipids, ensuring an unobstructed visual field in all environments and simplifying maintenance.",
  "optics.oleophobic.tag1": "Scratch Resistant",
  "optics.oleophobic.tag2": "Hydrophobic",

  "cta.title": "EXPERIENCE THE FIT",
  "cta.description": "Utilize our advanced facial mapping technology to accurately preview the Lumina Collection from your device in real-time.",
  "cta.startStudio": "Start Virtual Studio",
  "cta.exploreCatalog": "Explore frame catalog"
}
```

- [ ] **Step 3: Create `en/collections.json`**

```json
{
  "eyebrow": "Optical Catalog",
  "title": "The Inaugural Collection",
  "description": "Each silhouette is tuned for lightweight endurance, precise balance, and prescription-ready lens geometry. Select a frame to move directly into checkout.",
  "availableBuilds": "Available Builds",
  "loadingCatalog": "Loading catalog...",
  "retry": "Retry",
  "prescriptionReady": "Prescription-ready chassis",
  "select": "Select",
  "selectionNotes.title": "Selection Notes",
  "selectionNotes.eyebrow": "Before Checkout",
  "selectionNotes.description": "Current checkout accepts a frame choice and applies the standard lens package. Use Config Lab first if you want to review prescription values before payment.",
  "selectionNotes.included.label": "Included",
  "selectionNotes.included.description": "High-index custom lenses, AR coating, and HEV filter are bundled at checkout.",
  "selectionNotes.mobileFlow.label": "Mobile Flow",
  "selectionNotes.mobileFlow.description": "Cards stay tap-sized and the selection CTA remains visible without hover-dependent cues.",
  "signInMessage": "Sign in or create your account to continue with this frame."
}
```

- [ ] **Step 4: Create `en/ar-studio.json`**

```json
{
  "studioStatus": "Studio Status",
  "liveFaceMapping": "Live Face Mapping",
  "frontCameraAligned": "Front camera aligned. Refine finish selection, then move into Config Lab for lens setup.",
  "currentFinish": "Current Finish",
  "faceMesh": "Face Mesh",
  "active": "Active",
  "pupillaryDist": "Pupillary Dist",
  "tiltAngle": "Tilt Angle",
  "depthZ": "Depth Z",
  "lens": "Lens",
  "coating": "Coating",
  "fit": "Fit",
  "confidence": "Confidence",
  "liveReadout": "Live Readout",
  "captureInstruction": "Capture a still or continue to prescription configuration.",
  "configurePrecisionLenses": "Configure Precision Lenses",
  "liveArTryOnActive": "Live AR Try-On Active",
  "meshTracking": "Mesh Tracking",
  "color.matteBlack": "Matte Black",
  "color.titanium": "Titanium",
  "color.roseGold": "Rose Gold",
  "lensProfile": "Lens profile",
  "stillCaptured": "Still captured. Share export preview coming from connected device workflow."
}
```

- [ ] **Step 5: Create `en/config-lab.json`**

```json
{
  "eyebrow": "Swiss Precision Customization Interface",
  "title": "Config Lab",
  "description": "Tune prescription values, select the surface stack, and review the optical build before moving to secure checkout.",
  "engine": "Engine",
  "step1.eyebrow": "Step 01",
  "step1.title": "Optometric Prescription",
  "step1.description": "Enter your prescription values. All fields are validated against optical standards.",
  "step1.pdHint": "Pupillary distance in mm",
  "step2.eyebrow": "Step 02",
  "step2.title": "Surface Details",
  "step2.description": "Choose lens type and coatings from the available options.",
  "step2.loadingLens": "Loading lens options...",
  "step2.lensType": "Lens Type",
  "step2.coatings": "Coatings",
  "step3.eyebrow": "Step 03",
  "step3.title": "Review & Confirm",
  "step3.description": "Verify your configuration before proceeding to checkout.",
  "step3.prescription": "Prescription",
  "step3.selectedOptions": "Selected Options",
  "steps.prescription.label": "Prescription",
  "steps.prescription.description": "Sphere, cylinder, axis",
  "steps.surface.label": "Surface",
  "steps.surface.description": "Coatings and lens behavior",
  "steps.review.label": "Review",
  "steps.review.description": "Summary before order",
  "summary.frame": "Frame",
  "summary.selectedOptions": "Selected Options",
  "summary.optionCount": "{{count}} option",
  "summary.optionCount_plural": "{{count}} options",
  "summary.activeStage": "Active Stage",
  "summary.totalValue": "Total Value",
  "summary.premium": "PREMIUM",
  "nextStep": "Next Step",
  "initializeOrder": "Initialize Order"
}
```

- [ ] **Step 6: Create `en/checkout.json`**

```json
{
  "eyebrow": "Secure Order",
  "title": "Finalize Commission",
  "description": "Confirm customer information, validate prescription values, and authorize payment for the current optical build.",
  "formStatus": "Form Status",
  "step1.title": "Client Details",
  "step1.eyebrow": "Step 01",
  "step1.description": "Identity and delivery fields are required for the existing checkout request.",
  "step1.accountOnFile": "Account on file",
  "step1.syncedToCheckout": "Synced to checkout identity",
  "step1.firstName": "First Name",
  "step1.lastName": "Last Name",
  "step1.emailAddress": "Email Address",
  "step1.shippingAddress": "Shipping Address",
  "step2.title": "Prescription Details",
  "step2.eyebrow": "Step 02",
  "step2.fromConfigLab": "Prescription loaded from Config Lab. Values are pre-filled.",
  "step2.defaultDescription": "All values remain mapped to the current backend order contract.",
  "step2.pd": "Pupillary Distance (PD)",
  "step3.title": "Payment Method",
  "step3.eyebrow": "Step 03",
  "step3.description": "Card fields stay client-side only here; no checkout protocol changes were introduced.",
  "step3.creditCard": "Credit Card",
  "step3.cardNumber": "Card Number",
  "step3.expiry": "Expiry",
  "step3.cvc": "CVC",
  "manifest.title": "Manifest",
  "manifest.loadingProduct": "Loading selected product...",
  "manifest.noProduct": "No product selected. Return to the <1>collection</1> and choose a frame first.",
  "manifest.subtotal": "Subtotal",
  "manifest.complimentaryShipping": "Complimentary Shipping",
  "manifest.readiness": "Readiness",
  "manifest.nearlyComplete": "Customer and payment fields are nearly complete.",
  "manifest.stillInProgress": "Customer and payment fields are still in progress.",
  "manifest.accountIdentity": "Account Identity",
  "manifest.totalCommission": "Total Commission",
  "manifest.authorizing": "AUTHORIZING...",
  "manifest.authorizePayment": "AUTHORIZE PAYMENT",
  "manifest.encryptedTransaction": "Encrypted Transaction",
  "manifest.swissDataPrivacy": "Swiss Data Privacy Active",
  "selectProductError": "Select a product before submitting checkout.",
  "prescriptionNumberError": "Prescription values must all be valid numbers.",
  "checkoutFailed": "Checkout failed.",
  "sessionExpired": "Your session expired before checkout completed. Sign in again to submit this order."
}
```

- [ ] **Step 7: Create `en/account.json`**

```json
{
  "eyebrow": "Verified Account",
  "title": "My Account",
  "description": "Manage your Klarheit identity, optical profile, and recent order activity from one secure workspace.",
  "profileStatus": "Profile Status",
  "verified": "Verified",
  "identity.title": "Account Overview",
  "identity.eyebrow": "Identity",
  "identity.description": "Primary contact details used for secure access, order correspondence, and prescription records.",
  "identity.memberSince": "Member Since",
  "identity.memberSinceValue": "April 2026",
  "identity.accountTier": "Account Tier",
  "identity.accountTierValue": "Verified Optical Client",
  "identity.defaultName": "Klarheit Client",
  "identity.defaultEmail": "client@klarheit.com",
  "secureAccess.title": "Secure Access",
  "secureAccess.healthStable": "Account health is stable.",
  "secureAccess.profileAligned": "Profile data, saved prescriptions, and checkout identity are aligned across the current session.",
  "secureAccess.session": "Session",
  "secureAccess.sessionValue": "FX-4920 secure channel active",
  "orders.title": "Recent Orders",
  "orders.eyebrow": "Order Activity",
  "orders.description": "Track current production status and revisit recent commissions.",
  "orders.loading": "Loading orders...",
  "orders.noOrders": "No orders yet.",
  "orders.browseCollections": "Browse Collections",
  "orders.status": "Status",
  "orders.total": "Total",
  "orders.options": "Options",
  "orders.lensOptionCount": "{{count}} lens option",
  "orders.lensOptionCount_plural": "{{count}} lens options",
  "quickActions.title": "Account Controls",
  "quickActions.eyebrow": "Quick Actions",
  "quickActions.description": "Use the most common account actions without leaving the current workspace.",
  "quickActions.profileDetails": "Profile Details",
  "quickActions.profileDetailsMeta": "Identity",
  "quickActions.billingCheckout": "Billing & Checkout",
  "quickActions.billingCheckoutMeta": "Orders",
  "quickActions.appointments": "Appointments & Timeline",
  "quickActions.appointmentsMeta": "Schedule",
  "quickActions.savedAddresses": "Saved Addresses",
  "quickActions.savedAddressesMeta": "Delivery",
  "quickActions.recommendation": "Recommendation",
  "quickActions.recommendationText": "Refresh your prescription profile before placing a new optical commission to keep checkout aligned with your latest measurements.",
  "compliance.title": "Security & Privacy",
  "compliance.eyebrow": "Compliance",
  "compliance.description": "Core safeguards visible to the client account.",
  "compliance.sessionActive": "Authenticated session is active and tied to your verified email identity.",
  "compliance.dataSecure": "Prescription and order data stay within the secure Klarheit account workspace."
}
```

- [ ] **Step 8: Create `en/confirmation.json`**

```json
{
  "noOrderInfo": "No order information found.",
  "browseCollections": "Browse Collections",
  "eyebrow": "Order Confirmed",
  "title": "Thank You!",
  "description": "Your Klarheit optical commission has been received and is being prepared.",
  "orderPlacedSuccess": "Order Placed Successfully",
  "details.eyebrow": "Order Details",
  "details.description": "Your order has been confirmed and a confirmation email has been sent.",
  "details.product": "Product",
  "details.status": "Status",
  "details.total": "Total",
  "details.shippingTo": "Shipping To",
  "details.lensConfiguration": "Lens Configuration",
  "timeline.eyebrow": "What's Next",
  "timeline.title": "Order Timeline",
  "timeline.description": "Here's what to expect with your Klarheit commission.",
  "timeline.orderConfirmed": "Order Confirmed",
  "timeline.orderConfirmedDesc": "Your order has been received and payment is being processed.",
  "timeline.lensCrafting": "Lens Crafting",
  "timeline.lensCraftingDesc": "Your custom lenses will be precision-crafted to your prescription.",
  "timeline.shipped": "Shipped",
  "timeline.shippedDesc": "Your finished glasses will be shipped with tracking information.",
  "viewMyOrders": "View My Orders",
  "continueShopping": "Continue Shopping",
  "lensLabels.HIGH_INDEX_174": "Custom Lenses (High-Index)",
  "lensLabels.AR_ONYX": "Onyx AR Coating",
  "lensLabels.HEV_BLUE": "HEV Filter"
}
```

- [ ] **Step 9: Commit**

```bash
git add front_end/src/i18n/locales/en/
git commit -m "feat(i18n): add English translation files for all pages"
```

---

### Task 4: Create Chinese Translation Files

**Files:**
- Create: `front_end/src/i18n/locales/zh/common.json`
- Create: `front_end/src/i18n/locales/zh/landing.json`
- Create: `front_end/src/i18n/locales/zh/collections.json`
- Create: `front_end/src/i18n/locales/zh/ar-studio.json`
- Create: `front_end/src/i18n/locales/zh/config-lab.json`
- Create: `front_end/src/i18n/locales/zh/checkout.json`
- Create: `front_end/src/i18n/locales/zh/account.json`
- Create: `front_end/src/i18n/locales/zh/confirmation.json`

- [ ] **Step 1: Create `zh/common.json`**

```json
{
  "nav.collections": "产品系列",
  "nav.configLab": "配置工坊",
  "nav.arStudio": "AR 工作室",
  "nav.checkout": "结算",
  "nav.session": "会话",
  "nav.signIn": "登录",
  "nav.openAccount": "打开账户",
  "nav.verifiedAccount": "已验证账户",
  "nav.myAccount": "我的账户",
  "nav.profile": "个人资料",
  "nav.myOrders": "我的订单",
  "nav.prescriptionProfile": "处方档案",
  "nav.config": "配置",
  "nav.signOut": "退出登录",
  "nav.exit": "退出",
  "nav.menu": "菜单",
  "nav.signInMessage": "登录或创建账户以保存您的光学档案。",
  "nav.signedInReady": "已登录，随时可以管理订单和处方",

  "footer.copyright": "© 2024 Klarheit. 日内瓦，瑞士。",
  "footer.compliance": "合规标准：ISO 12870",
  "footer.status": "状态：已校准",

  "auth.authentication": "身份验证",
  "auth.signIn": "登录",
  "auth.register": "注册",
  "auth.welcomeBack": "欢迎回来",
  "auth.createAccount": "创建账户",
  "auth.defaultMessage": "登录以保存您的处方并继续定制订单。",
  "auth.emailAddress": "电子邮箱",
  "auth.password": "密码",
  "auth.firstName": "名",
  "auth.lastName": "姓",
  "auth.signingIn": "登录中...",
  "auth.continue": "继续",
  "auth.creatingAccount": "创建账户中...",
  "auth.minimumChars": "至少 8 个字符",

  "protected.restoringSession": "正在恢复安全会话...",
  "protected.accountRequired": "需要账户",
  "protected.signInToContinue": "登录以继续",

  "error.somethingWentWrong": "出现错误",
  "error.unexpectedError": "渲染此页面时发生意外错误，请尝试刷新。",
  "error.refreshPage": "刷新页面"
}
```

- [ ] **Step 2: Create `zh/landing.json`**

```json
{
  "hero.eyebrow": "精密校准",
  "hero.title": "LUMINA：视觉的建筑",
  "hero.subtitle": "采用航空级钛合金和精密光学技术打造。不仅是眼镜，更是视觉的精密仪器。",
  "hero.virtualTryOn": "虚拟试戴",
  "hero.browseCollection": "浏览系列",
  "hero.leadTime.label": "交付周期",
  "hero.leadTime.value": "10 天光学定制",
  "hero.fitAccuracy.label": "适配精度",
  "hero.fitAccuracy.value": "98.2% 工作室匹配",
  "hero.material.label": "材质",
  "hero.material.value": "5 级钛合金壳体",

  "structure.title": "结构完整性",
  "structure.description": "每副镜架均由整块 5 级钛合金铣削而成，确保传统光学制造无法比拟的强度重量比。",
  "structure.microHinges.title": "微铰链",
  "structure.microHinges.description": "无摩擦、无螺丝铰接设计，可承受 10 万次开合而不产生公差退化。",
  "structure.ultralight.title": "超轻底盘",
  "structure.ultralight.description": "总重量低于 14 克，提供长时间佩戴的无感舒适体验。",
  "structure.titaniumRim": "钛合金镜框",
  "structure.aeroPad": "气垫鼻托",

  "optics.eyebrow": "光学纯度",
  "optics.title": "精密折射",
  "optics.cr39.title": "CR-39 树脂",
  "optics.cr39.description": "光学级聚合物，清晰度优越，重量仅为传统玻璃镜片的一半。完美平衡耐用性与光学性能。",
  "optics.cr39.tag1": "UV400 防护",
  "optics.cr39.tag2": "减反射",
  "optics.chromatic.title": "色度控制",
  "optics.chromatic.description": "专利染色工艺过滤特定波长光线，增强对比度并减少强光环境下的视觉疲劳。",
  "optics.chromatic.tag1": "偏光",
  "optics.chromatic.tag2": "HEV 过滤",
  "optics.oleophobic.title": "疏油涂层",
  "optics.oleophobic.description": "纳米涂层排斥水分和油脂，确保在各种环境下视野清晰，简化日常维护。",
  "optics.oleophobic.tag1": "耐刮擦",
  "optics.oleophobic.tag2": "疏水",

  "cta.title": "体验贴合",
  "cta.description": "利用先进的面部映射技术，从您的设备实时精准预览 Lumina 系列。",
  "cta.startStudio": "启动虚拟工作室",
  "cta.exploreCatalog": "探索镜架目录"
}
```

- [ ] **Step 3: Create `zh/collections.json`**

```json
{
  "eyebrow": "光学目录",
  "title": "首发系列",
  "description": "每一款造型都经过轻量化耐久性、精确平衡和处方镜片几何结构的调校。选择镜架直接进入结算。",
  "availableBuilds": "可选配置",
  "loadingCatalog": "加载目录中...",
  "retry": "重试",
  "prescriptionReady": "处方就绪底盘",
  "select": "选择",
  "selectionNotes.title": "选购说明",
  "selectionNotes.eyebrow": "结算前",
  "selectionNotes.description": "当前结算接受镜架选择并应用标准镜片套餐。如需在付款前查看处方参数，请先使用配置工坊。",
  "selectionNotes.included.label": "包含内容",
  "selectionNotes.included.description": "高折射率定制镜片、AR 镀膜和 HEV 过滤器均在结算时捆绑提供。",
  "selectionNotes.mobileFlow.label": "移动端流程",
  "selectionNotes.mobileFlow.description": "卡片保持触摸友好尺寸，选择按钮无需悬停提示即可保持可见。",
  "signInMessage": "登录或创建账户以继续选择此镜架。"
}
```

- [ ] **Step 4: Create `zh/ar-studio.json`**

```json
{
  "studioStatus": "工作室状态",
  "liveFaceMapping": "实时面部映射",
  "frontCameraAligned": "前置摄像头已对齐。调整表面选择，然后进入配置工坊进行镜片设置。",
  "currentFinish": "当前表面",
  "faceMesh": "面部网格",
  "active": "活跃",
  "pupillaryDist": "瞳距",
  "tiltAngle": "倾斜角度",
  "depthZ": "深度 Z",
  "lens": "镜片",
  "coating": "镀膜",
  "fit": "适配",
  "confidence": "置信度",
  "liveReadout": "实时数据",
  "captureInstruction": "拍摄静帧或继续进行处方配置。",
  "configurePrecisionLenses": "配置精密镜片",
  "liveArTryOnActive": "AR 实时试戴中",
  "meshTracking": "网格追踪",
  "color.matteBlack": "哑光黑",
  "color.titanium": "钛金属",
  "color.roseGold": "玫瑰金",
  "lensProfile": "镜片方案",
  "stillCaptured": "静帧已捕获。分享导出预览即将从连接设备工作流推出。"
}
```

- [ ] **Step 5: Create `zh/config-lab.json`**

```json
{
  "eyebrow": "瑞士精密定制界面",
  "title": "配置工坊",
  "description": "调校处方参数、选择表面堆叠，在进入安全结算前审查光学配置。",
  "engine": "引擎",
  "step1.eyebrow": "步骤 01",
  "step1.title": "验光处方",
  "step1.description": "输入您的处方参数。所有字段均按光学标准验证。",
  "step1.pdHint": "瞳距，单位为毫米",
  "step2.eyebrow": "步骤 02",
  "step2.title": "表面详情",
  "step2.description": "从可用选项中选择镜片类型和镀膜。",
  "step2.loadingLens": "加载镜片选项中...",
  "step2.lensType": "镜片类型",
  "step2.coatings": "镀膜",
  "step3.eyebrow": "步骤 03",
  "step3.title": "审查确认",
  "step3.description": "在进入结算前验证您的配置。",
  "step3.prescription": "处方",
  "step3.selectedOptions": "已选选项",
  "steps.prescription.label": "处方",
  "steps.prescription.description": "球镜、柱镜、轴位",
  "steps.surface.label": "表面",
  "steps.surface.description": "镀膜和镜片特性",
  "steps.review.label": "审查",
  "steps.review.description": "下单前摘要",
  "summary.frame": "镜架",
  "summary.selectedOptions": "已选选项",
  "summary.optionCount": "{{count}} 个选项",
  "summary.optionCount_plural": "{{count}} 个选项",
  "summary.activeStage": "当前阶段",
  "summary.totalValue": "总价值",
  "summary.premium": "高级",
  "nextStep": "下一步",
  "initializeOrder": "确认下单"
}
```

- [ ] **Step 6: Create `zh/checkout.json`**

```json
{
  "eyebrow": "安全订单",
  "title": "确认委托",
  "description": "确认客户信息、验证处方参数并授权支付当前光学配置。",
  "formStatus": "表单状态",
  "step1.title": "客户详情",
  "step1.eyebrow": "步骤 01",
  "step1.description": "身份和配送字段为当前结算请求所必需。",
  "step1.accountOnFile": "已有账户",
  "step1.syncedToCheckout": "已同步至结算身份",
  "step1.firstName": "名",
  "step1.lastName": "姓",
  "step1.emailAddress": "电子邮箱",
  "step1.shippingAddress": "收货地址",
  "step2.title": "处方详情",
  "step2.eyebrow": "步骤 02",
  "step2.fromConfigLab": "处方已从配置工坊加载，参数已预填。",
  "step2.defaultDescription": "所有参数仍映射至当前后端订单协议。",
  "step2.pd": "瞳距 (PD)",
  "step3.title": "支付方式",
  "step3.eyebrow": "步骤 03",
  "step3.description": "卡号字段仅保留在客户端；未引入结算协议变更。",
  "step3.creditCard": "信用卡",
  "step3.cardNumber": "卡号",
  "step3.expiry": "有效期",
  "step3.cvc": "安全码",
  "manifest.title": "清单",
  "manifest.loadingProduct": "加载所选产品中...",
  "manifest.noProduct": "未选择产品。返回<1>产品系列</1>选择镜架。",
  "manifest.subtotal": "小计",
  "manifest.complimentaryShipping": "免费配送",
  "manifest.readiness": "就绪状态",
  "manifest.nearlyComplete": "客户和支付字段即将完成。",
  "manifest.stillInProgress": "客户和支付字段仍在填写中。",
  "manifest.accountIdentity": "账户身份",
  "manifest.totalCommission": "委托总额",
  "manifest.authorizing": "授权中...",
  "manifest.authorizePayment": "授权支付",
  "manifest.encryptedTransaction": "加密交易",
  "manifest.swissDataPrivacy": "瑞士数据隐私保护",
  "selectProductError": "提交结算前请先选择产品。",
  "prescriptionNumberError": "处方参数必须均为有效数字。",
  "checkoutFailed": "结算失败。",
  "sessionExpired": "结算完成前会话已过期。请重新登录以提交此订单。"
}
```

- [ ] **Step 7: Create `zh/account.json`**

```json
{
  "eyebrow": "已验证账户",
  "title": "我的账户",
  "description": "在一个安全工作区中管理您的 Klarheit 身份、光学档案和近期订单活动。",
  "profileStatus": "档案状态",
  "verified": "已验证",
  "identity.title": "账户概览",
  "identity.eyebrow": "身份",
  "identity.description": "用于安全访问、订单通信和处方记录的主要联系方式。",
  "identity.memberSince": "注册时间",
  "identity.memberSinceValue": "2026 年 4 月",
  "identity.accountTier": "账户等级",
  "identity.accountTierValue": "已验证光学客户",
  "identity.defaultName": "Klarheit 客户",
  "identity.defaultEmail": "client@klarheit.com",
  "secureAccess.title": "安全访问",
  "secureAccess.healthStable": "账户状态稳定。",
  "secureAccess.profileAligned": "档案数据、已保存处方和结算身份在当前会话中保持一致。",
  "secureAccess.session": "会话",
  "secureAccess.sessionValue": "FX-4920 安全通道活跃",
  "orders.title": "近期订单",
  "orders.eyebrow": "订单活动",
  "orders.description": "跟踪当前生产状态并查看近期委托。",
  "orders.loading": "加载订单中...",
  "orders.noOrders": "暂无订单。",
  "orders.browseCollections": "浏览系列",
  "orders.status": "状态",
  "orders.total": "总计",
  "orders.options": "选项",
  "orders.lensOptionCount": "{{count}} 个镜片选项",
  "orders.lensOptionCount_plural": "{{count}} 个镜片选项",
  "quickActions.title": "账户操作",
  "quickActions.eyebrow": "快捷操作",
  "quickActions.description": "无需离开当前工作区即可执行最常用的账户操作。",
  "quickActions.profileDetails": "个人资料详情",
  "quickActions.profileDetailsMeta": "身份",
  "quickActions.billingCheckout": "账单与结算",
  "quickActions.billingCheckoutMeta": "订单",
  "quickActions.appointments": "预约与时间线",
  "quickActions.appointmentsMeta": "日程",
  "quickActions.savedAddresses": "已保存地址",
  "quickActions.savedAddressesMeta": "配送",
  "quickActions.recommendation": "推荐",
  "quickActions.recommendationText": "在下新的光学委托前刷新您的处方档案，以确保结算与最新测量数据保持一致。",
  "compliance.title": "安全与隐私",
  "compliance.eyebrow": "合规",
  "compliance.description": "客户账户可见的核心保障措施。",
  "compliance.sessionActive": "已验证会话处于活跃状态并与您的已验证邮箱身份绑定。",
  "compliance.dataSecure": "处方和订单数据保存在安全的 Klarheit 账户工作区内。"
}
```

- [ ] **Step 8: Create `zh/confirmation.json`**

```json
{
  "noOrderInfo": "未找到订单信息。",
  "browseCollections": "浏览系列",
  "eyebrow": "订单已确认",
  "title": "谢谢您！",
  "description": "您的 Klarheit 光学委托已收到并正在准备中。",
  "orderPlacedSuccess": "订单已成功下单",
  "details.eyebrow": "订单详情",
  "details.description": "您的订单已确认，确认邮件已发送。",
  "details.product": "产品",
  "details.status": "状态",
  "details.total": "总计",
  "details.shippingTo": "收货地址",
  "details.lensConfiguration": "镜片配置",
  "timeline.eyebrow": "后续流程",
  "timeline.title": "订单时间线",
  "timeline.description": "以下是您的 Klarheit 委托的预期流程。",
  "timeline.orderConfirmed": "订单已确认",
  "timeline.orderConfirmedDesc": "您的订单已收到，支付正在处理中。",
  "timeline.lensCrafting": "镜片制作",
  "timeline.lensCraftingDesc": "您的定制镜片将按处方精密制作。",
  "timeline.shipped": "已发货",
  "timeline.shippedDesc": "成品眼镜将附带追踪信息发货。",
  "viewMyOrders": "查看我的订单",
  "continueShopping": "继续选购",
  "lensLabels.HIGH_INDEX_174": "定制镜片（高折射率）",
  "lensLabels.AR_ONYX": "Onyx AR 镀膜",
  "lensLabels.HEV_BLUE": "HEV 过滤器"
}
```

- [ ] **Step 9: Commit**

```bash
git add front_end/src/i18n/locales/zh/
git commit -m "feat(i18n): add Chinese translation files for all pages"
```

---

### Task 5: Wire Up i18n in Entry Point

**Files:**
- Modify: `front_end/src/main.tsx`

- [ ] **Step 1: Add i18n import to main.tsx**

The current file is:
```typescript
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Change to:
```typescript
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './i18n';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd front_end && npx tsc --noEmit
```
Expected: No errors (the JSON files now exist so the i18n config resolves).

- [ ] **Step 3: Commit**

```bash
git add front_end/src/main.tsx
git commit -m "feat(i18n): wire up i18n initialization in main entry point"
```

---

### Task 6: Add Language Toggle to Navbar

**Files:**
- Create: `front_end/src/components/layout/LanguageToggle.tsx`
- Modify: `front_end/src/components/layout/Navbar.tsx`

- [ ] **Step 1: Create LanguageToggle component**

```typescript
// front_end/src/components/layout/LanguageToggle.tsx
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";

type LanguageToggleProps = {
  isDark: boolean;
  className?: string;
};

export function LanguageToggle({ isDark, className }: LanguageToggleProps) {
  const { i18n } = useTranslation();

  return (
    <div className={cn("flex items-center gap-1 text-[10px] uppercase tracking-widest font-mono", className)}>
      <button
        type="button"
        onClick={() => i18n.changeLanguage("en")}
        className={cn(
          "transition-opacity px-1",
          i18n.language === "en"
            ? isDark ? "text-white" : "text-brand-primary"
            : isDark ? "text-white/40 hover:text-white/70" : "text-slate-400 hover:text-slate-600"
        )}
      >
        EN
      </button>
      <span className={cn(isDark ? "text-white/30" : "text-slate-300")}>|</span>
      <button
        type="button"
        onClick={() => i18n.changeLanguage("zh")}
        className={cn(
          "transition-opacity px-1",
          i18n.language === "zh"
            ? isDark ? "text-white" : "text-brand-primary"
            : isDark ? "text-white/40 hover:text-white/70" : "text-slate-400 hover:text-slate-600"
        )}
      >
        中
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add LanguageToggle to Navbar desktop area**

In `Navbar.tsx`, add the import and place `LanguageToggle` in the Global Actions div. The current Global Actions section starts at line 93. Add the LanguageToggle between the session info div (line 94-96) and the Checkout button (line 97-114).

Add import at top:
```typescript
import { LanguageToggle } from "./LanguageToggle";
```

After the session info `<div>` (line 96), add:
```tsx
<LanguageToggle isDark={isDarkCanvas || scrolled} className="hidden sm:flex" />
```

- [ ] **Step 3: Add LanguageToggle to mobile nav menu**

In the mobile navigation section (inside the `mobileOpen` div, after the nav items map at line 324), add:

```tsx
<div className="border-t border-white/10 pt-3 mt-1">
  <LanguageToggle isDark={isDarkCanvas || scrolled} className="justify-center py-2" />
</div>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd front_end && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add front_end/src/components/layout/LanguageToggle.tsx front_end/src/components/layout/Navbar.tsx
git commit -m "feat(i18n): add language toggle to Navbar desktop and mobile"
```

---

### Task 7: Add Locale-Aware Formatting Helpers

**Files:**
- Modify: `front_end/src/lib/utils.ts`

- [ ] **Step 1: Add formatPrice and formatDate to utils.ts**

The current file is:
```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Change to:
```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import i18n from "../i18n";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number): string {
  const lng = i18n.language;
  if (lng === "zh") {
    return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 }).format(amount * 7.3);
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
}

export function formatDate(dateString: string): string {
  const lng = i18n.language;
  const date = new Date(dateString);
  if (lng === "zh") {
    return date.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
  }
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
```

Note: The USD-to-CNY conversion uses a static rate of 7.3 for demo purposes. In a production app this would come from an API.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd front_end && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add front_end/src/lib/utils.ts
git commit -m "feat(i18n): add locale-aware formatPrice and formatDate helpers"
```

---

### Task 8: Update Common Components (Footer, AuthDrawer, ErrorBoundary, ProtectedRoute)

**Files:**
- Modify: `front_end/src/components/layout/Footer.tsx`
- Modify: `front_end/src/components/auth/AuthDrawer.tsx`
- Modify: `front_end/src/components/ErrorBoundary.tsx`
- Modify: `front_end/src/auth/ProtectedRoute.tsx`

- [ ] **Step 1: Update Footer.tsx**

Replace the entire file content:
```typescript
import { useTranslation } from "react-i18next";

export function Footer() {
  const { t } = useTranslation("common");
  return (
    <footer className="border-t border-slate-200 bg-white px-5 py-4 sm:px-8 lg:px-12 flex flex-col gap-3 md:h-12 md:flex-row md:items-center md:justify-between text-[9px] uppercase tracking-[0.2em] text-slate-400 font-medium shrink-0">
      <span>{t("footer.copyright")}</span>
      <div className="flex flex-wrap gap-4 md:gap-8">
        <span>{t("footer.compliance")}</span>
        <span>{t("footer.status")}</span>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Update AuthDrawer.tsx**

Replace the entire file content:
```typescript
import { type FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuth } from "../../auth/AuthProvider";

type SignInForm = {
  email: string;
  password: string;
};

type RegisterForm = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

const EMPTY_SIGN_IN_FORM: SignInForm = {
  email: "",
  password: "",
};

const EMPTY_REGISTER_FORM: RegisterForm = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
};

export function AuthDrawer() {
  const { t } = useTranslation("common");
  const {
    isAuthModalOpen,
    closeAuthModal,
    authMode,
    setAuthMode,
    login,
    register,
    authError,
    authMessage,
    isSubmittingAuth,
  } = useAuth();

  const [signInForm, setSignInForm] = useState<SignInForm>(EMPTY_SIGN_IN_FORM);
  const [registerForm, setRegisterForm] = useState<RegisterForm>(EMPTY_REGISTER_FORM);

  useEffect(() => {
    setSignInForm({ ...EMPTY_SIGN_IN_FORM });
    setRegisterForm({ ...EMPTY_REGISTER_FORM });
  }, [isAuthModalOpen]);

  async function handleSignInSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await login(signInForm);
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await register(registerForm);
  }

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[60] bg-brand-primary/20 backdrop-blur-sm transition-opacity duration-500",
          isAuthModalOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={closeAuthModal}
      />

      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-md z-[70] bg-white/85 backdrop-blur-2xl border-l border-white/40 shadow-[-20px_0_40px_rgba(11,32,70,0.1)] p-12 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col",
          isAuthModalOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-xl font-display tracking-tight text-brand-primary">{t("auth.authentication")}</h2>
          <button
            onClick={closeAuthModal}
            className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-500"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex gap-2 p-1 bg-slate-100 rounded-full mb-8">
          <button
            type="button"
            onClick={() => setAuthMode("signin")}
            className={cn(
              "flex-1 rounded-full py-3 text-[10px] uppercase tracking-[0.2em] font-semibold transition-colors",
              authMode === "signin" ? "bg-white text-brand-primary shadow-sm" : "text-slate-500"
            )}
          >
            {t("auth.signIn")}
          </button>
          <button
            type="button"
            onClick={() => setAuthMode("register")}
            className={cn(
              "flex-1 rounded-full py-3 text-[10px] uppercase tracking-[0.2em] font-semibold transition-colors",
              authMode === "register" ? "bg-white text-brand-primary shadow-sm" : "text-slate-500"
            )}
          >
            {t("auth.register")}
          </button>
        </div>

        <div className="mb-8">
          <h3 className="text-3xl font-display font-light text-brand-primary mb-3">
            {authMode === "signin" ? t("auth.welcomeBack") : t("auth.createAccount")}
          </h3>
          <p className="text-sm text-slate-500 font-light">
            {authMessage ?? t("auth.defaultMessage")}
          </p>
        </div>

        {authError ? (
          <div className="border border-red-200 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">
            {authError}
          </div>
        ) : null}

        {authMode === "signin" ? (
          <form className="flex flex-col gap-6" onSubmit={handleSignInSubmit}>
            <div className="flex flex-col gap-2 relative group">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest group-focus-within:text-brand-primary transition-colors">
                {t("auth.emailAddress")}
              </label>
              <input
                value={signInForm.email}
                onChange={(event) => setSignInForm((current) => ({ ...current, email: event.target.value }))}
                type="email"
                required
                placeholder="client@example.com"
                className="w-full bg-transparent border-0 border-b border-slate-300 py-3 px-0 focus:ring-0 focus:border-brand-primary outline-none transition-colors text-lg font-medium text-brand-primary rounded-none placeholder:text-slate-300"
              />
            </div>

            <div className="flex flex-col gap-2 relative group mb-4">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest group-focus-within:text-brand-primary transition-colors">
                {t("auth.password")}
              </label>
              <input
                value={signInForm.password}
                onChange={(event) => setSignInForm((current) => ({ ...current, password: event.target.value }))}
                type="password"
                required
                placeholder="••••••••"
                className="w-full bg-transparent border-0 border-b border-slate-300 py-3 px-0 focus:ring-0 focus:border-brand-primary outline-none transition-colors text-lg font-medium text-brand-primary rounded-none placeholder:text-slate-300"
              />
            </div>

            <button
              disabled={isSubmittingAuth}
              className="w-full bg-brand-primary text-white py-4 text-xs font-bold uppercase tracking-[0.2em] hover:bg-brand-primary/90 transition-colors rounded-sm shadow-[0_10px_20px_rgba(11,32,70,0.15)] flex justify-center items-center gap-2 disabled:opacity-70"
            >
              {isSubmittingAuth ? t("auth.signingIn") : t("auth.continue")}
            </button>
          </form>
        ) : (
          <form className="flex flex-col gap-6" onSubmit={handleRegisterSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2 relative group">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest group-focus-within:text-brand-primary transition-colors">
                  {t("auth.firstName")}
                </label>
                <input
                  value={registerForm.firstName}
                  onChange={(event) => setRegisterForm((current) => ({ ...current, firstName: event.target.value }))}
                  type="text"
                  required
                  className="w-full bg-transparent border-0 border-b border-slate-300 py-3 px-0 focus:ring-0 focus:border-brand-primary outline-none transition-colors text-lg font-medium text-brand-primary"
                />
              </div>
              <div className="flex flex-col gap-2 relative group">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest group-focus-within:text-brand-primary transition-colors">
                  {t("auth.lastName")}
                </label>
                <input
                  value={registerForm.lastName}
                  onChange={(event) => setRegisterForm((current) => ({ ...current, lastName: event.target.value }))}
                  type="text"
                  required
                  className="w-full bg-transparent border-0 border-b border-slate-300 py-3 px-0 focus:ring-0 focus:border-brand-primary outline-none transition-colors text-lg font-medium text-brand-primary"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2 relative group">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest group-focus-within:text-brand-primary transition-colors">
                {t("auth.emailAddress")}
              </label>
              <input
                value={registerForm.email}
                onChange={(event) => setRegisterForm((current) => ({ ...current, email: event.target.value }))}
                type="email"
                required
                placeholder="client@example.com"
                className="w-full bg-transparent border-0 border-b border-slate-300 py-3 px-0 focus:ring-0 focus:border-brand-primary outline-none transition-colors text-lg font-medium text-brand-primary rounded-none placeholder:text-slate-300"
              />
            </div>
            <div className="flex flex-col gap-2 relative group mb-4">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest group-focus-within:text-brand-primary transition-colors">
                {t("auth.password")}
              </label>
              <input
                value={registerForm.password}
                onChange={(event) => setRegisterForm((current) => ({ ...current, password: event.target.value }))}
                type="password"
                required
                minLength={8}
                placeholder={t("auth.minimumChars")}
                className="w-full bg-transparent border-0 border-b border-slate-300 py-3 px-0 focus:ring-0 focus:border-brand-primary outline-none transition-colors text-lg font-medium text-brand-primary rounded-none placeholder:text-slate-300"
              />
            </div>

            <button
              disabled={isSubmittingAuth}
              className="w-full bg-brand-primary text-white py-4 text-xs font-bold uppercase tracking-[0.2em] hover:bg-brand-primary/90 transition-colors rounded-sm shadow-[0_10px_20px_rgba(11,32,70,0.15)] flex justify-center items-center gap-2 disabled:opacity-70"
            >
              {isSubmittingAuth ? t("auth.creatingAccount") : t("auth.createAccount")}
            </button>
          </form>
        )}
      </div>
    </>
  );
}
```

- [ ] **Step 3: Update ErrorBoundary.tsx**

Replace the entire file content:
```typescript
import { Component, type ErrorInfo, type ReactNode } from "react";
import i18n from "../i18n";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center bg-surface-offwhite px-6 py-20">
          <div className="max-w-md w-full text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center">
              <span className="text-2xl text-red-400">!</span>
            </div>
            <h1 className="text-xl font-display font-medium text-brand-primary mb-3">
              {i18n.t("error.somethingWentWrong", { ns: "common" })}
            </h1>
            <p className="text-sm text-slate-500 mb-8">
              {i18n.t("error.unexpectedError", { ns: "common" })}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 rounded-sm px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] bg-brand-primary text-white hover:bg-brand-primary/90 transition-colors"
            >
              {i18n.t("error.refreshPage", { ns: "common" })}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

- [ ] **Step 4: Update ProtectedRoute.tsx**

Replace the entire file content:
```typescript
import { type ReactElement, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export function ProtectedRoute({ children, message }: { children: ReactElement; message: string }) {
  const { t } = useTranslation("common");
  const location = useLocation();
  const { isAuthenticated, isAuthReady, requireAuth } = useAuth();
  const attemptedPathRef = useRef<string | null>(null);
  const nextPath = `${location.pathname}${location.search}${location.hash}`;

  useEffect(() => {
    if (isAuthReady && !isAuthenticated && attemptedPathRef.current !== nextPath) {
      attemptedPathRef.current = nextPath;
      requireAuth(
        { path: nextPath, state: location.state },
        message
      );
    }
    if (isAuthenticated) {
      attemptedPathRef.current = null;
    }
  }, [isAuthenticated, isAuthReady, location.state, message, nextPath, requireAuth]);

  if (!isAuthReady) {
    return (
      <div className="flex-1 flex items-center justify-center px-8 py-24">
        <div className="text-sm uppercase tracking-[0.2em] text-slate-400">
          {t("protected.restoringSession")}
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex-1 flex items-center justify-center px-8 py-24">
        <div className="max-w-xl w-full border border-slate-200 bg-white rounded-2xl p-10 text-center shadow-sm">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold mb-4">
            {t("protected.accountRequired")}
          </p>
          <h1 className="text-3xl font-display font-light text-brand-primary mb-4">
            {t("protected.signInToContinue")}
          </h1>
          <p className="text-slate-500 font-light leading-relaxed">
            {message}
          </p>
        </div>
      </div>
    );
  }

  return children;
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd front_end && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add front_end/src/components/layout/Footer.tsx front_end/src/components/auth/AuthDrawer.tsx front_end/src/components/ErrorBoundary.tsx front_end/src/auth/ProtectedRoute.tsx
git commit -m "feat(i18n): translate Footer, AuthDrawer, ErrorBoundary, ProtectedRoute"
```

---

### Task 9: Update LandingPage with Translations

**Files:**
- Modify: `front_end/src/pages/LandingPage.tsx`

- [ ] **Step 1: Replace LandingPage.tsx**

```typescript
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, MoveRight } from "lucide-react";

export function LandingPage() {
  const { t } = useTranslation("landing");

  return (
    <div className="flex flex-col w-full">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
        <div className="absolute inset-0 z-0 bg-surface-offwhite">
          <img
            className="w-full h-full object-cover opacity-20 mix-blend-luminosity"
            alt="Abstract minimal composition of translucent glass surfaces"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBbg0BvCGzar79JhHvOW2yp9ebM_f8m99eRPPsLoUxsRvHsu-6yUn9K_l167-aQYawDGASWbzQ-Rt0pmWrBYxa-qHY6asAHJpbNqO-gBd6wkj_XQl83d_IkNYQ7u3-LXmVpYm36uqKeKVzyYT5Lg7Yb2n5d3q4BDy_RZrlv9xj-PpJsBzlnyutm9UxAhPQMJbqFBjm3SjZTWLseD5BAImx9atjF5sU5A_sFcAjfIgl2Qme-oJoFUBsWOAW8__y_s8ygo2WmbNFpRw"
          />
        </div>
        <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.08),_transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(249,250,251,0.95))]" />
        <div className="relative z-10 text-center max-w-4xl px-8 mx-auto flex flex-col items-center">
          <p className="text-[10px] sm:text-xs text-slate-500 uppercase tracking-[0.2em] mb-6 border-b border-slate-300/50 pb-2 inline-block font-semibold">
            {t("hero.eyebrow")}
          </p>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-display font-light tracking-tight text-brand-primary mb-8 px-4 leading-[1.1]">
            {t("hero.title")}
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto mb-12 font-light px-4">
            {t("hero.subtitle")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              to="/virtual-studio"
              className="text-[10px] sm:text-xs border border-brand-primary px-8 py-4 uppercase tracking-widest text-brand-primary hover:bg-brand-primary hover:text-white transition-all duration-500 bg-white/50 backdrop-blur-md font-medium flex items-center justify-center gap-3 group"
            >
              {t("hero.virtualTryOn")}
              <MoveRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
            </Link>
            <Link
              to="/collections"
              className="text-[10px] sm:text-xs border border-brand-primary px-8 py-4 uppercase tracking-widest text-brand-primary hover:bg-brand-primary hover:text-white transition-all duration-500 bg-white/40 backdrop-blur-md font-medium flex items-center justify-center"
            >
              {t("hero.browseCollection")}
            </Link>
          </div>
          <div className="mt-14 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              [t("hero.leadTime.label"), t("hero.leadTime.value")],
              [t("hero.fitAccuracy.label"), t("hero.fitAccuracy.value")],
              [t("hero.material.label"), t("hero.material.value")],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/60 bg-white/55 px-5 py-4 backdrop-blur-md">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold">{label}</p>
                <p className="mt-2 text-sm font-medium text-brand-primary">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Technical Deconstruction */}
      <section className="py-24 sm:py-32 bg-white relative border-t border-slate-200/50">
        <div className="max-w-[1440px] mx-auto px-8 lg:px-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24 items-center">
            <div className="lg:col-span-4 flex flex-col gap-8 order-2 lg:order-1">
              <div className="pb-6 border-b border-slate-200/50">
                <h2 className="text-3xl sm:text-4xl font-display text-brand-primary mb-4 font-light tracking-tight">
                  {t("structure.title")}
                </h2>
                <p className="text-slate-600 font-light leading-relaxed">
                  {t("structure.description")}
                </p>
              </div>
              <ul className="flex flex-col gap-8">
                <li className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded border border-slate-200 flex items-center justify-center shrink-0 mt-1">
                    <span className="text-brand-primary text-xs font-mono font-bold">01</span>
                  </div>
                  <div>
                    <h3 className="text-xs uppercase text-brand-primary mb-2 tracking-widest font-bold">
                      {t("structure.microHinges.title")}
                    </h3>
                    <p className="text-slate-500 text-sm font-light">
                      {t("structure.microHinges.description")}
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded border border-slate-200 flex items-center justify-center shrink-0 mt-1">
                    <span className="text-brand-primary text-xs font-mono font-bold">02</span>
                  </div>
                  <div>
                    <h3 className="text-xs uppercase text-brand-primary mb-2 tracking-widest font-bold">
                      {t("structure.ultralight.title")}
                    </h3>
                    <p className="text-slate-500 text-sm font-light">
                      {t("structure.ultralight.description")}
                    </p>
                  </div>
                </li>
              </ul>
            </div>
            
            <div className="lg:col-span-8 relative min-h-[400px] sm:min-h-[600px] bg-slate-50 rounded-xl border border-slate-200/50 overflow-hidden group order-1 lg:order-2">
              <img
                className="w-full h-full object-cover mix-blend-multiply opacity-80"
                alt="Minimalist titanium wireframe glasses"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuB5PNc7Uu61y6GSyVZ9LgDxCAUnNCMlrFL57NtjWtDMd02mY5WOmi_6ob7FtTxa74Rq_DaFKNX7ZkXNvRBJlTzcRov4cu-FNkHNPEGokk8I_t3E4-BWU2EyP-rnHyyXXpA1yh59ugBSHeaHIipxZov6cQKFOyfFU5Xa-2aGX135sP9WMiNxMKH9peDMNYfA0M9VWyLCH-NYPQccjKNnyoeMuvVkzqbOHFjipueWNwTZ50Br0owb9VrepxqWIT2WKT5MXQjrYCIn3Q"
              />
              {/* Annotations */}
              <div className="absolute top-[25%] left-[20%] sm:left-[30%] flex items-center gap-2">
                <div className="w-2 h-2 rounded-full border-2 border-brand-primary bg-white"></div>
                <div className="w-8 sm:w-16 h-[1px] bg-brand-primary/50"></div>
                <span className="text-[9px] sm:text-[10px] text-brand-primary uppercase bg-white/80 px-2 py-1 backdrop-blur-sm border border-brand-primary/20 tracking-widest font-semibold">
                  {t("structure.titaniumRim")}
                </span>
              </div>
              <div className="absolute bottom-[35%] right-[15%] sm:right-[25%] flex items-center gap-2">
                <span className="text-[9px] sm:text-[10px] text-brand-primary uppercase bg-white/80 px-2 py-1 backdrop-blur-sm border border-brand-primary/20 tracking-widest font-semibold">
                  {t("structure.aeroPad")}
                </span>
                <div className="w-8 sm:w-16 h-[1px] bg-brand-primary/50"></div>
                <div className="w-2 h-2 rounded-full border-2 border-brand-primary bg-white"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Optics Section */}
      <section className="py-24 sm:py-32 bg-[#0A1121] text-white relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0A1121] to-brand-primary opacity-90 z-10"></div>
          <img
            className="w-full h-full object-cover z-0 opacity-40 mix-blend-screen"
            alt="Optical glass prisms"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAZ2Q6yFw45bUXMEMyOMUAuzu9UTUXP7VQ_8QGoZxEDpJ9JAmyg3NEfeVUNgQ0xye9aVeuAYCUn-XaKvMwMgrkKqk4F9_XVKTETwmU96j-t2Nq-NCAPWAOVHNvd3pSc6fsrMWSXstJSD1VsZCVOe_rHVLqkrp5VlRDFdzLxfwZUINcmCo_KE__4oOjad0a1oDDKCaDmXXwkSj-EPsQIPwJiwvSQiVUCSkx52f_Dhm4flQL58hMnCV9mL-zlYRGN0jEsMlR1Xe7KLg"
          />
        </div>
        <div className="max-w-[1440px] mx-auto px-8 lg:px-16 relative z-20">
          <div className="text-center mb-16 sm:mb-24">
            <p className="text-[10px] sm:text-xs text-brand-cyan uppercase tracking-[0.2em] mb-4 font-semibold">
              {t("optics.eyebrow")}
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-light text-white tracking-tight">
              {t("optics.title")}
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="bg-white/5 border border-white/10 p-8 xl:p-10 backdrop-blur-xl hover:bg-white/10 transition-colors duration-500 rounded-lg">
              <div className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center mb-8 bg-white/5">
                <div className="w-4 h-4 bg-white rounded-full opacity-80"></div>
              </div>
              <h3 className="text-xl md:text-2xl font-display text-white mb-4 tracking-tight">{t("optics.cr39.title")}</h3>
              <p className="text-sm text-slate-300 font-light leading-relaxed mb-8">
                {t("optics.cr39.description")}
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-[9px] border border-white/20 px-3 py-1.5 rounded uppercase tracking-widest text-slate-300">{t("optics.cr39.tag1")}</span>
                <span className="text-[9px] border border-white/20 px-3 py-1.5 rounded uppercase tracking-widest text-slate-300">{t("optics.cr39.tag2")}</span>
              </div>
            </div>
            
            {/* Card 2 */}
            <div className="bg-white/5 border border-white/10 p-8 xl:p-10 backdrop-blur-xl hover:bg-white/10 transition-colors duration-500 rounded-lg">
              <div className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center mb-8 bg-white/5 relative">
                <div className="w-4 h-4 border border-brand-cyan rounded-sm rotate-45"></div>
                <div className="absolute w-6 h-[1px] bg-brand-cyan/50"></div>
                <div className="absolute h-6 w-[1px] bg-brand-cyan/50"></div>
              </div>
              <h3 className="text-xl md:text-2xl font-display text-white mb-4 tracking-tight">{t("optics.chromatic.title")}</h3>
              <p className="text-sm text-slate-300 font-light leading-relaxed mb-8">
                {t("optics.chromatic.description")}
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-[9px] border border-white/20 px-3 py-1.5 rounded uppercase tracking-widest text-slate-300">{t("optics.chromatic.tag1")}</span>
                <span className="text-[9px] border border-white/20 px-3 py-1.5 rounded uppercase tracking-widest text-slate-300">{t("optics.chromatic.tag2")}</span>
              </div>
            </div>
            
            {/* Card 3 */}
            <div className="bg-white/5 border border-white/10 p-8 xl:p-10 backdrop-blur-xl hover:bg-white/10 transition-colors duration-500 rounded-lg">
              <div className="w-12 h-12 rounded-full border border-white/40 rotate-45 backdrop-blur-sm bg-white/10"></div>
              <h3 className="text-xl md:text-2xl font-display text-white mb-4 tracking-tight">{t("optics.oleophobic.title")}</h3>
              <p className="text-sm text-slate-300 font-light leading-relaxed mb-8">
                {t("optics.oleophobic.description")}
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="text-[9px] border border-white/20 px-3 py-1.5 rounded uppercase tracking-widest text-slate-300">{t("optics.oleophobic.tag1")}</span>
                <span className="text-[9px] border border-white/20 px-3 py-1.5 rounded uppercase tracking-widest text-slate-300">{t("optics.oleophobic.tag2")}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 sm:py-32 bg-[#050B16] text-white relative">
        <div className="max-w-4xl mx-auto px-8 text-center flex flex-col items-center">
          <h2 className="text-4xl md:text-6xl font-display font-light text-white mb-8 tracking-tight">
            {t("cta.title")}
          </h2>
          <p className="text-base sm:text-lg text-slate-400 mb-12 max-w-xl mx-auto font-light">
            {t("cta.description")}
          </p>
          <Link
            to="/virtual-studio"
            className="text-[10px] sm:text-xs border border-white/30 px-10 py-5 uppercase tracking-widest text-white hover:bg-white hover:text-brand-primary transition-all duration-500 font-semibold flex items-center gap-4 group"
          >
            {t("cta.startStudio")}
            <div className="w-5 h-5 flex items-center justify-center rounded-full border border-current group-hover:bg-brand-primary group-hover:text-white transition-colors">
              <span className="block w-1.5 h-1.5 bg-current rounded-full"></span>
            </div>
          </Link>
          <Link to="/collections" className="mt-5 text-sm text-slate-400 hover:text-white transition-colors inline-flex items-center gap-2">
            {t("cta.exploreCatalog")} <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd front_end && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add front_end/src/pages/LandingPage.tsx
git commit -m "feat(i18n): translate LandingPage"
```

---

### Task 10: Update CollectionsPage with Translations

**Files:**
- Modify: `front_end/src/pages/CollectionsPage.tsx`

- [ ] **Step 1: Replace CollectionsPage.tsx**

```typescript
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, RefreshCw } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { useProducts } from "../hooks/useProducts";
import { type Product } from "../services/api";
import { Button } from "../components/ui/Button";
import { PageIntro } from "../components/ui/PageIntro";
import { SectionCard } from "../components/ui/SectionCard";
import { formatPrice } from "../lib/utils";

export function CollectionsPage() {
  const { t } = useTranslation("collections");
  const navigate = useNavigate();
  const { requireAuth } = useAuth();
  const { products, isLoading, error, retry } = useProducts();

  function handleProductSelect(product: Product) {
    if (requireAuth(
      { path: "/checkout", state: { product } },
      t("signInMessage")
    )) {
      navigate("/checkout", { state: { product } });
    }
  }

  return (
    <div className="flex flex-col w-full px-5 sm:px-8 lg:px-12 max-w-[1440px] mx-auto py-12 sm:py-16 gap-12">
      <PageIntro
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm">
            <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("availableBuilds")}</p>
            <p className="mt-2 text-2xl font-display font-medium text-brand-primary">{products.length || "--"}</p>
          </div>
        }
      />

      {isLoading ? (
        <div className="max-w-5xl mx-auto w-full text-center py-20 text-sm uppercase tracking-[0.2em] text-slate-400">
          {t("loadingCatalog")}
        </div>
      ) : null}

      {error ? (
        <SectionCard className="max-w-5xl mx-auto w-full border-red-200 bg-red-50/70" contentClassName="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-red-700">{error}</p>
          <Button type="button" variant="outline-light" className="self-start" onClick={retry}>
            <RefreshCw className="w-4 h-4" />
            {t("retry")}
          </Button>
        </SectionCard>
      ) : null}

      {!isLoading && !error ? (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-8 items-start">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-5xl">
        {products.map((item) => (
          <article key={item.id} className="group cursor-pointer flex flex-col">
            <button
              type="button"
              onClick={() => handleProductSelect(item)}
              className="text-left rounded-[28px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
            >
              <div className="bg-white border border-slate-100 rounded-[28px] w-full aspect-[4/3] flex items-center justify-center p-8 overflow-hidden relative transition-all duration-700 ease-in-out hover:shadow-[0_20px_40px_-20px_rgba(11,32,70,0.1)] hover:border-slate-200">
                <div className="absolute inset-0 bg-slate-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <img 
                  src={item.imageUrl} 
                  alt={item.name} 
                  className="w-4/5 h-auto object-contain transform group-hover:scale-105 transition-transform duration-700 ease-out mix-blend-multiply relative z-10"
                />
                <div className="absolute left-5 top-5 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-400 backdrop-blur-sm">
                  {item.material}
                </div>
              </div>
              <div className="mt-8 flex flex-col gap-2">
                <div className="flex justify-between items-baseline">
                  <h2 className="text-xl font-display font-medium tracking-wide text-brand-primary">{item.name}</h2>
                  <span className="text-base text-slate-500">{formatPrice(item.basePrice)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[10px] uppercase font-semibold tracking-widest text-slate-400">{t("prescriptionReady")}</p>
                  <span className="inline-flex items-center gap-2 text-xs text-brand-primary">
                    {t("select")}
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </div>
            </button>
          </article>
        ))}
        </div>
        <SectionCard
          title={t("selectionNotes.title")}
          eyebrow={t("selectionNotes.eyebrow")}
          description={t("selectionNotes.description")}
          className="xl:sticky xl:top-28"
        >
          <div className="space-y-4 text-sm text-slate-600">
            <div className="rounded-2xl bg-surface-muted px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("selectionNotes.included.label")}</p>
              <p className="mt-2">{t("selectionNotes.included.description")}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 px-4 py-4">
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{t("selectionNotes.mobileFlow.label")}</p>
              <p className="mt-2">{t("selectionNotes.mobileFlow.description")}</p>
            </div>
          </div>
        </SectionCard>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd front_end && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add front_end/src/pages/CollectionsPage.tsx
git commit -m "feat(i18n): translate CollectionsPage"
```

---

### Task 11: Update ARVirtualStudio with Translations

**Files:**
- Modify: `front_end/src/pages/ARVirtualStudio.tsx`

- [ ] **Step 1: Replace ARVirtualStudio.tsx**

```typescript
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, CheckCircle, Repeat, Share2, SlidersHorizontal, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../lib/utils";
import { GlassPanel } from "../components/ui/GlassPanel";
import { Button } from "../components/ui/Button";

export function ARVirtualStudio() {
  const { t } = useTranslation("ar-studio");
  const [activeColor, setActiveColor] = useState<"black" | "titanium" | "rose">("black");
  const [captureState, setCaptureState] = useState<"idle" | "captured">("idle");

  const colorMeta = {
    black: { label: t("color.matteBlack"), lens: "Onyx AR", fit: t("fit") + ": Urban contrast" },
    titanium: { label: t("color.titanium"), lens: "Neutral Clear", fit: t("fit") + ": Studio neutral" },
    rose: { label: t("color.roseGold"), lens: "Warm HEV", fit: t("fit") + ": Soft daylight" },
  } as const;

  return (
    <div className="relative w-full min-h-[calc(100vh-80px)] overflow-hidden bg-[#0A1121]">
      <div className="absolute inset-0 z-0">
        <img
          alt="AR Try-On View"
          className="w-full h-full object-cover object-center"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBYggF8qJw0oilYsR2i531-nRvWpDmAWrdVV3ZiJuyiBNGUpcYkvmouNUJzn2Q3nAN4LyI2t1wqrVpLE5PhZEc7VFFloCnfCrjcBZRNDDOqMVje38J0aIgjDZMxZDvHPnCEAghP_GeGOMmRp_7fuUk0fWDV7asCDR3tMIGdajd7NNaHJEEcUAmZshST9c1CoP1wXrGnMVQTNHdbRghQm33_mjfUNMjTCYbfXo7otFt44DdHhXXsUjjbIiYiyIjaJS247XHsldGkWA"
        />
        <div className="absolute inset-0 bg-[#0A1121]/20 mix-blend-multiply"></div>
      </div>

      <div
        className="absolute inset-0 z-10 pointer-events-none opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(34, 211, 238, 0.2) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(34, 211, 238, 0.2) 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px",
          backgroundPosition: "center center",
        }}
      />

      <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
        <div className="relative w-24 h-24 border border-brand-cyan/40 rounded-full flex items-center justify-center">
          <div className="absolute w-[120%] h-[1px] bg-brand-cyan/60"></div>
          <div className="absolute h-[120%] w-[1px] bg-brand-cyan/60"></div>
          <div className="absolute w-1.5 h-1.5 bg-brand-cyan rounded-full animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]"></div>
        </div>

        <div className="absolute top-[35%] left-[10%] lg:left-[20%] hidden md:flex flex-col gap-2 text-[9px] text-brand-cyan font-mono tracking-widest uppercase opacity-80 border-l border-brand-cyan/30 pl-3">
          <span>{t("faceMesh")} <span className="text-white ml-2">{t("active")}</span></span>
          <span>{t("pupillaryDist")} <span className="text-white ml-2">62mm</span></span>
          <span>{t("tiltAngle")} <span className="text-white ml-2">2.4°</span></span>
          <span>{t("depthZ")} <span className="text-white ml-2">-14.2cm</span></span>
        </div>

        <div className="absolute bottom-[40%] right-[10%] lg:right-[20%] hidden md:flex flex-col gap-2 text-[9px] text-brand-cyan font-mono tracking-widest uppercase opacity-80 border-r border-brand-cyan/30 pr-3 items-end">
          <span>{t("lens")} <span className="text-white ml-2">{colorMeta[activeColor].lens}</span></span>
          <span>{t("coating")} <span className="text-white ml-2">{colorMeta[activeColor].label}</span></span>
          <span>{t("fit")} <span className="text-white ml-2">{colorMeta[activeColor].fit}</span></span>
          <span>{t("confidence")} <span className="text-emerald-400 ml-2">98.2%</span></span>
        </div>
      </div>

      <div className="relative z-30 mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-[1440px] flex-col justify-between px-4 pb-6 pt-6 sm:px-6 lg:px-10">
        <div className="pointer-events-none flex justify-between gap-4">
          <GlassPanel className="pointer-events-auto max-w-sm px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em] text-brand-cyan font-semibold">{t("studioStatus")}</p>
                <h1 className="mt-2 text-xl font-display font-medium text-white">{t("liveFaceMapping")}</h1>
                <p className="mt-2 text-sm text-slate-300 font-light">{t("frontCameraAligned")}</p>
              </div>
              <Sparkles className="w-5 h-5 text-brand-cyan shrink-0" />
            </div>
          </GlassPanel>
          <GlassPanel className="pointer-events-auto hidden lg:block px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400 font-semibold">{t("currentFinish")}</p>
            <p className="mt-2 text-sm text-white">{colorMeta[activeColor].label}</p>
            <p className="mt-1 text-xs text-slate-400">{colorMeta[activeColor].fit}</p>
          </GlassPanel>
        </div>

        <div className="mt-auto flex flex-col items-center justify-end pointer-events-none">
          <GlassPanel className="p-5 sm:p-8 mb-4 w-full max-w-4xl pointer-events-auto flex flex-col gap-6 sm:gap-8">
            <div className="flex flex-col gap-4 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-display text-white text-xl md:text-2xl tracking-wide font-light">Aero X1</h2>
                <p className="text-[10px] text-slate-400 mt-2 uppercase font-semibold tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  {t("liveArTryOnActive")}
                </p>
              </div>
              <div className="flex items-center gap-2 border border-brand-cyan/30 bg-brand-cyan/10 px-3 py-1.5 rounded self-start">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-cyan"></span>
                <span className="font-mono text-[9px] text-brand-cyan tracking-widest uppercase mt-[1px]">{t("meshTracking")}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 sm:flex sm:items-center sm:justify-center sm:gap-12 py-2">
              {(["black", "titanium", "rose"] as const).map((color) => (
                <button
                  key={color}
                  onClick={() => setActiveColor(color)}
                  className="group flex flex-col items-center gap-3 rounded-2xl px-2 py-1"
                >
                  <div
                    className={cn(
                      "w-12 h-12 rounded-full p-1 relative transition-colors duration-300",
                      activeColor === color ? "border-2 border-white" : "border border-white/20 group-hover:border-white/50"
                    )}
                  >
                    <div
                      className={cn(
                        "w-full h-full rounded-full shadow-inner",
                        color === "black" && "bg-[#1c1c1c]",
                        color === "titanium" && "bg-gradient-to-br from-slate-300 to-slate-500",
                        color === "rose" && "bg-gradient-to-br from-rose-300 to-rose-400"
                      )}
                    />
                    {activeColor === color ? (
                      <CheckCircle className="absolute -top-1 -right-1 w-4 h-4 text-white bg-[#050B16] rounded-full" />
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      "text-[9px] text-center uppercase tracking-widest font-semibold transition-colors duration-300",
                      activeColor === color ? "text-white" : "text-slate-500 group-hover:text-slate-300"
                    )}
                  >
                    {colorMeta[color].label}
                  </span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-300">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-semibold">{t("liveReadout")}</p>
                <p className="mt-2">{t("lensProfile")}: {colorMeta[activeColor].lens}. {t("captureInstruction")}</p>
              </div>
              <Link to="/config-lab" className="w-full">
                <Button variant="outline-dark" className="w-full">
                  <SlidersHorizontal className="w-4 h-4" />
                  {t("configurePrecisionLenses")}
                </Button>
              </Link>
            </div>
          </GlassPanel>

          <div className="flex flex-wrap justify-center gap-3 pointer-events-auto">
            {[Repeat, Camera, Share2].map((Icon, i) => (
              <button
                key={i}
                onClick={() => {
                  if (Icon === Camera) {
                    setCaptureState("captured");
                  }
                }}
                className="w-12 h-12 rounded-full bg-[#050B16]/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/10 hover:border-white/30 transition-colors duration-300"
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
          {captureState === "captured" ? (
            <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-brand-cyan font-semibold pointer-events-auto">
              {t("stillCaptured")}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd front_end && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add front_end/src/pages/ARVirtualStudio.tsx
git commit -m "feat(i18n): translate ARVirtualStudio"
```

---

### Task 12: Update ConfigLab with Translations

**Files:**
- Modify: `front_end/src/pages/ConfigLab.tsx`

- [ ] **Step 1: Replace ConfigLab.tsx**

The ConfigLab file is ~400 lines. The changes are:
1. Add `import { useTranslation } from "react-i18next"` and `import { formatPrice } from "../lib/utils"`
2. Add `const { t } = useTranslation("config-lab")` inside the component
3. Replace all hardcoded strings with `t()` calls
4. Replace `${totalPrice.toFixed(2)}` with `formatPrice(totalPrice)`
5. Replace `${option.additionalPrice.toFixed(2)}` with `formatPrice(option.additionalPrice)`
6. Translate the steps array labels and descriptions
7. Translate the sidebar summary section

Since this file is large, use the following approach: read the current file, then apply edits. The key changes are:

- Import: add `useTranslation` and `formatPrice`
- Line 71-75: steps array → use `t()` for labels and descriptions
- Line 171-175: PageIntro props → use `t()`
- Line 204-208: SectionCard eyebrow/title/description → use `t()`
- Line 232-235: SectionCard → use `t()`
- Line 239: "Loading lens options..." → `t("step2.loadingLens")`
- Line 243: "Lens Type" → `t("step2.lensType")`
- Line 260: `$${option.additionalPrice.toFixed(2)}` → `formatPrice(option.additionalPrice)`
- Line 272: "Coatings" → `t("step2.coatings")`
- Line 289: `$${option.additionalPrice.toFixed(2)}` → `formatPrice(option.additionalPrice)`
- Line 304-309: SectionCard → use `t()`
- Line 312: "Prescription" → `t("step3.prescription")`
- Line 323: "Selected Options" → `t("step3.selectedOptions")`
- Line 328: `$${option.additionalPrice.toFixed(2)}` → `formatPrice(option.additionalPrice)`
- Line 344-347: product name and material → keep as-is (from API)
- Line 347: "PREMIUM" → `t("summary.premium")`
- Line 351-352: "Frame" → `t("summary.frame")`
- Line 355-356: "Selected Options" → `t("summary.selectedOptions")`, option count text
- Line 362-363: "Active Stage" → `t("summary.activeStage")`
- Line 369: "Total Value" → `t("summary.totalValue")`
- Line 370: `$${totalPrice.toFixed(2)}` → `formatPrice(totalPrice)`
- Line 379: "Next Step" → `t("nextStep")`
- Line 387: "Initialize Order" → `t("initializeOrder")`

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd front_end && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add front_end/src/pages/ConfigLab.tsx
git commit -m "feat(i18n): translate ConfigLab"
```

---

### Task 13: Update Checkout with Translations

**Files:**
- Modify: `front_end/src/pages/Checkout.tsx`

- [ ] **Step 1: Update Checkout.tsx**

Key changes:
1. Add `import { useTranslation } from "react-i18next"` and `import { formatPrice } from "../lib/utils"`
2. Add `const { t } = useTranslation("checkout")` inside component
3. Replace all `currencyFormatter.format(...)` with `formatPrice(...)`
4. Remove the `const currencyFormatter` line
5. Replace all hardcoded strings with `t()` calls:
   - PageIntro eyebrow/title/description
   - SectionCard titles, eyebrows, descriptions
   - Form labels (First Name, Last Name, Email, Shipping Address, Card Number, Expiry, CVC)
   - "Account on file", "Synced to checkout identity"
   - "Credit Card", "Pupillary Distance (PD)"
   - Manifest section: "Manifest", "Loading selected product...", "Subtotal", "Complimentary Shipping", etc.
   - Error messages
   - Button text: "AUTHORIZING...", "AUTHORIZE PAYMENT"
   - Footer badges: "Encrypted Transaction", "Swiss Data Privacy Active"
6. Keep `LENS_LABELS` as-is (these are technical labels that come from the API; the translation is in the confirmation page lensLabels for display purposes — but here they're used in a technical context)

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd front_end && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add front_end/src/pages/Checkout.tsx
git commit -m "feat(i18n): translate Checkout"
```

---

### Task 14: Update MyAccountPage with Translations

**Files:**
- Modify: `front_end/src/pages/MyAccountPage.tsx`

- [ ] **Step 1: Update MyAccountPage.tsx**

Key changes:
1. Add `import { useTranslation } from "react-i18next"` and `import { formatPrice, formatDate } from "../lib/utils"`
2. Add `const { t } = useTranslation("account")` inside component
3. Replace `currencyFormatter.format(...)` with `formatPrice(...)`
4. Replace `new Date(order.createdAt).toLocaleDateString("en-US", ...)` with `formatDate(order.createdAt)`
5. Remove the `const currencyFormatter` line
6. Replace all hardcoded strings with `t()` calls for:
   - PageIntro eyebrow/title/description
   - Identity section: all labels and values
   - Secure Access section
   - Orders section: loading, no orders, status/total/options labels
   - Quick Actions: all labels and meta
   - Compliance section
   - The `lensOptionTypes.length` display with plural handling

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd front_end && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add front_end/src/pages/MyAccountPage.tsx
git commit -m "feat(i18n): translate MyAccountPage"
```

---

### Task 15: Update OrderConfirmationPage with Translations

**Files:**
- Modify: `front_end/src/pages/OrderConfirmationPage.tsx`

- [ ] **Step 1: Update OrderConfirmationPage.tsx**

Key changes:
1. Add `import { useTranslation } from "react-i18next"` and `import { formatPrice } from "../lib/utils"`
2. Add `const { t } = useTranslation("confirmation")` inside component
3. Replace `currencyFormatter.format(...)` with `formatPrice(...)`
4. Remove the `const currencyFormatter` line
5. Replace `LENS_LABELS` with translation keys: `t("lensLabels." + type)` (with fallback to type)
6. Replace all hardcoded strings with `t()` calls for:
   - "No order information found."
   - "Browse Collections"
   - PageIntro eyebrow/title/description
   - SectionCard eyebrow/title/description
   - Product/Status/Total/Shipping To labels
   - "Lens Configuration"
   - Timeline steps: Order Confirmed, Lens Crafting, Shipped + descriptions
   - Button text: "View My Orders", "Continue Shopping"

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd front_end && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add front_end/src/pages/OrderConfirmationPage.tsx
git commit -m "feat(i18n): translate OrderConfirmationPage"
```

---

### Task 16: Verify Full Build and Manual Test

**Files:** None (verification only)

- [ ] **Step 1: Run TypeScript check**

```bash
cd front_end && npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 2: Run build**

```bash
cd front_end && npm run build
```
Expected: Build succeeds with no errors.

- [ ] **Step 3: Run tests**

```bash
cd front_end && npm test
```
Expected: All tests pass.

- [ ] **Step 4: Manual verification checklist**

Start the dev server (`npm run dev`) and verify:
- [ ] Landing page renders in English by default
- [ ] Click "中" in Navbar → all text switches to Chinese
- [ ] Click "EN" → switches back to English
- [ ] Refresh page → language choice persists
- [ ] Navigate to each page in both languages: Collections, AR Studio, Config Lab, Checkout, My Account, Order Confirmation
- [ ] AuthDrawer shows correct language for sign-in/register forms
- [ ] Footer shows correct language
- [ ] Mobile nav menu shows language toggle
- [ ] Prices show $ in English, ¥ in Chinese
- [ ] Dates show correct format per language

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(i18n): address review feedback"
```
