package com.example.starter_project_2025.system.demo.category;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CategoryTreeDTO {

    Long id;
    String name;
    String code;
    String description;
    Boolean isActive;
    Long parentId;
    String iconUrl;
    Integer displayOrder;

    /** Số khóa PUBLISHED + active thuộc trực tiếp danh mục này. */
    @Builder.Default
    long courseCount = 0;

    /** Như courseCount nhưng gồm cả các danh mục con, cháu. */
    @Builder.Default
    long totalCourseCount = 0;

    @Builder.Default
    List<CategoryTreeDTO> children = new ArrayList<>();
}