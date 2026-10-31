package com.example.starter_project_2025.system.project.template.milestone;

import com.example.starter_project_2025.system.project.milestone.domain.LatePenaltyBasis;
import com.example.starter_project_2025.system.project.milestone.domain.LatePolicyType;
import com.example.starter_project_2025.system.project.milestone.dto.request.ChecklistItemRequest;
import com.example.starter_project_2025.system.project.milestone.dto.request.CreateMilestoneRequest;
import com.example.starter_project_2025.system.project.milestone.dto.request.LatePolicyRequest;
import java.time.Instant;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import org.springframework.stereotype.Component;

@Component
public class TemplateMilestoneMapper {
    public TemplateMilestoneCreation forProject(TemplateMilestone milestone, Long teamId, Instant startsAt, ZoneId zone) {
        long days = milestone.getDueAfter().longValue() * (milestone.getDueUnit() == TemplateMilestoneTimeUnit.WEEKS ? 7L : 1L);
        Instant deadline = startsAt.plus(days, ChronoUnit.DAYS);
        boolean allowLate = Boolean.TRUE.equals(milestone.getAllowLateSubmission());
        LatePolicyRequest policy = allowLate
                ? new LatePolicyRequest(LatePolicyType.ALLOW_LATE, deadline.plus(milestone.getMaxLateDays(), ChronoUnit.DAYS),
                        milestone.getPenaltyPerDayPercent(), LatePenaltyBasis.PER_DAY)
                : new LatePolicyRequest(LatePolicyType.NO_LATE, null, null);
        return new TemplateMilestoneCreation(milestone.getId(), new CreateMilestoneRequest(teamId,
                milestone.getTitle(), milestone.getDescription(), deadline, milestone.isMandatory(),
                milestone.getChecklistItems().stream().map(item -> new ChecklistItemRequest(
                        item.getContent(), item.isMandatory(), item.getOrderIndex())).toList(),
                milestone.getRubricVersion().getId(), null, policy, null, milestone.getWeight(),
                deadline.minus(7, ChronoUnit.DAYS).atZone(zone).toLocalDate()));
    }
}
