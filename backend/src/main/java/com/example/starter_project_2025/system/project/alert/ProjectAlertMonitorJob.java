package com.example.starter_project_2025.system.project.alert;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.*;

@Slf4j @Component
@ConditionalOnProperty(name="app.project-alerts.monitor.enabled",havingValue="true",matchIfMissing=true)
public class ProjectAlertMonitorJob {
    private final ProjectAlertMonitor monitor;
    private final Clock clock;
    private final ZoneId zone;
    public ProjectAlertMonitorJob(ProjectAlertMonitor monitor,@Qualifier("memberReminderClock") Clock clock,
            @Value("${app.project-alerts.time-zone:Asia/Ho_Chi_Minh}") String zone) {
        this.monitor=monitor;this.clock=clock;this.zone=ZoneId.of(zone);
    }
    @Scheduled(fixedDelayString="${app.project-alerts.monitor.interval-ms:60000}",
            initialDelayString="${app.project-alerts.monitor.initial-delay-ms:30000}")
    public void scan() {
        try {monitor.scan(clock.instant(),zone);}
        catch(RuntimeException failure) {log.error("Project alert background scan failed; the next scan will retry",failure);}
    }
}
