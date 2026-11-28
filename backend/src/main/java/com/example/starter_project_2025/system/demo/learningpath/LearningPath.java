package com.example.starter_project_2025.system.demo.learningpath;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

/** An ordered group of courses a learner works through; finishing all of them earns a path completion. */
@Entity
@Table(name = "learning_paths")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LearningPath extends BaseEntity {

    @Column(nullable = false, length = 150)
    String name;

    @Column(length = 2000)
    String description;
}
