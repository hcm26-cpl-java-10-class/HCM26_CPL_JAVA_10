package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.ProjectMemberRepository;
import com.example.starter_project_2025.system.project.ProjectTeamStatus;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import com.example.starter_project_2025.system.project.trainingclass.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UnassignedClassMemberService {

    private final TrainingClassRepository trainingClassRepository;
    private final ClassMemberRepository classMemberRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final TeamAllocationSessionRepository sessionRepository;
    private final ScopeAuthorizationService scopeAuthorizationService;

    @Transactional(readOnly = true)
    public List<UnassignedClassMemberResponse> getUnassignedMembers(
            Long classId,
            Long sessionId,
            Authentication authentication
    ) {
        TrainingClass trainingClass = trainingClassRepository.findById(classId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("TrainingClass", "id", classId));

        scopeAuthorizationService.assertCanManageClass(authentication, trainingClass);
        TeamAllocationSession session = sessionRepository
                .findByIdAndTrainingClass_Id(sessionId, classId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "TeamAllocationSession", "id", sessionId));

        Set<Long> assignedMemberIds = Set.copyOf(
                projectMemberRepository.findAssignedMemberIdsBySessionAndTeamStatus(
                        session.getId(),
                        ProjectTeamStatus.ACTIVE
                )
        );

        return classMemberRepository
                .findAllByTrainingClass_IdAndStatusOrderByIdAsc(
                        classId,
                        ClassMemberStatus.ACTIVE
                )
                .stream()
                .filter(member -> !assignedMemberIds.contains(member.getId()))
                .map(member -> new UnassignedClassMemberResponse(
                        member.getId(),
                        member.getUser().getFullName()
                ))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ClassMemberRosterResponse> getClassRoster(
            Long classId,
            Long sessionId,
            Authentication authentication
    ) {
        TrainingClass trainingClass = trainingClassRepository.findById(classId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("TrainingClass", "id", classId));

        scopeAuthorizationService.assertCanManageClass(authentication, trainingClass);

        Set<Long> assignedMemberIds = sessionId == null
                ? Set.of()
                : Set.copyOf(sessionRepository.findByIdAndTrainingClass_Id(sessionId, classId)
                        .map(session -> projectMemberRepository
                                .findAssignedMemberIdsBySessionAndTeamStatus(
                                        session.getId(), ProjectTeamStatus.ACTIVE))
                        .orElseThrow(() -> new ResourceNotFoundException(
                                "TeamAllocationSession", "id", sessionId)));

        return classMemberRepository
                .findAllByTrainingClass_IdAndStatusOrderByIdAsc(
                        classId,
                        ClassMemberStatus.ACTIVE
                )
                .stream()
                .map(member -> new ClassMemberRosterResponse(
                        member.getId(),
                        member.getUser().getFullName(),
                        assignedMemberIds.contains(member.getId())
                ))
                .toList();
    }
}