package com.example.starter_project_2025.system.project.resources.workspace_resources;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Response payloads of the workspace-facing resource view (US-RES-004 / US-RES-003).
 * <p>
 * The raw storage key is deliberately absent: clients only receive display
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
                               Integer orderIndex,
                               LocalDateTime updatedAt,
                               Long updatedBy,
                               List<FileItem> files,
                               Long sourceTemplateId,
                               String sourceName,
                               String origin,
                               Long projectId,
                               boolean canManage) {
    }

    /** Result of {@code GET /api/workspaces/{id}/resources}. */
    public record ResourceCollection(Long workspaceId,
                                     Long projectId,
                                     Long teamId,
                                     int total,
                                     boolean canManage,
                                     long maxFileBytes,
                                     List<String> allowedExtensions,
                                     List<ResourceItem> items) {
    }

    /**
     * Create / update payload of one workspace resource (US-RES-003 AC01/AC02).
     * The owning project is always derived from the workspace route.
     */
    public record ResourcePayload(String title,
                                  String description,
                                  String kind,
                                  String url,
                                  Integer orderIndex) {
    }

    /** Short-lived signed URL handed to the browser. */
    public record DownloadTicket(String url, String fileName, String expiresAt) {
    }

    /** Binary content streamed back to the client. */
    public record Download(String fileName, String contentType, byte[] content) {
    }
}
