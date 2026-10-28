package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.system.project.template.ProjectTemplateLevel;
import com.example.starter_project_2025.system.project.template.ProjectTemplateStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "project_templates", uniqueConstraints = @UniqueConstraint(
        name = "uk_template_tenant_code_version", columnNames = {"tenant_id", "code", "template_version"}))
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@ResourceMenu(title = "Project Templates", group = "Project Management", icon = "book-open",
        url = "/project-templates", order = 8, permission = "PROJECT_TEMPLATE_READ")
public class ProjectTemplate extends BaseEntity {

    @Column(name = "tenant_id", updatable = false)
    Long tenantId;

    /** Optional business code; US-08 duplication no longer asks for one. */
    @Column(length = 100)
    String code;

    @Column(nullable = false, length = 255)
    String name;

    @Column(columnDefinition = "TEXT")
    String description;

    @Column(length = 255)
    String category;

    @Enumerated(EnumType.STRING)
    @Column(name = "difficulty_level", length = 20)
    ProjectTemplateLevel level;

    @Column(name = "estimated_duration_weeks")
    Integer estimatedDurationWeeks;

    /**
     * US-07: business version of the template, kept aligned with the newest
     * {@code project_template_version} snapshot ({@code v2.0} -> {@code 2}) by
     * {@code ProjectTemplateSnapshotServiceImpl}. The column is updatable so the
     * template row and its version chain can never report different numbers.
     */
    @Builder.Default
    @Column(name = "template_version", nullable = false, columnDefinition = "integer default 1")
    Integer templateVersion = 1;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "varchar(20) default 'DRAFT'")
    ProjectTemplateStatus status = ProjectTemplateStatus.DRAFT;

    @Version
    @Column(name = "lock_version", nullable = false, columnDefinition = "bigint default 0")
    Long lockVersion;

    @Builder.Default
    @Column(name = "constraints_json", nullable = false, columnDefinition = "TEXT")
    String constraintsJson = "{}";

    /**
     * US-07: aligns the template revision with the major number of its newest
     * snapshot version ({@code v3.0} -> {@code 3}).
     *
     * @param major parsed major number of the version label; ignored when
     *              {@code null} or not positive
     */
    public void syncVersion(Integer major) {
        if (major != null && major > 0) {
            this.templateVersion = major;
        }
    }
}
