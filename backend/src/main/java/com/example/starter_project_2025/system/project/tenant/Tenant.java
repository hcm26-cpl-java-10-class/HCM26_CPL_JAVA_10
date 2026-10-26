package com.example.starter_project_2025.system.project.tenant;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@AttributeOverride(name = "id", column = @Column(name = "tenant_id"))
@Table(
        name = "tenants",
        uniqueConstraints = @UniqueConstraint(name = "uk_tenant_code", columnNames = {"code"})
)
@FieldDefaults(level = AccessLevel.PRIVATE)
@ResourcePermission("TENANT")
public class Tenant extends BaseEntity {

    @Column(nullable = false, length = 100)
    String code;

    @Column(nullable = false, length = 255)
    String name;

    @Builder.Default
    @Column(nullable = false)
    Boolean active = true;
}
