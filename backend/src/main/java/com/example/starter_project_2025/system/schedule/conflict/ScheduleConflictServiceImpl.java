package com.example.starter_project_2025.system.schedule.conflict;

import com.example.starter_project_2025.system.schedule.*;
import com.example.starter_project_2025.system.schedule.conflict.dto.*;
import com.example.starter_project_2025.system.schedule_version.ScheduleVersionRepository;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

/** Compatibility facade for the existing feature/schedule-validation API. */
@Service
@RequiredArgsConstructor
public class ScheduleConflictServiceImpl implements ScheduleConflictService {
    private final ScheduleValidationEngine engine;
    private final ScheduleCandidateAdapter adapter;
    private final ScheduleVersionRepository versions;

    @Override
    @Transactional(readOnly=true)
    public ScheduleValidationResponse validateCandidates(Long versionId, ScheduleValidationRequest request) {
        var version=versions.findById(versionId).orElseThrow(() -> new ResourceNotFoundException("The schedule version could not be found."));
        var keys=new HashSet<String>();
        for (var c : request.getSessions()) {
            if (!keys.add(c.getCandidateKey())) throw new IllegalArgumentException("Each session in the request must have a unique candidate key.");
            if (!Objects.equals(version.getClassId(),String.valueOf(c.getClassId())))
                throw new IllegalArgumentException("Each session must belong to the class associated with the schedule version.");
        }
        var result=engine.validate(adapter.adapt(request.getSessions()));
        return new ScheduleValidationResponse(versionId,result.valid(),result.issues().stream().map(i ->
                new ScheduleConflictIssue(i.code(),i.candidateIndex()<0 ? null : request.getSessions().get(i.candidateIndex()).getCandidateKey(),
                        i.field(),i.message(),i.relatedSessionId(),i.relatedCandidateIndex()==null ? null :
                        request.getSessions().get(i.relatedCandidateIndex()).getCandidateKey())).toList());
    }
}