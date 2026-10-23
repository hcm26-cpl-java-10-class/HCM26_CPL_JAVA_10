package com.example.starter_project_2025.system.exam.dto;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@Builder
public class BatchInvitationResponse {
    private int totalRequested;
    private int successCount;
    private int failureCount;
    private List<InvitationDTO> successfulInvitations;
    private List<String> errors;
}