package com.example.starter_project_2025.system.project.notification;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.ZoneId;

@Configuration
public class DeadlineNotificationConfig {
    @Bean
    ZoneId backlogDeadlineZone(
            @Value("${app.notification.backlog-time-zone:Asia/Ho_Chi_Minh}") String zoneId) {
        return ZoneId.of(zoneId);
    }
}
