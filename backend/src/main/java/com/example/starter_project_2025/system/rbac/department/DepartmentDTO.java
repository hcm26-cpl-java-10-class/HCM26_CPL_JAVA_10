package com.example.starter_project_2025.system.rbac.department;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.crud.dto.OnUpdate;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

import static com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class DepartmentDTO extends BaseDTO {

    @NotBlank(groups = OnCreate.class, message = "Department code is required")
    @Pattern(regexp = "^[A-Za-z0-9._-]{2,50}$", groups = {OnCreate.class, OnUpdate.class},
            message = "Code must be 2-50 characters: letters, digits, '.', '_' or '-'")
    String code;

    @NotBlank(groups = OnCreate.class, message = "Department name is required")
    @Size(max = 150, groups = {OnCreate.class, OnUpdate.class}, message = "Name must not exceed 150 characters")
    String name;

    @Size(max = 500, groups = {OnCreate.class, OnUpdate.class}, message = "Description must not exceed 500 characters")
    String description;

    /**
     * Phòng ban cha. Khi tạo: null = phòng ban gốc.
     * Khi sửa (PUT): giá trị này luôn được áp dụng, null = chuyển thành phòng ban gốc.
     */
    Long parentDepartmentId;

    @JsonProperty(access = READ_ONLY)
    String parentDepartmentName;
}
