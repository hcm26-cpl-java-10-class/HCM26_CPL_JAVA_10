package com.example.starter_project_2025.system.project.task.alert;

import com.example.starter_project_2025.system.project.task.TaskDTO;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;

public final class TaskAlertDtos {
    private TaskAlertDtos() { }
    public record Selection(@NotNull UUID taskId, @NotNull @PositiveOrZero Long version) { }
    public record Send(@NotNull UUID projectId, @NotEmpty List<@NotNull @Valid Selection> tasks,
                       @NotBlank(message = "Warning note is required")
                       @Size(max = 500, message = "Warning note cannot exceed 500 characters") String warningNote) { }
    public record Result(UUID batchId, UUID eventId, UUID projectId, int taskCount, int recipientCount,
                         TaskAlertData.DeliveryStatus status, Instant createdAt, String correlationId) { }
    public record View(TaskDTO task, boolean canSend) { }
    public record OverduePage(List<View> content, long totalElements, int page, int size, boolean canSend) { }
    public record History(UUID batchId, Long actorId, String warningNote,
                          TaskAlertData.DeliveryStatus status, Instant createdAt, String correlationId) { }
    public record ProjectBinding(@NotNull Long projectId) { }
    public record MemberBinding(@NotNull UUID projectId, @NotNull TaskAlertData.MemberSource source,
                                @NotNull Long sourceMemberId) { }
    public record MemberOption(Long id, TaskAlertData.MemberSource source, Long userId, String displayName, String teamName) { }
    public record AssigneeOption(UUID id, String displayName) { }
    public record ProjectOption(UUID id, String name, String code, boolean canManage) { }
    public record BridgeOption(Long projectId, String projectName, UUID taskProjectId, List<MemberOption> members) { }

    // The payload is immutable. Assignee IDs are UUID member aliases; recipients are deduplicated User IDs.
    public record EventTask(UUID task_id, UUID assignee_id, String title, Instant deadline) { }
    public record Recipient(Long user_id, List<UUID> task_ids) { }
    public record Event(UUID event_id, String event_type, UUID project_id, Long tenant_id, Long actor_id,
                        String warning_note, List<UUID> task_ids, List<UUID> assignee_ids,
                        List<EventTask> tasks, List<Recipient> recipients, List<String> channels,
                        Instant occurred_at, String correlation_id) { }
}
