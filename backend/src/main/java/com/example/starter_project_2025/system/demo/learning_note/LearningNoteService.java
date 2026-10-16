
package com.example.starter_project_2025.system.demo.learning_note;

public interface LearningNoteService {

    LearningNote create(
            Long userId,
            LearningNoteDTO request
    );

}
