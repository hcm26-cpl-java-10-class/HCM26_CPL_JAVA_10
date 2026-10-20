package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class ExamAttemptExpiryJob {

    private final ExamAttemptService attemptService;
    private final ExamAttemptRepository attemptRepository;

    @Scheduled(
            fixedDelayString = "${exam.attempt.expiry-check-ms:30000}",
            initialDelayString = "${exam.attempt.expiry-check-ms:30000}"
    )
    public void run() {
        int expired = expireOverdue(Instant.now());
        if (expired > 0) {
            log.info("Auto-submitted {} expired exam attempt(s)", expired);
        }
    }

    /** @return số bài vừa được chuyển sang EXPIRED */
    int expireOverdue(Instant now) {
        List<Long> inProgressIds = attemptRepository.findIdsByStatus(ExamAttemptStatus.IN_PROGRESS);
        int expired = 0;
        for (Long attemptId : inProgressIds) {
            try {
                if (attemptService.expireIfOverdue(attemptId, now)) {
                    expired++;
                }
            } catch (RuntimeException ex) {
                log.warn("Could not auto-submit exam attempt {}", attemptId, ex);
            }
        }
        return expired;
    }
}
