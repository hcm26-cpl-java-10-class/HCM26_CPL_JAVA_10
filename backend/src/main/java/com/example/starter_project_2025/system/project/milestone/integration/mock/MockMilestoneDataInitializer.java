package com.example.starter_project_2025.system.project.milestone.integration.mock;

import com.example.starter_project_2025.system.project.milestone.domain.LatePolicyType;
import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Slf4j
@Order(12)
@Component
@Profile("!milestone-real-integrations")
@RequiredArgsConstructor
public class MockMilestoneDataInitializer implements CommandLineRunner {

    private static final UUID TEACHER_ACTOR_ID = UUID.nameUUIDFromBytes(
            "teacher@example.com".getBytes(StandardCharsets.UTF_8));

    private final MilestoneRepository milestoneRepository;
    private final Clock milestoneClock;

    @Value("${milestone.mock.seed-enabled:true}")
    private boolean seedEnabled;

    @Override
    @Transactional
    public void run(String... args) {
        if (!seedEnabled) {
            log.info("Milestone mock data seed is disabled.");
            return;
        }

        Instant now = milestoneClock.instant().truncatedTo(ChronoUnit.SECONDS);

        seed(new SampleMilestone(
                MockMilestoneData.PROJECT_ID,
                "Project Kickoff and Scope Confirmation",
                "Confirm the delivery scope, team responsibilities and communication plan.",
                now.minus(14, ChronoUnit.DAYS),
                true,
                MockMilestoneData.DOCUMENTATION_RUBRIC_ID,
                MockMilestoneData.REVIEWER_ID,
                LatePolicyType.NO_LATE,
                null,
                null,
                List.of(
                        "Project scope is approved",
                        "Team responsibilities are assigned",
                        "Communication channels are documented"
                )
        ), now.minus(30, ChronoUnit.DAYS));

        seed(new SampleMilestone(
                MockMilestoneData.PROJECT_ID,
                "Requirements and Architecture Review",
                "Review functional requirements, core architecture and major technical risks.",
                now.minus(2, ChronoUnit.DAYS),
                true,
                MockMilestoneData.RUBRIC_ID,
                MockMilestoneData.TECHNICAL_REVIEWER_ID,
                LatePolicyType.ALLOW_LATE,
                now.plus(1, ChronoUnit.DAYS),
                new BigDecimal("15.00"),
                List.of(
                        "User stories include acceptance criteria",
                        "Architecture diagram is attached",
                        "Technical risks and mitigations are recorded",
                        "Database model is reviewed"
                )
        ), now.minus(18, ChronoUnit.DAYS));

        seed(new SampleMilestone(
                MockMilestoneData.PROJECT_ID,
                "Core Feature MVP",
                "Deliver the first end-to-end workflow ready for mentor feedback.",
                now.plus(3, ChronoUnit.DAYS),
                true,
                MockMilestoneData.RUBRIC_ID,
                MockMilestoneData.TECHNICAL_REVIEWER_ID,
                LatePolicyType.ALLOW_LATE,
                now.plus(5, ChronoUnit.DAYS),
                new BigDecimal("10.00"),
                List.of(
                        "Core workflow runs end to end",
                        "Source code is pushed",
                        "Automated tests pass",
                        "Known issues are documented"
                )
        ), now.minus(10, ChronoUnit.DAYS));

        seed(new SampleMilestone(
                MockMilestoneData.PROJECT_ID,
                "Sprint Demo 1",
                "Demonstrate completed features and collect structured feedback.",
                now.plus(7, ChronoUnit.DAYS),
                false,
                MockMilestoneData.PRESENTATION_RUBRIC_ID,
                MockMilestoneData.SECONDARY_REVIEWER_ID,
                LatePolicyType.NO_LATE,
                null,
                null,
                List.of(
                        "Demo environment is available",
                        "Presentation stays within 20 minutes",
                        "Questions and feedback are recorded"
                )
        ), now.minus(6, ChronoUnit.DAYS));

        seed(new SampleMilestone(
                MockMilestoneData.PROJECT_ID,
                "Testing and Quality Gate",
                "Complete regression testing and resolve all release-blocking defects.",
                now.plus(14, ChronoUnit.DAYS),
                true,
                MockMilestoneData.RUBRIC_ID,
                MockMilestoneData.TECHNICAL_REVIEWER_ID,
                LatePolicyType.ALLOW_LATE,
                now.plus(16, ChronoUnit.DAYS),
                new BigDecimal("20.00"),
                List.of(
                        "Regression test report is attached",
                        "No critical defects remain open",
                        "Performance checks are completed",
                        "Security checklist is reviewed"
                )
        ), now.minus(3, ChronoUnit.DAYS));

        seed(new SampleMilestone(
                MockMilestoneData.PROJECT_ID,
                "Final Documentation",
                "Finalize technical documentation, user guide and deployment instructions.",
                now.plus(21, ChronoUnit.DAYS),
                true,
                MockMilestoneData.DOCUMENTATION_RUBRIC_ID,
                MockMilestoneData.REVIEWER_ID,
                LatePolicyType.ALLOW_LATE,
                now.plus(24, ChronoUnit.DAYS),
                new BigDecimal("5.00"),
                List.of(
                        "README contains local setup instructions",
                        "API documentation is current",
                        "Deployment and rollback steps are included",
                        "User guide includes screenshots"
                )
        ), now.minus(1, ChronoUnit.DAYS));

        seed(new SampleMilestone(
                MockMilestoneData.PROJECT_ID,
                "Final Product Presentation",
                "Present the completed product, lessons learned and next-step recommendations.",
                now.plus(30, ChronoUnit.DAYS),
                true,
                MockMilestoneData.PRESENTATION_RUBRIC_ID,
                MockMilestoneData.SECONDARY_REVIEWER_ID,
                LatePolicyType.NO_LATE,
                null,
                null,
                List.of(
                        "Production-like demo is prepared",
                        "All team members have a speaking role",
                        "Project outcomes are measured",
                        "Handover package is complete"
                )
        ), now);

        seed(new SampleMilestone(
                MockMilestoneData.SECOND_PROJECT_ID,
                "Secondary Project Discovery",
                "Sample data used to verify that project-scoped queries do not leak milestones.",
                now.plus(10, ChronoUnit.DAYS),
                true,
                MockMilestoneData.DOCUMENTATION_RUBRIC_ID,
                MockMilestoneData.REVIEWER_ID,
                LatePolicyType.NO_LATE,
                null,
                null,
                List.of(
                        "Stakeholders are identified",
                        "Initial scope is documented"
                )
        ), now.minus(2, ChronoUnit.DAYS));

        log.info("Ensured sample milestone, rubric and reviewer data.");
    }

    private void seed(SampleMilestone sample, Instant createdAt) {
        if (milestoneRepository.existsByTenantIdAndProjectIdAndTitle(
                MockMilestoneData.TENANT_ID, sample.projectId(), sample.title())) {
            return;
        }

        Milestone milestone = Milestone.create(
                MockMilestoneData.TENANT_ID,
                sample.projectId(),
                sample.title(),
                sample.description(),
                sample.deadline(),
                sample.mandatory(),
                sample.rubricId(),
                sample.reviewerId(),
                sample.latePolicyType(),
                sample.lateUntil(),
                sample.penaltyPercent(),
                TEACHER_ACTOR_ID,
                createdAt
        );
        for (int index = 0; index < sample.checklist().size(); index++) {
            milestone.addChecklistItem(sample.checklist().get(index), true, index);
        }
        milestoneRepository.save(milestone);
    }

    private record SampleMilestone(
            UUID projectId,
            String title,
            String description,
            Instant deadline,
            boolean mandatory,
            UUID rubricId,
            UUID reviewerId,
            LatePolicyType latePolicyType,
            Instant lateUntil,
            BigDecimal penaltyPercent,
            List<String> checklist
    ) {
    }
}
