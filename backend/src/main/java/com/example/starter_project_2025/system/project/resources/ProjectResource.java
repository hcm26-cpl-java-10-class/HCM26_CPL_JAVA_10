package com.example.starter_project_2025.system.project.resources;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.project.domain.Project;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "project_resources")
@Getter
@Setter
@NoArgsConstructor
public class ProjectResource extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(length = 4000)
    private String description;

    @Column(nullable = false, length = 50)
    private String version;

    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;

    @Column(name = "content_type", nullable = false, length = 150)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Column(name = "storage_key", nullable = false, updatable = false, length = 36)
    private String storageKey;

    @Column(nullable = false, length = 10, columnDefinition = "varchar(10) default 'FILE'")
    private String kind = "FILE";

    @Column(name = "external_url", length = 2000)
    private String externalUrl;

    @Column(name = "source_template_id")
    private Long sourceTemplateId;

    @Column(name = "source_template_code", length = 100)
    private String sourceTemplateCode;

    @Column(name = "source_template_name", length = 255)
    private String sourceTemplateName;

    @Column(name = "source_origin", length = 20)
    private String sourceOrigin;
}
