package com.example.starter_project_2025.system.demo.course;
import com.example.starter_project_2025.system.demo.category.Category;
import com.example.starter_project_2025.system.demo.syllabus.entity.Syllabus;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.template.annotation.ImportEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.*;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

import java.util.HashSet;
import java.util.Set;

@Entity
@EntityListeners(CourseCoverListener.class)
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "courses", uniqueConstraints = @UniqueConstraint(
        name = "uk_courses_syllabus_scope", columnNames = {"syllabus_id", "source_topic_scope_key"}))
@FieldDefaults(level = AccessLevel.PRIVATE)
@ResourcePermission("COURSE")
@ImportEntity("course")
@ResourceMenu(
        title = "Courses",
        group = "Course Management",
        icon = "graduation-cap",
        url = "/courses",
        order = 1,
        permission = "COURSE_READ"
)
public class Course extends BaseEntity {

    @Column(unique = true, nullable = false, length = 150)
    @ImportField(name = "Name", required = true)       // <-- thêm
    String name;

    @Column(length = 500)
    @ImportField(name = "Description")
    String description;

    @Column(length = 255)
    String thumbnailUrl;

    /** Request-only selected image; never stored in a database column. */
    @Transient
    String coverImage;

    @Column(length = 100)
    String instructor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "instructor_id")
    User instructorUser;

    @Builder.Default
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "course_category",
            joinColumns = @JoinColumn(name = "course_id"),
            inverseJoinColumns = @JoinColumn(name = "category_id"),
            uniqueConstraints = @UniqueConstraint(
                    name = "uk_course_category_course_cat",
                    columnNames = {"course_id", "category_id"}
            )
    )
    Set<Category> categories = new HashSet<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "syllabus_id")
    Syllabus syllabus;

    /** Null for legacy/standard Courses. V1: SHA-256 of Topic IDs; V2: SHA-256 of Topic IDs AND normalized Course outline. */
    @Column(name = "source_topic_scope_key", length = 64)
    String sourceTopicScopeKey;

    /** Selected Topic IDs in canonical order; not derived from Lesson titles. */
    @Column(name = "source_topic_ids", columnDefinition = "TEXT")
    String sourceTopicIds;

    /** Normalized uniqueness for generated-from-Syllabus Courses only; legacy/standard rows stay unchanged. */
    @Column(name = "normalized_name_key", length = 150, unique = true)
    String normalizedNameKey;

    @PrePersist
    @PreUpdate
    void updateNameKey() {
        normalizedNameKey = courseType == CourseType.FROM_SYLLABUS
                ? CourseSourceScope.nameKey(name) : null;
    }

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20,
            columnDefinition = "varchar(20) default 'STANDARD'")
    CourseType courseType = CourseType.STANDARD;

    public boolean allowsOutlineEditing() {
        return courseType == CourseType.FROM_SYLLABUS && status == CourseStatus.DRAFT;
    }

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    CourseStatus status = CourseStatus.DRAFT;

    @Builder.Default
    @Column(nullable = false)
    Boolean isFree = true;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    CourseLevel level;
}
