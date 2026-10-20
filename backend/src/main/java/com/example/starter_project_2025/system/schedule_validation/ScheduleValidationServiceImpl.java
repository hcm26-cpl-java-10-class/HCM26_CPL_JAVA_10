package com.example.starter_project_2025.system.schedule_validation;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.schedule.*;
import com.example.starter_project_2025.system.schedule.conflict.dto.SessionCandidateRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

/** Legacy response shape, backed by the same rules used for writes and the new UI. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly=true)
public class ScheduleValidationServiceImpl implements ScheduleValidationService {
    private final ScheduleValidationEngine engine;
    private final ScheduleCandidateAdapter adapter;
    @Override public ScheduleValidationResult validate(SessionConflictCandidate c) { return validateBatch(Collections.singletonList(c)); }
    @Override public ScheduleValidationResult validateBatch(List<SessionConflictCandidate> candidates) {
        if (candidates == null) candidates=List.of();
        var requests=new ArrayList<SessionCandidateRequest>();
        for (int index=0;index<candidates.size();index++) {
            var c=candidates.get(index);
            if (c==null) throw new IllegalArgumentException("Session details are required.");
            var r=new SessionCandidateRequest();
            r.setCandidateKey(String.valueOf(index));r.setSessionId(c.getSessionId());r.setClassId(c.getClassId());
            r.setTrainerId(c.getTrainerId());r.setLocation(c.getLocation());r.setStartAt(c.getStartTime());r.setEndAt(c.getEndTime());
            requests.add(r);
        }
        var result=engine.validate(requests.isEmpty() ? List.of() : adapter.adapt(requests));
        return ScheduleValidationResult.from(result.issues().stream().map(i -> ScheduleConflict.builder()
                .candidateIndex(i.candidateIndex()).type(switch(i.code()) {
                    case "CLASS_CONFLICT" -> ScheduleConflictType.CLASS_OVERLAP;
                    case "TRAINER_CONFLICT" -> ScheduleConflictType.TRAINER_OVERLAP;
                    case "ROOM_CONFLICT" -> ScheduleConflictType.ROOM_OVERLAP;
                    case "TIME_ORDER" -> ScheduleConflictType.INVALID_TIME;
                    default -> ScheduleConflictType.CONDITION;
                }).field(i.field()).message(i.message()).conflictingSessionId(i.relatedSessionId())
                .conflictingSessionTitle(i.relatedTitle()).conflictingStartTime(i.relatedStart()).conflictingEndTime(i.relatedEnd()).build()).toList());
    }
    @Override public void addValidationErrors(SessionConflictCandidate c,ValidationContext ctx) {
        validate(c).getConflicts().forEach(i -> ctx.add(i.getField(),i.getMessage()));
    }
}
