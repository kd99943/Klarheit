package com.klarheit.backend.order;

import com.klarheit.backend.order.dto.CustomerInfoDTO;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

/**
 * Launch delivery region, structured address completeness, shipping fee & honest
 * delivery window policy (P0-05).
 */
@Service
public class DeliveryPolicyService {

    public record DeliveryEstimate(
            boolean deliverable,
            boolean manualReviewRequired,
            BigDecimal shippingFee,
            int minDays,
            int maxDays,
            LocalDate estimatedDeliveryDate,
            String resolvedProvince,
            String resolvedCity,
            String reason
    ) {}

    private static final Pattern VALID_PHONE_PATTERN = Pattern.compile("^[+]?[0-9\\-\\s]{7,20}$");

    private static final Map<String, String> SUPPORTED_PROVINCE_ALIASES = new LinkedHashMap<>();
    private static final Set<String> REMOTE_PROVINCES = Set.of("新疆", "西藏", "青海");
    private static final List<String> UNSUPPORTED_KEYWORDS = List.of(
            "香港", "hong kong", "hongkong",
            "澳门", "澳門", "macau", "macao",
            "台湾", "台灣", "taiwan",
            "美国", "united states", "usa", "u.s.a", "new york", "california",
            "英国", "united kingdom", "london",
            "日本", "japan", "tokyo",
            "韩国", "korea", "seoul",
            "新加坡", "singapore",
            "加拿大", "canada",
            "澳大利亚", "澳洲", "australia",
            "德国", "germany", "法国", "france", "瑞士", "switzerland",
            "海外", "overseas", "international"
    );

    static {
        addProvince("北京", "beijing", "北京市");
        addProvince("上海", "shanghai", "上海市");
        addProvince("天津", "tianjin", "天津市");
        addProvince("重庆", "chongqing", "重庆市");
        addProvince("浙江", "zhejiang", "浙江省", "杭州", "hangzhou", "宁波");
        addProvince("江苏", "jiangsu", "江苏省", "南京", "nanjing", "苏州", "suzhou");
        addProvince("广东", "guangdong", "广东省", "广州", "guangzhou", "深圳", "shenzhen");
        addProvince("福建", "fujian", "福建省", "厦门", "福州");
        addProvince("山东", "shandong", "山东省", "青岛", "济南");
        addProvince("湖北", "hubei", "湖北省", "武汉", "wuhan");
        addProvince("湖南", "hunan", "湖南省", "长沙");
        addProvince("四川", "sichuan", "四川省", "成都", "chengdu");
        addProvince("河南", "henan", "河南省", "郑州");
        addProvince("河北", "hebei", "河北省", "石家庄");
        addProvince("安徽", "anhui", "安徽省", "合肥");
        addProvince("江西", "jiangxi", "江西省", "南昌");
        addProvince("陕西", "shaanxi", "陕西省", "西安");
        addProvince("山西", "shanxi", "山西省", "太原");
        addProvince("辽宁", "liaoning", "辽宁省", "沈阳", "大连");
        addProvince("吉林", "jilin", "吉林省", "长春");
        addProvince("黑龙江", "heilongjiang", "黑龙江省", "哈尔滨");
        addProvince("广西", "guangxi", "广西壮族自治区", "南宁");
        addProvince("贵州", "guizhou", "贵州省", "贵阳");
        addProvince("云南", "yunnan", "云南省", "昆明");
        addProvince("海南", "hainan", "海南省", "海口", "三亚");
        addProvince("甘肃", "gansu", "甘肃省", "兰州");
        addProvince("宁夏", "ningxia", "宁夏回族自治区", "银川");
        addProvince("内蒙古", "inner mongolia", "内蒙古自治区", "呼和浩特");
        addProvince("新疆", "xinjiang", "新疆维吾尔自治区", "乌鲁木齐");
        addProvince("西藏", "tibet", "xizang", "西藏自治区", "拉萨");
        addProvince("青海", "qinghai", "青海省", "西宁");
    }

    private static void addProvince(String canonical, String... aliases) {
        SUPPORTED_PROVINCE_ALIASES.put(canonical.toLowerCase(Locale.ROOT), canonical);
        for (String alias : aliases) {
            SUPPORTED_PROVINCE_ALIASES.put(alias.toLowerCase(Locale.ROOT), canonical);
        }
    }

    public DeliveryEstimate evaluate(CustomerInfoDTO customer, String fallbackPhone) {
        if (customer == null) {
            throw new IllegalArgumentException("收件人信息不能为空。");
        }
        String province = normalize(customer.province());
        String city = normalize(customer.city());
        String district = normalize(customer.district());
        String detail = normalize(customer.detailAddress());
        String combined = assembleAddress(customer);

        String effectivePhone = normalize(customer.phone());
        if (effectivePhone == null) {
            effectivePhone = normalize(fallbackPhone);
        }

        // 1. Always reject explicitly out-of-region destinations (HK/MO/TW/overseas)
        String probeText = ((province != null ? province + " " : "")
                + (city != null ? city + " " : "")
                + (combined != null ? combined : "")).toLowerCase(Locale.ROOT);
        for (String unsupported : UNSUPPORTED_KEYWORDS) {
            if (probeText.contains(unsupported)) {
                return new DeliveryEstimate(
                        false,
                        false,
                        BigDecimal.ZERO,
                        0,
                        0,
                        null,
                        province,
                        city,
                        "当前首发配送范围仅覆盖中国大陆地区，暂不支持港澳台及海外地址配送，请更换中国大陆收货地址或联系客服。"
                );
            }
        }

        // 2. Contact phone check when structured address is submitted or phone is supplied
        if (effectivePhone != null && !VALID_PHONE_PATTERN.matcher(effectivePhone).matches()) {
            throw new IllegalArgumentException("收件人联系电话格式无效，请填写正确的手机或固话号码。");
        }
        boolean hasStructuredFields = province != null || city != null || district != null || detail != null;
        if (hasStructuredFields && effectivePhone == null) {
            throw new IllegalArgumentException("请填写有效的收件人联系电话以便承运商派送。");
        }

        // 3. Resolve province from structured province field or free-text address
        String resolvedProvince = resolveProvince(province);
        if (resolvedProvince == null) {
            resolvedProvince = resolveProvince(combined);
        }

        if (resolvedProvince == null) {
            // Unrecognized/non-structured address -> allow order creation only via manual review before payment
            return new DeliveryEstimate(
                    true,
                    true,
                    BigDecimal.ZERO,
                    12,
                    16,
                    null,
                    province,
                    city,
                    "收货地址未能自动识别到首发配送省市，已转入人工核对地址与配送时效后再报价付款。"
            );
        }

        // 4. Address completeness check
        if (hasStructuredFields) {
            if (city == null || detail == null || detail.length() < 4) {
                throw new IllegalArgumentException("请完整填写省、市及详细街道门牌地址（至少 4 个字符）。");
            }
        } else if (combined == null || combined.length() < 6) {
            throw new IllegalArgumentException("收货地址不完整，请补充省市区及详细街道门牌信息。");
        }

        boolean isRemote = REMOTE_PROVINCES.contains(resolvedProvince);
        BigDecimal shippingFee = isRemote ? new BigDecimal("25.00") : BigDecimal.ZERO;
        int minDays = isRemote ? 14 : 10;
        int maxDays = isRemote ? 18 : 14;
        LocalDate estimatedDate = BusinessClock.today().plusDays(maxDays);
        String msg = isRemote
                ? "该地址属于偏远配送区域（" + resolvedProvince + "），运费 ¥25，预计 " + minDays + "–" + maxDays + " 天送达。"
                : "标准中国大陆配送区域（" + resolvedProvince + "），免运费，预计 " + minDays + "–" + maxDays + " 天送达。";

        return new DeliveryEstimate(
                true,
                false,
                shippingFee,
                minDays,
                maxDays,
                estimatedDate,
                resolvedProvince,
                city,
                msg
        );
    }

    public String assembleAddress(CustomerInfoDTO customer) {
        String raw = normalize(customer.shippingAddress());
        String province = normalize(customer.province());
        String city = normalize(customer.city());
        String district = normalize(customer.district());
        String detail = normalize(customer.detailAddress());

        if (province != null || city != null || detail != null) {
            StringBuilder sb = new StringBuilder();
            if (province != null) sb.append(province).append(' ');
            if (city != null) sb.append(city).append(' ');
            if (district != null) sb.append(district).append(' ');
            if (detail != null) sb.append(detail);
            String assembled = sb.toString().trim();
            if (!assembled.isBlank()) {
                return assembled;
            }
        }
        return raw;
    }

    public String resolveProvince(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String lower = text.toLowerCase(Locale.ROOT);
        for (Map.Entry<String, String> entry : SUPPORTED_PROVINCE_ALIASES.entrySet()) {
            if (lower.contains(entry.getKey())) {
                return entry.getValue();
            }
        }
        return null;
    }

    private String normalize(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return raw.trim();
    }
}
