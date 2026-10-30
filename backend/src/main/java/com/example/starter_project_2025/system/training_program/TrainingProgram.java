package com.example.starter_project_2025.system.training_program;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

import java.util.ArrayList;
import java.util.List;

@Entity(name = "AcademicTrainingProgram")
@Table(name = "training_programs",
       uniqueConstraints = @UniqueConstraint(name = "uk_program_code_version", columnNames = {"code", "version"}))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @SuperBuilder
@FieldDefaults(level = AccessLevel.PRIVATE)
@ResourcePermission("TRAINING_PROGRAM")
@ResourceMenu(title = "Training Programs", group = "Academic Management", icon = "graduation-cap",
        url = "/training-programs", order = 20, permission = "TRAINING_PROGRAM_READ")
public class TrainingProgram extends BaseEntity {
    @Column(nullable = false, length = 50)
    String code;

    @Column(nullable = false, length = 150)
    String name;

    @Column(nullable = false)
    Integer version;

    @Column(length = 100)
    String region;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    ProgramStatus status = ProgramStatus.DRAFT;

    @Builder.Default
    @OneToMany(mappedBy = "program", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC")
    List<ProgramSubject> subjects = new ArrayList<>();

    public void replaceSubjects(List<ProgramSubject> newSubjects) {
        subjects.clear();
        if (newSubjects != null) {
            for (ProgramSubject item : newSubjects) {
                item.setProgram(this);
                subjects.add(item);
            }
        }
    }
}
