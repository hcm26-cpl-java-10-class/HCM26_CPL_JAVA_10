package com.example.starter_project_2025.system.resource_assignment.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "class_resource_assignments",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_class_resource_type",
                        columnNames = {"class_id", "resource_id", "resource_type"}
                )
        }
)
@FieldDefaults(level = AccessLevel.PRIVATE)
@ResourcePermission("RESOURCE_ASSIGNMENT")
@ResourceMenu(
        title = "Resource Assignments",
        group = "Class Management",
        icon = "users-cog",
        url = "/resource-assignments",
        order = 3,
        permission = "RESOURCE_ASSIGNMENT_READ"
)
public class ClassResourceAssignment extends BaseEntity {

    @Column(name = "class_id", nullable = false)
    Long classId;

    @Column(name = "resource_id", nullable = false)
    Long resourceId;

    @Enumerated(EnumType.STRING)
    @Column(name = "resource_type", nullable = false, length = 50)
    ResourceType resourceType;

    @Column(name = "resource_name", length = 150)
    String resourceName;
}