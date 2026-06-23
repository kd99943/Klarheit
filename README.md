<div align="center">

![Klarheit Banner](https://img.shields.io/badge/Klarheit-Premium_Eyewear_Ecommerce-1a1a2e?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2UwYThhOSI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgMThjLTQuNDEgMC04LTMuNTktOC04czMuNTktOCA4LTggOCAzLjU5IDggOC0zLjU5IDgtOCA4eiIvPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjMiLz48L3N2Zz4=&labelColor=0f0f23&color=e0a899)

# Klarheit — 光学新零售 · AR 虚拟试戴电商平台

[![Java](https://img.shields.io/badge/Java_21-ED8B00?style=flat&logo=openjdk&logoColor=white)](https://www.oracle.com/java/)
[![Spring Boot](https://img.shields.io/badge/Spring_Boot_3-6DB33F?style=flat&logo=spring-boot&logoColor=white)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React_19-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)

*高端 D2C 眼镜电商解决方案 · 基于 MediaPipe + Three.js 的 WebAR 虚拟试戴 · 支付宝/微信支付 · 企业级安全架构*

</div>

---

## 项目定位

Klarheit 是一个面向高端市场的 **直面消费者 (D2C) 眼镜电商平台**，核心差异化在于 **实时 AR 虚拟试戴** 功能。从产品发现到处方配镜、支付结算，提供完整的线上购镜体验。

### 核心特性

- **WebAR 实时试戴** — MediaPipe Face Landmarker 3D 面部追踪 + Three.js 物理级材质渲染，支持高达 90° 侧脸精准贴合
- **高保真 3D 渲染** — 物理折射镜片 (IOR 1.56)、多层防反射膜、PCF 软阴影、摄影棚环境贴图
- **智能配镜向导** — 实时处方校验、动态镜片选项、完整数据传递至结账流程
- **双通道支付** — 支付宝 + 微信支付沙箱集成，HMAC-SHA256 安全验签
- **企业级安全** — JWT 认证、IP 速率限制、CSP 安全策略、CORS 白名单
- **全球化就绪** — 中英文双语支持，locale-aware 价格/日期格式化
- **容器化部署** — Docker + Nginx 多阶段构建，一键启动全栈环境

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
│  │  Tailwind CSS 4  │  │  │  ├─ Payment Service (双通道)     │  │
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
| Flyway | 最新 | 数据库迁移 |
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
│  │     ├─ order/             # 订单管理
│  │     ├─ payment/           # 支付网关 (支付宝/微信)
│  │     ├─ coupon/            # 优惠券系统
│  │     ├─ prescription/      # 处方管理
│  │     ├─ lens/              # 镜片选项
│  │     ├─ sms/               # 短信服务
│  │     ├─ email/             # 邮件通知
│  │     ├─ security/          # 安全配置
│  │     └─ config/            # 应用配置
│  ├─ src/main/resources/
│  │  └─ db/migration/         # Flyway 迁移脚本 (V1-V10)
│  └─ pom.xml
│
├─ front_end/                   # React + Vite 前端
│  ├─ src/
│  │  ├─ ar/                   # WebAR 引擎 (Three.js + MediaPipe)
│  │  ├─ auth/                 # 认证上下文
│  │  ├─ components/           # UI 组件库
│  │  │  ├─ auth/              # 登录/注册/找回密码
│  │  │  ├─ layout/            # 布局组件 (Navbar, Footer)
│  │  │  ├─ profile/           # 个人资料
│  │  │  └─ ui/                # 通用 UI 组件
│  │  ├─ hooks/                # 自定义 Hooks
│  │  ├─ i18n/                 # 国际化 (en/zh)
│  │  ├─ pages/                # 页面组件
│  │  └─ services/             # API 服务层
│  ├─ public/                  # 静态资源
│  │  ├─ images/               # 产品图片
│  │  ├─ models/               # 3D 模型
│  │  └─ wasm/                 # WebAssembly 模块
│  └─ package.json
│
├─ docs/                        # 项目文档
│  ├─ archive/                 # 历史设计文档
│  └─ superpowers/             # 技术方案
│
├─ docker-compose.yml           # 容器编排
└─ PRODUCT_ROADMAP.md           # 产品路线图
```

---

## 已实现功能

### WebAR 虚拟试戴

> 自研 WebAR 引擎，基于 MediaPipe Face Landmarker + Three.js

- **3D 正交基姿态解算** — 通过左眼、右眼、鼻梁、鼻尖 4 个 3D 关键点构建空间坐标系，实现高达 90° 侧脸的精准贴合
- **物理精准材质渲染** — MeshPhysicalMaterial 折射镜片 (IOR 1.56)、蓝绿防反射膜 Sheen、1024×512 柔光箱环境贴图
- **PCF 软阴影** — shadow.radius = 4 的柔和面部投影，去除生硬阴影黑斑
- **无框镜架建模** — Silhouette 级 Rimless 钛金镜架，含穿孔夹片、超细桥梁设计
- **交互式产品选择器** — 可折叠横向滑动卡片，含缩略图与材质描述

### 用户与安全

- JWT 认证 + IP 速率限制
- 手机号绑定 + 短信验证码
- SMS OTP 密码找回流程
- 个人资料看板 (处方/PD 数据展示)

### 支付与营销

- 支付宝/微信支付双通道沙箱集成
- HMAC-SHA256 安全验签
- 优惠券/折扣码系统 (固定金额/百分比)
- 原子化防并发超额核销

### 配镜向导

- 分步处方录入 (SPH/CYL/AXIS 实时校验)
- 动态镜片选项 API 联动
- 完整数据传递至结账流程

### 全球化

- 中英文双语完整支持
- locale-aware 价格/日期格式化
- `npm run check-i18n` 覆盖率检查脚本

---

## 产品路线图

| 阶段 | 状态 | 内容 |
|------|------|------|
| Phase 0 — 地基加固 | ✅ 完成 | 安全加固、代码质量、测试覆盖、Flyway 迁移 |
| Phase 1 — 核心流程 | ✅ 完成 | 配镜向导、结账流程、订单管理、个人资料 |
| Phase 2 — AR 试戴 | ✅ 完成 | MediaPipe + Three.js、3D 正交基、PBR 材质 |
| Phase 3 — 支付营销 | ✅ 完成 | 支付宝/微信支付、优惠券系统、邮件通知 |
| Phase 4 — 体验提升 | 🔄 进行中 | 产品过滤/搜索、收藏夹、性能优化 |
| Phase 5 — 生产部署 | 🔄 进行中 | CI/CD、HTTPS、域名、监控 |

> 详细路线图请参阅 [PRODUCT_ROADMAP.md](./PRODUCT_ROADMAP.md)

---

## 快速开始

### 前置要求

- Java 21+
- Node.js 18+
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

> 测试使用 H2 内存数据库，运行测试：`mvn test -Dspring.profiles.active=test`

---

## API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/v1/auth/register` | 用户注册 |
| `POST` | `/api/v1/auth/login` | 用户登录 |
| `GET` | `/api/v1/auth/me` | 获取当前用户 |
| `POST` | `/api/v1/auth/forgot-password` | 密码找回 |
| `GET` | `/api/v1/products` | 产品列表 |
| `GET` | `/api/v1/lens-options` | 镜片选项 |
| `POST` | `/api/v1/orders/checkout` | 创建订单 |
| `GET` | `/api/v1/orders/my` | 我的订单 |
| `POST` | `/api/v1/payments/callback/{channel}` | 支付回调 |
| `POST` | `/api/v1/coupons/validate` | 验证优惠券 |
| `POST` | `/api/v1/phone/send-code` | 发送验证码 |
| `POST` | `/api/v1/phone/verify-and-bind` | 绑定手机号 |

---

## 开发动机

Klarheit 旨在展示：

- **全栈系统架构** — 前后端分离、微服务化思维
- **前端工程深度** — WebAR、3D 渲染、复杂状态管理
- **后端安全基础** — JWT、速率限制、签名验签
- **业务数据建模** — 电商领域模型设计
- **迭代工程实践** — 从 MVP 到生产级的渐进式交付

---

## 部署注意事项

| 配置项 | 说明 | 必填 |
|--------|------|------|
| `APP_JWT_SECRET` | JWT 签名密钥 (`openssl rand -base64 32`) | ✅ |
| `PAYMENT_CALLBACK_SECRET` | 支付回调验签密钥 (`openssl rand -hex 32`) | ✅ |
| `VITE_API_BASE_URL` | 前端构建时的 API 地址 | ✅ |
| `API_ORIGIN` | 浏览器访问后端的 Origin | ✅ |
| `RESEND_API_KEY` | Resend 邮件服务密钥 | 可选 |
| `ALIPAY_APP_ID` | 支付宝沙箱应用 ID | 可选 |

---

## 许可证

暂未添加开源许可证。

---

<div align="center">

**[ 产品路线图 ](./PRODUCT_ROADMAP.md)** · **[ 开发文档 ](./docs/)** · **[ 问题反馈 ](https://github.com/kd99943/Klarheit/issues)**

</div>
