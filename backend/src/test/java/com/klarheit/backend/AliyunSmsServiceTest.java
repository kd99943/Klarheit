package com.klarheit.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.aliyun.dysmsapi20170525.Client;
import com.aliyun.dysmsapi20170525.models.SendSmsRequest;
import com.aliyun.dysmsapi20170525.models.SendSmsResponse;
import com.aliyun.dysmsapi20170525.models.SendSmsResponseBody;
import com.klarheit.backend.sms.AliyunSmsService;
import com.klarheit.backend.sms.MockSmsService;
import com.klarheit.backend.sms.SmsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class AliyunSmsServiceTest {

    @Mock
    private Client mockClient;

    @Mock
    private SendSmsResponse mockResponse;

    @Mock
    private SendSmsResponseBody mockResponseBody;

    private AliyunSmsService aliyunSmsService;

    @BeforeEach
    void setUp() {
        // Initialize with empty credentials so client starts as null
        aliyunSmsService = new AliyunSmsService("", "", "Klarheit", "SMS_12345");
    }

    @Test
    void aliyunSmsServiceHasCorrectConditionalAnnotation() {
        ConditionalOnProperty annotation = AliyunSmsService.class.getAnnotation(ConditionalOnProperty.class);
        assertThat(annotation).isNotNull();
        assertThat(annotation.name()).containsExactly("app.sms.provider");
        assertThat(annotation.havingValue()).isEqualTo("aliyun");
    }

    @Test
    void aliyunSmsServiceImplementsSmsServiceInterface() {
        assertThat(SmsService.class).isAssignableFrom(AliyunSmsService.class);
    }

    @Test
    void mockSmsServiceImplementsSmsServiceInterface() {
        assertThat(SmsService.class).isAssignableFrom(MockSmsService.class);
    }

    @Test
    void aliyunSmsServiceIsAnnotatedAsService() {
        Service annotation = AliyunSmsService.class.getAnnotation(Service.class);
        assertThat(annotation).isNotNull();
    }

    @Test
    void mockSmsServiceIsAnnotatedAsService() {
        Service annotation = MockSmsService.class.getAnnotation(Service.class);
        assertThat(annotation).isNotNull();
    }

    @Test
    void mockSmsServiceHasConditionalAnnotation() {
        ConditionalOnProperty annotation = MockSmsService.class.getAnnotation(ConditionalOnProperty.class);
        if (annotation != null) {
            assertThat(annotation.havingValue()).isNotEqualTo("aliyun");
        }
    }

    @Test
    void sendVerificationCode_whenClientIsNull_returnsGracefully() {
        ReflectionTestUtils.setField(aliyunSmsService, "client", null);
        aliyunSmsService.sendVerificationCode("13800000000", "123456");
    }

    @Test
    void sendVerificationCode_successScenario() throws Exception {
        ReflectionTestUtils.setField(aliyunSmsService, "client", mockClient);

        when(mockClient.sendSms(any(SendSmsRequest.class))).thenReturn(mockResponse);
        when(mockResponse.getBody()).thenReturn(mockResponseBody);
        when(mockResponseBody.getCode()).thenReturn("OK");

        aliyunSmsService.sendVerificationCode("13800000000", "123456");

        verify(mockClient, times(1)).sendSms(any(SendSmsRequest.class));
    }

    @Test
    void sendVerificationCode_apiErrorScenario() throws Exception {
        ReflectionTestUtils.setField(aliyunSmsService, "client", mockClient);

        when(mockClient.sendSms(any(SendSmsRequest.class))).thenReturn(mockResponse);
        when(mockResponse.getBody()).thenReturn(mockResponseBody);
        when(mockResponseBody.getCode()).thenReturn("ERROR");
        when(mockResponseBody.getMessage()).thenReturn("Invalid signature");

        aliyunSmsService.sendVerificationCode("13800000000", "123456");

        verify(mockClient, times(1)).sendSms(any(SendSmsRequest.class));
    }

    @Test
    void sendVerificationCode_clientExceptionScenario() throws Exception {
        ReflectionTestUtils.setField(aliyunSmsService, "client", mockClient);

        when(mockClient.sendSms(any(SendSmsRequest.class))).thenThrow(new RuntimeException("Connection timed out"));

        aliyunSmsService.sendVerificationCode("13800000000", "123456");

        verify(mockClient, times(1)).sendSms(any(SendSmsRequest.class));
    }
}
