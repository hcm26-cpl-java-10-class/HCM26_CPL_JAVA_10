package com.example.starter_project_2025.system.project.milestone.config;

import com.example.starter_project_2025.system.project.milestone.integration.port.TenantSettingsPort;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;

/** Preserves the exact opening instant of milestones scheduled with the legacy offset. */
@Component
@Order(-90)
@RequiredArgsConstructor
public class MilestoneStartScheduleBackfill implements ApplicationRunner {
    private final MilestoneRepository milestones;
    private final TenantSettingsPort tenantSettings;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        for (var milestone : milestones.findAll()) {
            if (!milestone.isAutoStartEnabled() || milestone.scheduledStartAt() != null
                    || milestone.getDeadline() == null || milestone.getDeadlineOffsetDays() == null) continue;
            var instant = milestone.getDeadline().minus(Duration.ofDays(milestone.getDeadlineOffsetDays()));
            LocalDate date = LocalDate.ofInstant(instant, tenantSettings.requireTimeZone(milestone.getTenantId()));
            milestone.backfillSchedule(date, instant);
        }
    }
}
