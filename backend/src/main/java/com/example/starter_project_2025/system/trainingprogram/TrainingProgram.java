package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "training_programs", uniqueConstraints = {
        @UniqueConstraint(name = "uk_training_program_code_version", columnNames = {"code", "version"})
})
@Getter @Setter @SuperBuilder @NoArgsConstructor @AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@ResourcePermission("PROGRAM")
@ResourceMenu(title = "Training Programs", group = "Training Management", icon = "graduation-cap",
        url = "/programs", order = 2, permission = "PROGRAM_READ")
public class TrainingProgram extends BaseEntity {
    @Column(nullable = false, length = 50)
    String code;

    @Column(nullable = false, length = 255)
    String name;

    @Column(nullable = false, length = 30)
    String version;

    @Column(length = 100)
    String region;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    ProgramStatus status = ProgramStatus.ACTIVE;

    @OneToMany(mappedBy = "program", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC")
    @Builder.Default
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
