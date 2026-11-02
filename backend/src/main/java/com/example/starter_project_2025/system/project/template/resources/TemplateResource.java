package com.example.starter_project_2025.system.project.template.resources;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.project.ProjectTemplate;
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
@Table(name = "template_resources")
@Getter
@Setter
@NoArgsConstructor
public class TemplateResource extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "template_id", nullable = false, updatable = false)
    private ProjectTemplate template;

    @Column(nullable = false, updatable = false, length = 10)
    private String kind;

    @Column(nullable = false, updatable = false, length = 255)
    private String title;

    @Column(name = "file_name", updatable = false, length = 255)
    private String fileName;

    @Column(name = "content_type", updatable = false, length = 150)
    private String contentType;

    @Column(name = "size_bytes", updatable = false)
    private Long sizeBytes;

    @Column(name = "storage_key", updatable = false, length = 36)
    private String storageKey;

    @Column(name = "external_url", updatable = false, length = 2000)
    private String externalUrl;

    public Data snapshot() {
        return new Data(getId(), kind, title, fileName, contentType, sizeBytes, storageKey, externalUrl);
    }

    public record Data(Long id, String kind, String title, String fileName, String contentType,
                       Long sizeBytes, String storageKey, String externalUrl) { }
}
