package com.example.starter_project_2025.system.project.report;

import com.example.starter_project_2025.system.project.milestone.domain.MilestoneLifecycleStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;

@Component
@RequiredArgsConstructor
public class ProjectReportRiskPolicy {
    public record Flags(boolean overdue,boolean late,boolean atRisk) { }
    private final ProjectReportSettings settings;
    public Flags evaluate(MilestoneLifecycleStatus state,Instant deadline,BigDecimal progress,
                          boolean lateSubmission,boolean projectClosed,Instant now) {
        boolean teamWork=!projectClosed&&state!=MilestoneLifecycleStatus.ACCEPTED&&state!=MilestoneLifecycleStatus.SUBMITTED;
        boolean overdue=teamWork&&deadline!=null&&now.isAfter(deadline);
        boolean atRisk=teamWork&&deadline!=null&&deadline.isAfter(now)
                &&!deadline.isAfter(now.plus(Duration.ofHours(settings.getAtRiskHours())))
                &&progress!=null&&progress.compareTo(settings.getAtRiskThreshold())<0;
        return new Flags(overdue,lateSubmission,atRisk);
    }
}
