package com.example.starter_project_2025.system.project.rubric.config;

import com.example.starter_project_2025.system.project.milestone.integration.mock.MockMilestoneData;
import com.example.starter_project_2025.system.project.rubric.domain.*;
import com.example.starter_project_2025.system.project.rubric.repository.RubricRepository;
import com.example.starter_project_2025.system.project.rubric.integration.RubricTenantIdentity;
import org.springframework.jdbc.core.JdbcTemplate;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;

@Component
@Profile("!milestone-real-integrations")
@Order(11)
@RequiredArgsConstructor
public class RubricDataInitializer implements CommandLineRunner {
    private static final UUID ACTOR_ID = UUID.nameUUIDFromBytes("teacher@example.com".getBytes(StandardCharsets.UTF_8));
    private final RubricRepository repository;
    private final Clock milestoneClock;
    private final JdbcTemplate jdbc;

    @Value("${milestone.mock.seed-enabled:true}")
    private boolean enabled;

    @Override
    @Transactional
    public void run(String... args) {
        if (!enabled) return;
        seed(UUID.fromString("22222222-2222-2222-2222-222222222210"), MockMilestoneData.RUBRIC_ID,
                "Milestone Delivery Rubric", "General delivery quality and completeness.", List.of(
                        criterion("FUNCTIONALITY", "Functionality", "50.00", "5.00", 0),
                        criterion("QUALITY", "Code quality", "30.00", "3.00", 1),
                        criterion("DOCUMENTATION", "Documentation", "20.00", "2.00", 2)));
        seed(UUID.fromString("22222222-2222-2222-2222-222222222211"), MockMilestoneData.PRESENTATION_RUBRIC_ID,
                "Demo and Presentation Rubric", "Presentation, communication and question handling.", List.of(
                        criterion("DEMO", "Product demonstration", "40.00", "4.00", 0),
                        criterion("COMMUNICATION", "Communication", "35.00", "3.50", 1),
                        criterion("QNA", "Question handling", "25.00", "2.50", 2)));
        seed(UUID.fromString("22222222-2222-2222-2222-222222222212"), MockMilestoneData.DOCUMENTATION_RUBRIC_ID,
                "Technical Documentation Rubric", "Completeness and accuracy of technical documentation.", List.of(
                        criterion("COMPLETENESS", "Completeness", "45.00", "4.50", 0),
                        criterion("ACCURACY", "Technical accuracy", "35.00", "3.50", 1),
                        criterion("CLARITY", "Clarity and structure", "20.00", "2.00", 2)));
    }

    private void seed(UUID rubricId, UUID versionId, String name, String description,
                      List<RubricVersion.CriterionValue> criteria) {
        if (repository.existsById(rubricId)) {
            jdbc.update("UPDATE rubrics SET tenant_id = ? WHERE rubric_id = ? AND tenant_id = ?",
                    RubricTenantIdentity.from(MockMilestoneData.TENANT_ID), rubricId,
                    UUID.nameUUIDFromBytes(("tenant:" + MockMilestoneData.TENANT_ID).getBytes(StandardCharsets.UTF_8)));
            return;
        }
        Instant now = milestoneClock.instant();
        Rubric rubric = Rubric.create(rubricId, RubricTenantIdentity.from(MockMilestoneData.TENANT_ID),
                name, description, ACTOR_ID, now);
        RubricVersion version = RubricVersion.draft(versionId, rubric, 1, ACTOR_ID, now);
        version.replaceDraft(name, description, criteria, ACTOR_ID, now);
        version.publish(ACTOR_ID, now);
        rubric.addVersion(version);
        repository.save(rubric);
    }

    private static RubricVersion.CriterionValue criterion(String code, String name, String weight,
                                                            String maxScore, int order) {
        return new RubricVersion.CriterionValue(code, name, null, new BigDecimal(weight),
                new BigDecimal(maxScore), order, ratingGuidance(code));
    }

    private static List<RubricVersion.RatingValue> ratingGuidance(String code) {
        return switch (code) {
            case "FUNCTIONALITY" -> ratings(
                    "All required functionality works end-to-end, including edge cases.",
                    "The main flow works; only minor requirements or edge cases are incomplete.",
                    "The core flow is partially working, but several requirements are incomplete.",
                    "Required functionality is missing, unusable, or consistently fails.");
            case "QUALITY" -> ratings(
                    "Code is clean, maintainable, well-tested, and follows project conventions.",
                    "Code is generally maintainable with a few quality or testing gaps.",
                    "Code works but has notable duplication, complexity, or missing tests.",
                    "Code is difficult to maintain, error-prone, or lacks meaningful tests.");
            case "DOCUMENTATION" -> ratings(
                    "Documentation is complete, accurate, and enables another developer to run the work.",
                    "Documentation covers the main setup and usage with minor omissions.",
                    "Documentation is incomplete or requires significant clarification to use.",
                    "Documentation is missing, inaccurate, or does not explain how to use the work.");
            case "DEMO" -> ratings(
                    "The demonstration is structured, concise, and clearly shows the completed outcome.",
                    "The main outcome is demonstrated clearly with a few presentation gaps.",
                    "The demonstration is difficult to follow or omits important completed features.",
                    "The outcome cannot be demonstrated or the demonstration does not reflect the work.");
            case "COMMUNICATION" -> ratings(
                    "Communication is clear, confident, well-structured, and appropriate for the audience.",
                    "Communication is understandable with occasional lack of structure or detail.",
                    "The explanation is sometimes unclear and requires repeated clarification.",
                    "Communication is unclear, disorganized, or prevents the audience from understanding the work.");
            case "QNA" -> ratings(
                    "Answers are accurate, specific, and explain the reasoning behind key decisions.",
                    "Most questions are answered correctly with minor gaps in depth or precision.",
                    "Answers address only part of the questions or rely on vague explanations.",
                    "Questions are not answered or answers show no understanding of the work.");
            case "COMPLETENESS" -> ratings(
                    "All requested sections, examples, and supporting artifacts are present.",
                    "Most requested content is present with only minor omissions.",
                    "Several requested sections or artifacts are missing.",
                    "The documentation is largely incomplete and cannot support the work.");
            case "ACCURACY" -> ratings(
                    "Technical details, commands, examples, and diagrams are correct and consistent.",
                    "The documentation is mostly accurate with minor technical inconsistencies.",
                    "Multiple inaccuracies could mislead a reader or require verification.",
                    "Information is substantially incorrect or contradicts the implemented system.");
            case "CLARITY" -> ratings(
                    "Content is logically structured, easy to scan, and uses clear terminology.",
                    "Content is generally clear with a few organization or wording issues.",
                    "The structure or wording makes important information difficult to find.",
                    "Content is confusing, disorganized, or not understandable to its audience.");
            default -> ratings(
                    "The criterion is fully satisfied with clear and reliable evidence.",
                    "The criterion is mostly satisfied with minor gaps.",
                    "The criterion is partially satisfied with significant gaps.",
                    "The criterion is not satisfied or evidence is unavailable.");
        };
    }

    private static List<RubricVersion.RatingValue> ratings(String excellent, String good,
                                                            String fair, String notMet) {
        return List.of(
                new RubricVersion.RatingValue(RubricRatingLevel.EXCELLENT, excellent),
                new RubricVersion.RatingValue(RubricRatingLevel.GOOD, good),
                new RubricVersion.RatingValue(RubricRatingLevel.FAIR, fair),
                new RubricVersion.RatingValue(RubricRatingLevel.NOT_MET, notMet));
    }
}
