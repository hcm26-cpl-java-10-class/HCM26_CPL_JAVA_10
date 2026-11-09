package com.example.starter_project_2025.system.project.task.reminder;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;
public final class MemberReminderDtos {
    private MemberReminderDtos(){}
    public record Send(@NotEmpty List<@NotNull @Positive Long> recipientUserIds,
            @NotBlank(message="Reminder note is required")
            @Size(max=500,message="Reminder note cannot exceed 500 characters") String warningNote){}
    public record Member(Long userId,String userCode,String displayName,Instant joinedAt,Instant lastContributionAt,
            String activityStatus,boolean inactive,Instant lastReminderAt,Instant nextReminderAt,boolean coolingDown){}
    public record Page(UUID projectId,String projectName,long inactivityHours,long cooldownSeconds,boolean canSend,
            List<Member> content){}
    public record Result(UUID batchId,UUID eventId,UUID projectId,int recipientCount,String status,Instant createdAt,String correlationId){}
    public record CooldownMember(Long userId,String userCode,String displayName,Instant nextReminderAt){}
    public record CooldownError(String message,Map<String,List<String>> errors,List<CooldownMember> cooldownMembers){}
    public record History(UUID batchId,Long actorId,String warningNote,String status,Instant createdAt,String correlationId){}
    public record Event(UUID event_id,String event_type,UUID project_id,Long tenant_id,Long actor_id,String warning_note,
            List<Long> recipient_user_ids,List<String> channels,Instant occurred_at,String correlation_id){}
}
