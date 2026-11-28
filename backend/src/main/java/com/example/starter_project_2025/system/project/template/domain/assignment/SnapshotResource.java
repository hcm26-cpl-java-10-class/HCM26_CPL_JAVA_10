package com.example.starter_project_2025.system.project.template.domain.assignment;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import org.hibernate.annotations.Immutable;

@Entity
@Table(name = "project_template_snapshot_resources", uniqueConstraints = @UniqueConstraint(
        name = "uk_snapshot_resource_source", columnNames = {"snapshot_id", "source_resource_id"}))
@Immutable
@Data
@EqualsAndHashCode(callSuper = true, onlyExplicitlyIncluded = true)
@ToString(onlyExplicitlyIncluded = true)
@NoArgsConstructor
public class SnapshotResource extends BaseEntity {
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;
    @Column(name = "snapshot_id", nullable = false, updatable = false)
    private Long snapshotId;
    @Column(name = "source_resource_id", nullable = false, updatable = false)
    private Long sourceResourceId;
    @Lob
    @Column(name = "content_json", nullable = false, updatable = false)
    private String contentJson;
}
