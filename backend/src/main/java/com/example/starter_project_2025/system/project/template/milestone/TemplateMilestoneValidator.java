package com.example.starter_project_2025.system.project.template.milestone;

import com.example.starter_project_2025.system.project.template.ProjectTemplateException;
import java.math.BigDecimal;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class TemplateMilestoneValidator {
    public void validate(TemplateMilestonePlanRequest request) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        if (!validVersion(request.lockVersion())) {
            error(errors, "lockVersion", "A valid template revision is required. Please reload the template");
        }
        if (request.milestones() == null || request.milestones().isEmpty()) {
            error(errors, "milestones", "Add at least one milestone before saving");
        } else {
            Set<Long> ids = new HashSet<>();
            BigDecimal total = BigDecimal.ZERO;
            boolean validWeights = true;
            for (int index = 0; index < request.milestones().size(); index++) {
                var milestone = request.milestones().get(index);
                String path = "milestones[" + index + "]";
                if (milestone == null) {
                    error(errors, path, "Enter the milestone information");
                    validWeights = false;
                    continue;
                }
                id(errors, path + ".id", milestone.id(), ids);
                text(errors, path + ".title", milestone.title(), 120, "Milestone name");
                if (milestone.description() != null && milestone.description().strip().length() > 1000) {
                    error(errors, path + ".description", "Description must not exceed 1000 characters");
                }
                if (!positiveInteger(milestone.dueAfter())) {
                    error(errors, path + ".dueAfter", "Due after must be a positive whole number");
                }
                if (milestone.dueUnit() == null) {
                    error(errors, path + ".dueUnit", "Select days or weeks");
                }
                if (!validWeight(milestone.weight())) {
                    error(errors, path + ".weight", "Weight must be between 0 and 100 with up to 2 decimal places");
                    validWeights = false;
                } else {
                    total = total.add(milestone.weight());
                }
                checklist(errors, path, milestone.checklistItems());
                if (milestone.mandatory() == null) error(errors, path + ".mandatory", "Choose whether the milestone is required");
                if (milestone.rubricVersionId() == null) error(errors, path + ".rubricVersionId", "Select a published rubric version");
                if (milestone.latePolicy() != null) {
                    latePolicy(errors, path, milestone.latePolicy());
                } else {
                    error(errors, path + ".latePolicy", "Configure a late submission policy for this milestone");
                }
            }
            if (validWeights && total.compareTo(new BigDecimal("100")) != 0) {
                error(errors, "totalWeight", "Milestone weights must total 100%");
            }
        }
        if (!errors.isEmpty()) {
            throw new ProjectTemplateException(422, "Please correct the highlighted fields", errors);
        }
    }

    private void latePolicy(Map<String, List<String>> errors, String path, TemplateMilestonePlanRequest.LatePolicy policy) {
        if (policy.allowLateSubmission() == null) {
            error(errors, path + ".latePolicy.allowLateSubmission", "Choose whether late submissions are allowed");
            return;
        }
        if (!policy.allowLateSubmission()) return;
        if (!positiveInteger(policy.maxLateDays())) {
            error(errors, path + ".latePolicy.maxLateDays", "Maximum late days must be a positive whole number");
        }
        if (!validWeight(policy.penaltyPerDayPercent())) {
            error(errors, path + ".latePolicy.penaltyPerDayPercent",
                    "Daily penalty must be between 0 and 100 with up to 2 decimal places");
        }
    }

    private void checklist(Map<String, List<String>> errors, String path,
            List<TemplateMilestonePlanRequest.ChecklistItem> items) {
        if (items == null || items.isEmpty() || items.size() > 100) {
            error(errors, path + ".checklistItems", "Provide between 1 and 100 checklist items");
            return;
        }
        Set<Long> ids = new HashSet<>();
        for (int index = 0; index < items.size(); index++) {
            var item = items.get(index);
            String itemPath = path + ".checklistItems[" + index + "]";
            if (item == null) {
                error(errors, itemPath, "Enter the checklist item information");
                continue;
            }
            id(errors, itemPath + ".id", item.id(), ids);
            text(errors, itemPath + ".content", item.content(), 500, "Checklist item");
            if (item.mandatory() == null) {
                error(errors, itemPath + ".mandatory", "Choose whether the checklist item is required");
            }
        }
    }

    private void id(Map<String, List<String>> errors, String path, BigDecimal id, Set<Long> ids) {
        if (id == null) return;
        try {
            long value = id.longValueExact();
            if (value > 0 && ids.add(value)) return;
        } catch (ArithmeticException exception) {
            error(errors, path, "Use a valid, unique ID for each saved item");
            return;
        }
        error(errors, path, "Use a valid, unique ID for each saved item");
    }

    private void text(Map<String, List<String>> errors, String path, String value, int maximum, String label) {
        if (value == null || value.isBlank() || value.strip().length() > maximum) {
            error(errors, path, label + " must contain 1 to " + maximum + " characters");
        }
    }

    private boolean positiveInteger(BigDecimal value) {
        try {
            return value != null && value.intValueExact() > 0;
        } catch (ArithmeticException exception) {
            return false;
        }
    }

    private boolean validVersion(BigDecimal value) {
        try {
            return value != null && value.longValueExact() >= 0;
        } catch (ArithmeticException exception) {
            return false;
        }
    }

    private boolean validWeight(BigDecimal value) {
        return value != null && value.signum() >= 0 && value.compareTo(new BigDecimal("100")) <= 0
                && value.stripTrailingZeros().scale() <= 2;
    }

    private void error(Map<String, List<String>> errors, String path, String message) {
        errors.put(path, List.of(message));
    }
}
