package com.example.starter_project_2025.system.trainer;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.subject.Subject;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.util.LinkedHashSet;
import java.util.Set;

/** Internal identity namespace. Never equate this ID to a shared-system trainer ID. */
@Entity
@Table(name = "trainers", uniqueConstraints = {
    @UniqueConstraint(name = "uk_trainer_code", columnNames = "trainer_code"),
    @UniqueConstraint(name = "uk_trainer_email", columnNames = "email")
})
@Getter @Setter
@ResourcePermission("TRAINER")
@ResourceMenu(title = "Trainers", group = "Training Management", icon = "users", url = "/trainers", order = 7, permission = "TRAINER_READ")
public class Trainer extends BaseEntity {
    @Column(name = "trainer_code", nullable = false, length = 50)
    private String trainerCode;
    @Column(nullable = false, length = 150)
    private String fullName;
    @Column(nullable = false, length = 254)
    private String email;
    @Column(length = 500)
    private String specialization;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    private TrainerStatus status = TrainerStatus.ACTIVE;
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "trainer_teaching_topics",
            joinColumns = @JoinColumn(name = "trainer_id"),
            inverseJoinColumns = @JoinColumn(name = "subject_id"),
            uniqueConstraints = @UniqueConstraint(
                    name = "uk_trainer_topics_trainer_subj",
                    columnNames = {"trainer_id", "subject_id"}
            )
    )
    private Set<Subject> teachingTopics = new LinkedHashSet<>();
}
