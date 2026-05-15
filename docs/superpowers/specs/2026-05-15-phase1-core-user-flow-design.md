# Phase 1: Core User Flow Closure — Design Spec

## Overview

**Goal:** Enable users to complete the full "Browse → Configure Lens → Checkout → Confirm → View Order" purchase flow.

**Scope:** Three workstreams — ConfigLab wizard fix, checkout confirmation flow, and order history in My Account.

---

## 1. ConfigLab Wizard Fix

### Current Problems
- Prescription fields (SPH/CYL/AXIS/PD) have no validation
- Lens surface options are hardcoded; not fetched from backend API
- No state persistence between steps — user data lost when navigating
- "Initialize Order" link passes no data to Checkout

### Design

**State Management:**
- Single `useState` object holds all prescription fields: `{ sphOd, sphOs, cylOd, cylOs, axisOd, axisOs, pd }`
- Single `useState` holds selected lens option types: `string[]`
- State persists across step navigation (already the case since it's component-level state)

**Validation (real-time, matching backend `PrescriptionDetailsDTO`):**
- SPH: -20.00 to +20.00, step 0.25
- CYL: -10.00 to +10.00, step 0.25
- AXIS: 0 to 180, integer
- PD: positive, max 80.00
- Validation errors shown inline below each field

**Lens Options (Step 02 — Surface Details):**
- Fetch from `GET /api/v1/lens-options` on mount
- Display options grouped by category (LENS vs COATING)
- Multi-select: user can pick lens type + coating(s)
- Selected options stored as `string[]` of type identifiers

**Step 03 (Review):**
- Summary showing: product info, all prescription values, selected lens options, total price
- "Initialize Order" button navigates to `/checkout` with state:

```typescript
navigate("/checkout", {
  state: {
    product: selectedProduct,
    prescription: { sphOd, sphOs, cylOd, cylOs, axisOd, axisOs, pd },
    lensOptionTypes: ["HIGH_INDEX_174", "AR_ONYX"]
  }
});
```

---

## 2. Checkout Flow Enhancement

### Current Problems
- Checkout doesn't receive prescription data from ConfigLab
- After successful order, shows inline text — no confirmation page
- No email notification

### Design

**Receiving ConfigLab Data:**
- Checkout reads `location.state` for `product`, `prescription`, `lensOptionTypes`
- If prescription data exists from ConfigLab, pre-fill the prescription section and mark it as read-only (with "Edit" button to unlock)
- If lens options exist from ConfigLab, use them instead of hardcoded `LENS_PACKAGE`
- If no state (direct navigation), fall back to current behavior (manual entry)

**Order Confirmation Page (new route `/order-confirmation`):**
- After `POST /orders/checkout` succeeds, navigate to `/order-confirmation` with state:

```typescript
navigate("/order-confirmation", {
  state: {
    orderNumber: response.orderNumber,
    status: response.status,
    totalAmount: response.totalAmount,
    productName: response.productName,
    lensOptionTypes: response.lensOptionTypes,
    customer: { firstName, lastName, email, shippingAddress }
  }
});
```

- Page displays: order number, product summary, lens options list, total, shipping address, estimated delivery (14 business days), email confirmation notice

---

## 3. My Account — Order History

### Current Problems
- `recentOrders` is hardcoded mock data
- `prescriptionStats` is hardcoded
- No real API integration

### Design

**Backend — New Endpoint:**
```
GET /api/v1/orders/my
Authorization: Bearer <token>
Response: List<OrderSummaryDTO>
```

```java
public record OrderSummaryDTO(
    String orderNumber,
    String status,
    BigDecimal totalAmount,
    String productName,
    List<String> lensOptionTypes,
    LocalDateTime createdAt
) {}
```

- Returns orders for the authenticated user, sorted by `createdAt` descending
- Uses existing `OrderRepository` with a new query method

**Frontend:**
- New `useOrders()` hook fetching from `GET /api/v1/orders/my`
- Replace hardcoded `recentOrders` with fetched data
- Clicking an order expands to show full details (prescription, lens options, shipping address)
- Add `createdAt` field to display order date

---

## 4. Backend — Resend Email Integration

### Design

**Approach:** Use Spring `RestClient` to call Resend REST API directly (no third-party SDK dependency).

**Configuration:**
```yaml
app:
  resend:
    api-key: ${RESEND_API_KEY:}
    from-email: ${RESEND_FROM_EMAIL:orders@klarheit.com}
```

**EmailService:**
```java
@Service
public class EmailService {
    void sendOrderConfirmation(String to, OrderConfirmationEmailData data);
}
```

**Integration Point:** Called in `OrderService.checkout()` after order creation, annotated with `@Async` to not block the checkout response. Requires `@EnableAsync` on the application class.

**Database Migration:** Add Flyway migration `V2__add_orders_created_at.sql` to add `created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP` to the orders table. The `Order` entity will get a `createdAt` field with `@PrePersist` auto-fill.

**Email Content:**
- Subject: "Order Confirmed — {orderNumber}"
- Body: Order number, product name, lens options, total, estimated delivery

---

## 5. New Routes (App.tsx)

| Path | Component | Auth Required |
|------|-----------|---------------|
| `/order-confirmation` | `OrderConfirmationPage` | Yes |

---

## 6. Files to Modify

### Backend (Java)
- `OrderController.java` — Add `GET /orders/my` endpoint
- `OrderService.java` — Add `getMyOrders()` method, add email send call
- `OrderRepository.java` — Add `findByUserEmailOrderByCreatedAtDesc()`
- `Order.java` — Add `createdAt` field with `@PrePersist`
- `OrderResponseDTO.java` — Add `createdAt` field
- New: `OrderSummaryDTO.java` — For list endpoint
- New: `EmailService.java` — Resend integration via RestClient
- New: `V2__add_orders_created_at.sql` — Flyway migration
- `KlarheitBackendApplication.java` — Add `@EnableAsync`

### Frontend (TypeScript/React)
- `ConfigLab.tsx` — Full rewrite: validation, API lens options, review step, navigate with state
- `Checkout.tsx` — Read state from ConfigLab, pre-fill, navigate to confirmation
- `MyAccountPage.tsx` — Fetch real orders, show real prescription
- `api.ts` — Add `fetchMyOrders()`, `fetchLatestPrescription()`, update `OrderResponse` type
- New: `OrderConfirmationPage.tsx` — Order success page
- New: `hooks/useOrders.ts` — Order fetching hook
- `App.tsx` — Add `/order-confirmation` route

---

## Acceptance Criteria

1. Complete flow: Register → Browse → ConfigLab (enter prescription, select lenses) → Checkout (pre-filled) → Submit → Order Confirmation page
2. Order appears in My Account → Recent Orders with real data
3. Prescription validation blocks invalid values in ConfigLab (SPH/CYL/AXIS/PD)
4. Order confirmation email sent via Resend
5. All existing tests still pass
