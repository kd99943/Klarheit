// =============================================================================
// Klarheit 埋点清单 (Analytics Event Schema) + 轻量采集层
// =============================================================================
// 设计原则:
//   1. 事件命名 snake_case,「领域_动作_结果」结构 (如 ar_face_detected / checkout_submit_failed)
//   2. 每个事件强类型 properties — 调用方传错属性在编译期即可发现
//   3. Provider-agnostic: 默认仅 console.debug, 不依赖任何外部 SDK
//      配置 VITE_GA_MEASUREMENT_ID 后自动路由到 GA4 (按需动态加载 gtag)
//   4. 公共属性自动附加: page_path, locale, timestamp, session_id
//   5. 用户身份通过 setUserContext() 由 AuthProvider 注入, 不读 localStorage 推测
//
// 接入步骤 (后续接入 GA4):
//   1. 在 .env 配置 VITE_GA_MEASUREMENT_ID=G-XXXXXXX
//   2. main.tsx 已自动调用 initAnalytics()
//   3. 所有 track() 自动转发到 GA4, 无需改业务代码
// =============================================================================

// -----------------------------------------------------------------------------
// 一、事件清单 (Event Name Registry)
// -----------------------------------------------------------------------------
// 按用户旅程分 10 个域. 增加新事件时:
//   - 在 AnalyticsEventName 联合类型追加
//   - 在 AnalyticsEventProperties 配置对应 properties 类型
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// 二、事件属性 Schemas (Properties Schemas)
// -----------------------------------------------------------------------------
// 每个事件对应一份强类型 properties. Record<string, never> 表示无附加属性.
// -----------------------------------------------------------------------------

export interface AnalyticsEventProperties {
  // 1. 页面浏览
  page_viewed: { path: string; referrer?: string };
  // 2. Landing
  landing_hero_cta_clicked: { cta_name: "virtual_try_on" | "browse_collection" };
  landing_section_viewed: {
    section: "hero" | "brand_story" | "structure" | "optics" | "trust" | "faq" | "cta";
  };
  landing_cta_final_clicked: { cta_name: "start_studio" | "explore_catalog" };
  // 3. 认证
  auth_drawer_opened: { mode: "signin" | "signup" };
  auth_signin_succeeded: Record<string, never>;
  auth_signin_failed: { reason: string };
  auth_signup_succeeded: Record<string, never>;
  auth_signup_failed: { reason: string };
  auth_signout_clicked: Record<string, never>;
  auth_password_reset_initiated: Record<string, never>;
  auth_password_reset_succeeded: Record<string, never>;
  auth_password_reset_failed: { reason: string };
  // 4. 产品
  collections_viewed: Record<string, never>;
  product_card_clicked: { product_id: string; product_name: string };
  product_details_viewed: { product_id: string };
  product_filter_applied: { filter_type: string; filter_value: string };
  product_search_used: { query: string; result_count: number };
  cart_item_added: {
    product_id: string;
    product_name: string;
    lens_count: number;
  };
  cart_item_removed: { item_id: string };
  cart_cleared: Record<string, never>;
  cart_viewed: { item_count: number };
  checkout_from_cart: { item_count: number; total_amount: number };
  // 5. AR
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
  // 6. 配镜
  config_lab_entered: Record<string, never>;
  config_step_completed: {
    step: "prescription" | "lens" | "review";
    duration_sec: number;
  };
  config_prescription_validation_failed: { field: string; value: string };
  config_lens_selected: { lens_option_id: string };
  config_proceed_to_checkout_clicked: Record<string, never>;
  config_added_to_cart: { product_name: string };
  // 7. 结账
  checkout_entered: {
    from_source: "config_lab" | "product_details" | "navbar" | "other";
  };
  checkout_coupon_applied: { coupon_code: string };
  checkout_coupon_failed: { reason: string };
  checkout_payment_method_selected: { channel: "alipay" | "wechat" };
  checkout_submit_clicked: { channel: "alipay" | "wechat"; total_amount: number };
  checkout_submit_failed: { reason: string };
  // 8. 订单
  order_created: { order_id: string; total_amount: number };
  order_payment_initiated: { order_id: string; channel: "alipay" | "wechat" };
  order_payment_succeeded: {
    order_id: string;
    channel: "alipay" | "wechat";
    duration_sec: number;
  };
  order_payment_failed: {
    order_id: string;
    channel: "alipay" | "wechat";
    reason: string;
  };
  order_confirmation_viewed: { order_id: string };
  orders_list_viewed: Record<string, never>;
  // 9. 个人账户
  account_page_viewed: Record<string, never>;
  profile_updated: { fields_changed: string[] };
  phone_binding_initiated: Record<string, never>;
  phone_binding_succeeded: Record<string, never>;
  phone_binding_failed: { reason: string };
  address_added: Record<string, never>;
  address_deleted: Record<string, never>;
  // 10. 错误
  error_displayed: { error_type: string; message: string; page: string };
  api_error: { status_code: number; endpoint: string; method: string };
  api_network_error: { endpoint: string; method: string };
}

// -----------------------------------------------------------------------------
// 三、track() 类型签名
// -----------------------------------------------------------------------------

export interface TrackFn {
  <K extends AnalyticsEventName>(
    event: K,
    properties: AnalyticsEventProperties[K],
  ): void;
}

// -----------------------------------------------------------------------------
// 四、运行时实现
// -----------------------------------------------------------------------------

// 会话 ID (单次页面生命周期内一致, 刷新后变化)
const SESSION_ID =
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;

// GA4 Measurement ID, 通过 .env 注入
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;

// 用户上下文 (由 AuthProvider 在登录/登出时通过 setUserContext 注入)
let userContext: { user_id?: string } = {};

let initialized = false;

/**
 * 初始化埋点模块. 在 main.tsx 启动时调用一次.
 * - 未配置 VITE_GA_MEASUREMENT_ID 时仅 console.debug, 不发任何外部请求
 * - 配置后会动态加载 gtag.js 并初始化 GA4
 */
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

  // 动态加载 gtag.js (避免在未配置时拖慢首屏)
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script);

  // 初始化 dataLayer
  window.dataLayer = window.dataLayer || [];
  const gtag = (...args: unknown[]) => {
    window.dataLayer!.push(args);
  };
  window.gtag = gtag as unknown as typeof window.gtag;
  gtag("js", new Date());
  gtag("config", GA_MEASUREMENT_ID, { send_page_view: false });
}

/**
 * 设置/清除用户上下文. AuthProvider 登录成功后调 setUserContext(userId),
 * 登出时调 setUserContext() (无参) 清除.
 */
export function setUserContext(userId?: string): void {
  userContext = userId ? { user_id: userId } : {};
}

function getCommonProperties() {
  return {
    page_path: typeof window !== "undefined" ? window.location.pathname : "",
    locale:
      typeof document !== "undefined"
        ? document.documentElement.lang || "zh"
        : "zh",
    timestamp: new Date().toISOString(),
    session_id: SESSION_ID,
    ...userContext,
  };
}

/**
 * 触发埋点事件. Type-safe: 调用方传错 properties 在编译期报错.
 *
 * @example
 *   track("landing_hero_cta_clicked", { cta_name: "virtual_try_on" });
 *   track("ar_product_switched", { product_id: "aero_x1", product_name: "Aero X1" });
 */
export const track: TrackFn = (event, properties) => {
  const payload = {
    event,
    ...properties,
    ...getCommonProperties(),
  };

  // 1) 始终打到 console, 方便开发调试
  if (import.meta.env.DEV) {
    console.debug("[analytics]", event, properties);
  }

  // 2) 转发到 GA4 (若已配置并初始化)
  if (GA_MEASUREMENT_ID && typeof window.gtag === "function") {
    window.gtag("event", event, payload);
  }

  // 3) 预留钩子: 后续可扩展为发送到后端 /api/v1/analytics, 或切换 PostHog/Sentry adapter
  // navigator.sendBeacon("/api/v1/analytics", JSON.stringify(payload));
};

// TypeScript 类型增强: 让 import.meta.env 识别 VITE_GA_MEASUREMENT_ID
interface ImportMetaEnv {
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_API_BASE_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// gtag 全局类型声明
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}
