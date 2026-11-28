package com.example.starter_project_2025.system.project.alert;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class WorkspaceProjectAlertDtos {
    private WorkspaceProjectAlertDtos() { }

    public record Item(String id, String title, String status, Instant deadline, String assigneeName,
                       BigDecimal percentage, Long done, Long total) { }
    public record SentAlert(UUID id, ProjectAlertDtos.Kind kind, String warningNote, Long senderId,
                            String senderName, int recipientCount, Instant sentAt, String status,
                            List<Item> items) { }
    public record Page(Long workspaceId, Long teamId, List<SentAlert> content, long total,
                       int page, int size) { }
}
