package com.example.starter_project_2025.system.study_session;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.function.Consumer;

/** Each imported row commits validation, usage and the row together; other rows remain independent. */
@Service
@RequiredArgsConstructor
public class StudySessionImportWriter {
    private final StudySessionScheduling scheduling;
    private final StudySessionRepository sessions;
    @Transactional
    public void save(StudySession row, Consumer<StudySession> beforeSave) {
        row.setId(null);
        scheduling.lock(); beforeSave.accept(row); scheduling.validate(row); sessions.saveAndFlush(row);
    }
}
