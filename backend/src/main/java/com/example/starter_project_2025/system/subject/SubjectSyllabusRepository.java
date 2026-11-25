package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SubjectSyllabusRepository extends BaseCrudRepository<SubjectSyllabus, Long> {

    Optional<SubjectSyllabus> findBySubject_Id(Long subjectId);

    void deleteBySubject_Id(Long subjectId);
}

