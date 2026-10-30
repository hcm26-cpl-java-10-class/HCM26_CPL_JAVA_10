package com.example.starter_project_2025.system.schedule;

import jakarta.annotation.PostConstruct;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import java.time.*;
import java.util.Set;

@Data
@Component
@ConfigurationProperties(prefix = "schedule.validation")
public class ScheduleRules {
    private String timezone = "Asia/Ho_Chi_Minh";
    private LocalTime openingTime = LocalTime.of(7, 0);
    private LocalTime closingTime = LocalTime.of(22, 0);
    private Set<Integer> workingDays = Set.of(1, 2, 3, 4, 5, 6, 7);
    private int maxBatchSize = 200;

    @PostConstruct
    void validateConfiguration() {
        ZoneId.of(timezone);
        if (!closingTime.isAfter(openingTime) || maxBatchSize < 1 || maxBatchSize > 200 || workingDays.isEmpty()
                || workingDays.stream().anyMatch(d -> d < 1 || d > 7)) {
            throw new IllegalArgumentException("Invalid schedule.validation configuration");
        }
    }
}
