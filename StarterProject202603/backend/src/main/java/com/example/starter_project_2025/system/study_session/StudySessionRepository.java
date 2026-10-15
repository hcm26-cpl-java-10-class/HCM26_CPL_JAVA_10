package com.example.starter_project_2025.system.study_session;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface StudySessionRepository extends BaseCrudRepository<StudySession, Long> {

	boolean existsBySubjectId(Long subjectId);
}