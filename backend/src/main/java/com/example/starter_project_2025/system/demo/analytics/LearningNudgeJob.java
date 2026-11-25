package com.example.starter_project_2025.system.demo.analytics;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Nhắc học tự động mỗi ngày (kiểu Duolingo) cho người học rủi ro cao.
 * Mặc định TẮT: bật bằng {@code app.learning-nudge.auto-enabled=true}.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LearningNudgeJob {

    private final LearnerEngagementService engagementService;

    @Value("${app.learning-nudge.auto-enabled:false}")
    private boolean enabled;

    @Scheduled(cron = "${app.learning-nudge.cron:0 0 9 * * *}")
    public void run() {
        if (!enabled) {
            return;
        }
        long sent = engagementService.autoNudgeAllCourses();
        log.info("Learning nudge job sent {} reminders", sent);
    }
}
