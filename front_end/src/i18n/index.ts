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
