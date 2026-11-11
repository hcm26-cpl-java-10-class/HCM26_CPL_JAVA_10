package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.system.external_api.ExternalApiService;
import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.schedule.ScheduleIssue;
import com.example.starter_project_2025.system.subject.SubjectStatus;
import com.example.starter_project_2025.system.trainingprogram.*;
import lombok.RequiredArgsConstructor;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

/** Import-only eligibility checks. Topic identity remains the schedule owner's contract. */
@Service
@RequiredArgsConstructor
public class SessionImportAssignmentPolicy {
    private final TeachingAssignmentRepository assignments;
    private final SessionImportAvailableAssignments availableAssignments;
    private final ExternalApiService externalResources;
    private final Environment environment;

    @Transactional(readOnly = true)
    public List<ScheduleIssue> validateAndResolve(List<SessionDTO> requests) {
        var issues = new ArrayList<ScheduleIssue>();
        boolean sampleSource = externalResources.isSampleData() || environment.acceptsProfiles(Profiles.of("schedule-demo"));
        if (sampleSource) {
            issues.add(issue("IMPORT_REFERENCE_SOURCE", -1,
                    "Real assignment/resource data is required. local/schedule-demo references are sample data and cannot certify a real Session import. Configure the team's existing data source; no data is created by Preview."));
        }
        for (int index = 0; index < requests.size(); index++) {
            var request = requests.get(index);
            String lookup = lookup(request);
            TeachingAssignment assignment = null;
            if (request.getTeachingAssignmentId() != null) {
                assignment = assignments.findById(request.getTeachingAssignmentId()).orElse(null);
                if (assignment == null) {
                    issues.add(issue("IMPORT_ASSIGNMENT_NOT_FOUND", index,
                            "Teaching Assignment ID (column D): " + request.getTeachingAssignmentId()
                                    + " does not exist in the current assignment store. Obtain an existing ID from " + lookup + "."));
                    continue;
                }
                String error = basicError(assignment, request);
                if (error != null) { issues.add(issue("IMPORT_ASSIGNMENT_INVALID", index, error + " Use " + lookup + ".")); continue; }
            }
            if (sampleSource) continue; // Never resolve IDs from demo reference catalogues.
            List<TeachingAssignmentResponse> available;
            try {
                available = availableAssignments.forSession(request).stream()
                        .filter(item -> Objects.equals(item.classId(), request.getClassId())
                                && Objects.equals(item.trainerId(), request.getTrainerId()))
                        .toList();
            } catch (BusinessValidationException error) {
                issues.add(issue("IMPORT_ASSIGNMENT_LOOKUP", index, "Teaching Assignment ID (column D): "
                        + error.getErrors().entrySet().stream().map(entry -> entry.getKey() + ": "
                        + String.join("; ", entry.getValue())).collect(java.util.stream.Collectors.joining("; "))));
                continue;
            } catch (ResourceNotFoundException | IllegalArgumentException error) {
                issues.add(issue("IMPORT_ASSIGNMENT_LOOKUP", index,
                        "Teaching Assignment ID (column D): " + error.getMessage() + " Check " + lookup + "."));
                continue;
            } catch (ExternalApiException error) {
                issues.add(issue("IMPORT_ASSIGNMENT_SOURCE_UNAVAILABLE", index,
                        "Teaching Assignment ID (column D): the authoritative resource API is unavailable. Restore that source before importing."));
                continue;
            }
            if (assignment == null) {
                if (available.size() != 1) {
                    issues.add(issue("IMPORT_ASSIGNMENT_REQUIRED", index,
                            "Teaching Assignment ID (column D) is blank. "
                                    + (available.isEmpty() ? "No current eligible assignment matches this class, trainer and interval. Import or obtain the real assignment first. "
                                    : "More than one assignment is eligible; select an explicit ID. ")
                                    + "Use " + lookup + ". Topic ID is not Subject ID or ProgramSubject ID."));
                    continue;
                }
                assignment = assignments.findById(available.getFirst().id()).orElse(null);
                if (assignment == null) {
                    issues.add(issue("IMPORT_ASSIGNMENT_NOT_FOUND", index,
                            "Teaching Assignment ID (column D): the selected available assignment no longer exists; reload " + lookup + "."));
                    continue;
                }
                String error = basicError(assignment, request);
                if (error != null) { issues.add(issue("IMPORT_ASSIGNMENT_INVALID", index, error)); continue; }
            }
            final TeachingAssignment selected = assignment;
            boolean eligible = available.stream().anyMatch(item -> Objects.equals(item.id(), selected.getId())
                    && Objects.equals(item.programSubjectId(), selected.getProgramSubject().getId())
                    && Objects.equals(item.subjectId(), selected.getProgramSubject().getSubject().getId()));
            if (!eligible) {
                issues.add(issue("IMPORT_ASSIGNMENT_UNAVAILABLE", index,
                        "Teaching Assignment ID (column D): " + selected.getId()
                                + " is not eligible in the class curriculum for the full session interval. Check ACTIVE class/trainer/program/subject and the available API: " + lookup + "."));
                continue;
            }
            // Resolve an existing unambiguous assignment only; do not derive or replace topicId.
            request.setTeachingAssignmentId(selected.getId());
        }
        return List.copyOf(issues);
    }

    private String basicError(TeachingAssignment assignment, SessionDTO request) {
        String prefix = "Teaching Assignment ID (column D): " + assignment.getId() + ": ";
        if (!Boolean.TRUE.equals(assignment.getIsActive())) return prefix + "assignment is inactive.";
        if (!Objects.equals(assignment.getClassId(), request.getClassId())) return prefix + "Class ID (column A) does not match.";
        if (!Objects.equals(assignment.getTrainerId(), request.getTrainerId())) return prefix + "Trainer ID (column C) does not match.";
        if (assignment.getEffectiveFrom() == null || request.getStartTime() == null || request.getEndTime() == null)
            return prefix + "effective dates or session times are incomplete.";
        if (request.getStartTime().toLocalDate().isBefore(assignment.getEffectiveFrom())
                || (assignment.getEffectiveTo() != null && request.getEndTime().toLocalDate().isAfter(assignment.getEffectiveTo())))
            return prefix + "the full Start Time / End Time interval is outside the assignment effective period.";
        var ps = assignment.getProgramSubject();
        if (ps == null || ps.getId() == null || ps.getProgram() == null || ps.getSubject() == null
                || ps.getProgram().getId() == null || ps.getSubject().getId() == null)
            return prefix + "Subject/ProgramSubject references are incomplete.";
        if (ps.getProgram().getStatus() != ProgramStatus.ACTIVE || !Boolean.TRUE.equals(ps.getProgram().getIsActive())
                || ps.getSubject().getStatus() != SubjectStatus.ACTIVE || !Boolean.TRUE.equals(ps.getSubject().getIsActive()))
            return prefix + "the subject and training program must be ACTIVE.";
        return null;
    }

    private String lookup(SessionDTO request) {
        return "GET /api/classes/" + request.getClassId() + "/teaching-assignments/available?date="
                + (request.getStartTime() == null ? "YYYY-MM-DD" : request.getStartTime().toLocalDate())
                + " (use from/to for the full interval)";
    }
    private ScheduleIssue issue(String code, int index, String message) {
        return new ScheduleIssue(code, "teachingAssignmentId", message, index, null, null, null, null, null);
    }
}