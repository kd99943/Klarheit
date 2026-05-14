---
title: Phase 0 — 地基加固设计文档
date: 2026-05-14
status: approved
---

# Phase 0 — 地基加固

## 目标

在添加任何新功能之前，修复现有代码的安全和质量问题，消除技术债务。

## 实施策略

方案 B：前后端分层。先完成所有后端任务，再完成所有前端任务，最后统一提交推送到 GitHub。

---

## 后端设计

### 1. JWT 密钥安全

**问题：** `application-local.yml` 包含硬编码的 fallback JWT 密钥，且未被 `.gitignore` 排除，会随代码提交到 GitHub。

**解决方案：**
- 将 `application-local.yml` 加入根目录 `.gitignore`
- 创建 `application-local.yml.example` 作为模板（不含真实密钥）
- 主配置 `application.yml` 已正确使用 `${APP_JWT_SECRET}`（无 fallback），无需改动

### 2. CORS 白名单

**问题：** `CorsConfig.java` 使用 `List.of("*")` 允许所有来源。

**解决方案：**
- 改为从环境变量 `CORS_ALLOWED_ORIGINS` 读取，支持逗号分隔多个域名
- `application-local.yml.example` 中默认值为 `http://localhost:5173`
- 生产环境通过环境变量注入真实前端域名

### 3. 速率限制（Bucket4j）

**问题：** 认证接口无速率限制，存在暴力破解风险。

**解决方案：**
- `pom.xml` 添加 `bucket4j-core` 依赖
- 创建 `RateLimitFilter`（`OncePerRequestFilter`），仅对 `/api/v1/auth/login` 和 `/api/v1/auth/register` 生效
- 策略：每 IP 每分钟最多 10 次请求，超限返回 HTTP 429 和标准错误响应体
- 使用 `ConcurrentHashMap<String, Bucket>` 存储每 IP 的令牌桶（内存存储，适合单实例部署）

### 4. 处方输入校验

**问题：** `PrescriptionPayloadDTO` 和 `PrescriptionDetailsDTO` 中 SPH/CYL 字段缺少范围约束。

**解决方案：**
- SPH（球镜）：`@DecimalMin("-20.00") @DecimalMax("+20.00")`
- CYL（柱镜）：`@DecimalMin("-10.00") @DecimalMax("+10.00")`
- Axis 已有 `@DecimalMin("0") @DecimalMax("180")`，无需改动
- PD 已有 `@Positive`，补充 `@DecimalMax("80.00")`（正常范围 40-80mm）

### 5. 结构化日志

**问题：** 服务层无日志输出，生产环境难以排查问题。

**解决方案：**
- Spring Boot 已内置 Logback，无需额外依赖
- 在 `AuthService`、`OrderService`、`PrescriptionService` 中使用 `@Slf4j`（Lombok）
- 日志级别规范：
  - `INFO`：用户注册、登录成功、订单创建成功
  - `WARN`：登录失败（邮箱不存在或密码错误）、速率限制触发
  - `ERROR`：`ApiExceptionHandler` 中的未预期异常

### 6. 后端单元测试

**目标：** 覆盖核心业务逻辑，不依赖数据库。

**测试类：**
- `OrderServiceTest`：验证价格计算（frame + lens options = total）、重复 lens option 拒绝、无效 product/lens 抛出异常
- `AuthServiceTest`：验证邮箱规范化（大小写、空格）、重复注册拒绝

**框架：** JUnit 5 + Mockito（Spring Boot Test 已包含）

### 7. Flyway 数据库迁移

**问题：** 使用 `schema.sql` 直接初始化，无版本管理，无法追踪 schema 变更历史。

**解决方案：**
- `pom.xml` 添加 `flyway-core` 依赖
- 将 `schema.sql` 内容迁移为 `src/main/resources/db/migration/V1__init_schema.sql`
- 更新 `application.yml`：禁用 `spring.sql.init`，启用 `spring.flyway`
- 测试 profile 保持使用 H2 内存数据库，Flyway 自动在测试时运行迁移

---

## 前端设计

### 8. 清除硬编码处方默认值

**问题：** `ConfigLab.tsx` 和 `Checkout.tsx` 中有硬编码的处方值（`-2.25` 等），会误导用户以为这是他们的真实处方。

**解决方案：**
- `ConfigLab.tsx`：`FormField` 的 `defaultValue` 改为空字符串
- `Checkout.tsx`：处方初始状态 `sphOd`、`sphOs`、`cylOd`、`cylOs`、`axisOd`、`axisOs`、`pd` 全部改为 `""`

### 9. `useProducts` 共享 Hook

**问题：** `CollectionsPage.tsx` 和 `Checkout.tsx` 各自独立实现产品加载逻辑，代码重复。

**解决方案：**
- 创建 `src/hooks/useProducts.ts`，返回 `{ products, isLoading, error, retry }`
- 封装 `fetchProducts()` 调用、loading 状态、error 状态、取消逻辑（`isCancelled` 模式）
- `CollectionsPage.tsx` 和 `Checkout.tsx` 改用此 hook，删除各自的重复逻辑

### 10. Error Boundary

**问题：** 无全局错误边界，组件渲染错误会导致整个应用白屏。

**解决方案：**
- 创建 `src/components/ErrorBoundary.tsx`（React class component，因为 Error Boundary 必须是 class）
- 捕获子树渲染错误，显示友好的错误页面（包含"刷新页面"按钮）
- 在 `App.tsx` 的 `<BrowserRouter>` 内层包裹所有路由

### 11. 前端渲染测试

**框架：** Vitest + @testing-library/react + @testing-library/jest-dom + jsdom

**安装：**
```
vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

**测试文件：**
- `src/components/ui/Button.test.tsx`：渲染、disabled 状态、variant 样式
- `src/components/ui/FormField.test.tsx`：label 渲染、hint 显示
- `src/components/ErrorBoundary.test.tsx`：正常渲染子组件、捕获错误显示 fallback

---

## GitHub 推送策略

- 推送到 `main` 分支
- 打 tag `v0.0-phase0`
- 推送 tag 到远程

---

## 验收标准

- [ ] 安全扫描：`application-local.yml` 不在 git 追踪范围内
- [ ] CORS 仅允许配置的域名
- [ ] 认证接口超过 10 次/分钟返回 429
- [ ] 处方超范围值被后端拒绝（400）
- [ ] 所有后端集成测试通过
- [ ] 前端无控制台报错，所有页面正常渲染
- [ ] 前端处方字段初始为空
