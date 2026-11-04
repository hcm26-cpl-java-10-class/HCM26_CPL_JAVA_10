package com.example.starter_project_2025.system.project.resources.workspace_resources;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;

/**
 * Resources tab of a workspace (US-RES-004 read, US-RES-003 manage).
 * <p>
 * Routes are workspace-scoped: the project is derived from the workspace and
 * the team membership check happens before any resource is returned. Mutating
 * routes additionally require the caller to be the team mentor or an
 * administrator / program manager.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/workspaces/{workspaceId}/resources")
@PreAuthorize("hasAnyAuthority('WORKSPACE_READ', 'VIEW_PROJECT_WORKSPACE')")
public class WorkspaceResourceController {

    private final WorkspaceResourceQueryService service;
    private final WorkspaceResourceCommandService commands;

    @GetMapping
    public WorkspaceResourceDtos.ResourceCollection list(@PathVariable Long workspaceId) {
        return service.list(workspaceId);
    }

    @PostMapping
    @PreAuthorize("hasAuthority('PROJECT_RESOURCE_CREATE')")
    @ResponseStatus(HttpStatus.CREATED)
    public WorkspaceResourceDtos.ResourceItem create(
            @PathVariable Long workspaceId,
            @RequestBody WorkspaceResourceDtos.ResourcePayload request) {
        return commands.create(workspaceId, request);
    }

    @PutMapping("/{resourceId}")
    @PreAuthorize("hasAuthority('PROJECT_RESOURCE_UPDATE')")
    public WorkspaceResourceDtos.ResourceItem update(
            @PathVariable Long workspaceId,
            @PathVariable Long resourceId,
            @RequestBody WorkspaceResourceDtos.ResourcePayload request) {
        return commands.update(workspaceId, resourceId, request);
    }

    @DeleteMapping("/{resourceId}")
    @PreAuthorize("hasAuthority('PROJECT_RESOURCE_DELETE')")
    public ResponseEntity<Void> delete(@PathVariable Long workspaceId,
                                       @PathVariable Long resourceId) {
        commands.delete(workspaceId, resourceId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(value = "/{resourceId}/files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('PROJECT_RESOURCE_FILE_CREATE')")
    @ResponseStatus(HttpStatus.CREATED)
    public WorkspaceResourceDtos.FileItem upload(
            @PathVariable Long workspaceId,
            @PathVariable Long resourceId,
            @RequestPart("file") MultipartFile file) {
        return commands.upload(workspaceId, resourceId, file);
    }

    @DeleteMapping("/{resourceId}/files/{fileId}")
    @PreAuthorize("hasAuthority('PROJECT_RESOURCE_FILE_DELETE')")
    public ResponseEntity<Void> deleteFile(@PathVariable Long workspaceId,
                                           @PathVariable Long resourceId,
                                           @PathVariable Long fileId) {
        commands.deleteFile(workspaceId, resourceId, fileId);
        return ResponseEntity.noContent().build();
    }

    /** Issues the short-lived signed URL used by the browser download. */
    @GetMapping("/{resourceId}/files/{fileId}/download-ticket")
    public WorkspaceResourceDtos.DownloadTicket ticket(@PathVariable Long workspaceId,
                                                       @PathVariable Long resourceId,
                                                       @PathVariable Long fileId) {
        return service.createTicket(workspaceId, resourceId, fileId);
    }

    /** Direct authenticated stream, kept as a fallback for same-origin clients. */
    @GetMapping("/{resourceId}/files/{fileId}/download")
    public ResponseEntity<byte[]> download(@PathVariable Long workspaceId,
                                           @PathVariable Long resourceId,
                                           @PathVariable Long fileId) {
        return stream(service.downloadForMember(workspaceId, resourceId, fileId));
    }

    static ResponseEntity<byte[]> stream(WorkspaceResourceDtos.Download download) {

        ContentDisposition disposition = ContentDisposition.attachment()
                .filename(download.fileName(), StandardCharsets.UTF_8)
                .build();

        MediaType mediaType;
        try {
            mediaType = MediaType.parseMediaType(download.contentType());
        } catch (IllegalArgumentException exception) {
            mediaType = MediaType.APPLICATION_OCTET_STREAM;
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header("X-Content-Type-Options", "nosniff")
                .contentType(mediaType)
                .body(download.content());
    }
}
