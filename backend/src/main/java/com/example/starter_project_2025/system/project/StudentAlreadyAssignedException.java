package com.example.starter_project_2025.system.project;

import lombok.Getter;
import java.util.List;

@Getter
public class StudentAlreadyAssignedException extends RuntimeException {

    private final Long memberId;
    private final Long conflictingTeamId;
    private final String memberName;

    public StudentAlreadyAssignedException(
            Long memberId,
            Long conflictingTeamId
    ) {
        this(memberId, conflictingTeamId, null);
    }

    public StudentAlreadyAssignedException(
            Long memberId,
            Long conflictingTeamId,
            String memberName
    ) {
        super("Học viên " + (memberName == null || memberName.isBlank()
                ? memberId
                : memberName)
                + " đã được xếp vào nhóm khác, vui lòng tải lại danh sách");
        this.memberId = memberId;
        this.conflictingTeamId = conflictingTeamId;
        this.memberName = memberName;
    }

    public StudentAlreadyAssignedException(
            List<Long> memberIds,
            Long conflictingTeamId,
            List<String> memberNames
    ) {
        super("Các học viên " + String.join(", ", memberNames)
                + " đã được xếp vào nhóm khác, vui lòng tải lại danh sách");
        this.memberId = memberIds.isEmpty() ? null : memberIds.get(0);
        this.conflictingTeamId = conflictingTeamId;
        this.memberName = memberNames.isEmpty() ? null : String.join(", ", memberNames);
    }
}