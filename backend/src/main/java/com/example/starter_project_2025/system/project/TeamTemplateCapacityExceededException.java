package com.example.starter_project_2025.system.project;

import lombok.Getter;

/**
 * US-10: the DRAFT team size does not fit the capacity window declared by the
 * selected project template.
 * <p>
 * Both "too many members" (AC02) and "not enough members" (AC03) map to
 * {@code HTTP 400} with the {@code ERR_TEAM_CAPACITY_EXCEEDED} code required by
 * the user story; {@link #getReason()} tells the client which side was
 * violated so the UI can render the right message.
 */
@Getter
public class TeamTemplateCapacityExceededException extends RuntimeException {

    public enum Reason {
        MIN_MEMBERS_NOT_MET,
        MAX_MEMBERS_EXCEEDED
    }

    private final Reason reason;
    private final int memberCount;
    private final int minMembers;
    private final int maxMembers;
    private final Long projectTemplateId;
    private final String projectTemplateName;

    private TeamTemplateCapacityExceededException(
            Reason reason,
            int memberCount,
            ProjectTemplateConstraints.Capacity capacity,
            ProjectTemplate template
    ) {
        super(buildMessage(reason, memberCount, capacity, template));
        this.reason = reason;
        this.memberCount = memberCount;
        this.minMembers = capacity.minMembers();
        this.maxMembers = capacity.maxMembers();
        this.projectTemplateId = template == null ? null : template.getId();
        this.projectTemplateName = template == null ? null : template.getName();
    }

    public static TeamTemplateCapacityExceededException exceeded(
            int memberCount,
            ProjectTemplateConstraints.Capacity capacity,
            ProjectTemplate template
    ) {
        return new TeamTemplateCapacityExceededException(
                Reason.MAX_MEMBERS_EXCEEDED, memberCount, capacity, template);
    }

    public static TeamTemplateCapacityExceededException notMet(
            int memberCount,
            ProjectTemplateConstraints.Capacity capacity,
            ProjectTemplate template
    ) {
        return new TeamTemplateCapacityExceededException(
                Reason.MIN_MEMBERS_NOT_MET, memberCount, capacity, template);
    }

    private static String buildMessage(
            Reason reason,
            int memberCount,
            ProjectTemplateConstraints.Capacity capacity,
            ProjectTemplate template
    ) {
        String templateName = template == null ? "đề bài đã chọn" : "“" + template.getName() + "”";
        if (reason == Reason.MIN_MEMBERS_NOT_MET) {
            return "Nhóm hiện có " + memberCount + " thành viên, chưa đủ sĩ số tối thiểu "
                    + capacity.minMembers() + " của " + templateName
                    + ". Vui lòng bổ sung thành viên trước khi gán đề bài.";
        }
        return "Nhóm hiện có " + memberCount + " thành viên, vượt quá sức chứa tối đa "
                + capacity.maxMembers() + " của " + templateName
                + ". Vui lòng điều chỉnh lại sĩ số nhóm trước khi gán đề bài.";
    }
}
