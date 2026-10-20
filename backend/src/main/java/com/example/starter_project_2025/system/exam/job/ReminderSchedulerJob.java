package com.example.starter_project_2025.system.exam.job;

import com.example.starter_project_2025.system.exam.service.ReminderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Polls every minute for reminder emails that are due and sends them.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ReminderSchedulerJob {

    private final ReminderService reminderService;

    @Scheduled(fixedRateString = "${app.reminder.interval-ms:60000}")
    public void sendPendingReminders() {
        try {
            int sent = reminderService.sendPendingReminders();
            if (sent > 0) {
                log.info("ReminderSchedulerJob dispatched {} reminder email(s)", sent);
            }
        } catch (Exception e) {
            log.error("ReminderSchedulerJob failed: {}", e.getMessage(), e);
        }
    }
}