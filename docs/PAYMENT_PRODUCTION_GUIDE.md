# Klarheit 支付接入说明（生产上线指南）

## 1. 当前实现状态

| 模块 | 当前状态 | 说明 |
|------|----------|------|
| 本地 Mock 收银台 | **已物理隔离** | `MockPaymentController` 受 `@Profile({"local & !prod", "test & !prod"})` 与 `app.payment.mock-enabled=true` 双重门控，生产环境（`prod`）不会注册任何 mock 端点；前端模拟按钮仅在开发模式下渲染 |
| 支付宝 (`ALIPAY`) | **沙箱已闭环 · 生产待配密钥** | 后端 `PaymentServiceImpl` 通过支付宝官方 SDK (`AlipayTradePagePayRequest` + `timeout_express=30m`) 生成真实表单，前端 `parseAndValidatePaymentForm` 校验网关域名并自动提交；回调支持 RSA2 (`AlipaySignature.rsaCheckV1`) + `app_id` 双校验并处理 `TRADE_SUCCESS` / `TRADE_FINISHED`；支持主动查单 (`Query`)、关单 (`Close`) 与线上原路退款 (`AlipayTradeRefundRequest`) |
| 微信支付 (`WECHAT`) | **仅本地 Mock · 生产已禁用** | 尚未接入微信支付 V3 Native 官方统一下单与平台证书验签；`mockEnabled=false` 时后端拒绝发起微信支付，前端生产构建默认禁用微信支付卡片 |
| 订单超时与迟到付款对账 | **已实现** | `PaymentReconciliationScheduler` 超时前先向网关查单/关单并核验回查金额；若已取消订单收到迟到付款回调或自动退款失败，自动转入 `REFUND_PENDING` 人工退款队列并保留网关流水号；所有取消/过期/退款均幂等回补库存与退券 |
| 应急停单开关 (`Kill Switch`) | **已实现** | 管理员可通过控制台或 `PUT /api/v1/admin/settings/checkout` 一键暂停接收新订单并配置对外公告，不影响已付订单查询、回调对账与售后通道 |

---

## 2. 生产上线必配项

### 2.1 环境变量（后端 `prod` Profile）

后端 `application.yml` 与 `docker-compose.yml` 统一读取以下环境变量：

```bash
SPRING_PROFILES_ACTIVE=prod
PAYMENT_MOCK_ENABLED=false

# 站点公网基地址（用于默认拼接支付同步跳回与异步回调地址）
APP_FRONTEND_URL=https://your-domain.com
APP_BACKEND_BASE_URL=https://api.your-domain.com

# 支付宝正式/沙箱商户配置
ALIPAY_APP_ID=your_alipay_app_id
ALIPAY_PRIVATE_KEY=your_rsa2_merchant_private_key
ALIPAY_PUBLIC_KEY=alipay_rsa2_public_key
# 正式环境完整网关地址（沙箱环境为 https://openapi-sandbox.dl.alipaydev.com/gateway.do；同时兼容旧变量名 ALIPAY_GATEWAY）
ALIPAY_GATEWAY_URL=https://openapi.alipay.com/gateway.do

# 可选：显式覆盖回调与同步跳转地址（不设置时默认使用 ${APP_BACKEND_BASE_URL}/api/v1/payments/callback/alipay 与 ${APP_FRONTEND_URL}/my-account）
ALIPAY_NOTIFY_URL=https://api.your-domain.com/api/v1/payments/callback/alipay
ALIPAY_RETURN_URL=https://your-domain.com/my-account

# 支付回调验签密钥与来源 IP 白名单（逗号分隔）
PAYMENT_CALLBACK_SECRET=your_callback_hmac_secret
PAYMENT_WEBHOOK_IP_WHITELIST=110.75.128.0/19
PAYMENT_WEBHOOK_TRUST_FORWARDED_FOR=false
```

### 2.2 后续待接入项与上线前实测事项

1. **支付宝移动端浏览器体验实测（`PagePay` vs `WapPay`）**：
   - 当前后端统一发起 `AlipayTradePagePayRequest`（电脑网站支付）。若试运营面向微信内置浏览器或手机 Safari/Chrome 用户，需在真机实测拉起体验，必要时补充 `AlipayTradeWapPayRequest`（手机网站支付）。
2. **微信支付 V3 Native 接入**：
   - 在 `PaymentServiceImpl` 中接入 `wechatpay-java` SDK，实现 Native 下单（返回真实 `code_url`）、查单、关单与退款。
   - 在 `PaymentCallbackController` 中使用微信平台证书验签并解密 AEAD_AES_256_GCM 回调报文。
   - 接入验证通过后，在前端构建环境中设置 `VITE_ENABLE_WECHAT_PAY=true` 开放微信支付选项。
3. **上线异常止损与人工回退 SOP**：
   - 若发现支付回调异常、误标价或加工产能告急，第一时间在管理台开启「暂停新单」开关（不需重新发版）；
   - 保持支付回调接口与在途订单详情页在线，切勿直接关停后端进程导致迟到回调丢失；
   - 每日核对管理台 `REFUND_PENDING` 队列与支付宝商户后台账单。

---

## 3. 上线前验收清单

- [x] `prod` 环境下 `/api/v1/payments/mock-trigger` 与 `/api/v1/payments/mock-cashier` 不可访问
- [x] 支付宝表单自动识别与网关域名白名单校验，下单设置 `timeout_express=30m`
- [x] 异步回调 RSA2 验签、`app_id` 校验、`TRADE_FINISHED` 兼容与订单金额二次核对
- [x] 重复回调与下单幂等性保障（`PESSIMISTIC_WRITE` 行锁 + `idempotency_key` + 零元网关单拦截）
- [x] 超时任务先查单/关单并核验金额再本地取消，优惠券与商品库存幂等退回
- [x] 迟到付款回调或退款失败自动进入 `REFUND_PENDING` 异常队列
- [x] 客户订单详情页支持自助「继续支付」「刷新支付状态」与「开工前取消」
- [ ] 生产商户密钥、公网 HTTPS 回调与移动端拉起实测联调
