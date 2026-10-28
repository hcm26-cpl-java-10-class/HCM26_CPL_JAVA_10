package com.example.starter_project_2025.system.demo.learning_note;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LearningNoteRepository
        extends BaseCrudRepository<LearningNote, Long> {
}