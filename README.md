<div align="center">

![Klarheit Banner](https://img.shields.io/badge/Klarheit-Premium_Eyewear_Ecommerce-1a1a2e?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2UwYThhOSI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgMThjLTQuNDEgMC04LTMuNTktOC04czMuNTktOCA4LTggOCAzLjU5IDggOC0zLjU5IDgtOCA4eiIvPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjMiLz48L3N2Zz4=&labelColor=0f0f23&color=e0a899)

# Klarheit — 光学新零售 · AR 虚拟试戴电商平台

[![Java](https://img.shields.io/badge/Java_21-ED8B00?style=flat&logo=openjdk&logoColor=white)](https://www.oracle.com/java/)
[![Spring Boot](https://img.shields.io/badge/Spring_Boot_3-6DB33F?style=flat&logo=spring-boot&logoColor=white)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React_19-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)

*高端 D2C 眼镜电商解决方案 · 基于 MediaPipe + Three.js 的 WebAR 虚拟试戴 · 支付宝沙箱与本地 Mock 支付 · 企业级安全架构*

</div>

---

## 项目定位

Klarheit 是一个面向高端市场的 **直面消费者 (D2C) 眼镜电商平台**，核心差异化在于 **实时 AR 虚拟试戴** 功能。从产品发现到处方配镜、支付结算，提供完整的线上购镜体验。

### 核心特性

- **WebAR 实时试戴** — MediaPipe Face Landmarker 3D 面部追踪（478 点含虹膜特征点）+ Three.js 物理级材质渲染，支持侧脸三维正交基姿态对齐与 GPU/CPU 自动回退
- **高保真 3D 渲染** — 物理折射镜片 (IOR 1.56)、多层防反射膜、PCF 软阴影、摄影棚环境贴图
- **智能配镜向导** — 实时处方校验、动态镜片选项、购物车补配镜片闭环与完整数据传递至结账流程
- **支付与沙箱对账** — 支持支付宝沙箱集成、RSA2/HMAC-SHA256 回调验签、本地开发专用 Mock 收银台（生产环境物理隔离禁用）与超时主动查单/关单对账
- **企业级安全** — JWT 认证、IP 速率限制、支持 WebAssembly 的 CSP 安全策略、CORS 白名单、悲观行锁订单状态机
- **全球化就绪** — 中英文双语支持，locale-aware 价格/日期格式化与裸字符串扫描脚本
- **容器化部署** — Docker + Nginx 多阶段构建，支持构建期与运行时 API 地址注入，一键启动全栈环境

## 功能成熟度说明（实现 / 模拟可演示 / 实测通过 / 生产可用）

| 模块 | 当前成熟度 | 详细说明 |
|------|-----------|---------|
| 商品目录、配镜向导、购物车与结账单 | **实测通过 · 生产可用** | 支持详情页/AR 页/配镜页多入口加购、购物车未配镜补选防呆、服务端镜片动态计价、收件人电话快照、中文姓名自动拆分与付款后精确移除购物车项 |
| 用户认证、地址簿、处方档案与管理端履约 | **实测通过 · 生产可用** | JWT 鉴权、限流、管理端独立订单详情接口（`/api/v1/admin/orders/{orderNumber}`）、只读事务分页防懒加载异常、悲观锁撤单与幂等退券 |
| WebAR 虚拟试戴 | **已实现 · 单元测试与 CSP 校验通过** | 478 点关键点与 3D 正交基解算通过 Vitest 单元测试；Nginx CSP 已放行 `'wasm-unsafe-eval'` 并支持 GPU→CPU 自动降级（真机跨浏览器摄像头贴合度需按终端硬件实测） |
| 支付宝支付 (`ALIPAY`) | **沙箱可演示 · 协议实测通过** | 已对接 `Alipay EasySDK` 生成 `punchout_form` 自动提交、RSA2 异步回调验签、主动查单 (`Query`) 与关单 (`Close`)；配置真实支付宝商户证书后可用于生产 |
| 微信支付 (`WECHAT`) | **仅本地 Mock 可演示（生产已禁用）** | 本地 `local`/`test` 环境可通过内置 SVG 二维码与 `MockPaymentController` 演示扫码回调闭环；微信 V3 真实商户统一下单尚未接入，生产构建默认禁用该选项 |
| 短信验证码与邮件通知 | **模拟可演示 / 配置密钥后可用** | 默认提供开发态控制台 Mock 验证码与日志；配置 `RESEND_API_KEY` 后启用真实邮件发送 |
| 线下门店预约 (`/appointments`) | **Coming Soon 占位页** | 目前仅为前端展示占位页面，未计入已完成业务模块 |

## 技术架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Klarheit Platform                        │
├───────────────────────┬─────────────────────────────────────────┤
│      Frontend         │              Backend                    │
│  ┌─────────────────┐  │  ┌──────────────────────────────────┐  │
│  │  React 19        │  │  │  Spring Boot 3                   │  │
│  │  TypeScript      │  │  │  ├─ Spring Security + JWT        │  │
│  │  Vite            │◄─┼──┤  ├─ Spring Data JPA + Flyway     │  │
│  │  Tailwind CSS 4  │  │  │  ├─ Payment Service & Reconcile  │  │
│  │  Three.js        │  │  │  └─ SMS/Email Service            │  │
│  │  MediaPipe       │  │  └──────────────────────────────────┘  │
│  └─────────────────┘  │                    │                    │
├───────────────────────┼────────────────────┼────────────────────┤
│   WebAR Engine        │                    ▼                    │
│  ┌─────────────────┐  │  ┌──────────────────────────────────┐  │
│  │ Face Landmarker  │  │  │           MySQL 8.4              │  │
│  │ 3D Pose Solver   │  │  │  ┌──────┐ ┌────┐ ┌──────────┐  │  │
│  │ PBR Materials    │  │  │  │Users │ │Ords│ │Products  │  │  │
│  └─────────────────┘  │  │  └──────┘ └────┘ └──────────┘  │  │
│                       │  └──────────────────────────────────┘  │
└───────────────────────┴─────────────────────────────────────────┘
```

### 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19 | UI 框架 |
| TypeScript | 5.x | 类型安全 |
| Vite | 6.x | 构建工具 |
| Three.js | 最新 | 3D 渲染引擎 |
| MediaPipe | 最新 | 人脸关键点检测 |
| Tailwind CSS | 4 | 原子化样式 |
| React Router | 7.x | 路由管理 |
| i18next | 最新 | 国际化 |

### 后端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Java | 21 | 运行时 |
| Spring Boot | 3.x | 应用框架 |
| Spring Security | 6.x | 安全认证 |
| Spring Data JPA | 3.x | 数据访问 |
| Flyway | 最新 | 数据库迁移 (V1-V23) |
| MySQL | 8.4 | 持久化存储 |
| Maven | 3.9+ | 依赖管理 |

---

## 项目结构

```text
Klarheit/
├─ backend/                     # Spring Boot 后端
│  ├─ src/main/java/           # 业务代码
│  │  └─ com/klarheit/backend/
│  │     ├─ auth/              # 认证授权 (JWT + 手机验证)
│  │     ├─ product/           # 产品目录
│  │     ├─ order/             # 订单管理、履约状态与管理端履行
│  │     ├─ aftersales/        # 客户售后、改址与开票工单
│  │     ├─ settings/          # 系统运行开关（应急停单开关）
│  │     ├─ payment/           # 支付网关、本地 Mock 控制器与对账调度器
│  │     ├─ coupon/            # 优惠券系统
│  │     ├─ prescription/      # 处方管理
│  │     ├─ lens/              # 镜片选项
│  │     ├─ sms/               # 短信服务
│  │     ├─ email/             # 邮件通知
│  │     ├─ security/          # 安全配置
│  │     └─ config/            # 应用配置
│  ├─ src/main/resources/
│  │  └─ db/migration/         # Flyway 迁移脚本 (V1-V23)
│  └─ pom.xml
│
├─ front_end/                   # React + Vite 前端
│  ├─ src/
│  │  ├─ ar/                   # WebAR 引擎 (Three.js + MediaPipe)
│  │  ├─ auth/                 # 认证上下文
│  │  ├─ components/           # UI 组件库
│  │  ├─ hooks/                # 自定义 Hooks
│  │  ├─ i18n/                 # 国际化 (en/zh)
│  │  ├─ lib/                  # 工具函数 (支付表单解析、本地 SVG 二维码等)
│  │  ├─ pages/                # 页面组件
│  │  └─ services/             # API 服务层
│  ├─ public/                  # 静态资源 (images, models, wasm)
│  └─ package.json
│
├─ .github/workflows/ci.yml     # GitHub Actions 自动化验证流水线
├─ docs/                        # 部署与生产配置文档
│  ├─ DEPLOYMENT_EMAIL.md       # Resend 邮件服务与 DNS 配置指南
│  ├─ DEPLOYMENT_RAILWAY.md     # Railway 容器化部署指南
│  └─ PAYMENT_PRODUCTION_GUIDE.md # 支付网关生产配置与验收说明
├─ docker-compose.yml           # 容器编排
└─ PRODUCT_ROADMAP.md           # 产品路线图
```

---

## 快速开始

### 前置要求

- Java 21+
- Node.js 22+
- MySQL 8.x (或 Docker)
- Maven 3.9+

### 方式一：Docker Compose (推荐)

```bash
# 克隆仓库
git clone https://github.com/kd99943/Klarheit.git
cd Klarheit

# 配置环境变量
cp backend/.env.example backend/.env
# 编辑 backend/.env 设置 APP_JWT_SECRET 等必要配置

# 一键启动
docker-compose up --build -d
```

| 服务 | 地址 | 端口 |
|------|------|------|
| 前端 | http://localhost | 80 |
| 后端 API | http://localhost:8080 | 8080 |
| MySQL | localhost:3306 | 3306 |

### 方式二：本地开发

**前端**

```bash
cd front_end
npm install
npm run dev
# → http://localhost:3000
```

**后端**

```bash
cd backend

# 创建 .env 文件 (参考 .env.example)
cp .env.example .env
# 编辑数据库连接、JWT 密钥等配置

mvn spring-boot:run
# → http://localhost:8081
```

**数据库配置** ([backend/.env.example](./backend/.env.example))

```bash
SPRING_PROFILES_ACTIVE=local
SERVER_PORT=8081
DB_URL=jdbc:mysql://localhost:3306/klarheit?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
DB_USERNAME=root
DB_PASSWORD=your-password
APP_JWT_SECRET=your-base64-secret-at-least-32-bytes
```

> **测试说明**：
> - 后端单元测试（`*Test`）：无需外部数据库即可运行：`mvn test "-Dtest=*Test" "-Dspring.profiles.active=test"`
> - 后端数据库集成测试（`*IntegrationTest`）：已迁移至 **Testcontainers MySQL 8.4**（不再使用 H2），需本机或 CI 具备 Docker 环境运行：`mvn test "-Dspring.profiles.active=test"`
> - 前端检查与测试：`npm run lint`（`tsc --noEmit` 类型检查）、`npm run check-i18n`（裸字符串扫描）、`npm run test`（Vitest 单元测试）

---

## API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/v1/auth/register` | 用户注册 |
| `POST` | `/api/v1/auth/login` | 用户登录 |
| `GET` | `/api/v1/auth/me` | 获取当前用户 |
| `POST` | `/api/v1/auth/forgot-password` | 密码找回 |
| `POST` | `/api/v1/auth/change-password` | 已登录用户修改密码 |
| `GET` | `/api/v1/system/checkout-status` | 查询系统是否暂停接单（应急开关） |
| `GET` | `/api/v1/products` | 产品列表 |
| `GET` | `/api/v1/lens-options` | 镜片选项 |
| `POST` | `/api/v1/orders/checkout` | 创建订单（支持 `idempotencyKey` 防重与库存扣减） |
| `GET` | `/api/v1/orders/my` | 我的订单 |
| `GET` | `/api/v1/orders/{orderNumber}` | 客户订单详情 |
| `POST` | `/api/v1/orders/{orderNumber}/resume-payment` | 未付订单继续支付（先主动查单防重付） |
| `POST` | `/api/v1/orders/{orderNumber}/refresh-payment` | 主动核对网关支付状态 |
| `POST` | `/api/v1/orders/{orderNumber}/cancel` | 客户自助取消（未付或开工前已付自动退款） |
| `POST` / `GET` | `/api/v1/orders/{orderNumber}/after-sales` | 提交与查看订单售后/改址/开票工单 |
| `GET` | `/api/v1/admin/orders/{orderNumber}` | 管理员订单详情（另含履约更新、签收、售后、审计与停单开关） |
| `POST` | `/api/v1/payments/callback/{channel}` | 支付回调 |
| `POST` | `/api/v1/coupons/validate` | 验证优惠券 |
| `POST` | `/api/v1/phone/send-code` | 发送验证码 |
| `POST` | `/api/v1/phone/verify-and-bind` | 绑定手机号 |

---

## 部署注意事项

| 配置项 | 说明 | 必填 |
|--------|------|------|
| `APP_JWT_SECRET` | JWT 签名密钥 (`openssl rand -base64 32`) | ✅ |
| `PAYMENT_CALLBACK_SECRET` | 支付回调验签密钥 (`openssl rand -hex 32`) | ✅ |
| `APP_FRONTEND_URL` | 前端公网地址，用于拼接支付同步跳转地址 | ✅ |
| `APP_BACKEND_BASE_URL` | 后端公网地址，用于拼接支付宝异步通知回调地址 | ✅ |
| `VITE_API_BASE_URL` | 前端构建与运行时注入的 API 地址 (如 `http://localhost:8080/api/v1`) | ✅ |
| `API_ORIGIN` | 浏览器访问后端的 Origin (用于 Nginx CSP `connect-src`) | ✅ |
| `RESEND_API_KEY` | Resend 邮件服务密钥 | 可选 |
| `ALIPAY_APP_ID` / `ALIPAY_GATEWAY_URL` | 支付宝商户应用 ID 与完整网关地址（可选覆盖 `ALIPAY_NOTIFY_URL` / `ALIPAY_RETURN_URL`） | 可选 |

---

## 许可证

暂未添加开源许可证。

---

<div align="center">

**[ 产品路线图 ](./PRODUCT_ROADMAP.md)** · **[ 开发文档 ](./docs/)** · **[ 问题反馈 ](https://github.com/kd99943/Klarheit/issues)**

</div>
