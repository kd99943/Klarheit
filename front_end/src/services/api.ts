import type { ARFrameConfig } from "../ar/types";

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
}

export interface UserProfile {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  phoneVerified: boolean;
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

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  const contentType = response.headers.get("content-type");
  const payload: unknown = contentType?.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
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
