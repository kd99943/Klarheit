import type { ARFrameConfig } from "../ar/types";
import { normalizeRoutePath, track } from "./analytics";
import { getStoredAccountOwner } from "../lib/privacy";

export interface ProductSku {
  id: number;
  productId: number;
  finishId: string;
  sizeSpec: string;
  supplierName?: string | null;
  onHandQty?: number;
  reservedQty?: number;
  committedQty?: number;
  availableQty?: number;
  inStock?: boolean;
  lowStock?: boolean;
  stocktakeVerified?: boolean;
  stocktakeAt?: string | null;
  stocktakeBy?: string | null;
  salesStatus: "AVAILABLE" | "OUT_OF_STOCK" | "PAUSED" | "ARCHIVED" | string;
  restockEta: string | null;
  unitCost?: number | null;
}

export interface Product {
  id: number;
  name: string;
  material: string;
  nameEn: string;
  nameZh: string;
  materialEn: string;
  materialZh: string;
  basePrice: number;
  imageUrl: string;
  shape: string;
  specsSize: string;
  detailImages: string | null;
  arConfigs?: ARFrameConfig[];
  stockQuantity?: number;
  inStock?: boolean;
  lowStock?: boolean;
  salesStatus?: "AVAILABLE" | "OUT_OF_STOCK" | "PAUSED" | "ARCHIVED" | string;
  skus?: ProductSku[];
}

export interface UserProfile {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  phoneVerified: boolean;
  role: string;
}

export const STAFF_ROLES = new Set([
  "ADMIN",
  "CUSTOMER_SERVICE",
  "OPTICIAN",
  "WAREHOUSE",
  "FINANCE",
]);

export function isStaffRole(role?: string | null): boolean {
  return Boolean(role && STAFF_ROLES.has(role.toUpperCase()));
}

export interface PhoneStatus {
  maskedPhone: string | null;
  verified: boolean;
}

export interface AuthResponse {
  token?: string | null;
  user: UserProfile;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface OrderRequest {
  productId: number;
  skuId?: number;
  lensOptionTypes: string[];
  customer: {
    firstName: string;
    lastName?: string;
    email: string;
    phone?: string;
    shippingAddress: string;
    province?: string;
    city?: string;
    district?: string;
    detailAddress?: string;
  };
  prescription: {
    sphOd: number;
    sphOs: number;
    cylOd: number;
    cylOs: number;
    axisOd: number;
    axisOs: number;
    pd: number;
  };
  couponCode?: string;
  paymentChannel?: string;
  finishId?: string;
  idempotencyKey?: string;
  wearerName?: string;
  savePrescriptionToProfile?: boolean;
  sizeSpec?: string;
  orderSource?: string;
}

export interface DeliveryEstimate {
  deliverable: boolean;
  manualReviewRequired: boolean;
  shippingFee: number;
  minDays: number;
  maxDays: number;
  estimatedDeliveryDate: string | null;
  resolvedProvince: string | null;
  resolvedCity: string | null;
  reason: string;
}

export interface OrderResponse {
  orderNumber: string;
  status: string;
  totalAmount: number;
  productName: string;
  lensOptionTypes: string[];
  payData?: string;
  finishId?: string;
  skuId?: number | null;
  sizeSpecSnapshot?: string | null;
  quoteVersion?: number | null;
  shippingFee?: number | null;
}

export interface CouponValidateRequest {
  code: string;
  currentAmount: number;
}

export interface CouponValidateResponse {
  code: string;
  type: string;
  value: number;
  discountAmount: number;
}

export interface OrderSummary {
  orderNumber: string;
  status: string;
  totalAmount: number;
  productName: string;
  lensOptionTypes: string[];
  createdAt: string;
  fulfillmentStatus?: string;
}

export interface LensOption {
  id: number;
  type: string;
  category: string;
  label: string;
  description: string;
  indexValue: number;
  additionalPrice: number;
}

interface ApiErrorPayload {
  status?: number;
  error?: string;
  message?: string;
  path?: string;
  details?: string[];
}

const DEFAULT_API_BASE_URL = "http://localhost:8081/api/v1";
const runtimeEnv = (window as unknown as Record<string, Record<string, string>>).__ENV__;

const resolveApiBaseUrl = () => {
  const envVal = runtimeEnv?.VITE_API_BASE_URL?.trim();
  if (envVal && !envVal.startsWith("${")) {
    return envVal;
  }
  return import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;
};

const API_BASE_URL = resolveApiBaseUrl().replace(/\/$/, "");

if (import.meta.env.PROD && API_BASE_URL.includes("localhost")) {
  console.warn(
    "[Klarheit] API_BASE_URL is pointing to localhost in a production build. " +
    "Set VITE_API_BASE_URL at build time to your production API origin."
  );
}
const AUTH_TOKEN_KEY = "klarheit_auth_token";

export class ApiError extends Error {
  status: number;
  details: string[];
  path?: string;

  constructor(message: string, options: { status: number; details?: string[]; path?: string }) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.details = options.details ?? [];
    this.path = options.path;
  }
}

function getBrowserStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

let activeSessionHint = false;

export function markSessionActive(active: boolean) {
  activeSessionHint = active;
}

interface RequestOptions {
  suppressSessionExpired?: boolean;
}

async function request<T>(path: string, init?: RequestInit, options?: RequestOptions): Promise<T> {
  const headers = new Headers(init?.headers);

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const token = getStoredAuthToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      credentials: "include",
    });
  } catch {
    track("api_network_error", {
      endpoint: normalizeRoutePath(path),
      method: init?.method ?? "GET",
    });
    throw new ApiError("网络连接失败，请检查网络后重试", { status: 0 });
  }

  const contentType = response.headers.get("content-type");
  const payload: unknown = contentType?.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    if (response.status === 401 && !options?.suppressSessionExpired) {
      const hadActiveSession = Boolean(token || getStoredAccountOwner() || activeSessionHint);
      if (hadActiveSession) {
        activeSessionHint = false;
        logoutStoredAuthToken();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("klarheit:session-expired"));
        }
      }
    }
    if (!(response.status === 401 && options?.suppressSessionExpired)) {
      track("api_error", {
        status_code: response.status,
        endpoint: normalizeRoutePath(path),
        method: init?.method ?? "GET",
      });
    }
    let message = `Request failed with status ${response.status}`;

    if (typeof payload === "string" && payload.trim()) {
      message = payload;
    } else if (payload && typeof payload === "object") {
      const apiError = payload as ApiErrorPayload;
      if (apiError.message) {
        message = apiError.message;
      } else if (apiError.error) {
        message = apiError.error;
      }

      if (apiError.details?.length) {
        message = `${message} ${apiError.details.join(" ")}`;
      }

      throw new ApiError(message, {
        status: response.status,
        details: apiError.details,
        path: apiError.path,
      });
    }

    throw new ApiError(message, { status: response.status });
  }

  return payload as T;
}

export function fetchProducts(): Promise<Product[]> {
  return request<Product[]>("/products");
}

export function registerUser(payload: RegisterRequest): Promise<AuthResponse> {
  return request<AuthResponse>(
    "/auth/register",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { suppressSessionExpired: true }
  );
}

export function loginUser(payload: LoginRequest): Promise<AuthResponse> {
  return request<AuthResponse>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { suppressSessionExpired: true }
  );
}

export function logoutUser(): Promise<void> {
  return request<void>(
    "/auth/logout",
    {
      method: "POST",
    },
    { suppressSessionExpired: true }
  );
}

export function fetchCurrentUser(options?: RequestOptions): Promise<UserProfile> {
  return request<UserProfile>("/auth/me", undefined, options);
}

export function checkoutOrder(payload: OrderRequest): Promise<OrderResponse> {
  return request<OrderResponse>("/orders/checkout", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function estimateOrderDelivery(customer: OrderRequest["customer"]): Promise<DeliveryEstimate> {
  return request<DeliveryEstimate>("/orders/delivery-estimate", {
    method: "POST",
    body: JSON.stringify(customer),
  });
}

export function validateCouponApi(payload: CouponValidateRequest): Promise<CouponValidateResponse> {
  return request<CouponValidateResponse>("/coupons/validate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchMyOrders(): Promise<OrderSummary[]> {
  return request<OrderSummary[]>("/orders/my");
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export function fetchMyOrdersPaged(page = 0, size = 20): Promise<PageResponse<OrderSummary>> {
  return request<PageResponse<OrderSummary>>(`/orders/my/paged?page=${page}&size=${size}`);
}

export function fetchProductsPaged(page = 0, size = 20): Promise<PageResponse<Product>> {
  return request<PageResponse<Product>>(`/products/paged?page=${page}&size=${size}`);
}

export function fetchLensOptions(): Promise<LensOption[]> {
  return request<LensOption[]>("/lens-options");
}

export interface PrescriptionRecord {
  id: number;
  userEmail: string;
  sphOd: number;
  sphOs: number;
  cylOd: number;
  cylOs: number;
  axisOd: number;
  axisOs: number;
  pd: number;
  savedToProfile?: boolean;
  wearerName?: string | null;
  sourceNote?: string | null;
  createdAt?: string | null;
}

export function fetchLatestPrescription(): Promise<PrescriptionRecord | null> {
  return request("/prescriptions/me/latest");
}

export function savePrescription(payload: {
  sphOd: number;
  sphOs: number;
  cylOd: number;
  cylOs: number;
  axisOd: number;
  axisOs: number;
  pd: number;
  wearerName?: string;
  sourceNote?: string;
}): Promise<PrescriptionRecord> {
  return request<PrescriptionRecord>("/prescriptions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return request<void>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export interface CheckoutSystemStatus {
  checkoutEnabled: boolean;
  pauseReason: string;
}

export function fetchCheckoutSystemStatus(): Promise<CheckoutSystemStatus> {
  return request<CheckoutSystemStatus>("/system/checkout-status");
}

export function fetchArConfigs(): Promise<ARFrameConfig[]> {
  return request<ARFrameConfig[]>("/products/ar-configs");
}

export function getStoredAuthToken(): string | null {
  return getBrowserStorage()?.getItem(AUTH_TOKEN_KEY) ?? null;
}

export function setStoredAuthToken(token: string) {
  getBrowserStorage()?.setItem(AUTH_TOKEN_KEY, token);
}

export function logoutStoredAuthToken() {
  getBrowserStorage()?.removeItem(AUTH_TOKEN_KEY);
}

export function isApiErrorWithStatus(error: unknown, status: number) {
  return error instanceof ApiError && error.status === status;
}

export function getOrderStatus(orderNumber: string): Promise<{ status: string }> {
  return request<{ status: string }>(`/orders/${orderNumber}/status`);
}

export function triggerMockPayment(orderNumber: string, channel: string): Promise<string> {
  return request<string>("/payments/callback/mock-trigger", {
    method: "POST",
    body: JSON.stringify({ orderNumber, channel }),
  });
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

// ── Phone & SMS ──────────────────────────────────────────

export function sendSmsCode(phone: string): Promise<void> {
  return request<void>("/phone/send-code", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export function verifyAndBindPhone(phone: string, code: string): Promise<void> {
  return request<void>("/phone/verify-and-bind", {
    method: "POST",
    body: JSON.stringify({ phone, code }),
  });
}

export function getPhoneStatus(): Promise<PhoneStatus> {
  return request<PhoneStatus>("/phone/status");
}

export function resetPasswordViaSms(phone: string, code: string, newPassword: string): Promise<void> {
  return request<void>(
    "/auth/forgot-password",
    {
      method: "POST",
      body: JSON.stringify({ phone, code, newPassword }),
    },
    { suppressSessionExpired: true }
  );
}

// ── Address Book ──────────────────────────────────────────

export interface AddressRequest {
  recipientName: string;
  phoneNumber: string;
  province: string;
  city: string;
  district?: string;
  detailAddress: string;
  isDefault: boolean;
}

export interface AddressResponse {
  id: number;
  recipientName: string;
  phoneNumber: string;
  province: string;
  city: string;
  district?: string;
  detailAddress: string;
  isDefault: boolean;
}

export function fetchAddresses(): Promise<AddressResponse[]> {
  return request<AddressResponse[]>("/addresses");
}

export function createAddress(payload: AddressRequest): Promise<AddressResponse> {
  return request<AddressResponse>("/addresses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAddress(id: number, payload: AddressRequest): Promise<AddressResponse> {
  return request<AddressResponse>(`/addresses/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteAddress(id: number): Promise<void> {
  return request<void>(`/addresses/${id}`, {
    method: "DELETE",
  });
}

export function setDefaultAddress(id: number): Promise<AddressResponse> {
  return request<AddressResponse>(`/addresses/${id}/default`, {
    method: "POST",
  });
}

// ── Product Details & Filtering ───────────────────────────

export function fetchProductById(id: number): Promise<Product> {
  return request<Product>(`/products/${id}`);
}

export interface ProductFilterParams {
  search?: string;
  material?: string;
  shape?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
}

export function fetchProductsFiltered(params: ProductFilterParams): Promise<Product[]> {
  const query = new URLSearchParams();
  if (params.search) query.append("search", params.search);
  if (params.material) query.append("material", params.material);
  if (params.shape) query.append("shape", params.shape);
  if (params.minPrice !== undefined) query.append("minPrice", params.minPrice.toString());
  if (params.maxPrice !== undefined) query.append("maxPrice", params.maxPrice.toString());
  if (params.sortBy) query.append("sortBy", params.sortBy);

  const queryString = query.toString();
  return request<Product[]>(`/products${queryString ? "?" + queryString : ""}`);
}

// ── Order Details ──────────────────────────────────────────

export interface LensOptionDetail {
  type: string;
  label: string;
  additionalPrice: number;
}

export interface PrescriptionDetails {
  sphOd: number;
  sphOs: number;
  cylOd: number;
  cylOs: number;
  axisOd: number;
  axisOs: number;
  pd: number;
}

export interface QuoteVersionSummary {
  versionNumber: number;
  skuId?: number | null;
  finishId?: string | null;
  sizeSpec?: string | null;
  lensOptions?: LensOptionDetail[];
  quotedAmount?: number | null;
  promisedDeliveryDate?: string | null;
  expiresAt?: string | null;
  quoteNote?: string | null;
  changeSummary?: string | null;
  createdAt?: string | null;
  confirmedAt?: string | null;
}

export interface RefundTransactionRecord {
  refundRequestId: string;
  ticketNumber?: string | null;
  requestedAmount: number;
  confirmedAmount?: number | null;
  status: "REQUESTED" | "PENDING_CHANNEL" | "CONFIRMED" | "FAILED" | string;
  paymentChannel?: string | null;
  gatewayRefundId?: string | null;
  manualVoucherRef?: string | null;
  reason?: string | null;
  failureMessage?: string | null;
  requestedAt?: string | null;
  confirmedAt?: string | null;
  financeVerifiedBy?: string | null;
  financeVerifiedAt?: string | null;
}

export interface ShipmentEventRecord {
  eventType: string;
  carrier?: string | null;
  trackingNumber?: string | null;
  previousCarrier?: string | null;
  previousTrackingNumber?: string | null;
  note?: string | null;
  createdAt?: string | null;
}

export interface OrderDetailResponse {
  orderNumber: string;
  status: string;
  totalAmount: number;
  discountAmount: number;
  appliedCouponCode: string | null;
  createdAt: string;
  paidAt: string | null;
  customerFirstName: string;
  customerLastName: string;
  customerEmail: string;
  customerPhone?: string | null;
  shippingAddress: string;
  paymentChannel: string | null;
  gatewayTransactionId: string | null;
  finishId: string | null;
  productName: string;
  productImageUrl: string;
  lensOptions: LensOptionDetail[];
  prescription: PrescriptionDetails | null;
  carrier: string | null;
  trackingNumber: string | null;
  fulfillmentStatus?: string | null;
  fulfillmentNote?: string | null;
  estimatedDeliveryDate?: string | null;
  deliveredAt?: string | null;
  wearerName?: string | null;
  refundAmount?: number | null;
  refundReason?: string | null;
  skuId?: number | null;
  sizeSpecSnapshot?: string | null;
  initialPromisedDeliveryDate?: string | null;
  deliveryDelayReason?: string | null;
  requiresPrepayReview?: boolean | null;
  prepayReviewReason?: string | null;
  quoteNote?: string | null;
  quoteRevisedAmount?: number | null;
  customerQuoteConfirmedAt?: string | null;
  opticianVerifiedBy?: string | null;
  opticianVerifiedAt?: string | null;
  qcStatus?: string | null;
  qcNote?: string | null;
  qcCheckedBy?: string | null;
  qcCheckedAt?: string | null;
  orderSource?: string | null;
  variableCostAmount?: number | null;
  parentOrderNumber?: string | null;
  quoteVersion?: number | null;
  quoteExpiresAt?: string | null;
  reviewExpiresAt?: string | null;
  quoteChangeSummary?: string | null;
  prescriptionVersion?: number | null;
  opticianVerifiedRxVersion?: number | null;
  firstShippedAt?: string | null;
  shippingProvince?: string | null;
  shippingCity?: string | null;
  shippingDistrict?: string | null;
  shippingDetailAddress?: string | null;
  shippingFee?: number | null;
  deliveryReviewRequired?: boolean | null;
  initialPromisedSource?: string | null;
  confirmedRefundAmount?: number | null;
  pendingRefundAmount?: number | null;
  returnRestocked?: boolean | null;
  returnRestockedByTicket?: string | null;
  quoteHistory?: QuoteVersionSummary[];
  refundTransactions?: RefundTransactionRecord[];
  shipmentEvents?: ShipmentEventRecord[];
}

export function fetchOrderDetail(orderNumber: string): Promise<OrderDetailResponse> {
  return request<OrderDetailResponse>(`/orders/${orderNumber}`);
}

export function resumeOrderPayment(orderNumber: string, paymentChannel?: string): Promise<OrderResponse> {
  return request<OrderResponse>(`/orders/${orderNumber}/resume-payment`, {
    method: "POST",
    body: JSON.stringify(paymentChannel ? { paymentChannel } : {}),
  });
}

export function confirmOrderQuote(
  orderNumber: string,
  paymentChannel?: string,
  quoteVersion?: number
): Promise<OrderResponse> {
  const body: Record<string, unknown> = {};
  if (paymentChannel) body.paymentChannel = paymentChannel;
  if (quoteVersion !== undefined && quoteVersion !== null) body.quoteVersion = quoteVersion;
  return request<OrderResponse>(`/orders/${orderNumber}/confirm-quote`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function refreshOrderPaymentStatus(orderNumber: string): Promise<OrderDetailResponse> {
  return request<OrderDetailResponse>(`/orders/${orderNumber}/refresh-payment`, {
    method: "POST",
  });
}

export function cancelMyOrder(orderNumber: string): Promise<OrderDetailResponse> {
  return request<OrderDetailResponse>(`/orders/${orderNumber}/cancel`, {
    method: "POST",
  });
}

// ── After-Sales Support Tickets ────────────────────────────

export interface AfterSalesTicket {
  ticketNumber: string;
  orderNumber: string;
  category: string;
  reason: string;
  contactInfo: string | null;
  status: string;
  assignee: string | null;
  resolutionNote: string | null;
  nextContactAt: string | null;
  createdAt: string;
  updatedAt: string;
  returnCarrier?: string | null;
  returnTrackingNumber?: string | null;
  returnReceivedAt?: string | null;
  returnQcResult?: string | null;
  returnQcNote?: string | null;
  returnRestocked?: boolean;
  remakeOrderNumber?: string | null;
  remakeCarrier?: string | null;
  remakeTrackingNumber?: string | null;
  refundAmount?: number | null;
  refundTransactionId?: string | null;
  financeVerifiedBy?: string | null;
  financeVerifiedAt?: string | null;
  rootCause?: string | null;
  returnReceivedBy?: string | null;
  returnQcCheckedBy?: string | null;
  returnQcCheckedAt?: string | null;
  returnDisposition?: string | null;
  returnEvidenceNote?: string | null;
  remakeCostAmount?: number | null;
  returnShippingCost?: number | null;
  confirmedRefundAmount?: number | null;
  pendingRefundAmount?: number | null;
  refundTransactions?: RefundTransactionRecord[];
}

export function createAfterSalesTicket(
  orderNumber: string,
  payload: { category: string; reason: string; contactInfo?: string }
): Promise<AfterSalesTicket> {
  return request<AfterSalesTicket>(`/orders/${orderNumber}/after-sales`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchOrderAfterSalesTickets(orderNumber: string): Promise<AfterSalesTicket[]> {
  return request<AfterSalesTicket[]>(`/orders/${orderNumber}/after-sales`);
}

// ── Admin Dashboard ────────────────────────────────────────

export interface ContributionRow {
  key: string;
  orderCount: number;
  grossRevenue: number;
  refundedAmount: number;
  variableCost: number;
  netContribution: number;
  ticketCount: number;
}

export interface OnTimeDeliveryMetrics {
  dueCount: number;
  onTimeDeliveredCount: number;
  delayedCount: number;
  onTimeRatePct: number;
  cancelledCount: number;
  needsInfoCount: number;
  rescheduledCount: number;
  backfilledPromiseCount?: number;
}

export interface AdminStats {
  totalOrders: number;
  totalUsers: number;
  totalSales: number;
  grossReceipts?: number;
  totalRefunded?: number;
  confirmedRefunded?: number;
  pendingRefundAmount?: number;
  netRevenue?: number;
  totalVariableCost?: number;
  netContribution?: number;
  averageOrderValue: number;
  pendingReviewCount?: number;
  awaitingPrepayReviewCount?: number;
  quoteReadyCount?: number;
  expiredHoldCount?: number;
  refundPendingCount?: number;
  businessTimeZone?: string;
  onTimeDeliveryMetrics?: OnTimeDeliveryMetrics;
  contributionByProduct?: ContributionRow[];
  contributionBySource?: ContributionRow[];
  afterSalesByRootCause?: Record<string, number>;
}

export function adminFetchOrders(
  page = 0,
  size = 20,
  filters?: { status?: string; fulfillmentStatus?: string; search?: string; overdueOnly?: boolean }
): Promise<PageResponse<OrderSummary>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (filters?.status) params.set("status", filters.status);
  if (filters?.fulfillmentStatus) params.set("fulfillmentStatus", filters.fulfillmentStatus);
  if (filters?.search?.trim()) params.set("search", filters.search.trim());
  if (filters?.overdueOnly) params.set("overdueOnly", "true");
  return request<PageResponse<OrderSummary>>(`/admin/orders?${params.toString()}`);
}

export function adminFetchOrderDetail(orderNumber: string): Promise<OrderDetailResponse> {
  return request<OrderDetailResponse>(`/admin/orders/${orderNumber}`);
}

export function adminVerifyOptician(orderNumber: string, note?: string): Promise<OrderDetailResponse> {
  return request<OrderDetailResponse>(`/admin/orders/${orderNumber}/verify-optician`, {
    method: "POST",
    body: JSON.stringify(note ? { note } : {}),
  });
}

export function adminReviseOrderPrescription(
  orderNumber: string,
  prescription: PrescriptionDetails,
  note?: string
): Promise<OrderDetailResponse> {
  const qs = note ? `?note=${encodeURIComponent(note)}` : "";
  return request<OrderDetailResponse>(`/admin/orders/${orderNumber}/prescription${qs}`, {
    method: "PUT",
    body: JSON.stringify(prescription),
  });
}

export function adminStartProduction(
  orderNumber: string,
  payload?: { estimatedDeliveryDate?: string; note?: string }
): Promise<OrderDetailResponse> {
  return request<OrderDetailResponse>(`/admin/orders/${orderNumber}/start-production`, {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

export function adminRecordQcResult(
  orderNumber: string,
  payload: { qcStatus: "PASSED" | "FAILED" | string; qcNote?: string }
): Promise<OrderDetailResponse> {
  return request<OrderDetailResponse>(`/admin/orders/${orderNumber}/qc`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function adminShipOrder(orderNumber: string, carrier: string, trackingNumber: string): Promise<void> {
  return request<void>(`/admin/orders/${orderNumber}/ship`, {
    method: "POST",
    body: JSON.stringify({ carrier, trackingNumber }),
  });
}

export function adminUpdateTracking(
  orderNumber: string,
  payload: { carrier: string; trackingNumber: string; note?: string }
): Promise<void> {
  return request<void>(`/admin/orders/${orderNumber}/tracking`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function adminDeliverOrder(orderNumber: string, deliveredAt?: string): Promise<void> {
  return request<void>(`/admin/orders/${orderNumber}/deliver`, {
    method: "POST",
    body: deliveredAt ? JSON.stringify({ deliveredAt }) : undefined,
  });
}

export function adminUpdateFulfillment(
  orderNumber: string,
  payload: {
    fulfillmentStatus: string;
    fulfillmentNote?: string;
    estimatedDeliveryDate?: string;
    deliveryDelayReason?: string;
    opticianVerified?: boolean;
    qcStatus?: string;
    qcNote?: string;
  }
): Promise<void> {
  return request<void>(`/admin/orders/${orderNumber}/fulfillment`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function adminConfirmPrepayQuote(
  orderNumber: string,
  payload: {
    revisedTotalAmount?: number;
    estimatedDeliveryDate?: string;
    quoteNote?: string;
    targetSkuId?: number;
    targetFinishId?: string;
    targetSizeSpec?: string;
    revisedLensOptionTypes?: string[];
    quoteExpiresAt?: string;
    changeSummary?: string;
  }
): Promise<OrderDetailResponse> {
  return request<OrderDetailResponse>(`/admin/orders/${orderNumber}/quote-confirm`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function adminUpdateOrderEconomics(
  orderNumber: string,
  payload: {
    orderSource?: string;
    variableCostAmount?: number;
    shippingCostAmount?: number;
    paymentFeeAmount?: number;
  }
): Promise<OrderDetailResponse> {
  return request<OrderDetailResponse>(`/admin/orders/${orderNumber}/economics`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function adminFetchProductSkus(productId: number): Promise<ProductSku[]> {
  return request<ProductSku[]>(`/admin/products/${productId}/skus`);
}

export function adminUpsertProductSku(
  productId: number,
  payload: {
    finishId: string;
    sizeSpec: string;
    supplierName?: string;
    onHandQty: number;
    salesStatus?: string;
    restockEta?: string | null;
    unitCost?: number | null;
  }
): Promise<ProductSku> {
  return request<ProductSku>(`/admin/products/${productId}/skus`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export interface StocktakeImportItem {
  productId: number;
  finishId: string;
  sizeSpec: string;
  countedOnHandQty: number;
  supplierName?: string;
  unitCost?: number | null;
  salesStatus?: string;
  restockEta?: string | null;
}

export function adminImportStocktake(items: StocktakeImportItem[]): Promise<ProductSku[]> {
  return request<ProductSku[]>("/admin/inventory/stocktake-import", {
    method: "POST",
    body: JSON.stringify(items),
  });
}

export async function adminDownloadReconciliationCsv(from?: string, to?: string): Promise<void> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  const url = `${API_BASE_URL}/admin/reconciliation/export${qs ? `?${qs}` : ""}`;
  const token = getStoredAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const resp = await fetch(url, { headers, credentials: "include" });
  if (!resp.ok) {
    throw new Error(`Failed to export reconciliation CSV (${resp.status})`);
  }
  const blob = await resp.blob();
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = `klarheit-reconciliation${from ? `-${from}` : ""}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(downloadUrl);
}

export function adminUpdateOrderAddress(
  orderNumber: string,
  shippingAddress: string,
  customerPhone?: string,
  structured?: { province?: string; city?: string; district?: string; detailAddress?: string }
): Promise<void> {
  return request<void>(`/admin/orders/${orderNumber}/shipping-address`, {
    method: "PUT",
    body: JSON.stringify({
      shippingAddress,
      customerPhone: customerPhone || "",
      ...(structured?.province ? { province: structured.province } : {}),
      ...(structured?.city ? { city: structured.city } : {}),
      ...(structured?.district ? { district: structured.district } : {}),
      ...(structured?.detailAddress ? { detailAddress: structured.detailAddress } : {}),
    }),
  });
}

export function adminCancelOrder(orderNumber: string): Promise<void> {
  return request<void>(`/admin/orders/${orderNumber}/cancel`, {
    method: "POST",
  });
}

export function adminFetchStats(from?: string, to?: string): Promise<AdminStats> {
  const params = new URLSearchParams();
  if (from?.trim()) params.set("from", from.trim());
  if (to?.trim()) params.set("to", to.trim());
  const qs = params.toString();
  return request<AdminStats>(`/admin/stats${qs ? `?${qs}` : ""}`);
}

export function adminFetchCheckoutSetting(): Promise<CheckoutSystemStatus> {
  return request<CheckoutSystemStatus>("/admin/settings/checkout");
}

export function adminUpdateCheckoutSetting(
  checkoutEnabled: boolean,
  pauseReason: string
): Promise<CheckoutSystemStatus> {
  return request<CheckoutSystemStatus>("/admin/settings/checkout", {
    method: "PUT",
    body: JSON.stringify({ checkoutEnabled, pauseReason }),
  });
}

export function adminFetchAfterSalesTickets(
  status?: string,
  page = 0,
  size = 20
): Promise<PageResponse<AfterSalesTicket>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) params.set("status", status);
  return request<PageResponse<AfterSalesTicket>>(`/admin/after-sales?${params.toString()}`);
}

export function adminUpdateAfterSalesTicket(
  ticketNumber: string,
  payload: {
    status?: string;
    assignee?: string;
    resolutionNote?: string;
    nextContactAt?: string;
    returnCarrier?: string;
    returnTrackingNumber?: string;
    returnReceivedAt?: string;
    returnQcResult?: string;
    returnQcNote?: string;
    returnDisposition?: string;
    returnEvidenceNote?: string;
    remakeOrderNumber?: string;
    remakeCarrier?: string;
    remakeTrackingNumber?: string;
    remakeCostAmount?: number;
    returnShippingCost?: number;
    rootCause?: string;
  }
): Promise<AfterSalesTicket> {
  return request<AfterSalesTicket>(`/admin/after-sales/${ticketNumber}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function adminRestockAfterSalesTicket(ticketNumber: string): Promise<AfterSalesTicket> {
  return request<AfterSalesTicket>(`/admin/after-sales/${ticketNumber}/restock`, {
    method: "POST",
  });
}

export function adminRefundAfterSalesTicket(
  ticketNumber: string,
  payload: {
    refundAmount: number;
    refundReason?: string;
    refundTransactionId?: string;
    refundRequestId?: string;
  }
): Promise<AfterSalesTicket> {
  return request<AfterSalesTicket>(`/admin/after-sales/${ticketNumber}/refund`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function adminFinanceVerifyAfterSalesTicket(
  ticketNumber: string,
  payload?: { refundTransactionId?: string; note?: string }
): Promise<AfterSalesTicket> {
  return request<AfterSalesTicket>(`/admin/after-sales/${ticketNumber}/finance-verify`, {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
}

export function adminRetryRefundTransaction(refundRequestId: string): Promise<RefundTransactionRecord> {
  return request<RefundTransactionRecord>(`/admin/refunds/${encodeURIComponent(refundRequestId)}/retry`, {
    method: "POST",
  });
}

export function adminManualConfirmRefundTransaction(
  refundRequestId: string,
  payload: { confirmedAmount?: number; manualVoucherRef: string; note?: string }
): Promise<RefundTransactionRecord> {
  return request<RefundTransactionRecord>(`/admin/refunds/${encodeURIComponent(refundRequestId)}/manual-confirm`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface AuditLogEntry {
  id: number;
  timestamp: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string | null;
}

export function adminFetchAuditLogs(page = 0, size = 30): Promise<PageResponse<AuditLogEntry>> {
  return request<PageResponse<AuditLogEntry>>(`/admin/audit-logs?page=${page}&size=${size}`);
}

export interface ProductRequest {
  nameEn: string;
  nameZh: string;
  materialEn: string;
  materialZh: string;
  basePrice: number;
  imageUrl: string;
  shape?: string;
  specsSize?: string;
  detailImages?: string | null;
  stockQuantity?: number;
  salesStatus?: string;
}

export function adminFetchProducts(): Promise<Product[]> {
  return request<Product[]>("/admin/products");
}

export function adminCreateProduct(payload: ProductRequest): Promise<Product> {
  return request<Product>("/admin/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function adminUpdateProduct(id: number, payload: ProductRequest): Promise<Product> {
  return request<Product>(`/admin/products/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function adminDeleteProduct(id: number): Promise<void> {
  return request<void>(`/admin/products/${id}`, {
    method: "DELETE",
  });
}

export function adminFetchUsers(page = 0, size = 20): Promise<PageResponse<UserProfile>> {
  return request<PageResponse<UserProfile>>(`/admin/users?page=${page}&size=${size}`);
}

export function adminUpdateUserRole(userId: number, role: string): Promise<UserProfile> {
  return request<UserProfile>(`/admin/users/${userId}/role`, {
    method: "PUT",
    body: JSON.stringify({ role }),
  });
}

// ── Operational Alerts & Email Failure Outbox (Sec 6 P1) ───

export interface AdminAlertItem {
  key:
    | "AWAITING_REVIEW"
    | "EXPIRED_HOLDS"
    | "DELAYED_DELIVERY"
    | "UNRESOLVED_REFUNDS"
    | "FAILED_EMAILS"
    | "OVERDUE_AFTER_SALES"
    | string;
  severity: "CRITICAL" | "WARNING" | string;
  count: number;
  ownerRole: string;
}

export interface AdminAlertsSummary {
  generatedAt: string;
  businessTimeZone: string;
  totalActionable: number;
  alerts: AdminAlertItem[];
}

export interface EmailNotificationRecord {
  id: number;
  eventKey: string;
  eventType: string;
  orderNumber: string | null;
  recipientEmail: string;
  subject: string;
  status: "SENT" | "FAILED" | "PENDING" | string;
  attemptCount: number;
  lastError: string | null;
  lastAttemptedAt: string | null;
  sentAt: string | null;
  resentBy: string | null;
  createdAt: string;
}

export function adminFetchAlerts(): Promise<AdminAlertsSummary> {
  return request<AdminAlertsSummary>("/admin/alerts");
}

export function adminFetchNotifications(
  status?: string,
  page = 0,
  size = 20
): Promise<PageResponse<EmailNotificationRecord>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (status?.trim()) params.set("status", status.trim());
  return request<PageResponse<EmailNotificationRecord>>(`/admin/notifications?${params.toString()}`);
}

export function adminResendNotification(id: number): Promise<EmailNotificationRecord> {
  return request<EmailNotificationRecord>(`/admin/notifications/${id}/resend`, {
    method: "POST",
  });
}
