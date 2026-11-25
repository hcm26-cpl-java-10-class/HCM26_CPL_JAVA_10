package com.example.starter_project_2025.system.training.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "class_activities")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClassActivityEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "class_id", nullable = false)
    private Long classId;

    @Column(name = "author", length = 100)
    private String author;

    @Column(name = "initials", length = 10)
    private String initials;

    @Column(name = "content", length = 1000)
    private String content;

    @Column(name = "timestamp", length = 50)
    private String timestamp;

    @Column(name = "type", length = 20)
    private String type;
}

