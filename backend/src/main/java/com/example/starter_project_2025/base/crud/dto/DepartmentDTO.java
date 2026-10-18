package com.example.starter_project_2025.base.crud.dto;

import lombok.*;
import lombok.experimental.SuperBuilder;

import java.util.List;
import java.util.UUID;

@Data
@EqualsAndHashCode(callSuper = true)
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class DepartmentDTO extends BaseDTO {

    private String code;
    private String name;
    private UUID parentDepartmentId;
    private String parentDepartmentName;
    private UUID locationId;
    private String status;
    private List<DepartmentDTO> children;
}