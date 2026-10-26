package com.example.starter_project_2025.system.project.milestone.risk;
import com.example.starter_project_2025.system.project.milestone.domain.*;
import org.springframework.stereotype.Component;
import java.math.*;
import java.time.*;
@Component
public class MilestoneRiskEvaluator {
    public MilestoneRiskDtos.Progress evaluate(Milestone milestone, long done, long total, Instant now) {
        BigDecimal rate = total == 0 ? BigDecimal.ZERO : BigDecimal.valueOf(done).multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP);
        boolean belowTarget = total == 0 || BigDecimal.valueOf(done).multiply(BigDecimal.valueOf(100))
                .compareTo(BigDecimal.valueOf(total).multiply(BigDecimal.valueOf(80))) < 0;
        boolean eligible = milestone.isActive() && milestone.getStatus() == MilestoneStatus.OPEN
                && milestone.getDeadline().isAfter(now) && milestone.getDeadline().isBefore(now.plus(Duration.ofHours(48)))
                && belowTarget;
        return new MilestoneRiskDtos.Progress(done, total, rate, eligible);
    }
}
