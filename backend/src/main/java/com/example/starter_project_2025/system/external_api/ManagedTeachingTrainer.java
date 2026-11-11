package com.example.starter_project_2025.system.external_api;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "managed_teaching_trainers")
@Getter @Setter @NoArgsConstructor
@ResourcePermission("TRAINER")
public class ManagedTeachingTrainer extends BaseEntity {
    @Column(nullable = false, unique = true, updatable = false)
    private Long referenceId;
    @Column(nullable = false, length = 200)
    private String name;
    @Column(nullable = false, unique = true, length = 200)
    private String email;
}
