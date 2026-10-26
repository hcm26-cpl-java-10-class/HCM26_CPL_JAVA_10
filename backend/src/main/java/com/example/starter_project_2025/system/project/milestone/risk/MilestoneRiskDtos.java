package com.example.starter_project_2025.system.project.milestone.risk;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneStatus;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
public final class MilestoneRiskDtos {
    private MilestoneRiskDtos() { }
    public record Send(@NotNull @PositiveOrZero Long version,
            @Size(max = 500, message = "Guidance note cannot exceed 500 characters") String warningNote) { }
    public record Progress(long doneTasks, long totalTasks, BigDecimal completionRate, boolean eligible) { }
    public record Item(UUID id, String title, MilestoneStatus status, Instant deadline, long version,
            boolean atRisk, Progress progress, boolean canSend) { }
    public record Page(Long projectId, String projectName, Long actorId, Long tenantId, boolean canSend,
            int warningWindowHours, int completionThreshold, List<Item> content) { }
    public record Result(UUID alertId, UUID eventId, UUID milestoneId, boolean atRisk, int recipientCount,
            String status, Instant createdAt, String correlationId) { }
    public record History(UUID alertId, Long actorId, String warningNote, String status,
            Instant createdAt, String correlationId) { }
    public record Event(UUID event_id, String event_type, Long project_id, Long tenant_id, UUID milestone_id,
            String milestone_title, Long actor_id, String warning_note, List<Long> recipient_ids,
            List<String> channels, Progress progress, Instant occurred_at, String correlation_id) { }
}
