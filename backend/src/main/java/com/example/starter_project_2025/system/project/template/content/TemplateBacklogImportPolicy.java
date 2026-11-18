package com.example.starter_project_2025.system.project.template.content;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.web.servlet.MultipartProperties;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class TemplateBacklogImportPolicy {
    private final MultipartProperties multipart;

    public long maxBytes() {
        long limit = 50L * 1024 * 1024;
        long configured = multipart.getMaxFileSize().toBytes();
        return configured < 0 ? limit : Math.min(limit, configured);
    }
}
