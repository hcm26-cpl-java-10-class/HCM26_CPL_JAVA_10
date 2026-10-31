package com.example.starter_project_2025.system.project.milestone.service;

import com.example.starter_project_2025.system.project.milestone.domain.LatePolicyType;
import com.example.starter_project_2025.system.project.milestone.dto.request.ChecklistItemRequest;
import com.example.starter_project_2025.system.project.milestone.dto.request.CreateMilestoneRequest;
import com.example.starter_project_2025.system.project.milestone.dto.request.LatePolicyRequest;
import com.example.starter_project_2025.system.project.milestone.exception.MilestoneValidationException;
import com.example.starter_project_2025.system.project.milestone.integration.model.RubricCriterionData;
import com.example.starter_project_2025.system.project.milestone.integration.model.RubricSnapshotData;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

@Component
public class MilestoneValidator {

    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100.00");

    public void validate(CreateMilestoneRequest request, RubricSnapshotData rubric, Instant now, ZoneId zone) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        validateDeadline(request.deadline(), now, errors);
        validateStartDate(request.startDate(), request.deadline(), now, zone, errors);
        validateChecklist(request.checklist(), errors);
        validateRubric(rubric, errors);
        validateLatePolicy(request.latePolicy(), request.deadline(), errors);
        if (request.resubmissionPolicy() != null
                && request.resubmissionPolicy().allowed()
                && request.resubmissionPolicy().maxAttempts() != null
                && request.resubmissionPolicy().maxAttempts() < 2) {
            add(errors, "resubmissionPolicy.maxAttempts",
                    "Maximum submission attempts must be at least 2 when resubmission is allowed");
        }
        if (request.weight() != null && (request.weight().signum() < 0
                || request.weight().compareTo(ONE_HUNDRED) > 0 || request.weight().stripTrailingZeros().scale() > 2)) {
            add(errors, "weight", "Milestone weight must be between 0 and 100 with up to 2 decimal places");
        }
        if (!errors.isEmpty()) {
            throw new MilestoneValidationException(errors);
        }
    }

    public Instant requireScheduledStart(LocalDate startDate, Instant deadline, Instant now, ZoneId zone) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        validateStartDate(startDate, deadline, now, zone, errors);
        if (!errors.isEmpty()) throw new MilestoneValidationException(errors);
        return startDate.atStartOfDay(zone).toInstant();
    }

    private void validateStartDate(LocalDate startDate, Instant deadline, Instant now, ZoneId zone,
                                   Map<String, List<String>> errors) {
        if (startDate == null) {
            add(errors, "startDate", "Start date is required");
            return;
        }
        if (!startDate.isAfter(LocalDate.ofInstant(now, zone)))
            add(errors, "startDate", "Start date must be after today in the tenant time zone");
        if (deadline != null && !startDate.atStartOfDay(zone).toInstant().isBefore(deadline))
            add(errors, "startDate", "Start date must be before the deadline");
    }

    private void validateDeadline(Instant deadline, Instant now, Map<String, List<String>> errors) {
        if (deadline != null && !deadline.isAfter(now)) {
            add(errors, "deadline", "Deadline must be in the future according to server time");
        }
    }

    private void validateChecklist(List<ChecklistItemRequest> checklist, Map<String, List<String>> errors) {
        if (checklist == null) return;

        Set<Integer> positions = new HashSet<>();
        for (int i = 0; i < checklist.size(); i++) {
            ChecklistItemRequest item = checklist.get(i);
            if (item == null) {
                add(errors, "checklist[" + i + "]", "Checklist item is required");
                continue;
            }
            if (item.content() == null || item.content().trim().isEmpty()) {
                add(errors, "checklist[" + i + "].content", "Checklist content must not be blank");
            }
            if (item.orderIndex() != null && !positions.add(item.orderIndex())) {
                add(errors, "checklist[" + i + "].orderIndex", "Checklist order must be unique");
            }
        }
    }

    private void validateRubric(RubricSnapshotData rubric, Map<String, List<String>> errors) {
        if (rubric == null || !rubric.active()) {
            add(errors, "rubricSnapshotId", "Rubric is not available");
            return;
        }
        if (rubric.criteria() == null || rubric.criteria().isEmpty()) {
            add(errors, "rubricSnapshotId", "Rubric must contain at least one criterion");
            return;
        }

        BigDecimal total = BigDecimal.ZERO;
        Set<String> codes = new HashSet<>();
        for (int i = 0; i < rubric.criteria().size(); i++) {
            RubricCriterionData criterion = rubric.criteria().get(i);
            String path = "rubric.criteria[" + i + "]";
            if (criterion == null) {
                add(errors, path, "Rubric criterion is required");
                continue;
            }
            if (criterion.code() == null || criterion.code().isBlank()) {
                add(errors, path + ".code", "Criterion code is required");
            } else if (!codes.add(criterion.code())) {
                add(errors, path + ".code", "Criterion code must be unique");
            }
            if (criterion.name() == null || criterion.name().isBlank()) {
                add(errors, path + ".name", "Criterion name is required");
            }
            if (criterion.weight() == null || criterion.weight().compareTo(BigDecimal.ZERO) <= 0) {
                add(errors, path + ".weight", "Criterion weight must be greater than 0");
            } else {
                total = total.add(criterion.weight());
            }
        }
        if (total.compareTo(ONE_HUNDRED) != 0) {
            add(errors, "rubric.totalWeight", "Rubric total weight must equal exactly 100.00 percent");
        }
    }

    public void validateRubric(RubricSnapshotData rubric) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        validateRubric(rubric, errors);
        if (!errors.isEmpty()) throw new MilestoneValidationException(errors);
    }

    private void validateLatePolicy(
            LatePolicyRequest policy, Instant deadline, Map<String, List<String>> errors) {
        if (policy == null || policy.type() == null) return;

        if (policy.type() == LatePolicyType.ALLOW_LATE) {
            if (policy.lateUntil() == null) {
                add(errors, "latePolicy.lateUntil", "Late-until time is required when late submission is allowed");
            } else if (deadline != null && !policy.lateUntil().isAfter(deadline)) {
                add(errors, "latePolicy.lateUntil", "Late-until time must be after the deadline");
            }
            if (policy.penaltyPercent() == null) {
                add(errors, "latePolicy.penaltyPercent", "Late penalty is required when late submission is allowed");
            }
        } else {
            if (policy.lateUntil() != null) {
                add(errors, "latePolicy.lateUntil", "Late-until time must be omitted when late submission is not allowed");
            }
            if (policy.penaltyPercent() != null) {
                add(errors, "latePolicy.penaltyPercent", "Late penalty must be omitted when late submission is not allowed");
            }
        }
    }

    private void add(Map<String, List<String>> errors, String field, String message) {
        errors.computeIfAbsent(field, ignored -> new ArrayList<>()).add(message);
    }
}
