package com.example.starter_project_2025.system.demo.category;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CategoryDTO extends BaseDTO {

    @NotBlank(groups = OnCreate.class, message = "Category name is required")
    @Size(max = 150, message = "Name must not exceed 150 characters")
    String name;

    @NotBlank(groups = OnCreate.class, message = "Category code is required")
    @Size(max = 50, message = "Code must not exceed 50 characters")
    @Pattern(regexp = "^[A-Za-z0-9_-]*$", message = "Code may only contain letters, digits, '_' and '-'")
    String code;

    @Size(max = 500, message = "Description must not exceed 500 characters")
    String description;

    /** Parent category id; null = root category. */
    Long parentId;

    /** Read-only, filled by the mapper. */
    String parentName;
}