# Klarheit Railway 部署指南

## 项目概述

Klarheit 是一个 React 19 + Spring Boot 3 + MySQL 8.4 全栈眼镜电商平台。项目使用 Docker 构建，已配置 `docker-compose.yml` 用于本地部署，但 Railway 平台需要分别部署三个独立服务。

- 前端仓库路径：`front_end/`
- 后端仓库路径：`backend/`
- 仓库地址：`https://github.com/kd99943/Klarheit.git`

---

## 已完成的代码修改（部署适配）

以下修改已提交到 `main` 分支，是 Railway 部署的关键适配：

### 1. 后端 Dockerfile（`backend/Dockerfile`）

将 `ENTRYPOINT` 改为 `CMD` shell 形式，以支持 Railway 动态注入 `$PORT` 环境变量：

```dockerfile
EXPOSE 8080

CMD ["sh", "-c", "java -Djava.security.egd=file:/dev/./urandom -Dserver.port=${PORT:-8080} -jar app.jar"]
```

### 2. 后端 Railway 配置（`backend/railway.toml`）

```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = ""
healthcheckPath = "/actuator/health"
healthcheckTimeout = 120
```

### 3. 前端 Nginx 配置（`front_end/nginx.conf`）

Nginx 必须监听 **80 端口**（Railway 将外部动态 `$PORT` 映射到容器的 80）：

```nginx
server {
    listen 80;
    server_name localhost;
    # ... 其余配置不变
}
```

> **注意**：不要使用 `listen ${PORT}`，因为 Railway 不会自动将 `$PORT` 注入到 envsubst 中，会导致 Nginx 起不来（502 Bad Gateway）。

### 4. 前端运行时配置注入

Vite 的 `VITE_API_BASE_URL` 是构建时变量，Railway 的 Docker 构建器有时不传递 Build Args，导致前端连不上后端。解决方案是**运行时注入**：

**`front_end/public/env-config.js`**（模板文件）：
```javascript
window.__ENV__ = {
  VITE_API_BASE_URL: "${VITE_API_BASE_URL}"
};
```

**`front_end/index.html`**（在 main.tsx 之前引入）：
```html
<script src="/env-config.js"></script>
<script type="module" src="/src/main.tsx"></script>
```

**`front_end/src/services/api.ts`**（优先读取运行时配置）：
```typescript
const runtimeEnv = (window as unknown as Record<string, Record<string, string>>).__ENV__;
const API_BASE_URL = (
  runtimeEnv?.VITE_API_BASE_URL?.trim() ||
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  DEFAULT_API_BASE_URL
).replace(/\/$/, "");
```

### 5. 前端 Dockerfile（`front_end/Dockerfile`）

启动时用 `envsubst` 将运行时环境变量注入 `env-config.js`：

```dockerfile
CMD ["/bin/sh", "-c", "envsubst '${API_ORIGIN}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && envsubst '${VITE_API_BASE_URL}' < /usr/share/nginx/html/env-config.js > /tmp/env-config.js && mv /tmp/env-config.js /usr/share/nginx/html/env-config.js && nginx -g 'daemon off;'"]
```

### 6. 前端 Railway 配置（`front_end/railway.toml`）

```toml
[build]
builder = "dockerfile"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = ""
```

> **不要设置 healthcheckPath**，否则容易超时导致部署失败。Railway 默认会检测端口是否可达。

---

## Railway 部署步骤

### 第一步：创建 Railway 项目

1. 打开 [railway.app](https://railway.app)，用 GitHub 账号登录
2. 点 **"+ New Project"**

### 第二步：添加 MySQL 数据库

1. 在项目页面点 **"+ New"** → **"Database"** → **"MySQL"**
2. 等待创建完成，状态变绿
3. MySQL 的连接信息会自动生成为项目级环境变量（`${{MySQL.MYSQL_HOST}}` 等）

### 第三步：部署后端服务

1. 点 **"+ New"** → **"GitHub Repo"** → 选择 `kd99943/Klarheit`
2. 进入该服务 → **"Settings"** → **"Source"** 区域：
   - **Root Directory** 填：`backend`
   - **Builder** 选：`Dockerfile`
3. 点 **"Variables"** 标签 → 点 **"Raw Editor"**，粘贴：

```
DB_URL=jdbc:mysql://${{MySQL.MYSQL_HOST}}:${{MySQL.MYSQL_PORT}}/${{MySQL.MYSQL_DATABASE}}?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
DB_USERNAME=${{MySQL.MYSQL_USER}}
DB_PASSWORD=${{MySQL.MYSQL_PASSWORD}}
APP_JWT_SECRET=KlarheitSecretKey2026RandomStringForJWT
SPRING_PROFILES_ACTIVE=prod
JPA_DDL_AUTO=none
FLYWAY_ENABLED=true
CORS_ALLOWED_ORIGINS=*
```

4. 点 **"Networking"** → 点 **"Generate Domain"**，端口填 **8080**
5. 等待部署完成（约 3-5 分钟），状态变绿后记下后端域名

> **后端健康检查**：访问 `https://<后端域名>/actuator/health`，应返回 `{"status":"UP"}`

### 第四步：部署前端服务

1. 回到项目页面，点 **"+ New"** → **"GitHub Repo"** → 同一仓库
2. 进入该服务 → **"Settings"** → **"Source"** 区域：
   - **Root Directory** 填：`front_end`
   - **Builder** 选：`Dockerfile`
3. 点 **"Variables"** 标签，添加以下变量：

| Variable Name | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://<后端域名>/api/v1` |
| `API_ORIGIN` | `https://<后端域名>` |

4. 点 **"Networking"** → 点 **"Generate Domain"**，端口填 **80**
5. 等待部署完成，状态变绿

### 第五步：回填前端地址到后端

1. 回到后端服务 → **"Variables"** 标签
2. 将 `CORS_ALLOWED_ORIGINS` 的值从 `*` 改为 `https://<前端域名>`

---

## 环境变量汇总

### 后端环境变量

| 变量名 | 值 | 说明 |
|---|---|---|
| `DB_URL` | `jdbc:mysql://${{MySQL.MYSQL_HOST}}:${{MySQL.MYSQL_PORT}}/${{MySQL.MYSQL_DATABASE}}?...` | Railway 自动解析 |
| `DB_USERNAME` | `${{MySQL.MYSQL_USER}}` | Railway 自动解析 |
| `DB_PASSWORD` | `${{MySQL.MYSQL_PASSWORD}}` | Railway 自动解析 |
| `APP_JWT_SECRET` | 任意 32 位以上随机字符串 | 需自行生成 |
| `SPRING_PROFILES_ACTIVE` | `prod` | - |
| `JPA_DDL_AUTO` | `none` | 由 Flyway 管理结构（生产环境设为 `none`） |
| `FLYWAY_ENABLED` | `true` | 开启 Flyway 以自动创建表并导入初始商品数据 |
| `CORS_ALLOWED_ORIGINS` | 前端部署域名 | 第五步回填 |
| `APP_FRONTEND_URL` | 前端部署域名 | 可选 |

### 前端环境变量

| 变量名 | 值 | 说明 |
|---|---|---|
| `VITE_API_BASE_URL` | `https://<后端域名>/api/v1` | 运行时注入 |
| `API_ORIGIN` | `https://<后端域名>` | Nginx CSP 白名单 |

---

## 常见问题排查

### 前端 502 Bad Gateway

**原因**：Nginx 监听端口与 Railway 映射不一致。

**解决**：确保 `nginx.conf` 中 `listen 80;`（不是 `listen ${PORT};`），并在前端 Networking 设置中填端口 **80**。

### 前端页面能打开但 API 请求失败

**原因**：`VITE_API_BASE_URL` 没有正确注入，前端仍在请求 `localhost`。

**排查**：浏览器打开 `https://<前端域名>/env-config.js`，检查是否正确输出了后端地址。

**解决**：确认前端 Variables 中有 `VITE_API_BASE_URL` 和 `API_ORIGIN`，然后 Redeploy。

### 后端健康检查失败

**原因**：数据库连接失败或应用启动报错。

**排查**：查看后端 Deployments → Runtime Logs，搜索 `ERROR` 关键字。

**常见原因**：
- `DB_URL` 中的 `${{MySQL.xxx}}` 变量未正确解析（检查 MySQL 服务是否在同一项目）
- `APP_JWT_SECRET` 未设置

### 前端健康检查超时

**原因**：Railway 的 Healthcheck Path 配置导致。

**解决**：在前端服务 Settings → Deploy 区域，**不要设置 Healthcheck Path**，留空即可。

### Railway 无法识别构建方式

**原因**：Railway 的 Railpack 构建器无法自动识别项目类型。

**解决**：确保服务的 Root Directory 已正确设置（`backend` 或 `front_end`），且对应目录下有 `railway.toml` 文件指定了 `builder = "dockerfile"`。

---

## 部署后验证清单

- [ ] 后端 `https://<后端域名>/actuator/health` 返回 `{"status":"UP"}`
- [ ] 前端 `https://<前端域名>/env-config.js` 输出正确的后端地址
- [ ] 前端页面能正常加载（非 Railway 错误页）
- [ ] 前端能正常调用后端 API（如产品列表、用户注册）
- [ ] 后端 CORS 配置包含前端域名

---

## 已知部署域名

| 服务 | 域名 |
|---|---|
| 后端 | `https://klarheit-production.up.railway.app` |
| 前端 | `https://klarheit.up.railway.app` |
