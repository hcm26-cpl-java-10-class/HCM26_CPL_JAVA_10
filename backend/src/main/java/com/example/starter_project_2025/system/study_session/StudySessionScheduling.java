package com.example.starter_project_2025.system.study_session;

import com.example.starter_project_2025.system.schedule.ScheduleEntryKey;
import com.example.starter_project_2025.system.trainingprogram.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(propagation=Propagation.MANDATORY)
public class StudySessionScheduling {
    private final TeachingAssignmentSessionGuard guard;
    private final AssignmentScheduleValidation validation;
    public void lock(){guard.lockForWrite();}
    public void remember(Long assignmentId){guard.rememberUse(assignmentId);}
    public void validate(StudySession session) {
        // Unlinked legacy records retain their existing CRUD contract.
        if(session.getTeachingAssignmentId()==null) return;
        var key=session.getId()==null?null:new ScheduleEntryKey(ScheduleEntryKey.Source.STUDY_SESSION,session.getId());
        validation.requireValid(List.of(new AssignmentScheduleProposal(key,session.getTeachingAssignmentId(),
                session.getClassId(),session.getSubjectId(),session.getProgramSubjectId(),session.getTrainerId(),session.getTitle(),
                session.getSessionDate().atTime(session.getStartTime()),session.getSessionDate().atTime(session.getEndTime()),
                session.getRoomId(),session.getMeetingUrl())));
    }
}
