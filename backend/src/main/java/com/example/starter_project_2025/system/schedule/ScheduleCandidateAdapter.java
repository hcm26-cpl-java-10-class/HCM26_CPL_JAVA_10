package com.example.starter_project_2025.system.schedule;

import com.example.starter_project_2025.system.demo.session.*;
import com.example.starter_project_2025.system.schedule.conflict.dto.SessionCandidateRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.util.*;

@Component
@RequiredArgsConstructor
public class ScheduleCandidateAdapter {
    private final SessionRepository sessions;
    private final ScheduleReferenceProvider references;

    public List<ScheduleCandidate> adapt(List<SessionCandidateRequest> requests) {
        var refs = references.load();
        return requests.stream().map(r -> {
            Session current = r.getSessionId() == null ? null : sessions.findById(r.getSessionId()).orElse(null);
            if (current != null && !Objects.equals(current.getClassId(), r.getClassId()))
                throw new IllegalArgumentException("The session you are trying to update does not belong to the selected class.");
            var eligible = refs.assignments().stream().filter(a ->
                    Objects.equals(a.classId(), r.getClassId()) && Objects.equals(a.trainerId(), r.getTrainerId())
                    && (r.getTeachingAssignmentId() == null || Objects.equals(a.id(),r.getTeachingAssignmentId()))
                    && "ACTIVE".equalsIgnoreCase(a.status())).toList();
            Long topic = r.getTopicId() != null ? r.getTopicId() : current != null ? current.getTopicId()
                    : eligible.size() == 1 ? eligible.getFirst().topicId() : null;
            return new ScheduleCandidate(r.getSessionId(),r.getClassId(),topic,r.getTrainerId(),
                    r.getTeachingAssignmentId(),r.getRoomId(),r.getLocation(),r.getMeetingUrl(),
                    r.getTitle() != null ? r.getTitle() : current != null ? current.getTitle() : "Proposed session",
                    r.getStartAt(),r.getEndAt());
        }).toList();
    }
}