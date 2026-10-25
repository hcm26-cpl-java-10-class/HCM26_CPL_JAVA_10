package com.example.starter_project_2025.system.project.rubric.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "rubrics", uniqueConstraints = {
        @UniqueConstraint(name = "uk_rubric_tenant_name", columnNames = {"tenant_id", "name"})
}, indexes = {
        @Index(name = "idx_rubric_tenant_name", columnList = "tenant_id,name")
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Rubric {
    @Id
    @Column(name = "rubric_id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, updatable = false)
    private UUID tenantId;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(length = 500)
    private String description;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "updated_by", nullable = false)
    private UUID updatedBy;

    @Version
    @Column(name = "lock_version", nullable = false)
    private long lockVersion;

    @OneToMany(mappedBy = "rubric", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("versionNumber DESC")
    private List<RubricVersion> versions = new ArrayList<>();

    public static Rubric create(UUID id, UUID tenantId, String name, String description, UUID actorId, Instant now) {
        Rubric rubric = new Rubric();
        rubric.id = id;
        rubric.tenantId = tenantId;
        rubric.name = name.trim();
        rubric.description = normalize(description);
        rubric.createdAt = now;
        rubric.createdBy = actorId;
        rubric.updatedAt = now;
        rubric.updatedBy = actorId;
        return rubric;
    }

    public void updateMetadata(String name, String description, UUID actorId, Instant now) {
        this.name = name.trim();
        this.description = normalize(description);
        this.updatedAt = now;
        this.updatedBy = actorId;
    }

    public void addVersion(RubricVersion version) {
        versions.add(version);
    }

    public void removeVersion(RubricVersion version) {
        versions.remove(version);
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
