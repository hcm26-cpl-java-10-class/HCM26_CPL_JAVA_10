package com.example.starter_project_2025.system.project.alert;

import com.example.starter_project_2025.system.project.sprint.SprintStatus;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.ZoneId;

@Component
public class ProjectAlertBacklogPolicy {
    public boolean eligible(SprintBacklog item, Instant now, ZoneId zone) {
        if (item.getSprint() != null && item.getSprint().getStatus() != SprintStatus.ACTIVE) {
            return false;
        }
        return item.getStatus() != SprintBacklogStatus.DONE
                && item.getEndDate() != null
                && item.getEndDate().atZone(zone).toInstant().isBefore(now);
    }
}
