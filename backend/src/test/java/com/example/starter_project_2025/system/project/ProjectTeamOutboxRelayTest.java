package com.example.starter_project_2025.system.project;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ProjectTeamOutboxRelayTest {

    @Mock
    private ProjectTeamOutboxRepository outboxRepository;

    @Test
    void publishesPendingEventAndMarksItPublished() {
        ProjectTeamOutboxEvent event = ProjectTeamOutboxEvent.builder()
                .eventType("PROJECT_TEAM_MEMBER_ROLES_UPDATED")
                .aggregateId(12L)
                .payload("{\"teamId\":12}")
                .correlationId("correlation-1")
                .status("PENDING")
                .build();
        ProjectTeamOutboxRelay relay = new ProjectTeamOutboxRelay(outboxRepository);
        when(outboxRepository.findTop50ByStatusOrderByIdAsc("PENDING"))
                .thenReturn(List.of(event));

        relay.publishPending();

        assertEquals("PUBLISHED", event.getStatus());
        assertNotNull(event.getPublishedAt());
        verify(outboxRepository).save(event);
    }
}
