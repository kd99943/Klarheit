export interface PaymentFormOptions {
  allowMockEndpoint?: boolean;
  targetDocument?: Document;
}

const TRUSTED_ALIPAY_HOST_SUFFIXES = [".alipay.com", ".alipaydev.com"];
const LOCAL_MOCK_TERMINAL_PATH = "/api/v1/payments/callback/mock-terminal";

function isTrustedAlipayHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return TRUSTED_ALIPAY_HOST_SUFFIXES.some(
    (suffix) => lower === suffix.slice(1) || lower.endsWith(suffix)
  );
}

/**
 * Parses and validates an HTML auto-submit form returned by Alipay SDK
 * (`<form name="punchout_form" ...>`) or the local sandbox mock terminal
 * (`<form id="alipay_submit" ...>`).
 *
 * Throws an Error if no form element is present or if the form action URL is
 * missing, malformed, or points to an untrusted/mock destination in production.
 */
export function parseAndValidatePaymentForm(
  payData: string,
  options: PaymentFormOptions = {}
): HTMLFormElement {
  const allowMock = options.allowMockEndpoint ?? Boolean(import.meta.env.DEV);

  if (!payData || !payData.trim()) {
    throw new Error("Invalid payment form: empty gateway payload.");
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(payData, "text/html");
  const formEl = doc.querySelector<HTMLFormElement>(
    'form[name="punchout_form"], form#alipay_submit, form'
  );

  if (!formEl) {
    throw new Error("Invalid payment form: no <form> element found in gateway response.");
  }

  const rawAction = formEl.getAttribute("action")?.trim() ?? "";
  if (!rawAction) {
    throw new Error("Invalid payment form: missing form action URL.");
  }

  if (rawAction.startsWith("/")) {
    if (!allowMock || !rawAction.startsWith(LOCAL_MOCK_TERMINAL_PATH)) {
      throw new Error("Untrusted or mock payment form action is forbidden in production.");
    }
    return formEl;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawAction);
  } catch {
    throw new Error("Invalid payment form: malformed action URL.");
  }

  const isLocalhost =
    parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1";

  if (isLocalhost) {
    if (!allowMock) {
      throw new Error("Localhost payment form action is forbidden in production.");
    }
    return formEl;
  }

  if (parsedUrl.protocol !== "https:" || !isTrustedAlipayHost(parsedUrl.hostname)) {
    throw new Error(`Untrusted payment gateway action URL: ${parsedUrl.origin}`);
  }

  return formEl;
}

/**
 * Validates, imports, and submits a payment HTML form in the target document.
 */
export function submitPaymentForm(
  payData: string,
  options: PaymentFormOptions = {}
): HTMLFormElement {
  const targetDoc = options.targetDocument ?? document;
  const validatedForm = parseAndValidatePaymentForm(payData, options);
  const importedForm = targetDoc.importNode(validatedForm, true);
  importedForm.style.display = "none";
  targetDoc.body.appendChild(importedForm);
  HTMLFormElement.prototype.submit.call(importedForm);
  return importedForm;
}
