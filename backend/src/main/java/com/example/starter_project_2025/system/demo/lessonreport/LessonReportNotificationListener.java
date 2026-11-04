package com.example.starter_project_2025.system.demo.lessonreport;

import com.example.starter_project_2025.system.notification.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;


@Slf4j
@Component
@RequiredArgsConstructor
public class LessonReportNotificationListener {

    private final NotificationService notificationService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onReportCreated(LessonReportEvents.ReportCreated event) {
        try {
            notificationService.createOnce(
                    event.instructorId(),
                    "lesson-report:" + event.reportId() + ":" + event.instructorId(),
                    "New lesson report",
                    event.message(),
                    "/lesson-reports");
        } catch (Exception exception) {
            log.warn("Could not create lesson report notification: {}", exception.getMessage());
        }
    }
}
