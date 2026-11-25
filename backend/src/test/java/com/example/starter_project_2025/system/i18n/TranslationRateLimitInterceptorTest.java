package com.example.starter_project_2025.system.i18n;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.converter.json.Jackson2ObjectMapperBuilder;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.method.HandlerMethod;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;

class TranslationRateLimitInterceptorTest {

    private I18nProperties properties;
    private TranslationRateLimitInterceptor interceptor;
    private HandlerMethod handlerMethod;

    @BeforeEach
    void setUp() throws Exception {
        properties = new I18nProperties();
        properties.setRateLimitPerMinute(3);
        interceptor = new TranslationRateLimitInterceptor(properties, jsonMapper());
        // Tạo HandlerMethod thật để preHandle không bị NullPointerException khi Spring kiểm tra instanceof.
        Method method = Dummy.class.getMethod("dummy");
        handlerMethod = new HandlerMethod(new Dummy(), method);
    }

    // Lớp helper cho HandlerMethod
    static class Dummy {
        public void dummy() {}
    }

    /** ObjectMapper giống hệt bean do Spring Boot tự cấu hình (có JavaTimeModule). */
    private static ObjectMapper jsonMapper() {
        return Jackson2ObjectMapperBuilder.json().build();
    }

    @Test
    void allowsRequestsUnderLimit() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("1.2.3.4");

        for (int i = 0; i < 3; i++) {
            MockHttpServletResponse response = new MockHttpServletResponse();
            boolean result = interceptor.preHandle(request, response, handlerMethod);
            assertThat(result).isTrue();
        }
    }

    @Test
    void blocks429AfterLimitExceeded() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("5.6.7.8");

        // Gọi đúng limit → vẫn OK
        for (int i = 0; i < 3; i++) {
            interceptor.preHandle(request, new MockHttpServletResponse(), handlerMethod);
        }

        // Lần thứ 4 vượt giới hạn → 429
        MockHttpServletResponse response = new MockHttpServletResponse();
        boolean result = interceptor.preHandle(request, response, handlerMethod);
        assertThat(result).isFalse();
        assertThat(response.getStatus()).isEqualTo(429);
        assertThat(response.getContentType()).contains("application/json");
        assertThat(response.getContentAsString()).contains("ERR_I18N_RATE_LIMITED");
        assertThat(response.getHeader("Retry-After")).isEqualTo("60");
    }

    @Test
    void differentIpsHaveSeparateWindows() throws Exception {
        // IP A đã vượt giới hạn
        MockHttpServletRequest reqA = new MockHttpServletRequest();
        reqA.setRemoteAddr("10.0.0.1");
        for (int i = 0; i < 4; i++) {
            interceptor.preHandle(reqA, new MockHttpServletResponse(), handlerMethod);
        }

        // IP B vẫn được phép (window riêng)
        MockHttpServletRequest reqB = new MockHttpServletRequest();
        reqB.setRemoteAddr("10.0.0.2");
        MockHttpServletResponse responseB = new MockHttpServletResponse();
        boolean result = interceptor.preHandle(reqB, responseB, handlerMethod);
        assertThat(result).isTrue();
    }

    @Test
    void bypassesLimitWhenRateLimitIsZeroOrNegative() throws Exception {
        properties.setRateLimitPerMinute(0);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("9.9.9.9");

        for (int i = 0; i < 100; i++) {
            MockHttpServletResponse response = new MockHttpServletResponse();
            boolean result = interceptor.preHandle(request, response, handlerMethod);
            assertThat(result).isTrue();
        }
    }

    @Test
    void readsClientIpFromXForwardedForHeader() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        // X-Forwarded-For chứa nhiều IP, lấy IP đầu tiên
        request.addHeader("X-Forwarded-For", "203.0.113.1, 10.0.0.1");
        request.setRemoteAddr("127.0.0.1");

        for (int i = 0; i < 3; i++) {
            interceptor.preHandle(request, new MockHttpServletResponse(), handlerMethod);
        }

        // Lần 4 vượt giới hạn → phải đếm theo 203.0.113.1
        MockHttpServletResponse response = new MockHttpServletResponse();
        boolean result = interceptor.preHandle(request, response, handlerMethod);
        assertThat(result).isFalse();
        assertThat(response.getStatus()).isEqualTo(429);
    }

    @Test
    void evictExpiredWindowsClearsStaleEntries() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr("11.22.33.44");
        interceptor.preHandle(request, new MockHttpServletResponse(), handlerMethod);

        // Chạy evict: window còn fresh nên không bị xóa.
        interceptor.evictExpiredWindows();

        // Vẫn còn được đếm → giới hạn vẫn còn hiệu lực trong cùng window.
        for (int i = 1; i < 3; i++) {
            interceptor.preHandle(request, new MockHttpServletResponse(), handlerMethod);
        }
        MockHttpServletResponse response = new MockHttpServletResponse();
        boolean result = interceptor.preHandle(request, response, handlerMethod);
        assertThat(result).isFalse();
        assertThat(response.getStatus()).isEqualTo(429);
    }
}
