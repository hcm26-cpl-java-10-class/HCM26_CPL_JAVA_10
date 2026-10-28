package com.example.starter_project_2025.system.project.alert;

import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneStatus;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus;
import org.springframework.stereotype.Component;
import java.math.*;
import java.time.*;
import java.util.List;
import static com.example.starter_project_2025.system.project.alert.ProjectAlertDtos.Progress;

@Component
public class ProjectAlertMilestonePolicy {
    public Progress evaluate(Milestone milestone, List<SprintBacklog> items, Instant now) {
        long done=items.stream().filter(item->item.getStatus()==SprintBacklogStatus.DONE).count();
        long total=items.size();
        BigDecimal percentage=total==0?BigDecimal.ZERO:BigDecimal.valueOf(done).multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(total),2,RoundingMode.HALF_UP);
        boolean upcoming=milestone.getDeadline().isAfter(now)
                &&!milestone.getDeadline().isAfter(now.plus(Duration.ofHours(48)));
        boolean open=milestone.getStatus()==MilestoneStatus.PLANNED||milestone.getStatus()==MilestoneStatus.OPEN;
        // Compare counts before rounding: a displayed 80.00% may still be below 80%.
        boolean below=total==0||BigDecimal.valueOf(done).multiply(BigDecimal.valueOf(100))
                .compareTo(BigDecimal.valueOf(total).multiply(BigDecimal.valueOf(80)))<0;
        return new Progress(true,done,total,percentage,"BACKLOG_ITEMS",milestone.isActive()&&open&&upcoming&&below);
    }
}
