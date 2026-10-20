package com.example.starter_project_2025.system.resource_assignment.dto;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.system.resource_assignment.domain.ResourceType;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ClassResourceAssignmentDTO extends BaseDTO {

    @NotNull(groups = OnCreate.class, message = "Class ID is required")
    Long classId;

    @NotNull(groups = OnCreate.class, message = "Resource ID is required")
    Long resourceId;

    @NotNull(groups = OnCreate.class, message = "Resource Type is required")
    ResourceType resourceType;

    String resourceName;
}