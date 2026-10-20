package com.example.starter_project_2025.system.demo.syllabus;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "syllabuses")
@Getter
@Setter
@NoArgsConstructor
@ResourcePermission("SYLLABUS")
@ResourceMenu(
        title = "Syllabuses",
        group = "Course Management",
        icon = "file-text",
        url = "/syllabuses",
        order = 0,
        permission = "SYLLABUS_READ"
)
public class Syllabus extends BaseEntity {

    @Column(nullable = false, unique = true, length = 30)
    private String code;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(length = 1500)
    private String description;
}