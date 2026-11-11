package com.example.starter_project_2025.system.trainingprogram;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ClassTopicCourseRepository extends JpaRepository<ClassTopicCourse, Long> {

    List<ClassTopicCourse> findByClassId(Long classId);

    Optional<ClassTopicCourse> findByClassIdAndProgramSubject_Id(Long classId, Long programSubjectId);

    boolean existsByClassId(Long classId);

    long countByClassId(Long classId);
}

