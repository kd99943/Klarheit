package com.klarheit.backend.payment;

import java.math.BigDecimal;

public interface PaymentService {
    /**
     * 发起收单支付意向
     * @param orderNumber 平台订单号
     * @param amount 实付金额
     * @param channel 渠道 (WECHAT / ALIPAY)
     * @return 包含支付凭证和前端拉起参数 (如二维码链接或支付宝 HTML Form)
     */
    PaymentInitiateResult initiatePayment(String orderNumber, BigDecimal amount, String channel);
}
