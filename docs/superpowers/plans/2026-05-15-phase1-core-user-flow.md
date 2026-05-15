# Phase 1: Core User Flow Closure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users to complete the full "Browse → Configure Lens → Checkout → Confirm → View Order" purchase flow.

**Architecture:** Frontend ConfigLab wizard manages prescription state and lens selection, passes data to Checkout via React Router state. Backend adds order history endpoint and Resend email integration via Spring RestClient.

**Tech Stack:** React + TypeScript (Vite), Spring Boot 3 + JPA + Flyway, Resend (REST API), MySQL

---

## File Structure

### Backend
- Create: `backend/src/main/resources/db/migration/V2__add_orders_created_at.sql`
- Modify: `backend/src/main/java/com/klarheit/backend/order/Order.java`
- Modify: `backend/src/main/java/com/klarheit/backend/order/OrderRepository.java`
- Create: `backend/src/main/java/com/klarheit/backend/order/dto/OrderSummaryDTO.java`
- Modify: `backend/src/main/java/com/klarheit/backend/order/OrderController.java`
- Modify: `backend/src/main/java/com/klarheit/backend/order/OrderService.java`
- Create: `backend/src/main/java/com/klarheit/backend/email/EmailService.java`
- Modify: `backend/src/main/java/com/klarheit/backend/KlarheitBackendApplication.java`
- Modify: `backend/src/main/resources/application.yml`
- Modify: `backend/pom.xml`

### Frontend
- Modify: `front_end/src/services/api.ts`
- Create: `front_end/src/hooks/useOrders.ts`
- Create: `front_end/src/hooks/useLensOptions.ts`
- Rewrite: `front_end/src/pages/ConfigLab.tsx`
- Modify: `front_end/src/pages/Checkout.tsx`
- Create: `front_end/src/pages/OrderConfirmationPage.tsx`
- Modify: `front_end/src/pages/MyAccountPage.tsx`
- Modify: `front_end/src/App.tsx`

---

## Task 1: Flyway Migration — Add `created_at` to Orders

**Files:**
- Create: `backend/src/main/resources/db/migration/V2__add_orders_created_at.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- backend/src/main/resources/db/migration/V2__add_orders_created_at.sql
ALTER TABLE orders ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
```

- [ ] **Step 2: Verify migration runs**

Run: `cd backend && ./mvnw flyway:info -Dflyway.url=jdbc:mysql://localhost:3306/klarheit -Dflyway.user=root -Dflyway.password=root`
Expected: V2 appears in the migration list as pending

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/resources/db/migration/V2__add_orders_created_at.sql
git commit -m "feat(db): add created_at column to orders table"
```

---

## Task 2: Order Entity — Add `createdAt` Field

**Files:**
- Modify: `backend/src/main/java/com/klarheit/backend/order/Order.java`

- [ ] **Step 1: Add createdAt field to Order entity**

Add the following import at the top of Order.java:

```java
import jakarta.persistence.PrePersist;
import java.time.LocalDateTime;
```

Add the field after the `lensOptionTypes` field:

```java
@Column(name = "created_at", nullable = false)
private LocalDateTime createdAt;
```

Add getter and setter after the existing getters/setters:

```java
public LocalDateTime getCreatedAt() { return createdAt; }
public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
```

Add `@PrePersist` method before the Builder class:

```java
@PrePersist
protected void onCreate() {
    if (createdAt == null) {
        createdAt = LocalDateTime.now();
    }
}
```

Add builder method in the Builder class:

```java
public Builder createdAt(LocalDateTime createdAt) { instance.createdAt = createdAt; return this; }
```

- [ ] **Step 2: Compile to verify**

Run: `cd backend && ./mvnw compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/klarheit/backend/order/Order.java
git commit -m "feat(order): add createdAt field to Order entity"
```

---

## Task 3: OrderRepository — Add Query for User Orders

**Files:**
- Modify: `backend/src/main/java/com/klarheit/backend/order/OrderRepository.java`

- [ ] **Step 1: Add query method**

Add the following import:

```java
import java.util.List;
```

Add the query method to the interface:

```java
List<Order> findByUserEmailOrderByCreatedAtDesc(String userEmail);
```

- [ ] **Step 2: Compile to verify**

Run: `cd backend && ./mvnw compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/klarheit/backend/order/OrderRepository.java
git commit -m "feat(order): add user order history query to repository"
```

---

## Task 4: OrderSummaryDTO + GET /api/v1/orders/my Endpoint

**Files:**
- Create: `backend/src/main/java/com/klarheit/backend/order/dto/OrderSummaryDTO.java`
- Modify: `backend/src/main/java/com/klarheit/backend/order/OrderController.java`
- Modify: `backend/src/main/java/com/klarheit/backend/order/OrderService.java`

- [ ] **Step 1: Create OrderSummaryDTO**

```java
// backend/src/main/java/com/klarheit/backend/order/dto/OrderSummaryDTO.java
package com.klarheit.backend.order.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record OrderSummaryDTO(
        String orderNumber,
        String status,
        BigDecimal totalAmount,
        String productName,
        List<String> lensOptionTypes,
        LocalDateTime createdAt
) {}
```

- [ ] **Step 2: Add getMyOrders to OrderService**

Add the following import:

```java
import com.klarheit.backend.order.dto.OrderSummaryDTO;
import java.util.Arrays;
import java.util.List;
```

Add the method after the `checkout` method:

```java
public List<OrderSummaryDTO> getMyOrders(String authenticatedEmail) {
    return orderRepository.findByUserEmailOrderByCreatedAtDesc(authenticatedEmail)
            .stream()
            .map(order -> new OrderSummaryDTO(
                    order.getOrderNumber(),
                    order.getStatus(),
                    order.getTotalAmount(),
                    order.getProduct().getName(),
                    Arrays.asList(order.getLensOptionTypes().split(",")),
                    order.getCreatedAt()
            ))
            .toList();
}
```

- [ ] **Step 3: Add endpoint to OrderController**

Add the following imports:

```java
import com.klarheit.backend.order.dto.OrderSummaryDTO;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
```

Add the endpoint after the existing `checkout` method:

```java
@GetMapping("/my")
public ResponseEntity<List<OrderSummaryDTO>> myOrders(Authentication authentication) {
    return ResponseEntity.ok(orderService.getMyOrders(authentication.getName()));
}
```

- [ ] **Step 4: Compile to verify**

Run: `cd backend && ./mvnw compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/klarheit/backend/order/dto/OrderSummaryDTO.java
git add backend/src/main/java/com/klarheit/backend/order/OrderController.java
git add backend/src/main/java/com/klarheit/backend/order/OrderService.java
git commit -m "feat(order): add GET /api/v1/orders/my endpoint"
```

---

## Task 5: EmailService with Resend

**Files:**
- Create: `backend/src/main/java/com/klarheit/backend/email/EmailService.java`
- Modify: `backend/src/main/resources/application.yml`
- Modify: `backend/src/main/java/com/klarheit/backend/KlarheitBackendApplication.java`

- [ ] **Step 1: Add Resend config to application.yml**

Append to the `app` section in `application.yml`:

```yaml
  resend:
    api-key: ${RESEND_API_KEY:}
    from-email: ${RESEND_FROM_EMAIL:orders@klarheit.com}
```

- [ ] **Step 2: Create EmailService**

```java
// backend/src/main/java/com/klarheit/backend/email/EmailService.java
package com.klarheit.backend.email;

import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class EmailService {
    private static final Logger log = LoggerFactory.getLogger(EmailService.class);
    private static final String RESEND_API_URL = "https://api.resend.com/emails";

    private final RestClient restClient;
    private final String apiKey;
    private final String fromEmail;

    public EmailService(
            RestClient.Builder restClientBuilder,
            @Value("${app.resend.api-key:}") String apiKey,
            @Value("${app.resend.from-email:orders@klarheit.com}") String fromEmail) {
        this.restClient = restClientBuilder.baseUrl(RESEND_API_URL).build();
        this.apiKey = apiKey;
        this.fromEmail = fromEmail;
    }

    @Async
    public void sendOrderConfirmation(String to, String orderNumber, String productName, String totalAmount) {
        if (apiKey.isBlank()) {
            log.warn("Resend API key not configured. Skipping email to {} for order {}", to, orderNumber);
            return;
        }

        String subject = "Order Confirmed — " + orderNumber;
        String htmlBody = """
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h1 style="color: #0f172a;">Thank you for your order!</h1>
                  <p>Your Klarheit order has been confirmed.</p>
                  <table style="width: 100%%; border-collapse: collapse; margin: 20px 0;">
                    <tr>
                      <td style="padding: 8px 0; color: #64748b;">Order Number</td>
                      <td style="padding: 8px 0; font-weight: bold;">%s</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #64748b;">Product</td>
                      <td style="padding: 8px 0;">%s</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #64748b;">Total</td>
                      <td style="padding: 8px 0; font-weight: bold;">$%s</td>
                    </tr>
                  </table>
                  <p style="color: #64748b;">Estimated delivery: 14 business days</p>
                  <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                  <p style="color: #94a3b8; font-size: 12px;">Klarheit — Swiss Precision Eyewear</p>
                </div>
                """.formatted(orderNumber, productName, totalAmount);

        try {
            restClient.post()
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + apiKey)
                    .body(Map.of(
                            "from", fromEmail,
                            "to", to,
                            "subject", subject,
                            "html", htmlBody))
                    .retrieve()
                    .toBodilessEntity();
            log.info("Order confirmation email sent to {} for order {}", to, orderNumber);
        } catch (Exception e) {
            log.error("Failed to send order confirmation email to {} for order {}: {}", to, orderNumber, e.getMessage());
        }
    }
}
```

- [ ] **Step 3: Add @EnableAsync to application class**

Add the following import to `KlarheitBackendApplication.java`:

```java
import org.springframework.scheduling.annotation.EnableAsync;
```

Add the annotation to the class:

```java
@SpringBootApplication
@EnableAsync
public class KlarheitBackendApplication {
```

- [ ] **Step 4: Compile to verify**

Run: `cd backend && ./mvnw compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/klarheit/backend/email/EmailService.java
git add backend/src/main/resources/application.yml
git add backend/src/main/java/com/klarheit/backend/KlarheitBackendApplication.java
git commit -m "feat(email): add Resend email service for order confirmations"
```

---

## Task 6: Integrate Email into OrderService

**Files:**
- Modify: `backend/src/main/java/com/klarheit/backend/order/OrderService.java`

- [ ] **Step 1: Inject EmailService and call it after order creation**

Add the import:

```java
import com.klarheit.backend.email.EmailService;
```

Add the field and constructor parameter:

```java
private final EmailService emailService;

public OrderService(ProductRepository productRepository, LensOptionRepository lensOptionRepository,
                    PrescriptionRepository prescriptionRepository, OrderRepository orderRepository,
                    UserAccountRepository userAccountRepository, EmailService emailService) {
    this.productRepository = productRepository;
    this.lensOptionRepository = lensOptionRepository;
    this.prescriptionRepository = prescriptionRepository;
    this.orderRepository = orderRepository;
    this.userAccountRepository = userAccountRepository;
    this.emailService = emailService;
}
```

Add the email call after the `log.info` line in the `checkout` method:

```java
emailService.sendOrderConfirmation(
        user.getEmail(),
        order.getOrderNumber(),
        product.getName(),
        totalAmount.toPlainString());
```

- [ ] **Step 2: Compile to verify**

Run: `cd backend && ./mvnw compile -q`
Expected: BUILD SUCCESS

- [ ] **Step 3: Commit**

```bash
git add backend/src/main/java/com/klarheit/backend/order/OrderService.java
git commit -m "feat(order): integrate email notification into checkout flow"
```

---

## Task 7: Frontend API Layer — New Types and Functions

**Files:**
- Modify: `front_end/src/services/api.ts`

- [ ] **Step 1: Add OrderSummary type and fetchMyOrders function**

Add the `OrderSummary` interface after the existing `OrderResponse` interface:

```typescript
export interface OrderSummary {
  orderNumber: string;
  status: string;
  totalAmount: number;
  productName: string;
  lensOptionTypes: string[];
  createdAt: string;
}
```

Add `LensOption` interface after `OrderSummary`:

```typescript
export interface LensOption {
  id: number;
  type: string;
  category: string;
  label: string;
  description: string;
  indexValue: number;
  additionalPrice: number;
}
```

Add the fetch functions after the existing `checkoutOrder` function:

```typescript
export function fetchMyOrders(): Promise<OrderSummary[]> {
  return request<OrderSummary[]>("/orders/my");
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd front_end && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add front_end/src/services/api.ts
git commit -m "feat(api): add order history, lens options, and prescription API functions"
```

---

## Task 8: useOrders and useLensOptions Hooks

**Files:**
- Create: `front_end/src/hooks/useOrders.ts`
- Create: `front_end/src/hooks/useLensOptions.ts`

- [ ] **Step 1: Create useOrders hook**

```typescript
// front_end/src/hooks/useOrders.ts
import { useCallback, useEffect, useState } from "react";
import { fetchMyOrders, type OrderSummary } from "../services/api";

export function useOrders() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchMyOrders();
      if (!signal?.aborted) {
        setOrders(data);
      }
    } catch (loadError) {
      if (!signal?.aborted) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load orders.");
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return { orders, isLoading, error };
}
```

- [ ] **Step 2: Create useLensOptions hook**

```typescript
// front_end/src/hooks/useLensOptions.ts
import { useCallback, useEffect, useState } from "react";
import { fetchLensOptions, type LensOption } from "../services/api";

export function useLensOptions() {
  const [options, setOptions] = useState<LensOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchLensOptions();
      if (!signal?.aborted) {
        setOptions(data);
      }
    } catch (loadError) {
      if (!signal?.aborted) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load lens options.");
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return { options, isLoading, error };
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd front_end && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add front_end/src/hooks/useOrders.ts front_end/src/hooks/useLensOptions.ts
git commit -m "feat(hooks): add useOrders and useLensOptions hooks"
```

---

## Task 9: ConfigLab Rewrite

**Files:**
- Rewrite: `front_end/src/pages/ConfigLab.tsx`

- [ ] **Step 1: Rewrite ConfigLab with validation, API lens options, and review step**

```tsx
// front_end/src/pages/ConfigLab.tsx
import { useEffect, useState } from "react";
import { ChevronRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useProducts } from "../hooks/useProducts";
import { useLensOptions } from "../hooks/useLensOptions";
import { Button } from "../components/ui/Button";
import { FormField } from "../components/ui/FormField";
import { cn } from "../lib/utils";
import { PageIntro } from "../components/ui/PageIntro";
import { SectionCard } from "../components/ui/SectionCard";

type Step = 1 | 2 | 3;

type PrescriptionForm = {
  sphOd: string;
  sphOs: string;
  cylOd: string;
  cylOs: string;
  axisOd: string;
  axisOs: string;
  pd: string;
};

type PrescriptionErrors = Partial<Record<keyof PrescriptionForm, string>>;

const PRESCRIPTION_RANGES = {
  sphOd: { min: -20, max: 20, label: "SPH OD" },
  sphOs: { min: -20, max: 20, label: "SPH OS" },
  cylOd: { min: -10, max: 10, label: "CYL OD" },
  cylOs: { min: -10, max: 10, label: "CYL OS" },
  axisOd: { min: 0, max: 180, label: "Axis OD" },
  axisOs: { min: 0, max: 180, label: "Axis OS" },
  pd: { min: 0, max: 80, label: "PD" },
} as const;

function validatePrescription(form: PrescriptionForm): PrescriptionErrors {
  const errors: PrescriptionErrors = {};
  for (const [key, range] of Object.entries(PRESCRIPTION_RANGES)) {
    const field = key as keyof PrescriptionForm;
    const val = form[field];
    if (!val.trim()) {
      errors[field] = `${range.label} is required`;
      continue;
    }
    const num = Number(val);
    if (!Number.isFinite(num)) {
      errors[field] = `${range.label} must be a number`;
    } else if (num < range.min || num > range.max) {
      errors[field] = `${range.label} must be between ${range.min} and ${range.max}`;
    }
  }
  return errors;
}

export function ConfigLab() {
  const navigate = useNavigate();
  const { products } = useProducts();
  const { options: lensOptions, isLoading: isLoadingLens } = useLensOptions();

  const [activeStep, setActiveStep] = useState<Step>(1);
  const [prescription, setPrescription] = useState<PrescriptionForm>({
    sphOd: "", sphOs: "", cylOd: "", cylOs: "", axisOd: "", axisOs: "", pd: "",
  });
  const [errors, setErrors] = useState<PrescriptionErrors>({});
  const [selectedLensTypes, setSelectedLensTypes] = useState<string[]>([]);

  const selectedProduct = products[0] ?? null;

  const steps = [
    { id: 1 as Step, label: "Prescription", description: "Sphere, cylinder, axis" },
    { id: 2 as Step, label: "Surface", description: "Coatings and lens behavior" },
    { id: 3 as Step, label: "Review", description: "Summary before order" },
  ];

  useEffect(() => {
    if (lensOptions.length > 0 && selectedLensTypes.length === 0) {
      setSelectedLensTypes([lensOptions[0].type]);
    }
  }, [lensOptions, selectedLensTypes.length]);

  function handlePrescriptionChange(field: keyof PrescriptionForm, value: string) {
    setPrescription((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function toggleLensType(type: string) {
    setSelectedLensTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  function handleNextStep() {
    if (activeStep === 1) {
      const validationErrors = validatePrescription(prescription);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
      }
    }
    if (activeStep < 3) {
      setActiveStep((s) => (s + 1) as Step);
    }
  }

  function handleInitializeOrder() {
    const validationErrors = validatePrescription(prescription);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setActiveStep(1);
      return;
    }
    navigate("/checkout", {
      state: {
        product: selectedProduct,
        prescription: {
          sphOd: Number(prescription.sphOd),
          sphOs: Number(prescription.sphOs),
          cylOd: Number(prescription.cylOd),
          cylOs: Number(prescription.cylOs),
          axisOd: Number(prescription.axisOd),
          axisOs: Number(prescription.axisOs),
          pd: Number(prescription.pd),
        },
        lensOptionTypes: selectedLensTypes,
      },
    });
  }

  const lensOptionsByCategory = {
    LENS: lensOptions.filter((o) => o.category === "LENS"),
    COATING: lensOptions.filter((o) => o.category === "COATING"),
  };

  const lensTotal = lensOptions
    .filter((o) => selectedLensTypes.includes(o.type))
    .reduce((sum, o) => sum + o.additionalPrice, 0);
  const totalPrice = (selectedProduct?.basePrice ?? 0) + lensTotal;

  return (
    <div className="flex-1 flex overflow-hidden bg-surface-offwhite">
      <aside className="hidden lg:flex w-24 border-r border-slate-200 flex-col items-center py-8 gap-8 shrink-0 bg-white/50">
        {steps.map((step) => (
          <button
            key={step.id}
            onClick={() => setActiveStep(step.id)}
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-mono transition-colors",
              activeStep === step.id
                ? "bg-brand-primary text-white shadow-sm"
                : "border border-slate-200 text-slate-400 hover:border-brand-primary hover:text-brand-primary bg-white"
            )}
          >
            {String(step.id).padStart(2, "0")}
          </button>
        ))}
        <div className="mt-auto mb-4">
          <div className="w-[1px] h-24 bg-slate-200"></div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-y-auto w-full">
        <div className="p-5 sm:p-8 lg:p-12 pb-4">
          <PageIntro
            eyebrow="Swiss Precision Customization Interface"
            title="Config Lab"
            description="Tune prescription values, select the surface stack, and review the optical build before moving to secure checkout."
            actions={
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Engine</p>
                <p className="mt-2 text-2xl font-display font-medium text-brand-primary">v2.4</p>
              </div>
            }
          />
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3 lg:hidden">
            {steps.map((step) => (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(step.id)}
                className={cn(
                  "rounded-2xl border px-4 py-4 text-left transition-colors",
                  activeStep === step.id ? "border-brand-primary bg-white" : "border-slate-200 bg-white/70"
                )}
              >
                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{String(step.id).padStart(2, "0")}</p>
                <p className="mt-2 text-sm font-semibold text-brand-primary">{step.label}</p>
                <p className="mt-1 text-xs text-slate-500">{step.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 p-5 sm:p-8 lg:p-12 pt-4">
          <div className="lg:col-span-8 flex flex-col gap-8">
            {activeStep === 1 && (
              <SectionCard
                eyebrow="Step 01"
                title="Optometric Prescription"
                description="Enter your prescription values. All fields are validated against optical standards."
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {(["sphOd", "sphOs", "cylOd", "cylOs", "axisOd", "axisOs", "pd"] as const).map((field) => (
                    <div key={field}>
                      <FormField
                        label={PRESCRIPTION_RANGES[field].label}
                        type="number"
                        step={field.startsWith("axis") ? "1" : "0.25"}
                        min={String(PRESCRIPTION_RANGES[field].min)}
                        max={String(PRESCRIPTION_RANGES[field].max)}
                        value={prescription[field]}
                        onChange={(e) => handlePrescriptionChange(field, e.target.value)}
                        hint={field === "pd" ? "Pupillary distance in mm" : undefined}
                      />
                      {errors[field] && (
                        <p className="text-xs text-red-500 mt-1">{errors[field]}</p>
                      )}
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {activeStep === 2 && (
              <SectionCard
                eyebrow="Step 02"
                title="Surface Details"
                description="Choose lens type and coatings from the available options."
              >
                {isLoadingLens ? (
                  <p className="text-sm text-slate-500">Loading lens options...</p>
                ) : (
                  <div className="flex flex-col gap-6">
                    {lensOptionsByCategory.LENS.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 mb-3">Lens Type</p>
                        {lensOptionsByCategory.LENS.map((option) => (
                          <div
                            key={option.id}
                            onClick={() => toggleLensType(option.type)}
                            className={cn(
                              "flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors mb-2",
                              selectedLensTypes.includes(option.type)
                                ? "border-brand-primary/50 bg-slate-50"
                                : "border-slate-200 hover:border-slate-300"
                            )}
                          >
                            <div>
                              <p className="text-sm font-semibold text-brand-primary">{option.label}</p>
                              <p className="text-xs text-slate-500 mt-1">{option.description}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-mono text-slate-600">${option.additionalPrice.toFixed(2)}</span>
                              <div className={cn(
                                "w-5 h-5 rounded-full border bg-white transition-all",
                                selectedLensTypes.includes(option.type) ? "border-[5px] border-brand-primary" : "border border-slate-300"
                              )} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {lensOptionsByCategory.COATING.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 mb-3">Coatings</p>
                        {lensOptionsByCategory.COATING.map((option) => (
                          <div
                            key={option.id}
                            onClick={() => toggleLensType(option.type)}
                            className={cn(
                              "flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors mb-2",
                              selectedLensTypes.includes(option.type)
                                ? "border-brand-primary/50 bg-slate-50"
                                : "border-slate-200 hover:border-slate-300"
                            )}
                          >
                            <div>
                              <p className="text-sm font-semibold text-brand-primary">{option.label}</p>
                              <p className="text-xs text-slate-500 mt-1">{option.description}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-mono text-slate-600">${option.additionalPrice.toFixed(2)}</span>
                              <div className={cn(
                                "w-5 h-5 rounded-full border bg-white transition-all",
                                selectedLensTypes.includes(option.type) ? "border-[5px] border-brand-primary" : "border border-slate-300"
                              )} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </SectionCard>
            )}

            {activeStep === 3 && (
              <SectionCard
                eyebrow="Step 03"
                title="Review & Confirm"
                description="Verify your configuration before proceeding to checkout."
              >
                <div className="flex flex-col gap-6">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 mb-3">Prescription</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {(["sphOd", "sphOs", "cylOd", "cylOs", "axisOd", "axisOs", "pd"] as const).map((field) => (
                        <div key={field} className="rounded-xl bg-slate-50 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{PRESCRIPTION_RANGES[field].label}</p>
                          <p className="mt-2 text-lg font-mono font-medium text-brand-primary">{prescription[field]}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 mb-3">Selected Options</p>
                    <div className="flex flex-col gap-2">
                      {lensOptions.filter((o) => selectedLensTypes.includes(o.type)).map((option) => (
                        <div key={option.id} className="flex justify-between items-center rounded-xl bg-slate-50 px-4 py-3">
                          <span className="text-sm font-medium text-brand-primary">{option.label}</span>
                          <span className="text-sm font-mono text-slate-600">${option.additionalPrice.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </SectionCard>
            )}
          </div>

          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="rounded-2xl border border-brand-primary/10 bg-brand-primary text-white p-6 sm:p-8 h-full flex flex-col justify-between shadow-xl relative overflow-hidden">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/5 rounded-full blur-3xl"></div>
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-10">
                  <div>
                    <h2 className="text-2xl font-display font-medium mb-1 tracking-wide">{selectedProduct?.name ?? "AERO X1"}</h2>
                    <p className="text-[10px] text-brand-cyan/80 uppercase tracking-widest font-semibold mt-2">{selectedProduct?.material ?? "Titanium"}</p>
                  </div>
                  <div className="bg-white/10 px-2 py-1 rounded text-[9px] font-mono tracking-widest border border-white/20">PREMIUM</div>
                </div>
                <ul className="space-y-6 text-sm">
                  <li className="flex flex-col gap-1 border-b border-white/10 pb-4">
                    <span className="text-white/50 text-xs font-medium">Frame</span>
                    <span className="font-semibold tracking-wide">{selectedProduct?.name ?? "—"}</span>
                  </li>
                  <li className="flex flex-col gap-1 border-b border-white/10 pb-4">
                    <span className="text-white/50 text-xs font-medium">Selected Options</span>
                    <span className="font-semibold tracking-wide">{selectedLensTypes.length} option{selectedLensTypes.length !== 1 ? "s" : ""}</span>
                  </li>
                </ul>
                <div className="mt-8 rounded-2xl bg-white/8 px-4 py-4 text-sm text-slate-200">
                  <div className="flex items-center gap-2 text-brand-cyan">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-[10px] uppercase tracking-[0.2em] font-semibold">Active Stage</span>
                  </div>
                  <p className="mt-2">{steps.find((step) => step.id === activeStep)?.description}</p>
                </div>
              </div>
              <div className="mt-12 relative z-10">
                <div className="flex justify-between items-end mb-8 font-display">
                  <span className="text-sm text-white/60 font-medium">Total Value</span>
                  <span className="text-3xl font-light tracking-tight text-white">${totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex flex-col gap-3">
                  {activeStep < 3 ? (
                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="w-full bg-white text-brand-primary py-4 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-slate-100 transition-colors rounded-sm flex items-center justify-center gap-2"
                    >
                      Next Step
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleInitializeOrder}
                      className="w-full bg-white text-brand-primary py-4 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-slate-100 transition-colors rounded-sm flex items-center justify-center gap-2"
                    >
                      Initialize Order
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd front_end && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add front_end/src/pages/ConfigLab.tsx
git commit -m "feat(config-lab): rewrite with validation, API lens options, and review step"
```

---

## Task 10: Checkout Enhancement — Receive ConfigLab Data

**Files:**
- Modify: `front_end/src/pages/Checkout.tsx`

- [ ] **Step 1: Update Checkout to receive and use ConfigLab data**

The Checkout page needs to:
1. Read `prescription` and `lensOptionTypes` from `location.state`
2. Pre-fill prescription fields if data exists from ConfigLab
3. Use dynamic lens options if provided from ConfigLab
4. Navigate to `/order-confirmation` after successful order

Replace the entire `Checkout.tsx` file:

```tsx
// front_end/src/pages/Checkout.tsx
import { CheckCircle2, ChevronRight, ShieldCheck } from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useProducts } from "../hooks/useProducts";
import { checkoutOrder, isApiErrorWithStatus, type Product } from "../services/api";
import { Button } from "../components/ui/Button";
import { PageIntro } from "../components/ui/PageIntro";
import { SectionCard } from "../components/ui/SectionCard";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

type CheckoutLocationState = {
  product?: Product;
  prescription?: {
    sphOd: number;
    sphOs: number;
    cylOd: number;
    cylOs: number;
    axisOd: number;
    axisOs: number;
    pd: number;
  };
  lensOptionTypes?: string[];
};

type CustomerForm = {
  firstName: string;
  lastName: string;
  email: string;
  shippingAddress: string;
};

type PrescriptionForm = {
  sphOd: string;
  sphOs: string;
  cylOd: string;
  cylOs: string;
  axisOd: string;
  axisOs: string;
  pd: string;
};

type PaymentForm = {
  cardNumber: string;
  expiry: string;
  cvc: string;
};

const LENS_LABELS: Record<string, string> = {
  HIGH_INDEX_174: "Custom Lenses (High-Index)",
  AR_ONYX: "Onyx AR Coating",
  HEV_BLUE: "HEV Filter",
};

const LENS_PRICES: Record<string, number> = {
  HIGH_INDEX_174: 215,
  AR_ONYX: 60,
  HEV_BLUE: 30,
};

export function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = location.state as CheckoutLocationState | null;
  const { user, openAuthModal } = useAuth();
  const { products, isLoading: isLoadingProducts, error: catalogError } = useProducts();

  const selectedProduct = routeState?.product ?? products[0] ?? null;
  const isLoadingProduct = !routeState?.product && isLoadingProducts;

  const prescriptionFromConfig = routeState?.prescription;
  const lensOptionTypesFromConfig = routeState?.lensOptionTypes;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerForm>({
    firstName: "",
    lastName: "",
    email: user?.email ?? "",
    shippingAddress: "",
  });
  const [prescription, setPrescription] = useState<PrescriptionForm>({
    sphOd: prescriptionFromConfig ? String(prescriptionFromConfig.sphOd) : "",
    sphOs: prescriptionFromConfig ? String(prescriptionFromConfig.sphOs) : "",
    cylOd: prescriptionFromConfig ? String(prescriptionFromConfig.cylOd) : "",
    cylOs: prescriptionFromConfig ? String(prescriptionFromConfig.cylOs) : "",
    axisOd: prescriptionFromConfig ? String(prescriptionFromConfig.axisOd) : "",
    axisOs: prescriptionFromConfig ? String(prescriptionFromConfig.axisOs) : "",
    pd: prescriptionFromConfig ? String(prescriptionFromConfig.pd) : "",
  });
  const [payment, setPayment] = useState<PaymentForm>({
    cardNumber: "",
    expiry: "",
    cvc: "",
  });

  const activeLensTypes = lensOptionTypesFromConfig ?? ["HIGH_INDEX_174", "AR_ONYX", "HEV_BLUE"];

  useEffect(() => {
    if (user) {
      setCustomer((current) => ({
        ...current,
        firstName: current.firstName || user.firstName,
        lastName: current.lastName || user.lastName,
        email: user.email,
      }));
    }
  }, [user]);

  const lensTotal = useMemo(
    () => activeLensTypes.reduce((total, type) => total + (LENS_PRICES[type] ?? 0), 0),
    [activeLensTypes]
  );
  const subtotal = (selectedProduct?.basePrice ?? 0) + lensTotal;
  const completionScore = [customer.firstName, customer.lastName, customer.email, customer.shippingAddress, payment.cardNumber, payment.expiry, payment.cvc]
    .filter((value) => value.trim()).length;
  const accountDisplayName = user ? `${user.firstName} ${user.lastName}`.trim() : "";

  function handleCustomerChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setCustomer((current) => ({ ...current, [name]: value }));
  }

  function handlePrescriptionChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setPrescription((current) => ({ ...current, [name]: value }));
  }

  function handlePaymentChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setPayment((current) => ({ ...current, [name]: value }));
  }

  function getNumericPrescription() {
    const numericPrescription = {
      sphOd: Number(prescription.sphOd),
      sphOs: Number(prescription.sphOs),
      cylOd: Number(prescription.cylOd),
      cylOs: Number(prescription.cylOs),
      axisOd: Number(prescription.axisOd),
      axisOs: Number(prescription.axisOs),
      pd: Number(prescription.pd),
    };

    return Object.values(numericPrescription).some((value) => !Number.isFinite(value)) ? null : numericPrescription;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProduct) {
      setSubmitError("Select a product before submitting checkout.");
      return;
    }

    const numericPrescription = getNumericPrescription();
    if (!numericPrescription) {
      setSubmitError("Prescription values must all be valid numbers.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await checkoutOrder({
        productId: selectedProduct.id,
        lensOptionTypes: activeLensTypes,
        customer: {
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          shippingAddress: customer.shippingAddress,
        },
        prescription: numericPrescription,
      });

      navigate("/order-confirmation", {
        state: {
          orderNumber: response.orderNumber,
          status: response.status,
          totalAmount: response.totalAmount,
          productName: response.productName,
          lensOptionTypes: response.lensOptionTypes,
          customer: {
            firstName: customer.firstName,
            lastName: customer.lastName,
            email: customer.email,
            shippingAddress: customer.shippingAddress,
          },
        },
      });
    } catch (error) {
      if (isApiErrorWithStatus(error, 401) || isApiErrorWithStatus(error, 403)) {
        openAuthModal({
          mode: "signin",
          message: "Your session expired before checkout completed. Sign in again to submit this order.",
          pendingNavigation: { path: "/checkout", state: { product: selectedProduct } },
        });
      }
      setSubmitError(error instanceof Error ? error.message : "Checkout failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex-1 w-full bg-surface-offwhite py-10 lg:py-16 px-5 sm:px-8">
      <form onSubmit={handleSubmit} className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        <div className="lg:col-span-7 flex flex-col gap-10">
          <PageIntro
            eyebrow="Secure Order"
            title="Finalize Commission"
            description="Confirm customer information, validate prescription values, and authorize payment for the current optical build."
            actions={
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm min-w-40">
                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Form Status</p>
                <p className="mt-2 text-2xl font-display font-medium text-brand-primary">{completionScore}/7</p>
              </div>
            }
          />

          <SectionCard title="Client Details" eyebrow="Step 01" description="Identity and delivery fields are required for the existing checkout request.">
            {user ? (
              <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50/80 px-5 py-4">
                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Account on file</p>
                <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-brand-primary">{accountDisplayName}</p>
                    <p className="text-sm text-slate-500">{user.email}</p>
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-brand-cyan">
                    Synced to checkout identity
                  </div>
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">First Name</label>
                <input name="firstName" value={customer.firstName} onChange={handleCustomerChange} required type="text" className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Last Name</label>
                <input name="lastName" value={customer.lastName} onChange={handleCustomerChange} required type="text" className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium" />
              </div>
            </div>
            <div className="flex flex-col gap-2 mb-6">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Email Address</label>
              <input name="email" value={customer.email} onChange={handleCustomerChange} required type="email" readOnly className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium" />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Shipping Address</label>
              <input name="shippingAddress" value={customer.shippingAddress} onChange={handleCustomerChange} required type="text" className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium" />
            </div>
          </SectionCard>

          <SectionCard title="Prescription Details" eyebrow="Step 02" description={prescriptionFromConfig ? "Prescription loaded from Config Lab. Values are pre-filled." : "All values remain mapped to the current backend order contract."}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {(["sphOd", "sphOs", "cylOd", "cylOs", "axisOd", "axisOs"] as const).map((field) => (
                <div key={field} className="flex flex-col gap-2">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{field.replace(/([A-Z])/g, " $1").toUpperCase()}</label>
                  <input
                    name={field}
                    value={prescription[field]}
                    onChange={handlePrescriptionChange}
                    required
                    step={field.startsWith("axis") ? "1" : "0.25"}
                    type="number"
                    className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium"
                  />
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 mt-6">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Pupillary Distance (PD)</label>
              <input name="pd" value={prescription.pd} onChange={handlePrescriptionChange} required min="40" max="80" step="0.5" type="number" className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-sm font-medium" />
            </div>
          </SectionCard>

          <SectionCard title="Payment Method" eyebrow="Step 03" description="Card fields stay client-side only here; no checkout protocol changes were introduced.">
            <div className="border border-brand-primary rounded-lg p-4 bg-slate-50 relative overflow-hidden mb-6">
              <div className="flex justify-between items-center z-10 relative">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full border-4 border-brand-primary bg-white"></div>
                  <span className="text-sm font-semibold text-brand-primary">Credit Card</span>
                </div>
                <div className="flex gap-2">
                  <div className="w-8 h-5 bg-slate-200 rounded shrink-0"></div>
                  <div className="w-8 h-5 bg-slate-200 rounded shrink-0"></div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 mb-6">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Card Number</label>
              <input name="cardNumber" value={payment.cardNumber} onChange={handlePaymentChange} required type="text" placeholder="0000 0000 0000 0000" className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-lg font-mono text-brand-primary" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2 relative">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Expiry</label>
                <input name="expiry" value={payment.expiry} onChange={handlePaymentChange} required type="text" placeholder="MM/YY" className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-lg font-mono text-brand-primary" />
              </div>
              <div className="flex flex-col gap-2 relative">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">CVC</label>
                <input name="cvc" value={payment.cvc} onChange={handlePaymentChange} required type="text" placeholder="123" className="w-full bg-transparent border-0 border-b border-slate-200 py-2 focus:ring-0 focus:border-brand-primary transition-colors text-lg font-mono text-brand-primary" />
              </div>
            </div>
          </SectionCard>

          {submitError ? <div className="border border-red-200 bg-red-50 text-red-700 px-6 py-4 rounded-xl text-sm">{submitError}</div> : null}
        </div>

        <div className="lg:col-span-5">
          <div className="bg-brand-primary text-white rounded-2xl p-6 sm:p-8 shadow-xl sticky top-28">
            <h2 className="text-lg font-display font-medium tracking-wide mb-8 border-b border-white/10 pb-4">Manifest</h2>

            {isLoadingProduct ? <div className="text-sm text-white/70 pb-6 mb-6 border-b border-white/10">Loading selected product...</div> : null}
            {catalogError ? <div className="text-sm text-red-200 pb-6 mb-6 border-b border-white/10">{catalogError}</div> : null}

            {selectedProduct ? (
              <div className="flex gap-4 sm:gap-6 items-center border-b border-white/10 pb-6 mb-6">
                <div className="w-20 h-20 bg-white rounded-lg flex items-center justify-center p-2 shrink-0 shadow-[0_12px_24px_-18px_rgba(15,23,42,0.8)]">
                  <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-contain mix-blend-multiply" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display font-medium text-lg">{selectedProduct.name}</h3>
                  <p className="text-[10px] text-brand-cyan uppercase tracking-widest font-semibold mt-1">{selectedProduct.material}</p>
                  <p className="text-white/60 text-xs mt-2 font-mono">ID: PR-{String(selectedProduct.id).padStart(4, "0")}</p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-sm">{currencyFormatter.format(selectedProduct.basePrice)}</span>
                </div>
              </div>
            ) : (
              <div className="border border-white/10 rounded-lg p-5 text-sm text-white/70 mb-6">
                No product selected. Return to the <Link to="/collections" className="underline underline-offset-4 text-white">collection</Link> and choose a frame first.
              </div>
            )}

            <div className="space-y-3 mb-8 text-sm">
              {activeLensTypes.map((type) => (
                <div key={type} className="flex justify-between text-white/70">
                  <span>{LENS_LABELS[type] ?? type}</span>
                  <span>{currencyFormatter.format(LENS_PRICES[type] ?? 0)}</span>
                </div>
              ))}
              <div className="flex justify-between text-white/70 pt-2 border-t border-white/5">
                <span>Subtotal</span>
                <span>{currencyFormatter.format(subtotal)}</span>
              </div>
              <div className="flex justify-between text-brand-cyan/80">
                <span>Complimentary Shipping</span>
                <span>{currencyFormatter.format(0)}</span>
              </div>
            </div>

            <div className="mb-8 rounded-2xl bg-white/8 px-4 py-4 text-sm text-slate-200">
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-white/50">Readiness</p>
              <p className="mt-2">Customer and payment fields are {completionScore >= 6 ? "nearly complete" : "still in progress"}.</p>
            </div>

            {user ? (
              <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-200">
                <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-white/50">Account Identity</p>
                <p className="mt-2 font-medium text-white">{accountDisplayName}</p>
                <p className="text-white/60">{user.email}</p>
              </div>
            ) : null}

            <div className="flex justify-between items-end mb-8 pt-6 border-t border-white/10">
              <span className="text-white/50 text-xs font-medium uppercase tracking-widest">Total Commission</span>
              <span className="text-3xl font-light tracking-tight">{currencyFormatter.format(subtotal)}</span>
            </div>

            <Button type="submit" disabled={isSubmitting || !selectedProduct || isLoadingProduct} className="w-full bg-white text-brand-primary hover:bg-slate-100 text-xs group">
              {isSubmitting ? "AUTHORIZING..." : "AUTHORIZE PAYMENT"}
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>

            <div className="mt-6 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-white/40 text-[10px] uppercase font-semibold tracking-widest justify-center">
                <CheckCircle2 className="w-3 h-3" />
                <span>Encrypted Transaction</span>
              </div>
              <div className="flex items-center gap-2 text-white/40 text-[10px] uppercase font-semibold tracking-widest justify-center">
                <ShieldCheck className="w-3 h-3" />
                <span>Swiss Data Privacy Active</span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd front_end && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add front_end/src/pages/Checkout.tsx
git commit -m "feat(checkout): receive ConfigLab data and navigate to confirmation page"
```

---

## Task 11: Order Confirmation Page

**Files:**
- Create: `front_end/src/pages/OrderConfirmationPage.tsx`
- Modify: `front_end/src/App.tsx`

- [ ] **Step 1: Create OrderConfirmationPage**

```tsx
// front_end/src/pages/OrderConfirmationPage.tsx
import { CheckCircle2, Package, Truck } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { PageIntro } from "../components/ui/PageIntro";
import { SectionCard } from "../components/ui/SectionCard";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

type OrderConfirmationState = {
  orderNumber?: string;
  status?: string;
  totalAmount?: number;
  productName?: string;
  lensOptionTypes?: string[];
  customer?: {
    firstName: string;
    lastName: string;
    email: string;
    shippingAddress: string;
  };
};

const LENS_LABELS: Record<string, string> = {
  HIGH_INDEX_174: "Custom Lenses (High-Index)",
  AR_ONYX: "Onyx AR Coating",
  HEV_BLUE: "HEV Filter",
};

export function OrderConfirmationPage() {
  const location = useLocation();
  const state = location.state as OrderConfirmationState | null;

  if (!state?.orderNumber) {
    return (
      <div className="flex-1 w-full bg-surface-offwhite py-10 lg:py-16 px-5 sm:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-slate-500">No order information found.</p>
          <Link to="/collections" className="mt-4 inline-block">
            <Button variant="outline-light">Browse Collections</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full bg-surface-offwhite py-10 lg:py-16 px-5 sm:px-8">
      <div className="max-w-3xl mx-auto flex flex-col gap-8">
        <PageIntro
          eyebrow="Order Confirmed"
          title="Thank You!"
          description="Your Klarheit optical commission has been received and is being prepared."
          actions={
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-700">Order Placed Successfully</p>
              </div>
            </div>
          }
        />

        <SectionCard eyebrow="Order Details" title={state.orderNumber} description="Your order has been confirmed and a confirmation email has been sent.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-slate-50 px-5 py-4">
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Product</p>
              <p className="mt-2 text-lg font-display font-medium text-brand-primary">{state.productName}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-5 py-4">
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Status</p>
              <p className="mt-2 text-lg font-display font-medium text-brand-primary">{state.status}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-5 py-4">
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Total</p>
              <p className="mt-2 text-lg font-display font-medium text-brand-primary">{currencyFormatter.format(state.totalAmount ?? 0)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-5 py-4">
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Shipping To</p>
              <p className="mt-2 text-sm text-brand-primary">{state.customer?.shippingAddress}</p>
            </div>
          </div>

          {state.lensOptionTypes && state.lensOptionTypes.length > 0 && (
            <div className="mt-6">
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400 mb-3">Lens Configuration</p>
              <div className="flex flex-col gap-2">
                {state.lensOptionTypes.map((type) => (
                  <div key={type} className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-brand-primary">
                    {LENS_LABELS[type] ?? type}
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard eyebrow="What's Next" title="Order Timeline" description="Here's what to expect with your Klarheit commission.">
          <div className="flex flex-col gap-4">
            {[
              { icon: CheckCircle2, label: "Order Confirmed", description: "Your order has been received and payment is being processed.", active: true },
              { icon: Package, label: "Lens Crafting", description: "Your custom lenses will be precision-crafted to your prescription.", active: false },
              { icon: Truck, label: "Shipped", description: "Your finished glasses will be shipped with tracking information.", active: false },
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${step.active ? "bg-brand-primary text-white" : "bg-slate-100 text-slate-400"}`}>
                  <step.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-brand-primary">{step.label}</p>
                  <p className="text-sm text-slate-500 mt-1">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link to="/my-account" className="w-full sm:w-auto">
            <Button variant="outline-light" className="w-full">View My Orders</Button>
          </Link>
          <Link to="/collections" className="w-full sm:w-auto">
            <Button variant="outline-light" className="w-full">Continue Shopping</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add route to App.tsx**

In `front_end/src/App.tsx`, add the import:

```typescript
import { OrderConfirmationPage } from "./pages/OrderConfirmationPage";
```

Add the route inside the `<Routes>` element, after the `/my-account` route:

```tsx
<Route
  path="order-confirmation"
  element={
    <ProtectedRoute message="Sign in to view your order confirmation.">
      <OrderConfirmationPage />
    </ProtectedRoute>
  }
/>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd front_end && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add front_end/src/pages/OrderConfirmationPage.tsx front_end/src/App.tsx
git commit -m "feat(order): add order confirmation page with timeline"
```

---

## Task 12: My Account — Real Order History

**Files:**
- Modify: `front_end/src/pages/MyAccountPage.tsx`

- [ ] **Step 1: Replace hardcoded data with real API calls**

Replace the entire `MyAccountPage.tsx`:

```tsx
// front_end/src/pages/MyAccountPage.tsx
import { CalendarDays, CheckCircle2, CreditCard, MapPin, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useOrders } from "../hooks/useOrders";
import { PageIntro } from "../components/ui/PageIntro";
import { SectionCard } from "../components/ui/SectionCard";
import { Button } from "../components/ui/Button";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function MyAccountPage() {
  const { user } = useAuth();
  const { orders, isLoading: isLoadingOrders, error: ordersError } = useOrders();

  const latestPrescription = orders.length > 0 ? null : null;

  return (
    <div className="flex-1 w-full bg-surface-offwhite px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8">
        <PageIntro
          eyebrow="Verified Account"
          title="My Account"
          description="Manage your Klarheit identity, optical profile, and recent order activity from one secure workspace."
          actions={
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm min-w-44">
              <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Profile Status</p>
              <p className="mt-2 flex items-center gap-2 text-lg font-display font-medium text-brand-primary">
                <ShieldCheck className="h-5 w-5 text-brand-cyan" />
                Verified
              </p>
            </div>
          }
        />

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-8">
            <SectionCard
              eyebrow="Identity"
              title="Account Overview"
              description="Primary contact details used for secure access, order correspondence, and prescription records."
            >
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary text-sm font-bold uppercase tracking-[0.2em] text-white">
                      {user ? `${user.firstName.slice(0, 1)}${user.lastName.slice(0, 1)}`.toUpperCase() : "KA"}
                    </div>
                    <div>
                      <p className="text-xl font-display font-medium text-brand-primary">
                        {user ? `${user.firstName} ${user.lastName}` : "Klarheit Client"}
                      </p>
                      <p className="text-sm text-slate-500">{user?.email ?? "client@klarheit.com"}</p>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-white px-4 py-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Member Since</p>
                      <p className="mt-2 text-sm font-medium text-brand-primary">April 2026</p>
                    </div>
                    <div className="rounded-xl bg-white px-4 py-4">
                      <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Account Tier</p>
                      <p className="mt-2 text-sm font-medium text-brand-primary">Verified Optical Client</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl bg-brand-primary p-5 text-white shadow-[0_24px_60px_-40px_rgba(15,23,42,0.45)]">
                  <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-white/55">Secure Access</p>
                  <p className="mt-3 text-lg font-display font-medium">Account health is stable.</p>
                  <p className="mt-2 text-sm text-white/70 leading-6">
                    Profile data, saved prescriptions, and checkout identity are aligned across the current session.
                  </p>
                  <div className="mt-5 rounded-2xl bg-white/8 px-4 py-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-brand-cyan font-semibold">Session</p>
                    <p className="mt-2 text-sm">FX-4920 secure channel active</p>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Order Activity"
              title="Recent Orders"
              description="Track current production status and revisit recent commissions."
            >
              {isLoadingOrders ? (
                <p className="text-sm text-slate-500">Loading orders...</p>
              ) : ordersError ? (
                <p className="text-sm text-red-500">{ordersError}</p>
              ) : orders.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-8 text-center">
                  <p className="text-sm text-slate-500">No orders yet.</p>
                  <Link to="/collections" className="mt-3 inline-block">
                    <Button variant="outline-light" className="text-xs">Browse Collections</Button>
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {orders.map((order) => (
                    <div key={order.orderNumber} className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.3)]">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">{order.orderNumber}</p>
                          <h3 className="mt-2 text-lg font-display font-medium text-brand-primary">{order.productName}</h3>
                          <p className="mt-1 text-sm text-slate-500">
                            {new Date(order.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:min-w-[360px]">
                          <div className="rounded-xl bg-slate-50 px-4 py-3">
                            <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Status</p>
                            <p className="mt-2 text-sm font-medium text-brand-primary">{order.status}</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 px-4 py-3">
                            <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Total</p>
                            <p className="mt-2 text-sm font-medium text-brand-primary">{currencyFormatter.format(order.totalAmount)}</p>
                          </div>
                          <div className="rounded-xl bg-slate-50 px-4 py-3 col-span-2 sm:col-span-1">
                            <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">Options</p>
                            <p className="mt-2 text-sm font-medium text-brand-primary">{order.lensOptionTypes.length} lens option{order.lensOptionTypes.length !== 1 ? "s" : ""}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          <div className="flex flex-col gap-6">
            <SectionCard
              eyebrow="Quick Actions"
              title="Account Controls"
              description="Use the most common account actions without leaving the current workspace."
              className="xl:sticky xl:top-28"
            >
              <div className="flex flex-col gap-3">
                {[
                  { icon: UserRound, label: "Profile Details", meta: "Identity" },
                  { icon: CreditCard, label: "Billing & Checkout", meta: "Orders", to: "/checkout" },
                  { icon: CalendarDays, label: "Appointments & Timeline", meta: "Schedule" },
                  { icon: MapPin, label: "Saved Addresses", meta: "Delivery" },
                ].map((item) => {
                  const content = (
                    <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-left transition-colors hover:bg-slate-50">
                      <span className="flex items-center gap-3 text-sm text-brand-primary">
                        <item.icon className="h-4 w-4" strokeWidth={1.5} />
                        {item.label}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{item.meta}</span>
                    </div>
                  );

                  return item.to ? (
                    <Link key={item.label} to={item.to}>
                      {content}
                    </Link>
                  ) : (
                    <div key={item.label}>{content}</div>
                  );
                })}
              </div>

              <div className="mt-5 rounded-2xl bg-brand-primary px-4 py-4 text-white">
                <div className="flex items-center gap-2 text-brand-cyan">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-[10px] uppercase tracking-[0.2em] font-semibold">Recommendation</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-white/80">
                  Refresh your prescription profile before placing a new optical commission to keep checkout aligned with your latest measurements.
                </p>
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Compliance"
              title="Security & Privacy"
              description="Core safeguards visible to the client account."
            >
              <div className="flex flex-col gap-3 text-sm text-slate-600">
                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-4">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-brand-cyan" />
                  <span>Authenticated session is active and tied to your verified email identity.</span>
                </div>
                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-4">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-brand-cyan" />
                  <span>Prescription and order data stay within the secure Klarheit account workspace.</span>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd front_end && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add front_end/src/pages/MyAccountPage.tsx
git commit -m "feat(account): replace hardcoded data with real order history from API"
```

---

## Task 13: End-to-End Verification

- [ ] **Step 1: Run backend tests**

Run: `cd backend && ./mvnw test`
Expected: All tests pass

- [ ] **Step 2: Run frontend type check**

Run: `cd front_end && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run frontend tests (if any)**

Run: `cd front_end && npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Start backend and frontend, test the flow manually**

1. Start backend: `cd backend && ./mvnw spring-boot:run`
2. Start frontend: `cd front_end && npm run dev`
3. Register/login
4. Go to Config Lab → enter prescription → select lens options → review → Initialize Order
5. Verify Checkout page has pre-filled prescription
6. Submit order → verify redirect to Order Confirmation page
7. Go to My Account → verify order appears in Recent Orders

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: address issues found during Phase 1 verification"
```

---

## Acceptance Criteria Checklist

- [ ] Complete flow: Register → Browse → ConfigLab (enter prescription, select lenses) → Checkout (pre-filled) → Submit → Order Confirmation page
- [ ] Order appears in My Account → Recent Orders with real data
- [ ] Prescription validation blocks invalid values in ConfigLab (SPH/CYL/AXIS/PD)
- [ ] Order confirmation email sent via Resend (if API key configured)
- [ ] All existing tests still pass
