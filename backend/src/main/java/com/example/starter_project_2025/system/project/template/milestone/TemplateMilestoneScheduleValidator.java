package com.example.starter_project_2025.system.project.template.milestone;

import com.example.starter_project_2025.system.project.template.ProjectTemplateException;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class TemplateMilestoneScheduleValidator {
    public void validate(TemplateMilestonePlanRequest request, Integer durationWeeks) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        if (durationWeeks == null || durationWeeks <= 0) {
            errors.put("estimatedDurationWeeks", List.of("Set a valid estimated duration in General information before saving milestones"));
        } else if (request.milestones() != null) {
            long durationDays = durationWeeks.longValue() * 7;
            for (int index = 0; index < request.milestones().size(); index++) {
                var milestone = request.milestones().get(index);
                if (milestone != null && days(milestone.dueAfter(), milestone.dueUnit()) > durationDays) {
                    errors.put("milestones[" + index + "].dueAfter", List.of(
                            "Due after must not exceed the template duration of " + durationWeeks + " weeks (" + durationDays + " days)"));
                }
            }
        }
        if (!errors.isEmpty()) {
            throw new ProjectTemplateException(422, "Please correct the milestone schedule", errors);
        }
    }

    public void validateDuration(Integer durationWeeks, List<TemplateMilestone> milestones) {
        long latestDay = milestones.stream().mapToLong(milestone ->
                days(milestone.getDueAfter(), milestone.getDueUnit())).max().orElse(0);
        if (latestDay > durationWeeks.longValue() * 7) {
            long minimumWeeks = (latestDay + 6) / 7;
            String message = "Estimated duration must be at least " + minimumWeeks
                    + " weeks to include all saved milestones. Update the milestone schedule first or increase the duration.";
            throw new ProjectTemplateException(422, message, Map.of("estimatedDurationWeeks", List.of(message)));
        }
    }

    private long days(BigDecimal count, TemplateMilestoneTimeUnit unit) {
        if (count == null) return 0;
        try {
            return days(count.intValueExact(), unit);
        } catch (ArithmeticException exception) {
            return 0;
        }
    }

    private long days(Integer count, TemplateMilestoneTimeUnit unit) {
        return count == null || count <= 0 || unit == null ? 0
                : count.longValue() * (unit == TemplateMilestoneTimeUnit.WEEKS ? 7 : 1);
    }
}
