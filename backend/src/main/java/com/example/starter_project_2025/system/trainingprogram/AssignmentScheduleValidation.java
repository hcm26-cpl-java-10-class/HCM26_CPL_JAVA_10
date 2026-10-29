package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.system.demo.session.SessionRepository;
import com.example.starter_project_2025.system.schedule.*;
import com.example.starter_project_2025.system.study_session.StudySessionRepository;
import com.example.starter_project_2025.system.subject.SubjectStatus;
import com.example.starter_project_2025.exception.ConflictException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.util.*;

/** Agreed P6 write gate. Both real tables participate; preview never records usage. */
@Service
@RequiredArgsConstructor
public class AssignmentScheduleValidation {
    private final TeachingAssignmentRepository assignments;
    private final ClassTrainingProgramRepository classPrograms;
    private final AssignmentSessionHistory history;
    private final SessionRepository demo;
    private final StudySessionRepository study;
    private final TeachingAssignmentSessionGuard guard;
    private final ScheduleReferenceProvider references;
    private final ScheduleValidationEngine engine;
    private final ScheduleRules rules;

    public record Issue(String code, String field, String message, Integer candidateIndex,
                        Integer relatedCandidateIndex, ScheduleEntryKey relatedEntryKey) {}
    public record Result(boolean valid, List<Issue> issues) {}

    @Transactional(readOnly=true)
    public Result preview(List<AssignmentScheduleProposal> proposals) {
        var issues = new ArrayList<Issue>();
        if (proposals == null || proposals.isEmpty() || proposals.size()>rules.getMaxBatchSize()) {
            return new Result(false,List.of(new Issue("BATCH_SIZE","sessions","Provide between 1 and " + rules.getMaxBatchSize() + " sessions.",null,null,null)));
        }
        var candidates = new ArrayList<ScheduleCandidate>();
        var replaced = new HashSet<ScheduleEntryKey>();
        for(int i=0;i<proposals.size();i++) {
            var p=proposals.get(i);
            if(p==null || p.teachingAssignmentId()==null || p.startTime()==null || p.endTime()==null
                    || !p.endTime().isAfter(p.startTime()) || p.title()==null || p.title().isBlank() || p.title().length()>150) {
                issues.add(issue("INVALID_SESSION","sessions","Provide an assignment, title and valid time interval.",i));
                continue;
            }
            var a=assignments.findById(p.teachingAssignmentId()).orElse(null);
            if(a==null) { issues.add(issue("ASSIGNMENT_INVALID","teachingAssignmentId","The assignment no longer exists.",i)); continue; }
            var ps=a.getProgramSubject();
            if(!Boolean.TRUE.equals(a.getIsActive()) || ps.getProgram().getStatus()!=ProgramStatus.ACTIVE
                    || !Boolean.TRUE.equals(ps.getSubject().getIsActive()) || ps.getSubject().getStatus()!=SubjectStatus.ACTIVE
                    || p.startTime().toLocalDate().isBefore(a.getEffectiveFrom())
                    || (a.getEffectiveTo()!=null && p.endTime().toLocalDate().isAfter(a.getEffectiveTo()))
                    || mismatch(p.classId(),a.getClassId()) || mismatch(p.trainerId(),a.getTrainerId())
                    || mismatch(p.subjectId(),ps.getSubject().getId()) || mismatch(p.programSubjectId(),ps.getId())) {
                issues.add(issue("ASSIGNMENT_INVALID","teachingAssignmentId","The assignment must match the class, subject, trainer and full effective period.",i));
            }
            if (!AssignmentTeachingSlot.covers(a.getTeachingSlots(), p.startTime(), p.endTime()))
                issues.add(issue("ASSIGNMENT_SLOT_INVALID", "teachingAssignmentId", "The session must fit within one assigned teaching slot.", i));
            if (assignments.existsTrainerSlotConflict(a.getTrainerId(), a.getId(), p.startTime().toLocalDate(),
                    p.startTime().toLocalTime(), p.endTime().toLocalTime()))
                issues.add(issue("TRAINER_CONFLICT", "trainerId", "The trainer has another teaching slot during this time.", i));
            if(p.replacedKey()!=null) {
                boolean exists=p.replacedKey().source()==ScheduleEntryKey.Source.STUDY_SESSION
                        ? study.existsById(p.replacedKey().id()) : demo.existsById(p.replacedKey().id());
                if(!exists || !replaced.add(p.replacedKey())) issues.add(issue("EDIT_ID_INVALID","replacedKey","Each edited entry must exist and appear only once.",i));
            }
            candidates.add(new ScheduleCandidate(null,a.getClassId(),null,a.getTrainerId(),a.getId(),p.roomId(),null,p.meetingUrl(),p.title(),p.startTime(),p.endTime()));
        }
        if(!issues.isEmpty()) return new Result(false,List.copyOf(issues));
        var refs=references.loadResources();
        for(int i=0;i<proposals.size();i++) {
            var a=assignments.findById(proposals.get(i).teachingAssignmentId()).orElseThrow();
            var clazz=refs.classes().stream().filter(c->Objects.equals(c.getId(),a.getClassId())).findFirst().orElse(null);
            Long programId=classPrograms.findByClassId(a.getClassId()).map(link->link.getProgram().getId()).orElse(clazz==null?null:clazz.getProgramId());
            if(!Objects.equals(programId,a.getProgramSubject().getProgram().getId()))
                issues.add(issue("PROGRAM_MISMATCH","programSubjectId","The assignment program must match the class program.",i));
        }
        for(var error:engine.inspectResources(candidates,refs)) issues.add(new Issue(error.code(),error.field(),error.message(),error.candidateIndex(),null,null));
        var from=candidates.stream().map(ScheduleCandidate::startTime).min(Comparator.naturalOrder()).orElseThrow();
        var to=candidates.stream().map(ScheduleCandidate::endTime).max(Comparator.naturalOrder()).orElseThrow();
        for(var row:history.blocking(from,to)) {
            var s=row.summary(); var key=new ScheduleEntryKey(s.source(),s.id());
            if(replaced.contains(key)) continue;
            if(row.classId()==null || row.trainerId()==null || (s.roomId()==null && (s.meetingUrl()==null || s.meetingUrl().isBlank())))
                issues.add(new Issue("RESOURCE_DATA_INCOMPLETE","resources","An existing booking has incomplete resource identity; resolve it before scheduling.",null,null,key));
            for(int i=0;i<candidates.size();i++) {
                var c=candidates.get(i);
                compare(c,row.classId(),row.trainerId(),s.roomId(),s.startTime(),s.endTime(),i,null,key,issues);
            }
        }
        for(int i=0;i<candidates.size();i++) for(int j=0;j<i;j++) {
            var other=candidates.get(j);
            compare(candidates.get(i),other.classId(),other.trainerId(),other.roomId(),other.startTime(),other.endTime(),i,j,null,issues);
        }
        return new Result(issues.isEmpty(),List.copyOf(issues));
    }

    @Transactional(propagation=Propagation.MANDATORY)
    public void requireValid(List<AssignmentScheduleProposal> proposals) {
        guard.lockForWrite();
        var result=preview(proposals);
        if(!result.valid()) throw new Rejected(result);
        proposals.forEach(p->guard.rememberUse(p.teachingAssignmentId()));
    }
    public static class Rejected extends ConflictException {
        private final Result result;
        public Rejected(Result result) { super("Scheduling validation failed. Reload the assignment or resolve the reported issues."); this.result=result; }
        public Result result(){return result;}
    }
    private boolean mismatch(Long supplied,Long actual){return supplied!=null && !Objects.equals(supplied,actual);}
    private Issue issue(String code,String field,String message,int index){return new Issue(code,field,message,index,null,null);}
    private void compare(ScheduleCandidate a,Long clazz,Long trainer,Long room,java.time.LocalDateTime from,
                         java.time.LocalDateTime to,int index,Integer peer,ScheduleEntryKey key,List<Issue> issues) {
        if(!a.startTime().isBefore(to) || !from.isBefore(a.endTime())) return;
        if(clazz!=null && clazz.equals(a.classId())) issues.add(new Issue("CLASS_CONFLICT","classId","The class already has a booking.",index,peer,key));
        if(trainer!=null && trainer.equals(a.trainerId())) issues.add(new Issue("TRAINER_CONFLICT","trainerId","The trainer already has a booking.",index,peer,key));
        if(room!=null && room.equals(a.roomId())) issues.add(new Issue("ROOM_CONFLICT","roomId","The room already has a booking.",index,peer,key));
    }
}
