// =============================================================================
// Klarheit 埋点清单 (Analytics Event Schema) + 轻量采集层
// =============================================================================
// 隐私原则:
//   - 严禁采集原始处方数值、姓名、邮箱、手机号、收货地址、原始订单号路径或自由搜索原文
//   - 动态路由统一归约为路由模板 (/order/:orderNumber, /product/:id)
//   - 会话 ID 持久化于 sessionStorage，同标签页刷新保持一致，退出/关闭标签页重置
// =============================================================================

export type AnalyticsEventName =
  // 1. 页面浏览
  | "page_viewed"
  // 2. Landing 交互
  | "landing_hero_cta_clicked"
  | "landing_section_viewed"
  | "landing_cta_final_clicked"
  // 3. 认证
  | "auth_drawer_opened"
  | "auth_signin_succeeded"
  | "auth_signin_failed"
  | "auth_signup_succeeded"
  | "auth_signup_failed"
  | "auth_signout_clicked"
  | "auth_password_reset_initiated"
  | "auth_password_reset_succeeded"
  | "auth_password_reset_failed"
  // 4. 产品浏览
  | "collections_viewed"
  | "product_card_clicked"
  | "product_details_viewed"
  | "product_filter_applied"
  | "product_search_used"
  | "cart_item_added"
  | "cart_item_removed"
  | "cart_cleared"
  | "cart_viewed"
  | "checkout_from_cart"
  // 5. AR 试戴
  | "ar_studio_entered"
  | "ar_camera_permission_requested"
  | "ar_camera_permission_granted"
  | "ar_camera_permission_denied"
  | "ar_face_detected"
  | "ar_face_lost"
  | "ar_product_switched"
  | "ar_screenshot_taken"
  | "ar_screenshot_downloaded"
  | "ar_save_configure_clicked"
  | "ar_studio_exited"
  | "ar_init_failed"
  | "ar_first_frame_ready"
  | "ar_asset_fallback_photo"
  // 6. 配镜向导
  | "config_lab_entered"
  | "config_step_completed"
  | "config_prescription_validation_failed"
  | "config_lens_selected"
  | "config_proceed_to_checkout_clicked"
  | "config_added_to_cart"
  // 7. 结账
  | "checkout_entered"
  | "checkout_coupon_applied"
  | "checkout_coupon_failed"
  | "checkout_payment_method_selected"
  | "checkout_submit_clicked"
  | "checkout_submit_failed"
  // 8. 订单
  | "order_created"
  | "order_payment_initiated"
  | "order_payment_succeeded"
  | "order_payment_failed"
  | "order_confirmation_viewed"
  | "orders_list_viewed"
  // 9. 个人账户
  | "account_page_viewed"
  | "profile_updated"
  | "phone_binding_initiated"
  | "phone_binding_succeeded"
  | "phone_binding_failed"
  | "address_added"
  | "address_deleted"
  // 10. 错误 & 异常
  | "error_displayed"
  | "api_error"
  | "api_network_error";

export type PrescriptionValidationErrorCode =
  | "required"
  | "invalid_number"
  | "out_of_range"
  | "invalid_step";

export interface AnalyticsEventProperties {
  page_viewed: { path: string; referrer?: string };
  landing_hero_cta_clicked: { cta_name: "virtual_try_on" | "browse_collection" };
  landing_section_viewed: {
    section: "hero" | "brand_story" | "structure" | "optics" | "trust" | "faq" | "cta";
  };
  landing_cta_final_clicked: { cta_name: "start_studio" | "explore_catalog" };
  auth_drawer_opened: { mode: "signin" | "signup" };
  auth_signin_succeeded: Record<string, never>;
  auth_signin_failed: { reason_code: string };
  auth_signup_succeeded: Record<string, never>;
  auth_signup_failed: { reason_code: string };
  auth_signout_clicked: Record<string, never>;
  auth_password_reset_initiated: Record<string, never>;
  auth_password_reset_succeeded: Record<string, never>;
  auth_password_reset_failed: { reason_code: string };
  collections_viewed: Record<string, never>;
  product_card_clicked: { product_id: string; product_name: string };
  product_details_viewed: { product_id: string };
  product_filter_applied: { filter_type: string; filter_value: string };
  product_search_used: { query_length: number; result_count: number };
  cart_item_added: {
    product_id: string;
    product_name: string;
    lens_count: number;
  };
  cart_item_removed: { item_id: string };
  cart_cleared: Record<string, never>;
  cart_viewed: { item_count: number };
  checkout_from_cart: { item_count: number; total_amount: number };
  ar_studio_entered: Record<string, never>;
  ar_camera_permission_requested: Record<string, never>;
  ar_camera_permission_granted: Record<string, never>;
  ar_camera_permission_denied: Record<string, never>;
  ar_face_detected: Record<string, never>;
  ar_face_lost: { duration_sec: number };
  ar_product_switched: { product_id: string; product_name: string };
  ar_screenshot_taken: { has_image: boolean };
  ar_screenshot_downloaded: Record<string, never>;
  ar_save_configure_clicked: {
    product_name: string;
    has_snapshot: boolean;
    has_pd: boolean;
  };
  ar_studio_exited: { duration_sec: number };
  ar_init_failed: { error_type: string };
  ar_first_frame_ready: { mode: "camera" | "model"; duration_ms: number };
  ar_asset_fallback_photo: { reason: "slow_load" | "manual" };
  config_lab_entered: Record<string, never>;
  config_step_completed: {
    step: "prescription" | "lens" | "review";
    duration_sec: number;
  };
  config_prescription_validation_failed: {
    field: string;
    error_code: PrescriptionValidationErrorCode;
  };
  config_lens_selected: { lens_option_id: string };
  config_proceed_to_checkout_clicked: Record<string, never>;
  config_added_to_cart: { product_name: string };
  checkout_entered: {
    from_source: "config_lab" | "product_details" | "navbar" | "other";
  };
  checkout_coupon_applied: { coupon_code: string };
  checkout_coupon_failed: { reason_code: string };
  checkout_payment_method_selected: { channel: "alipay" | "wechat" };
  checkout_submit_clicked: { channel: "alipay" | "wechat"; total_amount: number };
  checkout_submit_failed: { reason_code: string };
  order_created: { total_amount: number };
  order_payment_initiated: { channel: "alipay" | "wechat" };
  order_payment_succeeded: {
    channel: "alipay" | "wechat";
    duration_sec: number;
  };
  order_payment_failed: {
    channel: "alipay" | "wechat";
    reason_code: string;
  };
  order_confirmation_viewed: Record<string, never>;
  orders_list_viewed: Record<string, never>;
  account_page_viewed: Record<string, never>;
  profile_updated: { fields_changed: string[] };
  phone_binding_initiated: Record<string, never>;
  phone_binding_succeeded: Record<string, never>;
  phone_binding_failed: { reason_code: string };
  address_added: Record<string, never>;
  address_deleted: Record<string, never>;
  error_displayed: { error_type: string; message: string; page: string };
  api_error: { status_code: number; endpoint: string; method: string };
  api_network_error: { endpoint: string; method: string };
}

export interface TrackFn {
  <K extends AnalyticsEventName>(
    event: K,
    properties: AnalyticsEventProperties[K],
  ): void;
}

const SESSION_STORAGE_KEY = "klarheit_analytics_session_id";

function getOrCreateSessionId(): string {
  try {
    if (typeof sessionStorage !== "undefined") {
      const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (existing) return existing;
      const created =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(SESSION_STORAGE_KEY, created);
      return created;
    }
  } catch {
    // Private browsing fallback
  }
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/**
 * Normalize dynamic routes & API paths to templates so order numbers or IDs never leak into analytics.
 */
export function normalizeRoutePath(rawPath: string): string {
  const path = rawPath.split("?")[0];
  return path
    .replace(/^\/admin\/orders\/[^/]+/, "/admin/orders/:orderNumber")
    .replace(/^\/order\/[^/]+/, "/order/:orderNumber")
    .replace(/^\/product\/[^/]+/, "/product/:id")
    .replace(/\/orders\/KL-[^/]+/gi, "/orders/:orderNumber")
    .replace(/\/after-sales\/AS-[^/]+/gi, "/after-sales/:ticketNumber")
    .replace(/\/products\/\d+/g, "/products/:id")
    .replace(/\/addresses\/\d+/g, "/addresses/:id");
}

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

let userContext: { user_id?: string } = {};
let initialized = false;

export async function initAnalytics(): Promise<void> {
  if (initialized) return;
  initialized = true;

  if (!GA_MEASUREMENT_ID) {
    if (import.meta.env.DEV) {
      console.info(
        "[analytics] GA4 未配置 (VITE_GA_MEASUREMENT_ID 缺失), 事件仅输出到 console. 配置后将自动转发到 GA4.",
      );
    }
    return;
  }

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  const gtag = (...args: unknown[]) => {
    window.dataLayer!.push(args);
  };
  window.gtag = gtag as unknown as typeof window.gtag;
  gtag("js", new Date());
  gtag("config", GA_MEASUREMENT_ID, { send_page_view: false });
}

export function setUserContext(userId?: string): void {
  userContext = userId ? { user_id: userId } : {};
}

function getCommonProperties() {
  return {
    page_path: typeof window !== "undefined" ? normalizeRoutePath(window.location.pathname) : "",
    locale:
      typeof document !== "undefined"
        ? document.documentElement.lang || "zh"
        : "zh",
    timestamp: new Date().toISOString(),
    session_id: getOrCreateSessionId(),
    ...userContext,
  };
}

export const track: TrackFn = (event, properties) => {
  const payload = {
    event,
    ...properties,
    ...getCommonProperties(),
  };

  if (import.meta.env.DEV) {
    console.debug("[analytics]", event, properties);
  }

  if (GA_MEASUREMENT_ID && typeof window.gtag === "function") {
    window.gtag("event", event, payload);
  }
};

interface ImportMetaEnv {
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_API_BASE_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}
