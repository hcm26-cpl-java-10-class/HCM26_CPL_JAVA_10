package com.example.starter_project_2025.system.exam.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

/**
 * Kết quả xử lý lời mời của một học viên trong bulk invite.
 */
@Getter
@Setter
@Builder
@AllArgsConstructor
public class InvitationBulkItemResult {

    public enum Status {
        SUCCESS,
        SKIPPED,
        FAILED
    }

    private Long userId;
    private String userEmail;
    private String userFullName;
    private Long invitationId;
    private Status status;
    private String reason;
}
