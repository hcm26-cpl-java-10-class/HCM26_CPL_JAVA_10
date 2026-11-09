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
    /** Số lời mời bị bỏ qua (ví dụ: học viên đã có lời mời trước đó). */
    private int skippedCount;
    private List<InvitationDTO> successfulInvitations;
    private List<String> errors;
    /** Kết quả chi tiết từng học viên (SUCCESS / SKIPPED / FAILED). */
    private List<InvitationBulkItemResult> items;
}
