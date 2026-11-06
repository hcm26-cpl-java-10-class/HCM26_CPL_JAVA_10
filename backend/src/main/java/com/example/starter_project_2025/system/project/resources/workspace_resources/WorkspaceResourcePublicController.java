package com.example.starter_project_2025.system.project.resources.workspace_resources;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Streams a stored document for a valid, short-lived signed token.
 * <p>
 * The token carries the workspace, resource and file identifiers plus an
 * expiry timestamp and an HMAC signature, so the raw storage path never
 * appears in the URL. An invalid or expired token is rejected with 403.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/public/workspace-resources")
public class WorkspaceResourcePublicController {

    private final WorkspaceResourceQueryService service;

    @GetMapping("/download")
    public ResponseEntity<byte[]> download(@RequestParam("token") String token) {
        return WorkspaceResourceController.stream(service.downloadWithToken(token));
    }
}
