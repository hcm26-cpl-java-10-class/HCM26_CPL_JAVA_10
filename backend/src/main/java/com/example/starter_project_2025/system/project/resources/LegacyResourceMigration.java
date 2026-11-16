package com.example.starter_project_2025.system.project.resources;

import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshot;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateVersionStatus;
import com.example.starter_project_2025.system.project.resources.template_resource_files.TemplateResourceFile;
import com.example.starter_project_2025.system.project.resources.template_resource_files.TemplateResourceFileRepository;
import com.example.starter_project_2025.system.project.resources.template_resources.TemplateResource;
import com.example.starter_project_2025.system.project.resources.template_resources.TemplateResourceRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
@Order(22)
@RequiredArgsConstructor
public class LegacyResourceMigration implements CommandLineRunner {
    static final String LEGACY_KEY_PREFIX = "legacy:";

    private final JdbcTemplate jdbc;
    private final ProjectTemplateRepository templates;
    private final ProjectTemplateSnapshotRepository versions;
    private final TemplateResourceRepository resources;
    private final TemplateResourceFileRepository files;
    private final ObjectMapper json;

    @Override
    @Transactional
    public void run(String... args) {
        Map<String, Boolean> projectColumns = columns("project_resources");
        boolean oldProjectLayout = projectColumns.containsKey("source_resource_id")
                && projectColumns.containsKey("storage_key") && projectColumns.containsKey("version");
        if (oldProjectLayout) {
            if (!projectColumns.containsKey("normalized")) {
                jdbc.execute("alter table project_resources add column if not exists normalized boolean default false not null");
            }
            for (String column : List.of("version", "file_name", "content_type", "size_bytes", "storage_key")) {
                if (Boolean.FALSE.equals(projectColumns.get(column))) {
                    jdbc.execute("alter table project_resources alter column " + column + " drop not null");
                }
            }
        }
        Map<String, Boolean> templateColumns = columns("template_resources");
        boolean oldTemplateLayout = templateColumns.containsKey("template_id") && templateColumns.containsKey("storage_key");
        if (oldTemplateLayout && !templateColumns.containsKey("normalized")) {
            jdbc.execute("alter table template_resources add column if not exists normalized boolean default false not null");
        }

        if (oldProjectLayout) normalizeProjectResources();
        if (oldTemplateLayout) normalizeTemplateResources();
    }

    private Map<String, Boolean> columns(String table) {
        return jdbc.query("""
                select lower(column_name), is_nullable from information_schema.columns
                 where lower(table_name) = ? and lower(table_schema) = lower(current_schema())
                """, rows -> {
            Map<String, Boolean> result = new LinkedHashMap<>();
            while (rows.next()) result.put(rows.getString(1), "YES".equalsIgnoreCase(rows.getString(2)));
            return result;
        }, table);
    }

    private void normalizeProjectResources() {
        jdbc.update("""
                update project_resources
                   set url = coalesce(url, external_url),
                       source_template_resource_id = coalesce(source_template_resource_id, source_resource_id)
                 where normalized = false and version is not null
                """);
        jdbc.update("""
                insert into project_resource_files
                    (resource_id, storage_key, original_name, content_type, size_bytes,
                     is_active, created_at, updated_at, created_by, updated_by)
                select r.id, concat(?, r.storage_key), r.file_name, r.content_type, r.size_bytes,
                       r.is_active, r.created_at, r.updated_at, r.created_by, r.updated_by
                  from project_resources r
                 where r.normalized = false and r.version is not null and r.kind = 'FILE' and r.storage_key <> ''
                   and not exists (select 1 from project_resource_files f
                       where f.resource_id = r.id and f.storage_key = concat(?, r.storage_key))
                """, LEGACY_KEY_PREFIX, LEGACY_KEY_PREFIX);
        jdbc.update("update project_resources set normalized = true where version is not null and normalized = false");
    }

    private void normalizeTemplateResources() {
        for (Long templateId : jdbc.queryForList(
                "select distinct template_id from template_resources where normalized = false", Long.class)) {
            var template = templates.findById(templateId).orElse(null);
            if (template == null) continue;
            Map<Long, LegacyResource> old = jdbc.query("""
                    select id, kind, title, external_url, file_name, content_type, size_bytes, storage_key, is_active
                      from template_resources where template_id = ? and normalized = false order by id
                    """, rows -> {
                Map<Long, LegacyResource> result = new LinkedHashMap<>();
                while (rows.next()) result.put(rows.getLong("id"), new LegacyResource(
                        ResourceKind.valueOf(rows.getString("kind")), rows.getString("title"),
                        rows.getString("external_url"), rows.getString("file_name"), rows.getString("content_type"),
                        rows.getLong("size_bytes"), rows.getString("storage_key"), rows.getBoolean("is_active")));
                return result;
            }, templateId);
            for (ProjectTemplateSnapshot version : versions.findByTemplateIdOrderByCreatedAtDesc(templateId)) {
                if (version.getProjectId() != null || !Boolean.TRUE.equals(version.getIsActive())) continue;
                JsonNode content = read(version);
                List<LegacyResource> items = new java.util.ArrayList<>();
                if (content.path("resources").isArray()) {
                    content.path("resources").forEach(item -> {
                        LegacyResource resource = old.get(item.path("id").asLong());
                        if (resource != null) items.add(resource);
                    });
                } else if (version.getStatus() == ProjectTemplateVersionStatus.DRAFT) {
                    old.values().stream().filter(LegacyResource::active).forEach(items::add);
                }
                int order = (int) resources.countByTemplateVersionId(version.getId());
                for (LegacyResource resource : items) {
                    importResource(templateId, template.getTenantId(), version.getId(), order++, resource);
                }
            }
            jdbc.update("update template_resources set normalized = true where template_id = ?", templateId);
        }
    }

    private JsonNode read(ProjectTemplateSnapshot version) {
        try {
            JsonNode content = json.readTree(version.getContentJson());
            return content == null ? json.createObjectNode() : content;
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to migrate resources of template version " + version.getId(), exception);
        }
    }

    private void importResource(Long templateId, Long tenantId, Long versionId, int order, LegacyResource original) {
        TemplateResource resource = new TemplateResource();
        resource.setTemplateId(templateId);
        resource.setTenantId(tenantId);
        resource.setTemplateVersionId(versionId);
        resource.setTitle(original.title());
        resource.setKind(original.kind());
        resource.setUrl(original.url());
        resource.setOrderIndex(order);
        resources.saveAndFlush(resource);
        if (original.kind() == ResourceKind.FILE && original.storageKey() != null) {
            TemplateResourceFile file = new TemplateResourceFile();
            file.setResourceId(resource.getId());
            file.setStorageKey(LEGACY_KEY_PREFIX + original.storageKey());
            file.setOriginalName(original.fileName());
            file.setContentType(original.contentType());
            file.setSizeBytes(original.sizeBytes());
            files.save(file);
        }
    }

    private record LegacyResource(ResourceKind kind, String title, String url, String fileName,
                                  String contentType, long sizeBytes, String storageKey, boolean active) { }
}
