package com.example.starter_project_2025.system.project.milestone.submission.mock;

import com.example.starter_project_2025.system.project.milestone.integration.mock.MockMilestoneData;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneArtifactSubmission;
import com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneArtifactSubmissionRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/** Seeds immutable team artifact versions for the local team-submissions demo only. */
@Slf4j
@Component
@Profile("milestone-mock")
@Order(14)
@RequiredArgsConstructor
public class TeamArtifactSubmissionDemoInitializer implements CommandLineRunner {
    private static final UUID DEMO_STUDENT_ID = UUID.nameUUIDFromBytes(
            "student@example.com".getBytes(StandardCharsets.UTF_8));

    private final MilestoneRepository milestoneRepository;
    private final MilestoneArtifactSubmissionRepository submissionRepository;
    private final ObjectMapper objectMapper;

    @Value("${team.artifact.submission.demo-seed.enabled:false}")
    private boolean enabled;

    @Value("${team.artifact.submission.demo-seed.team-id:3}")
    private Long teamId;

    @Override
    @Transactional
    public void run(String... args) {
        if (!enabled) return;

        var milestone = milestoneRepository
                .findByTenantIdAndTeamIdAndActiveTrueOrderByDeadlineAscIdAsc(
                        MockMilestoneData.TENANT_ID, teamId)
                .stream()
                .filter(candidate -> candidate.getProjectId() == null)
                .findFirst()
                .orElse(null);

        if (milestone == null) {
            log.warn("Team artifact demo seed skipped: no active team-only milestone for team {}.", teamId);
            return;
        }

        if (!submissionRepository.findByTenantIdAndTeamIdAndMilestoneIdOrderBySubmittedAtDesc(
                MockMilestoneData.TENANT_ID, teamId, milestone.getId()).isEmpty()) {
            log.info("Team artifact demo submissions already exist for milestone {}.", milestone.getId());
            return;
        }

        Map<UUID, Boolean> checklist = milestone.getChecklistItems().stream().collect(Collectors.toMap(
                item -> item.getId(), item -> false, (first, second) -> first, LinkedHashMap::new));
        String checklistJson = write(checklist);
        Instant now = Instant.now();
        List<MilestoneArtifactSubmission> versions = java.util.stream.IntStream.rangeClosed(1, 4)
                .mapToObj(version -> MilestoneArtifactSubmission.submit(
                        MockMilestoneData.TENANT_ID,
                        milestone.getProjectId(),
                        teamId,
                        milestone.getId(),
                        DEMO_STUDENT_ID,
                        version,
                        "https://github.com/example/team-pixel-demo",
                        "https://example.github.io/team-pixel-demo",
                        "Demo artifact version " + version,
                        checklistJson,
                        "[]",
                        now.minusSeconds((4L - version) * 3600),
                        false,
                        BigDecimal.ZERO.setScale(2)))
                .toList();

        submissionRepository.saveAllAndFlush(versions);
        log.info("Seeded {} immutable team artifact versions for team {} milestone {}.",
                versions.size(), teamId, milestone.getId());
    }

    private String write(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Unable to serialize team artifact demo data", e);
        }
    }
}
