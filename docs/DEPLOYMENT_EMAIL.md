# 邮件服务部署指南 (Email Service Deployment Guide)

本文档说明如何配置 Klarheit 的邮件发送服务（基于 [Resend](https://resend.com)），包括域名验证和 DNS 记录配置。

---

## 1. Resend 平台配置

### 1.1 注册与获取 API Key

1. 前往 [resend.com](https://resend.com) 注册账号
2. 进入 **Dashboard → API Keys** 页面
3. 创建一个新的 API Key，权限选择 `Sending access`
4. 将 API Key 填入环境变量：
   ```bash
   RESEND_API_KEY=re_xxxxxxxxxxxx
   ```

### 1.2 配置发件域名

1. 进入 **Dashboard → Domains** 页面
2. 点击 **Add Domain**，输入你的发件域名（例如 `klarheit.com`）
3. Resend 会提供需要添加的 DNS 记录（见下方）

---

## 2. DNS 记录配置

### 2.1 SPF 记录

SPF（Sender Policy Framework）告诉收件方邮件服务器，哪些 IP 地址有权代表你的域名发送邮件。

在你的域名 DNS 管理面板中添加一条 **TXT 记录**：

| 类型 | 主机名 | 值 |
|------|-------|---|
| TXT | `@` | `v=spf1 include:amazonses.com ~all` |

> **说明**：Resend 底层使用 Amazon SES 发送邮件，因此需要 `include:amazonses.com`。如果你的域名已有 SPF 记录，请将 `include:amazonses.com` 合并到现有记录中。

### 2.2 DKIM 记录

DKIM（DomainKeys Identified Mail）为发出的每封邮件添加数字签名，收件方可以验证邮件未被篡改。

Resend 会提供 **3 条 CNAME 记录**，格式如下：

| 类型 | 主机名 | 值 |
|------|-------|---|
| CNAME | `resend._domainkey.klarheit.com` | `resend._domainkey.klarheit.com.xxxxx.dkim.amazonses.com` |
| CNAME | `resend2._domainkey.klarheit.com` | `resend2._domainkey.klarheit.com.xxxxx.dkim.amazonses.com` |
| CNAME | `resend3._domainkey.klarheit.com` | `resend3._domainkey.klarheit.com.xxxxx.dkim.amazonses.com` |

> **说明**：实际值以 Resend Dashboard 中显示的为准，上面只是格式示例。

### 2.3 DMARC 记录（推荐）

DMARC 在 SPF 和 DKIM 基础上增加了报告和策略控制。

| 类型 | 主机名 | 值 |
|------|-------|---|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@klarheit.com` |

> **说明**：初始建议使用 `p=none`（仅监控），确认邮件投递正常后再改为 `p=quarantine` 或 `p=reject`。

---

## 3. 环境变量配置

在 `.env` 或部署平台（Railway / Docker）中设置：

```bash
# Resend API Key
RESEND_API_KEY=re_xxxxxxxxxxxx

# 发件邮箱地址（必须使用已验证的域名）
RESEND_FROM_EMAIL=orders@klarheit.com
```

---

## 4. 验证配置

### 4.1 在 Resend Dashboard 验证

1. 添加所有 DNS 记录后，回到 Resend Dashboard
2. 点击域名旁的 **Verify** 按钮
3. DNS 传播通常需要 5-30 分钟，最长可达 48 小时
4. 验证通过后域名状态会显示为 ✅ **Verified**

### 4.2 测试发送

启动后端服务后，创建一个测试订单。如果 `RESEND_API_KEY` 配置正确，你会收到订单确认邮件。

如果 API Key 未配置，`EmailService` 会自动降级为本地 HTML 预览模式，输出文件到 `target/emails/` 目录。

---

## 5. 常见问题

| 问题 | 解决方案 |
|------|---------|
| 邮件进入垃圾箱 | 检查 SPF/DKIM/DMARC 记录是否正确配置 |
| DNS 验证失败 | 等待 DNS 传播（最长 48h），或检查记录是否有拼写错误 |
| 发送失败 401 | API Key 无效或已过期，重新生成 |
| 发送失败 403 | 发件域名未验证，或 `RESEND_FROM_EMAIL` 域名与验证域名不匹配 |
