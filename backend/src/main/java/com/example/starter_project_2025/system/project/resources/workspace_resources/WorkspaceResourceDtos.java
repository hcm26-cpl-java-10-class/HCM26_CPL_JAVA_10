package com.example.starter_project_2025.system.project.resources.workspace_resources;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Response payloads of the trainee-facing resource view (US-RES-004).
 * <p>
 * The raw storage key is deliberately absent: trainees only receive display
 * metadata plus a short-lived signed download URL, never the object path.
 */
public final class WorkspaceResourceDtos {

    private WorkspaceResourceDtos() {
    }

    /** Display metadata of one attached document. */
    public record FileItem(Long id, String fileName, String contentType, Long sizeBytes) {
    }

    /** One resource of the workspace project, with its documents and/or link. */
    public record ResourceItem(Long id,
                               String title,
                               String description,
                               String kind,
                               String url,
                               String category,
                               Integer orderIndex,
                               LocalDateTime updatedAt,
                               List<FileItem> files) {
    }

    /** Result of {@code GET /api/workspaces/{id}/resources}. */
    public record ResourceCollection(Long workspaceId,
                                     Long projectId,
                                     Long teamId,
                                     int total,
                                     List<ResourceItem> items) {
    }

    /** Short-lived signed URL handed to the browser. */
    public record DownloadTicket(String url, String fileName, String expiresAt) {
    }

    /** Binary content streamed back to the client. */
    public record Download(String fileName, String contentType, byte[] content) {
    }
}
