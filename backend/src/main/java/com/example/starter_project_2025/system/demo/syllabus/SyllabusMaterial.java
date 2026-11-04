package com.example.starter_project_2025.system.demo.syllabus;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "syllabus_materials")
@Getter
@Setter
@NoArgsConstructor
public class SyllabusMaterial extends BaseEntity {

    public enum MaterialType {
        DOCUMENT,
        SLIDE,
        VIDEO,
        BOOK,
        LINK
    }

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "syllabus_id", nullable = false)
    private Syllabus syllabus;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "topic_id")
    private SyllabusTopic topic;

    @Column(nullable = false, length = 200)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private MaterialType type;

    @Column(nullable = false, length = 2048)
    private String url;

    @Column(length = 150)
    private String author;

    @Column(length = 150)
    private String publisher;

    @Column(name = "is_main_material", nullable = false)
    private Boolean mainMaterial = false;

    @Column(length = 1000)
    private String note;
}