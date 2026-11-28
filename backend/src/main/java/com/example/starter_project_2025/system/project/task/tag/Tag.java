package com.example.starter_project_2025.system.project.task.tag;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.UUID;

@Entity
@Table(name = "tag", uniqueConstraints = @UniqueConstraint(name = "uk_tag_project_name",
        columnNames = {"project_id", "normalized_name"}))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Tag {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "tag_id")
    UUID id;

    @Column(name = "project_id", nullable = false, updatable = false)
    UUID projectId;

    @Column(nullable = false, length = 100)
    String name;

    @Column(name = "normalized_name", nullable = false, length = 100)
    String normalizedName;
}
