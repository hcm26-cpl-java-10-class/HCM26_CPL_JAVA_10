package com.example.starter_project_2025.system.project.milestone.submission.mock;

import com.example.starter_project_2025.system.project.milestone.domain.LatePolicyType;
import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneArtifactSubmission;
import com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneArtifactSubmissionRepository;
import com.example.starter_project_2025.system.project.milestone.integration.mock.MockMilestoneData;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TeamArtifactSubmissionDemoInitializerTest {

    @Test
    void seedsFourImmutableVersionsForAnEmptyTeamMilestone() {
        MilestoneRepository milestones = mock(MilestoneRepository.class);
        MilestoneArtifactSubmissionRepository submissions = mock(MilestoneArtifactSubmissionRepository.class);
        Milestone milestone = Milestone.create(
                MockMilestoneData.TENANT_ID,
                null,
                3L,
                "Team Demo Milestone",
                "Demo fixture",
                Instant.now().plusSeconds(86_400),
                true,
                UUID.randomUUID(),
                UUID.randomUUID(),
                LatePolicyType.NO_LATE,
                null,
                null,
                UUID.randomUUID(),
                Instant.now());

        when(milestones.findByTenantIdAndTeamIdAndActiveTrueOrderByDeadlineAscIdAsc(
                MockMilestoneData.TENANT_ID, 3L)).thenReturn(List.of(milestone));
        when(submissions.findByTenantIdAndTeamIdAndMilestoneIdOrderBySubmittedAtDesc(
                MockMilestoneData.TENANT_ID, 3L, milestone.getId())).thenReturn(List.of());

        TeamArtifactSubmissionDemoInitializer initializer = new TeamArtifactSubmissionDemoInitializer(
                milestones, submissions, new ObjectMapper());
        ReflectionTestUtils.setField(initializer, "enabled", true);
        ReflectionTestUtils.setField(initializer, "teamId", 3L);

        initializer.run();

        var captor = org.mockito.ArgumentCaptor.forClass((Class<List<MilestoneArtifactSubmission>>) (Class<?>) List.class);
        verify(submissions).saveAllAndFlush(captor.capture());
        assertEquals(List.of(1L, 2L, 3L, 4L), captor.getValue().stream()
                .map(MilestoneArtifactSubmission::getVersion).toList());
        assertEquals(3L, captor.getValue().get(0).getTeamId());
        assertEquals(milestone.getId(), captor.getValue().get(0).getMilestoneId());
    }
}
