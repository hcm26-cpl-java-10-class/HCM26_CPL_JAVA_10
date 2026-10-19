package com.example.starter_project_2025.system.invitation.dto;

import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchInvitationItemResult {

    private Long userId;
    private String userEmail;
    private Long invitationId;
    private String status; // SUCCESS, SKIPPED, FAILED
    private String reason;
}
