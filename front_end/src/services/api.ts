export interface Product {
  id: number;
  name: string;
  material: string;
  basePrice: number;
  imageUrl: string;
}

export interface UserProfile {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
}

export interface AuthResponse {
  token: string;
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
}

export interface OrderResponse {
  orderNumber: string;
  status: string;
  totalAmount: number;
  productName: string;
  lensOptionTypes: string[];
}

interface ApiErrorPayload {
  status?: number;
  error?: string;
  message?: string;
  path?: string;
  details?: string[];
}

const DEFAULT_API_BASE_URL = "http://localhost:8081/api/v1";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL).replace(/\/$/, "");
const AUTH_TOKEN_KEY = "lumina_auth_token";

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
  const authToken = getStoredAuthToken();
  const headers = new Headers(init?.headers);

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (authToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
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

export function fetchCurrentUser(): Promise<UserProfile> {
  return request<UserProfile>("/auth/me");
}

export function checkoutOrder(payload: OrderRequest): Promise<OrderResponse> {
  return request<OrderResponse>("/orders/checkout", {
    method: "POST",
    body: JSON.stringify(payload),
  });
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
