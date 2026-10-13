package com.example.starter_project_2025.system.study_session;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "study_sessions")
@FieldDefaults(level = AccessLevel.PRIVATE)
@ResourcePermission("STUDY_SESSION")
public class StudySession extends BaseEntity {

    @Column(nullable = false)
    Long classId;

    @Column(nullable = false)
    Long subjectId;

    @Column(nullable = false)
    Long teacherId;

    @Column(nullable = false, length = 200)
    String title;

    @Column(nullable = false)
    LocalDateTime startTime;

    @Column(nullable = false)
    LocalDateTime endTime;

    @Column(length = 100)
    String room;

    @Column(length = 500)
    String onlineLink;
}