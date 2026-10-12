import type { ARFrameConfig } from "../ar/types";
import { track } from "./analytics";

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
  lensOptionTypes: string[];
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    shippingAddress: string;
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
}

export interface OrderResponse {
  orderNumber: string;
  status: string;
  totalAmount: number;
  productName: string;
  lensOptionTypes: string[];
  payData?: string;
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
  // Filter out unsubstituted env templates (e.g. "${VITE_API_BASE_URL}" in local development)
  if (envVal && !envVal.startsWith("${")) {
    return envVal;
  }
  return import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;
};

const API_BASE_URL = resolveApiBaseUrl().replace(/\/$/, "");

// Warn if running in production with localhost API URL
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  // Attach the JWT as a Bearer header when available. This works alongside the
  // httpOnly cookie (credentials: "include") and serves as a fallback when the
  // cookie is not stored (e.g. secure cookie rejected on local HTTP dev).
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
  } catch (networkError) {
    // fetch() 抛出 TypeError 的常见场景：
    //  - 网络断开 / 服务器不可达
    //  - CORS 被拒绝
    //  - DNS 解析失败
    // 浏览器原生错误消息是字面量 "Failed to fetch"，对用户不友好，统一转换为本地化提示。
    // status: 0 表示网络层失败，便于调用方区分业务错误与网络错误。
    track("api_network_error", {
      endpoint: path,
      method: init?.method ?? "GET",
    });
    throw new ApiError("网络连接失败，请检查网络后重试", { status: 0 });
  }

  const contentType = response.headers.get("content-type");
  const payload: unknown = contentType?.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    // On 401, clear any stale token so subsequent requests don't keep sending
    // an invalid Bearer header, and so the AuthProvider can detect logout.
    if (response.status === 401) {
      logoutStoredAuthToken();
    }
    track("api_error", {
      status_code: response.status,
      endpoint: path,
      method: init?.method ?? "GET",
    });
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
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginUser(payload: LoginRequest): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function logoutUser(): Promise<void> {
  return request<void>("/auth/logout", {
    method: "POST",
  });
}

export function fetchCurrentUser(): Promise<UserProfile> {
  return request<UserProfile>("/auth/me");
}

export function checkoutOrder(payload: OrderRequest): Promise<OrderResponse> {
  return request<OrderResponse>("/orders/checkout", {
    method: "POST",
    body: JSON.stringify(payload),
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

export function fetchLatestPrescription(): Promise<{
  id: number;
  userEmail: string;
  sphOd: number;
  sphOs: number;
  cylOd: number;
  cylOs: number;
  axisOd: number;
  axisOs: number;
  pd: number;
} | null> {
  return request("/prescriptions/me/latest");
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
  return request<void>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ phone, code, newPassword }),
  });
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
}

export function fetchOrderDetail(orderNumber: string): Promise<OrderDetailResponse> {
  return request<OrderDetailResponse>(`/orders/${orderNumber}`);
}

// ── Admin Dashboard ────────────────────────────────────────

export interface AdminStats {
  totalOrders: number;
  totalUsers: number;
  totalSales: number;
  averageOrderValue: number;
}

export function adminFetchOrders(page = 0, size = 20): Promise<PageResponse<OrderSummary>> {
  return request<PageResponse<OrderSummary>>(`/admin/orders?page=${page}&size=${size}`);
}

export function adminShipOrder(orderNumber: string, carrier: string, trackingNumber: string): Promise<void> {
  return request<void>(`/admin/orders/${orderNumber}/ship`, {
    method: "POST",
    body: JSON.stringify({ carrier, trackingNumber }),
  });
}

export function adminCancelOrder(orderNumber: string): Promise<void> {
  return request<void>(`/admin/orders/${orderNumber}/cancel`, {
    method: "POST",
  });
}

export function adminFetchStats(): Promise<AdminStats> {
  return request<AdminStats>("/admin/stats");
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
