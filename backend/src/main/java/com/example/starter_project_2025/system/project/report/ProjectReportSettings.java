package com.example.starter_project_2025.system.project.report;

import lombok.Getter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.math.BigDecimal;
import java.time.ZoneId;

@Component
@Getter
public class ProjectReportSettings {
    @Value("${app.project-reports.time-zone:Asia/Ho_Chi_Minh}") private String timeZone;
    @Value("${app.project-reports.at-risk-hours:48}") private long atRiskHours;
    @Value("${app.project-reports.at-risk-threshold:50}") private BigDecimal atRiskThreshold;
    @Value("${app.project-reports.export.ttl-hours:24}") private long exportTtlHours;
    public ZoneId zone() { return ZoneId.of(timeZone); }
}
