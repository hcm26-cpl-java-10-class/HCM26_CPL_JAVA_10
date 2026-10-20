
package com.example.starter_project_2025.system.demo.section;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.demo.course.Course;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "sections")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@ResourcePermission("SECTION")
@ResourceMenu(
        title = "Sections",
        group = "Course Management",
        icon = "layers",
        url = "/sections",
        order = 3,
        permission = "SECTION_READ"
)
public class Section extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "course_id", nullable = false)
    Course course;

    @Column(nullable = false, length = 150)
    String title;

    @Column(name = "order_index", nullable = false)
    Integer orderIndex;
}
