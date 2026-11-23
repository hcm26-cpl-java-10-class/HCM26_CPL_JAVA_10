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
import java.util.Locale;

@Entity
@Table(name = "training_programs", uniqueConstraints = {
        @UniqueConstraint(name = "uk_training_program_code_version", columnNames = {"code", "version"})
})
@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@ResourcePermission("PROGRAM")
@ResourceMenu(title = "Training Programs", group = "Training Management", icon = "layers",
        url = "/programs", order = 4, permission = "PROGRAM_READ")
public class TrainingProgram extends BaseEntity {

    @PrePersist
    @PreUpdate
    void normalizeAndSyncStatus() {
        if (code != null) {
            code = code.trim().toUpperCase(Locale.ROOT);
        }
        if (version != null) {
            version = version.trim();
        }
        if (status == null) {
            status = Boolean.FALSE.equals(isActive) ? ProgramStatus.INACTIVE : ProgramStatus.ACTIVE;
        }
        if (isActive == null) {
            isActive = status == ProgramStatus.ACTIVE;
        }
    }
    @Column(nullable = false, length = 50)
    String code;

    @Column(nullable = false, length = 255)
    String name;

    @Column(nullable = false, length = 30)
    String version;

    @Column(length = 100)
    String region;

    @Column(name = "technical_group", length = 100)
    String technicalGroup;

    @Column(name = "content_link", length = 500)
    String contentLink;

    @Column(length = 2000)
    String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    ProgramStatus status = ProgramStatus.ACTIVE;

    @OneToMany(mappedBy = "program", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC")
    @Builder.Default
    @ToString.Exclude
    @EqualsAndHashCode.Exclude
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
