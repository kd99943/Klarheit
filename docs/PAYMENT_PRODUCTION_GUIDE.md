# Klarheit 支付接入说明（生产替换指南）

## 现状（Demo / 开发）

当前支付为 **可运行的模拟通道**，仅用于端到端演示：

- 前端：`Checkout.tsx` → `checkoutOrder` → `triggerMockPayment`
- 后端：HMAC 模拟验签 + mock 回调
- 短信 / 邮件：未配置密钥时写日志或本地文件

**结论：不可直接上线收真实资金。**

## 生产必改项

| 项 | 现状 | 生产要求 |
|----|------|----------|
| 支付宝 | HMAC-SHA256 模拟 | 官方 SDK `alipay-sdk-java`，`AlipaySignature.rsaCheckV1` 验签 |
| 微信支付 | HMAC 模拟 | 官方 SDK + 平台证书验签 |
| 回调地址 | mock trigger | HTTPS 公网可达 + IP 白名单 |
| 密钥 | 占位 | 从密钥管理服务注入，禁止进 Git |
| 对账 | 无 | 日终对账任务 + 差异告警 |
| 退款 API | 无 | 官方退款 + 状态机 |

## 前端接入点（已预留）

```
Checkout.tsx
  └─ checkoutOrder(payload)           // 创建订单
  └─ payData / payUrl                 // 渠道返回的支付参数
  └─ getOrderStatus(orderNumber)      // 轮询支付结果
```

替换模拟通道时：

1. 后端 `PaymentService` 换成官方 SDK 实现，**保留现有 REST 契约**
2. 前端按渠道渲染：支付宝 form 跳转 / 微信 Native 扫码 / 小程序跳转
3. 删掉 `triggerMockPayment` 的 UI 入口（或仅 dev profile 暴露）

## 环境变量（后端）

```
APP_PAYMENT_CALLBACK_SECRET=   # 模拟通道用；官方渠道改用渠道密钥体系
ALIPAY_APP_ID=
ALIPAY_PRIVATE_KEY=
ALIPAY_PUBLIC_KEY=
WECHAT_MCH_ID=
WECHAT_API_V3_KEY=
WECHAT_PLATFORM_CERT=
```

## 验收清单（支付上线前）

- [ ] 沙箱下单 → 支付 → 回调验签通过
- [ ] 订单状态机：CREATED → PENDING → PAID / FAILED / CLOSED
- [ ] 重复回调幂等
- [ ] 金额篡改拒绝
- [ ] 退款全链路
- [ ] 对账文件拉取与差异处理
- [ ] 密钥轮换演练

## Demo 验收（当前代码）

1. 配镜向导完成处方 → 结账
2. 选择支付宝/微信（模拟）
3. 触发 mock 支付 → 订单确认页出现 PAID
4. 购物车加入商品 → 选中结账同样走通
