package com.example.starter_project_2025.base.crud.dto;

import com.example.starter_project_2025.base.crud.domain.DepartmentStatus;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.UUID;

@Data
@EqualsAndHashCode(callSuper = true)
public class DepartmentFilter extends BaseFilter {
    private String code;
    private String name;
    private UUID parentDepartmentId;
    private UUID locationId;
    private DepartmentStatus status;
}