package com.example.starter_project_2025.system.project;

import java.util.List;

import com.example.starter_project_2025.system.project.UnassignedClassMemberResponse;
import com.example.starter_project_2025.system.project.UnassignedClassMemberService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/classes/{classId}/members")
public class ClassMemberQueryController {

    private final UnassignedClassMemberService memberService;

    @GetMapping("/unassigned")
    @PreAuthorize("hasAuthority('PEO_TEAM_ALLOCATE')")
    public List<UnassignedClassMemberResponse> getUnassignedMembers(
            @PathVariable Long classId,
            @RequestParam Long sessionId,
            Authentication authentication
    ) {
        return memberService.getUnassignedMembers(classId, sessionId, authentication);
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PEO_TEAM_ALLOCATE')")
    public List<ClassMemberRosterResponse> getClassRoster(
            @PathVariable Long classId,
            @RequestParam(required = false) Long sessionId,
            Authentication authentication
    ) {
        return memberService.getClassRoster(classId, sessionId, authentication);
    }
}