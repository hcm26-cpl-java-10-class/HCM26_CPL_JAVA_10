package com.example.starter_project_2025.system.subject;

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
@Table(name = "subjects")
@FieldDefaults(level = AccessLevel.PRIVATE)
@ResourcePermission("SUBJECT")
@ResourceMenu(
        title = "Subjects",
        group = "Academic Management",
        icon = "book-open",
        url = "/subjects",
        order = 1,
        permission = "SUBJECT_READ"
)
public class Subject extends BaseEntity {

    @Column(nullable = false, length = 50)
    String code;

    @Column(nullable = false, length = 150)
    String name;

    @Builder.Default
    @Column(length = 20)
    String version = "1.0";

    @Column(length = 500)
    String description;

    @Column(length = 100)
    String technicalGroup;

    @Column
    Integer durationHours;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    SubjectStatus status = SubjectStatus.ACTIVE;
}
