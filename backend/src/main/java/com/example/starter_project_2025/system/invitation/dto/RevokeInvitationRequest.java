package com.example.starter_project_2025.system.invitation.dto;

import jakarta.validation.constraints.Size;
import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RevokeInvitationRequest {

    @Size(max = 500, message = "Lý do thu hồi không được vượt quá 500 ký tự")
    private String reason;
}
