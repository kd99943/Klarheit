import { describe, expect, test, vi } from "vitest";
import { parseAndValidatePaymentForm, submitPaymentForm } from "./paymentForm";

describe("paymentForm", () => {
  test("parses and submits real Alipay SDK punchout_form output", () => {
    const sdkHtml = `
      <form name="punchout_form" method="post" action="https://openapi.alipay.com/gateway.do?charset=utf-8&method=alipay.trade.page.pay&sign=ABC">
        <input type="hidden" name="biz_content" value='{"out_trade_no":"KL-20261026-0001","total_amount":"850.00"}' />
        <input type="submit" value="立即支付" style="display:none" />
      </form>
      <script>document.forms[0].submit();</script>
    `;

    const submitSpy = vi
      .spyOn(HTMLFormElement.prototype, "submit")
      .mockImplementation(() => {});

    const submitted = submitPaymentForm(sdkHtml, { allowMockEndpoint: false });
    expect(submitted.getAttribute("name")).toBe("punchout_form");
    expect(submitted.getAttribute("action")).toContain("https://openapi.alipay.com/gateway.do");
    expect(submitSpy).toHaveBeenCalledTimes(1);

    submitted.remove();
    submitSpy.mockRestore();
  });

  test("accepts Alipay sandbox gateway URL in production mode", () => {
    const sandboxHtml = `<form name="punchout_form" method="post" action="https://openapi-sandbox.dl.alipaydev.com/gateway.do?charset=utf-8"></form>`;
    const form = parseAndValidatePaymentForm(sandboxHtml, { allowMockEndpoint: false });
    expect(form.getAttribute("name")).toBe("punchout_form");
  });

  test("accepts local mock terminal form only when allowMockEndpoint is true", () => {
    const mockHtml = `<form id="alipay_submit" name="punchout_form" action="/api/v1/payments/callback/mock-terminal" method="POST">
      <input type="hidden" name="out_trade_no" value="KL-123" />
    </form>`;

    const devForm = parseAndValidatePaymentForm(mockHtml, { allowMockEndpoint: true });
    expect(devForm.id).toBe("alipay_submit");

    expect(() =>
      parseAndValidatePaymentForm(mockHtml, { allowMockEndpoint: false })
    ).toThrow(/forbidden in production/i);
  });

  test("throws when no form element exists in payData", () => {
    expect(() =>
      parseAndValidatePaymentForm("<div>No form here</div>", { allowMockEndpoint: true })
    ).toThrow(/no <form> element found/i);
  });

  test("throws when form action URL is missing or points to an untrusted host", () => {
    expect(() =>
      parseAndValidatePaymentForm('<form name="punchout_form"></form>', { allowMockEndpoint: true })
    ).toThrow(/missing form action URL/i);

    expect(() =>
      parseAndValidatePaymentForm(
        '<form name="punchout_form" action="https://evil.example.com/steal"></form>',
        { allowMockEndpoint: true }
      )
    ).toThrow(/Untrusted payment gateway action URL/i);
  });
});
