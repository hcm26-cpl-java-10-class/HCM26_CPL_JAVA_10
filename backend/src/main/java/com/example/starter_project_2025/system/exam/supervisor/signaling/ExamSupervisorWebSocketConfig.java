package com.example.starter_project_2025.system.exam.supervisor.signaling;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class ExamSupervisorWebSocketConfig implements WebSocketConfigurer {

    private final ExamSupervisorSignalingHandler handler;

    private final ExamSupervisorWebSocketHandshakeInterceptor handshakeInterceptor;

    @Value("${app.frontend-domain:http://localhost:5173}")
    private String frontendDomain;

    @Override
    public void registerWebSocketHandlers(
            WebSocketHandlerRegistry registry
    ) {
        registry.addHandler(handler, "/ws/exam-supervisor")
                .addInterceptors(handshakeInterceptor)
                .setAllowedOriginPatterns(
                        frontendDomain,
                        "http://localhost:*",
                        "http://127.0.0.1:*",
                        "http://192.168.*.*:*" // chỉ để test trong LAN, bỏ ở production
                );
    }

    /**
     * Tomcat mặc định chỉ cho tin nhắn text tối đa 8KB. SDP offer của WebRTC
     * có thể lớn hơn, nên server đóng kết nối (mã 1009) trước khi chuyển offer
     * cho supervisor. Nâng giới hạn lên 64KB.
     */
    @Bean
    public ServletServerContainerFactoryBean webSocketContainer() {
        ServletServerContainerFactoryBean container =
                new ServletServerContainerFactoryBean();
        container.setMaxTextMessageBufferSize(64 * 1024);
        container.setMaxBinaryMessageBufferSize(64 * 1024);
        return container;
    }
}