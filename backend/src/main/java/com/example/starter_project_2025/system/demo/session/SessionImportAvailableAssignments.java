package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.system.trainingprogram.ClassSetupService;
import com.example.starter_project_2025.system.trainingprogram.TeachingAssignmentResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

/** A rejected directory lookup must not mark the enclosing preview/save transaction rollback-only. */
@Service
@RequiredArgsConstructor
public class SessionImportAvailableAssignments {
    private final ClassSetupService classSetup;

    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    public List<TeachingAssignmentResponse> forSession(SessionDTO request) {
        return classSetup.getAvailableClassAssignments(request.getClassId(), null, null,
                request.getStartTime(), request.getEndTime());
    }
}
