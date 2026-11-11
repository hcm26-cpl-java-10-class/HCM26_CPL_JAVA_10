package com.example.starter_project_2025.system.study_session;

import org.springframework.stereotype.Component;

@Component
public class MockStudySessionVersionLock implements StudySessionVersionLock {

    @Override
    public boolean isLocked(Long studySessionId) {
        // TODO: Delegate to Phat's version-based edit lock implementation.
        return false;
    }
}
