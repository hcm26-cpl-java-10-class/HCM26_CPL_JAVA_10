package com.example.starter_project_2025.system.project.allocation;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.*;
import com.example.starter_project_2025.system.project.project_template_version.*;
import com.example.starter_project_2025.system.project.template.ProjectTemplateLevel;
import com.example.starter_project_2025.system.project.template.ProjectTemplateStatus;
import com.example.starter_project_2025.system.project.trainingclass.ScopeAuthorizationService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Subquery;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TemplateCandidateService {
    private final ProjectTemplateRepository templates;
    private final ProjectTemplateSnapshotRepository versions;
    private final TeamAllocationSessionRepository sessions;
    private final ProjectTeamRepository teams;
    private final ProjectMemberRepository members;
    private final ScopeAuthorizationService scope;
    private final ObjectMapper mapper;
    private final TemplateSearchAuditWriter audit;

    public record Candidate(Long templateId, Long versionId, String version, String code, String name,
            String description, String category, ProjectTemplateLevel level, Integer durationWeeks,
            int minMembers, int maxMembers, boolean capacityMatch) {}

    public record Preview(Candidate template, JsonNode brief) {}

    public Page<Candidate> search(Long classId, Long sessionId, Long teamId, Authentication auth,
            String q, ProjectTemplateLevel level, String category, int page, int size) {
        Context context = requireContext(classId, sessionId, teamId, auth);
        if (page < 0 || size < 1 || size > 50 || (q != null && q.length() > 120)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid pagination or search term");
        }
        Page<ProjectTemplate> rows = templates.findAll(eligible(context, q, level, category),
                PageRequest.of(page, size, Sort.by(Sort.Order.asc("name"), Sort.Order.asc("id"))));
        if (rows.isEmpty()) return rows.map(template -> candidate(template, context.memberCount(), published(template.getId())));
        List<Long> ids = rows.getContent().stream().map(ProjectTemplate::getId).toList();
        Map<Long, ProjectTemplateSnapshot> currentVersions = versions
                .findAllByTemplateIdInAndProjectIdIsNullAndIsActiveTrueOrderByCreatedAtDescIdDesc(
                        ids)
                .stream().filter(version -> version.getStatus() == ProjectTemplateVersionStatus.PUBLISHED)
                .collect(Collectors.toMap(ProjectTemplateSnapshot::getTemplateId,
                        Function.identity(), (first, ignored) -> first));
        return rows.map(template -> candidate(template, context.memberCount(),
                currentVersions.get(template.getId())));
    }

    public Preview preview(Long classId, Long sessionId, Long teamId, Long templateId, Authentication auth) {
        Context context = requireContext(classId, sessionId, teamId, auth);
        ProjectTemplate template = templates.findOne(eligible(context, null, null, null).and((root, query, cb) -> cb.equal(root.get("id"), templateId)))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Template is no longer available"));
        ProjectTemplateSnapshot version = published(template.getId());
        try {
            return new Preview(candidate(template, context.memberCount(), version), mapper.readTree(version.getContentJson()));
        } catch (Exception error) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Published brief is invalid");
        }
    }

    record Context(Long tenantId, Long cohortId, long memberCount) {}

    private Context requireContext(Long classId, Long sessionId, Long teamId, Authentication auth) {
        if (auth == null || !(auth.getPrincipal() instanceof UserPrincipal principal)) {
            audit.denied(null, null, classId, teamId, "AUTHENTICATION_REQUIRED");
            throw new AccessDeniedException("Authentication is required");
        }
        boolean allowedRole = auth.getAuthorities().stream().anyMatch(authority ->
                "ROLE_MENTOR".equals(authority.getAuthority())
                        || "ROLE_PROGRAM_MANAGER".equals(authority.getAuthority())
                        || "ROLE_ADMIN".equals(authority.getAuthority()));
        if (!allowedRole || !Boolean.TRUE.equals(principal.getUser().getIsActive())
                || Boolean.TRUE.equals(principal.getUser().getLocked())) {
            audit.denied(principal.getUser().getId(), principal.getUser().getTenantId(),
                    classId, teamId, "ROLE_DENIED");
            throw new AccessDeniedException("Template search is not allowed");
        }
        TeamAllocationSession session = sessions.findByIdAndTrainingClass_Id(sessionId, classId)
                .orElseThrow(() -> new ResourceNotFoundException("TeamAllocationSession", "id", sessionId));
        Long tenantId = principal.getUser().getTenantId();
        if (tenantId == null || !tenantId.equals(session.getTrainingClass().getTenantId())) {
            audit.denied(principal.getUser().getId(), tenantId, classId, teamId, "TENANT_DENIED");
            throw new AccessDeniedException("Team is outside the current tenant");
        }
        try {
            scope.assertCanSearchProjectTemplates(auth, session.getTrainingClass());
        } catch (AccessDeniedException denied) {
            audit.denied(principal.getUser().getId(), tenantId, classId, teamId, "SCOPE_DENIED");
            throw denied;
        }
        ProjectTeam team = teams.findByIdAndAllocationSession_Id(teamId, sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("ProjectTeam", "id", teamId));
        return new Context(tenantId, session.getTrainingClass().getCohortId(),
                members.countByTeam_Id(team.getId()));
    }

    static Specification<ProjectTemplate> eligible(Context context, String q, ProjectTemplateLevel level, String category) {
        return (root, query, cb) -> {
            List<Predicate> all = new ArrayList<>();
            all.add(cb.equal(root.get("tenantId"), context.tenantId()));
            all.add(cb.isTrue(root.get("isActive")));
            all.add(cb.equal(root.get("status"), ProjectTemplateStatus.ACTIVE));
            Subquery<Long> published = query.subquery(Long.class);
            var version = published.from(ProjectTemplateSnapshot.class);
            published.select(version.get("id")).where(cb.equal(version.get("templateId"), root.get("id")),
                    cb.equal(version.get("status"), ProjectTemplateVersionStatus.PUBLISHED),
                    cb.isTrue(version.get("isActive")));
            all.add(cb.exists(published));
            if (q != null && !q.isBlank()) {
                String value = "%" + q.strip().toLowerCase(Locale.ROOT)
                        .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
                all.add(cb.or(cb.like(cb.lower(root.get("name")), value, '\\'),
                        cb.like(cb.lower(root.get("code")), value, '\\'),
                        cb.like(cb.lower(root.get("description")), value, '\\')));
            }
            if (level != null) all.add(cb.equal(root.get("level"), level));
            if (category != null && !category.isBlank())
                all.add(cb.equal(cb.lower(root.get("category")), category.strip().toLowerCase(Locale.ROOT)));
            return cb.and(all.toArray(Predicate[]::new));
        };
    }

    private ProjectTemplateSnapshot published(Long templateId) {
        return versions.findFirstByTemplateIdAndStatusAndIsActiveTrueOrderByCreatedAtDesc(
                templateId, ProjectTemplateVersionStatus.PUBLISHED)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Published version not found"));
    }

    private Candidate candidate(ProjectTemplate template, long count, ProjectTemplateSnapshot version) {
        if (version == null) throw new ResponseStatusException(HttpStatus.CONFLICT, "Published version disappeared");
        var capacity = ProjectTemplateConstraints.parse(mapper, template, null);
        return new Candidate(template.getId(), version.getId(), version.getVersion(), template.getCode(),
                template.getName(), template.getDescription(), template.getCategory(), template.getLevel(),
                template.getEstimatedDurationWeeks(),
                capacity.minMembers(), capacity.maxMembers(), capacity.accepts(count));
    }
}
