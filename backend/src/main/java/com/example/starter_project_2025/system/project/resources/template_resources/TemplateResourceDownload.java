package com.example.starter_project_2025.system.project.resources.template_resources;

/** Binary payload streamed back to the client. */
public record TemplateResourceDownload(String originalName, String contentType, byte[] content) {
}
