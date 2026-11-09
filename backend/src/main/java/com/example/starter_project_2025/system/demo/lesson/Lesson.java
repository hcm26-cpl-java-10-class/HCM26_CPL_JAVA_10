package com.example.starter_project_2025.system.demo.lesson;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.demo.section.Section;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "lessons")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@ResourcePermission("LESSON")
public class Lesson extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "section_id", nullable = false)
    Section section;

    @Column(nullable = false, length = 200)
    String title;

    @Enumerated(EnumType.STRING)
    @Column(name = "content_type", nullable = false, length = 20)
    LessonContentType contentType;

    @Column(name = "content_url", length = 500)
    String contentUrl;

    @Column(name = "text_content", columnDefinition = "TEXT")
    String textContent;

    @Column
    Integer duration;

    @Column(name = "order_index", nullable = false)
    Integer orderIndex;
}
