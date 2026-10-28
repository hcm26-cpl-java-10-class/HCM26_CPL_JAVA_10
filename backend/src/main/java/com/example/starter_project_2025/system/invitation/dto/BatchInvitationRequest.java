package com.example.starter_project_2025.system.invitation.dto;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchInvitationRequest {

    @NotNull(message = "examId không được để trống")
    private Long examId;

    private List<Long> userIds;

    private String note;

    private LocalDateTime expiresAt;
}
