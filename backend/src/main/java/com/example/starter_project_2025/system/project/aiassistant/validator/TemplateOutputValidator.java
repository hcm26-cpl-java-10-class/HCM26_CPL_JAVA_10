package com.example.starter_project_2025.system.project.aiassistant.validator;

import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.*;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.net.URI;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Component
public class TemplateOutputValidator {

    public void validate(GeneratedTemplateOutput output) {

        List<String> errors = new ArrayList<>();

        if (output == null) {
            throw new IllegalArgumentException(
                    "Generated template output must not be null"
            );
        }

        // Validate top-level components
        if (output.projectTemplate() == null) {
            errors.add("Project template information is required");
        }

        if (output.teamConstraints() == null) {
            errors.add("Team constraints are required");
        }

        if (output.milestones() == null || output.milestones().isEmpty()) {
            errors.add("At least one milestone is required");
        }

        if (output.backlogItems() == null || output.backlogItems().isEmpty()) {
            errors.add("At least one backlog item is required");
        }

        if (output.modules() == null || output.modules().isEmpty()) {
            errors.add("At least one module is required");
        }

        if (output.resources() == null || output.resources().isEmpty()) {
            errors.add("At least one resource is required");
        }

        if (output.projectTemplate() != null) {
            validateProjectTemplate(output.projectTemplate(), errors);
        }

        if (output.teamConstraints() != null) {
            validateTeamConstraints(output.teamConstraints(), errors);
        }

        if (output.milestones() != null) {
            validateMilestones(output.milestones(), errors);
        }

        validateBacklogItems(output.backlogItems(), errors);
        validateModules(output.modules(), errors);
        validateResources(output.resources(), errors);

        if (!errors.isEmpty()) {
            throw new IllegalArgumentException(
                    "AI generated invalid template: " + String.join("; ", errors)
            );
        }
    }

    private void validateProjectTemplate(
            ProjectTemplateOutput projectTemplate,
            List<String> errors
    ) {
        if (projectTemplate.code() == null
                || projectTemplate.code().isBlank()) {
            errors.add("Project template code is required");
        } else if (projectTemplate.code().length() > 100) {
            errors.add("Project template code must not exceed 100 characters");
        }

        if (projectTemplate.name() == null
                || projectTemplate.name().isBlank()) {
            errors.add("Project template name is required");
        } else if (projectTemplate.name().length() > 255) {
            errors.add("Project template name must not exceed 255 characters");
        }

        if (projectTemplate.technologyStack() != null
                && projectTemplate.technologyStack().length() > 2000) {
            errors.add("Technology stack must not exceed 2000 characters");
        }

        if (projectTemplate.category() != null
                && projectTemplate.category().length() > 255) {
            errors.add("Project category must not exceed 255 characters");
        }

        if (projectTemplate.level() != null
                && projectTemplate.level().length() > 20) {
            errors.add("Project level must not exceed 20 characters");
        }

        if (projectTemplate.estimatedDurationWeeks() == null
                || projectTemplate.estimatedDurationWeeks() <= 0) {
            errors.add("Estimated duration must be a positive integer");
        }
    }

    private void validateTeamConstraints(
            TeamConstraintsOutput teamConstraints,
            List<String> errors
    ) {
        if (teamConstraints.minMembers() <= 0) {
            errors.add("Minimum team members must be greater than 0");
        }

        if (teamConstraints.maxMembers() < teamConstraints.minMembers()) {
            errors.add("Maximum team members must be greater than or equal to minimum team members");
        }

        TeamConstraintsOutput.RoleQuotasOutput quotas =
                teamConstraints.roleQuotas();

        if (quotas == null) {
            errors.add("Role quotas are required");
            return;
        }

        if (quotas.pm() < 0
                || quotas.ba() < 0
                || quotas.dev() < 0
                || quotas.qa() < 0) {
            errors.add("Role quotas must not contain negative values");
        }

        int totalQuotas =
                quotas.pm() + quotas.ba() + quotas.dev() + quotas.qa();

        if (totalQuotas > teamConstraints.maxMembers()) {
            errors.add("Total role quotas must not exceed maximum team members");
        }

        if (quotas.dev() < 1) {
            errors.add("At least one Developer must be assigned");
        }
    }

    private void validateMilestones(
            List<MilestoneOutput> milestones,
            List<String> errors
    ) {
        if (milestones == null || milestones.isEmpty()) {
            return;
        }

        BigDecimal totalWeight = BigDecimal.ZERO;
        int previousDueAfter = 0;

        for (int i = 0; i < milestones.size(); i++) {

            MilestoneOutput milestone = milestones.get(i);
            String prefix = "Milestone " + (i + 1) + ": ";

            if (milestone == null) {
                errors.add(prefix + "must not be null");
                continue;
            }

            if (milestone.title() == null || milestone.title().isBlank()) {
                errors.add(prefix + "title is required");
            } else if (milestone.title().length() > 120) {
                errors.add(prefix + "title must not exceed 120 characters");
            }

            if (milestone.description() != null
                    && milestone.description().length() > 1000) {
                errors.add(prefix + "description must not exceed 1000 characters");
            }

            if (milestone.dueAfter() == null || milestone.dueAfter() <= 0) {
                errors.add(prefix + "dueAfter must be a positive integer");
            }

            if (!"DAYS".equals(milestone.dueUnit())
                    && !"WEEKS".equals(milestone.dueUnit())) {
                errors.add(prefix + "dueUnit must be DAYS or WEEKS");
            }

            if (milestone.dueAfter() != null
                    && milestone.dueAfter() > 0
                    && milestone.dueUnit() != null
                    && ("DAYS".equals(milestone.dueUnit())
                    || "WEEKS".equals(milestone.dueUnit()))) {

                int currentDueInDays = "WEEKS".equals(milestone.dueUnit())
                        ? milestone.dueAfter() * 7
                        : milestone.dueAfter();

                if (currentDueInDays < previousDueAfter) {
                    errors.add(prefix + "due date must be chronological");
                } else {
                    previousDueAfter = currentDueInDays;
                }
            }

            if (milestone.weight() == null
                    || milestone.weight().compareTo(BigDecimal.ZERO) <= 0) {
                errors.add(prefix + "weight must be greater than 0");
            } else {
                totalWeight = totalWeight.add(milestone.weight());
            }

            if (milestone.orderIndex() == null
                    || milestone.orderIndex() != i + 1) {
                errors.add(prefix + "orderIndex must start at 1 and increment sequentially");
            }

            validateLateSubmission(milestone, prefix, errors);
            validateChecklistItems(milestone, prefix, errors);
            validateRubricCriteria(milestone, prefix, errors);
        }

        if (totalWeight.compareTo(new BigDecimal("100")) != 0) {
            errors.add("Total milestone weights must equal 100");
        }
    }

    private void validateLateSubmission(
            MilestoneOutput milestone,
            String prefix,
            List<String> errors
    ) {
        if (milestone.allowLateSubmission() == null) {
            errors.add(prefix + "allowLateSubmission is required");
            return;
        }

        if (!milestone.allowLateSubmission()) {

            if (milestone.maxLateDays() != null) {
                errors.add(prefix + "maxLateDays must be null when late submission is disabled");
            }

            if (milestone.penaltyPerDayPercent() != null) {
                errors.add(prefix + "penaltyPerDayPercent must be null when late submission is disabled");
            }

            return;
        }

        if (milestone.maxLateDays() == null || milestone.maxLateDays() <= 0) {
            errors.add(prefix + "maxLateDays must be positive when late submission is enabled");
        }

        if (milestone.penaltyPerDayPercent() == null
                || milestone.penaltyPerDayPercent().compareTo(BigDecimal.ZERO) <= 0
                || milestone.penaltyPerDayPercent().compareTo(new BigDecimal("100")) > 0) {
            errors.add(prefix + "penaltyPerDayPercent must be greater than 0 and not exceed 100");
        }
    }

    private void validateChecklistItems(
            MilestoneOutput milestone,
            String prefix,
            List<String> errors
    ) {
        List<ChecklistItemOutput> items = milestone.checklistItems();

        if (items == null || items.isEmpty()) {
            errors.add(prefix + "must contain at least one checklist item");
            return;
        }

        for (int i = 0; i < items.size(); i++) {

            ChecklistItemOutput item = items.get(i);

            if (item == null) {
                errors.add(prefix + "checklist item " + (i + 1) + " must not be null");
                continue;
            }

            if (item.content() == null || item.content().isBlank()) {
                errors.add(prefix + "checklist item content is required");
            } else if (item.content().length() > 500) {
                errors.add(prefix + "checklist item content must not exceed 500 characters");
            }

            if (item.orderIndex() == null || item.orderIndex() != i + 1) {
                errors.add(prefix + "checklist item orderIndex must be sequential");
            }
        }
    }


    private void validateRubricCriteria(
            MilestoneOutput milestone,
            String prefix,
            List<String> errors
    ) {
        List<RubricCriterionOutput> criteria = milestone.rubricCriteria();

        if (criteria == null || criteria.isEmpty()) {
            errors.add(prefix + "must contain at least one rubric criterion");
            return;
        }

        BigDecimal totalWeight = BigDecimal.ZERO;
        BigDecimal totalMaxScore = BigDecimal.ZERO;

        Set<String> criterionCodes = new HashSet<>();

        Set<String> allowedRatingLevels = Set.of(
                "EXCELLENT",
                "GOOD",
                "FAIR",
                "NOT_MET"
        );

        for (int i = 0; i < criteria.size(); i++) {

            RubricCriterionOutput criterion = criteria.get(i);

            String criterionPrefix = prefix + "rubric criterion " + (i + 1) + ": ";

            if (criterion == null) {
                errors.add(criterionPrefix + "must not be null");
                continue;
            }

            // Validate code
            if (criterion.code() == null || criterion.code().isBlank()) {
                errors.add(criterionPrefix + "code is required");
            } else {
                if (criterion.code().length() > 30) {
                    errors.add(criterionPrefix + "code must not exceed 30 characters");
                }

                if (!criterionCodes.add(criterion.code().toUpperCase())) {
                    errors.add(criterionPrefix + "code must be unique within its Rubric");
                }
            }

            // Validate name
            if (criterion.name() == null || criterion.name().isBlank()) {
                errors.add(criterionPrefix + "name is required");
            } else if (criterion.name().length() > 100) {
                errors.add(criterionPrefix + "name must not exceed 100 characters");
            }

            // Validate description
            if (criterion.description() != null
                    && criterion.description().length() > 500) {
                errors.add(criterionPrefix + "description must not exceed 500 characters");
            }

            // Validate weight
            if (criterion.weight() == null
                    || criterion.weight().compareTo(BigDecimal.ZERO) <= 0
                    || criterion.weight().compareTo(new BigDecimal("100")) > 0) {
                errors.add(criterionPrefix + "weight must be greater than 0 and not exceed 100");
            } else {
                totalWeight = totalWeight.add(criterion.weight());
            }

            // Validate maxScore
            if (criterion.maxScore() == null
                    || criterion.maxScore().compareTo(BigDecimal.ZERO) <= 0) {
                errors.add(criterionPrefix + "maxScore must be positive");
            } else {
                totalMaxScore = totalMaxScore.add(criterion.maxScore());
            }

            // maxScore must be equal to weight
            if (criterion.weight() != null
                    && criterion.maxScore() != null
                    && criterion.maxScore().compareTo(criterion.weight()) != 0) {
                errors.add(criterionPrefix + "maxScore must equal weight");
            }

            // Validate orderIndex: starts from 0
            if (criterion.orderIndex() == null || criterion.orderIndex() != i) {
                errors.add(criterionPrefix + "orderIndex must start at 0 and increment sequentially");
            }

            // Validate ratings
            List<RubricRatingOutput> ratings = criterion.ratings();

            if (ratings == null || ratings.size() != 4) {
                errors.add(criterionPrefix + "must contain exactly four ratings");
                continue;
            }

            Set<String> actualRatingLevels = new HashSet<>();

            for (RubricRatingOutput rating : ratings) {

                if (rating == null) {
                    errors.add(criterionPrefix + "rating must not be null");
                    continue;
                }

                // Validate rating level
                if (rating.level() == null
                        || !allowedRatingLevels.contains(rating.level())) {
                    errors.add(criterionPrefix + "rating level must be EXCELLENT, GOOD, FAIR or NOT_MET");
                } else if (!actualRatingLevels.add(rating.level())) {
                    errors.add(criterionPrefix + "rating levels must be unique");
                }

                // Validate rating description
                if (rating.description() == null || rating.description().isBlank()) {
                    errors.add(criterionPrefix + "rating description is required");
                } else if (rating.description().length() > 500) {
                    errors.add(criterionPrefix + "rating description must not exceed 500 characters");
                }
            }

            if (!actualRatingLevels.equals(allowedRatingLevels)) {
                errors.add(criterionPrefix + "must contain all four rating levels");
            }
        }

        // Validate total weight
        if (totalWeight.compareTo(new BigDecimal("100.00")) != 0) {
            errors.add(prefix + "total rubric criterion weights must equal 100.00");
        }

        // Validate total maxScore
        if (totalMaxScore.compareTo(new BigDecimal("100.00")) != 0) {
            errors.add(prefix + "total rubric criterion maxScore must equal 100.00");
        }
    }

    private void validateBacklogItems(
            List<BacklogItemOutput> backlogItems,
            List<String> errors
    ) {
        if (backlogItems == null || backlogItems.isEmpty()) {
            return;
        }

        List<String> allowedRoles = List.of("PM", "BA", "DEV", "QA");

        for (int i = 0; i < backlogItems.size(); i++) {

            BacklogItemOutput item = backlogItems.get(i);
            String prefix = "Backlog item " + (i + 1) + ": ";

            if (item == null) {
                errors.add(prefix + "must not be null");
                continue;
            }

            if (item.title() == null || item.title().isBlank()) {
                errors.add(prefix + "title is required");
            } else if (item.title().length() > 200) {
                errors.add(prefix + "title must not exceed 200 characters");
            }

            if (item.suggestedRole() != null
                    && !allowedRoles.contains(item.suggestedRole())) {
                errors.add(prefix + "suggestedRole must be PM, BA, DEV, QA or null");
            }

            if (item.orderIndex() == null || item.orderIndex() != i + 1) {
                errors.add(prefix + "orderIndex must be sequential");
            }
        }
    }

    private void validateModules(
            List<ModuleOutput> modules,
            List<String> errors
    ) {
        if (modules == null || modules.isEmpty()) {
            return;
        }

        List<String> moduleCodes = new ArrayList<>();

        for (int i = 0; i < modules.size(); i++) {

            ModuleOutput module = modules.get(i);
            String prefix = "Module " + (i + 1) + ": ";

            if (module == null) {
                errors.add(prefix + "must not be null");
                continue;
            }

            if (module.code() == null || module.code().isBlank()) {
                errors.add(prefix + "code is required");
            } else {
                if (module.code().length() > 100) {
                    errors.add(prefix + "code must not exceed 100 characters");
                }

                if (!moduleCodes.add(module.code().toUpperCase())) {
                    errors.add(prefix + "module code must be unique");
                }
            }

            if (module.name() == null || module.name().isBlank()) {
                errors.add(prefix + "name is required");
            } else if (module.name().length() > 255) {
                errors.add(prefix + "name must not exceed 255 characters");
            }

            if (module.technologyStack() != null
                    && module.technologyStack().length() > 2000) {
                errors.add(prefix + "technologyStack must not exceed 2000 characters");
            }

            if (module.category() != null && module.category().length() > 255) {
                errors.add(prefix + "category must not exceed 255 characters");
            }

            if (module.level() != null && module.level().length() > 20) {
                errors.add(prefix + "level must not exceed 20 characters");
            }

            if (module.estimatedDurationWeeks() == null
                    || module.estimatedDurationWeeks() <= 0) {
                errors.add(prefix + "estimatedDurationWeeks must be positive");
            }
        }
    }

    private void validateResources(
            List<ResourceOutput> resources,
            List<String> errors
    ) {
        if (resources == null || resources.isEmpty()) {
            return;
        }

        for (int i = 0; i < resources.size(); i++) {

            ResourceOutput resource = resources.get(i);
            String prefix = "Resource " + (i + 1) + ": ";

            if (resource == null) {
                errors.add(prefix + "must not be null");
                continue;
            }

            if (resource.title() == null || resource.title().isBlank()) {
                errors.add(prefix + "title is required");
            } else if (resource.title().length() > 255) {
                errors.add(prefix + "title must not exceed 255 characters");
            }

            if (resource.description() != null
                    && resource.description().length() > 1000) {
                errors.add(prefix + "description must not exceed 1000 characters");
            }

            if (!"LINK".equals(resource.kind())) {
                errors.add(prefix + "kind must be LINK");
            }

            if (resource.url() == null || resource.url().isBlank()) {
                errors.add(prefix + "URL is required");
            } else if (resource.url().length() > 2000
                    || !isValidHttpUrl(resource.url())) {
                errors.add(prefix + "URL must be a valid HTTP or HTTPS URL");
            }

            if (resource.orderIndex() == null || resource.orderIndex() != i + 1) {
                errors.add(prefix + "orderIndex must be sequential");
            }
        }
    }

    private boolean isValidHttpUrl(String value) {
        try {
            URI uri = URI.create(value);
            return ("http".equalsIgnoreCase(uri.getScheme())
                    || "https".equalsIgnoreCase(uri.getScheme()))
                    && uri.getHost() != null
                    && !uri.getHost().isBlank();
        } catch (IllegalArgumentException e) {
            return false;
        }
    }
}