package com.example.starter_project_2025.system.subject.technicalgroup;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "subject_technical_groups", uniqueConstraints =
        @UniqueConstraint(name = "uk_subject_technical_group_key", columnNames = "normalized_name"))
@Getter
@NoArgsConstructor
public class SubjectTechnicalGroup {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 100)
    private String name;
    @Column(name = "normalized_name", nullable = false, length = 200)
    private String normalizedName;

    SubjectTechnicalGroup(String name, String normalizedName) {
        this.name = name;
        this.normalizedName = normalizedName;
    }
}
