package com.example.starter_project_2025.system.project.resources;

import java.nio.charset.StandardCharsets;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/workspaces/{workspaceId}/resources")
@PreAuthorize("hasAnyAuthority('WORKSPACE_READ', 'VIEW_PROJECT_WORKSPACE')")
@RequiredArgsConstructor
public class WorkspaceResourceController {
    private final WorkspaceResourceService service;

    @GetMapping
    public ResponseEntity<WorkspaceResourceService.Listing> list(@PathVariable Long workspaceId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.list(workspaceId));
    }

    @PostMapping("/{resourceId}/download-link")
    public ResponseEntity<WorkspaceResourceService.DownloadLink> link(
            @PathVariable Long workspaceId, @PathVariable Long resourceId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.downloadLink(workspaceId, resourceId));
    }

    @GetMapping("/{resourceId}/download")
    public ResponseEntity<Resource> download(@PathVariable Long workspaceId, @PathVariable Long resourceId,
            @RequestParam long expires, @RequestParam String signature) {
        WorkspaceResourceService.Download download = service.download(workspaceId, resourceId, expires, signature);
        String name = download.file().fileName().replaceAll("[\\p{Cntrl}\\\\/]", "_");
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(name, StandardCharsets.UTF_8).build().toString())
                .header("X-Content-Type-Options", "nosniff")
                .header("Referrer-Policy", "no-referrer")
                .body(download.content());
    }
}
