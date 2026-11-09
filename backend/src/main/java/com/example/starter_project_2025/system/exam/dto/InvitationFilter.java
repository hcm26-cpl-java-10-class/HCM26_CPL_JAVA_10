package com.example.starter_project_2025.system.exam.dto;

import com.example.starter_project_2025.system.exam.domain.InvitationStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InvitationFilter {
    private InvitationStatus status;
    private Boolean anonymous;
    private Long userId;
}
