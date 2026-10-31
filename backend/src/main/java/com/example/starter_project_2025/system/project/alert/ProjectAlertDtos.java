package com.example.starter_project_2025.system.project.alert;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

public final class ProjectAlertDtos {
    private ProjectAlertDtos() { }
    // Keep INACTIVE readable for historical database rows; new requests reject it.
    public enum Kind { BACKLOG, MILESTONE, INACTIVE }
    public record Filter(Long programId, Long cohortId, Long classId, Long teamId, String teamSearch,
                         String deadlineStatus, int windowHours, int page, int size) { }
    public record TeamInfo(Long id, String code, String name, Long classId, String classCode, String className,
                           Long programId, String programName, Long cohortId, String cohortName,
                           Long projectId, String projectName, String projectStatus) { }
    public record Options(List<TeamInfo> teams, Map<String,Boolean> permissions, String timeZone, List<ClassInfo> classes) { }
    public record ClassInfo(Long id, String code, String name, Long programId, String programName,
                            Long cohortId, String cohortName, long studentCount, long teamCount) { }
    public record Page<T>(List<T> content, long total, int page, int size, Instant asOf, String timeZone) { }
    public record BacklogRow(String id, TeamInfo team, String title, String workType, String status,
                             Instant deadline, String deadlineStatus, Long version, Long assigneeUserId,
                             String assigneeName, boolean canSend) { }
    public record Progress(boolean configured, long done, long total, BigDecimal percentage,
                           String source, boolean atRisk) { }
    public record SubmissionSummary(String status, long versionCount, Long latestVersion, Instant submittedAt,
                                    boolean submittedLate, String acceptanceStatus) {
        public static SubmissionSummary none() { return new SubmissionSummary("NOT_SUBMITTED",0,null,null,false,"NOT_AVAILABLE"); }
    }
    public record MilestoneRow(String id, TeamInfo team, String title, String status, Instant deadline,
                               String deadlineStatus, long version, Progress progress,
                               boolean canSend, boolean mandatory, String alertReason) { }
    public record MemberRow(String id, TeamInfo team, String userCode, String displayName, String projectRole,
                            Instant joinedAt, Instant lastTaskStartedAt, String activityStatus, boolean inactive,
                            Instant lastReminderAt, Instant nextReminderAt, boolean coolingDown, boolean canSend,
                            MemberWorkSummary workResults, Instant pendingSince) { }
    public record MemberWorkSummary(long assigned,long done,long overdue,long inReview,long withoutDeadline,
                                    BigDecimal percentage) { }
    public record MemberWorkDetail(Long userId,String displayName,TeamInfo team,MemberWorkSummary summary,
                                   List<BacklogRow> items) { }
    public record Selection(@NotBlank String id, @PositiveOrZero Long version) { }
    public record Send(@NotNull @Positive Long teamId, @NotNull Kind kind,
                       @NotEmpty @Size(max=200) List<@NotNull @Valid Selection> selections,
                       @Size(max=500,message="Warning note cannot exceed 500 characters") String warningNote) { }
    public record Result(UUID batchId, UUID eventId, String status, int recipientCount, Instant createdAt,
                         String correlationId) { }
    public record History(UUID batchId, Kind kind, String warningNote, int recipientCount, String status,
                          Instant createdAt, String correlationId) { }
    public record Links(@NotNull @PositiveOrZero Long milestoneVersion,
                        @NotNull @Size(max=500) Set<@Positive Long> backlogItemIds) { }
    public record LinkOptions(boolean configured, long milestoneVersion, Set<Long> selectedIds,
                               List<BacklogRow> availableItems) { }
    public record CooldownMember(Long userId, String userCode, String displayName, Instant nextReminderAt) { }
}
