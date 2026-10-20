package com.example.starter_project_2025.system.invitation.dto;

import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BatchInvitationResponse {

    private Long examId;
    private int totalRequested;
    private int successCount;
    private int skippedCount;
    private int failedCount;

    @Builder.Default
    private List<BatchInvitationItemResult> items = new ArrayList<>();
}
