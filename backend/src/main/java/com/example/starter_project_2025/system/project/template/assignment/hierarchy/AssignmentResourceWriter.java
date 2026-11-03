package com.example.starter_project_2025.system.project.template.assignment.hierarchy;

import com.example.starter_project_2025.system.project.domain.Project;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AssignmentResourceWriter {
    public record Source(AssignmentTemplateReader.Node template, String origin) { }
    private record Resource(Source source, JsonNode file) { }

    private final JdbcTemplate jdbc;

    public void copy(Project project, ProjectAssignment assignment, List<Source> inherited) {
        List<Resource> files = inherited.stream().flatMap(source -> {
            var stream = java.util.stream.StreamSupport.stream(source.template().content().path("resources").spliterator(), false);
            return stream.map(file -> new Resource(source, file));
        }).toList();
        Timestamp createdAt = Timestamp.valueOf(LocalDateTime.ofInstant(assignment.getAssignedAt(), ZoneOffset.UTC));
        jdbc.batchUpdate("""
                insert into project_resources
                    (project_id, tenant_id, title, version, file_name, content_type, size_bytes, storage_key,
                     kind, external_url, source_template_id, source_resource_id, source_template_code,
                     source_template_name, source_origin, is_active, created_at, updated_at, created_by, updated_by)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true, ?, ?, ?, ?)
                """, files, 100, (statement, resource) -> {
            JsonNode file = resource.file();
            Source source = resource.source();
            boolean link = "LINK".equals(file.path("kind").asText());
            statement.setLong(1, project.getId());
            statement.setLong(2, project.getTenantId());
            statement.setString(3, file.path("title").asText());
            statement.setString(4, source.template().version());
            statement.setString(5, link ? file.path("title").asText() : file.path("fileName").asText());
            statement.setString(6, link ? "text/uri-list" : file.path("contentType").asText());
            statement.setLong(7, link ? 0 : file.path("sizeBytes").asLong());
            statement.setString(8, link ? "" : file.path("storageKey").asText());
            statement.setString(9, link ? "LINK" : "FILE");
            statement.setString(10, link ? file.path("externalUrl").asText() : null);
            statement.setLong(11, source.template().templateId());
            statement.setLong(12, file.path("id").asLong());
            statement.setString(13, source.template().code());
            statement.setString(14, source.template().name());
            statement.setString(15, source.origin());
            statement.setTimestamp(16, createdAt);
            statement.setTimestamp(17, createdAt);
            statement.setObject(18, assignment.getCreatedBy());
            statement.setObject(19, assignment.getCreatedBy());
        });
    }
}
