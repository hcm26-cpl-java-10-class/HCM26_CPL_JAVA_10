package com.example.starter_project_2025.system.exam.dto;

import com.example.starter_project_2025.system.exam.domain.InvitationStatus;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class InvitationFilter {
    private InvitationStatus status;
    private Boolean anonymous;
    private Long userId;
    private List<Long> userIds;
}
