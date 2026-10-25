# US-PRJ-001-03 — Toàn bộ mã tham chiếu

Đọc IMPLEMENTATION_GUIDE.md trước. Đây là source tham chiếu, chưa áp dụng vào ứng dụng chính. Các file dưới đây giữ nguyên package/cấu trúc của codebase.

## Phase 1 — backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspaceContextService.java

Tạo file mới. Tách kiểm tra workspace/tenant/scope đang có để Overview và mọi phân mục dùng chung.

Đích: `D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspaceContextService.java`

~~~java
package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service @RequiredArgsConstructor @Transactional(readOnly = true)
public class WorkspaceContextService {
    private final WorkspaceRepository workspaces;
    private final WorkspaceAccessService access;

    public Workspace require(User user, Long id) {
        access.requireTenant(user, false);
        Workspace workspace = workspaces.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Workspace was not found"));
        if (!workspace.getTenant().getId().equals(user.getTenant().getId()))
            throw new AccessDeniedException("Workspace is outside the current tenant");
        if (!Boolean.TRUE.equals(workspace.getIsActive()))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Workspace was not found");
        access.requirePair(user, workspace.getProject().getId(), workspace.getTeam().getId(), false);
        return workspace;
    }
}
~~~

## Phase 1 — backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspaceAccessService.java

Sửa file hiện có. Tái sử dụng kiểm tra permission hiện tại trong DB cho từng request; không dựa vào localStorage.

Đích: `D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspaceAccessService.java`

~~~java
package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class WorkspaceAccessService {
    private final UserRepository users;
    private final TenantRepository tenants;
    private final TeamRepository teams;
    private final ProjectRepository projects;
    private static final Set<String> READ = Set.of("WORKSPACE_READ", "VIEW_PROJECT_WORKSPACE");
    private static final Set<String> CREATE = Set.of("WORKSPACE_CREATE", "CREATE_PROJECT_WORKSPACE");

    public User requireUser(boolean creating) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Phiên đăng nhập không hợp lệ");
        }
        User user = users.findById(principal.getUser().getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Phiên đăng nhập không hợp lệ"));
        if (!Boolean.TRUE.equals(user.getIsActive()) || Boolean.TRUE.equals(user.getLocked())
                || !hasPermission(user, creating ? CREATE : READ)) {
            throw new AccessDeniedException("Workspace permission has been revoked");
        }
        if (user.getTenant() == null) throw new AccessDeniedException("Tenant is not assigned");
        return user;
    }

    public boolean canRead(User user) { return hasPermission(user, READ); }

    public boolean canViewMembers(User user) {
        return hasPermission(user, Set.of("WORKSPACE_MEMBER_READ"));
    }

    public void requireMemberRead(User user) {
        if (!canViewMembers(user)) throw new AccessDeniedException("Member access is not allowed");
    }

    public void requireTeamUpdate(User user) {
        if (!hasPermission(user, Set.of("TEAM_UPDATE"))) throw new AccessDeniedException("Team management is not allowed");
    }

    public boolean permitted(User user, String permission) {
        return hasPermission(user, Set.of(permission));
    }

    private boolean hasPermission(User user, Set<String> required) {
        return user.getRoles().stream().filter(role -> Boolean.TRUE.equals(role.getIsActive()))
                .flatMap(role -> role.getPermissions().stream())
                .anyMatch(permission -> Boolean.TRUE.equals(permission.getIsActive()) && required.contains(permission.getName()));
    }

    public Tenant requireTenant(User user, boolean lock) {
        Long id = user.getTenant().getId();
        Tenant tenant = (lock ? tenants.findForWorkspaceCreation(id) : tenants.findById(id))
                .orElseThrow(() -> new AccessDeniedException("Tenant is not available"));
        if (!Boolean.TRUE.equals(tenant.getActive()) || !Boolean.TRUE.equals(tenant.getIsActive())) {
            throw new AccessDeniedException("Tenant is inactive");
        }
        return tenant;
    }

    public Team requirePair(User user, Long projectId, Long teamId, boolean lock) {
        Project project = requireProject(user, projectId, lock);
        Team team = requireTeam(user, teamId, lock);
        if (team.getProject() == null || !team.getProject().getId().equals(projectId)) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Project/team không có quan hệ hợp lệ");
        }
        return team;
    }

    public Project requireProject(User user, Long projectId, boolean lock) {
        Project project = (lock ? projects.findForWorkspaceCreation(projectId) : projects.findById(projectId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project was not found"));
        if (!project.getTenant().getId().equals(user.getTenant().getId())) throw new AccessDeniedException("Project is outside the current tenant");
        if (!Boolean.TRUE.equals(project.getIsActive())) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Project is inactive");
        return project;
    }

    public Team requireTeam(User user, Long teamId, boolean lock) {
        Team team = (lock ? teams.findForWorkspaceCreation(teamId) : teams.findById(teamId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy team"));
        if (!Boolean.TRUE.equals(team.getIsActive())) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Project/team không còn tồn tại");
        }
        Long tenantId = user.getTenant().getId();
        if (!team.getTenant().getId().equals(tenantId) || !inScope(user, team)) {
            throw new AccessDeniedException("Project/team is outside the current scope");
        }
        return team;
    }

    private boolean inScope(User user, Team team) {
        boolean admin = user.getRoles().stream().anyMatch(role -> Boolean.TRUE.equals(role.getIsActive())
                && ("ADMIN".equals(role.getName()) || "PO".equals(role.getName())));
        return admin || (team.getMentor() != null && team.getMentor().getId().equals(user.getId()))
                || team.getMembers().stream().anyMatch(member -> member.isCurrentParticipant()
                && member.getUser().getId().equals(user.getId()));
    }

    public boolean canSelectProject(User user, Project project) {
        boolean administrator = user.getRoles().stream().anyMatch(role -> Boolean.TRUE.equals(role.getIsActive())
                && ("ADMIN".equals(role.getName()) || "PO".equals(role.getName())));
        return administrator || teams.findFirstByProjectIdOrderByIdAsc(project.getId()).map(team -> inScope(user, team)).orElse(true);
    }

    public boolean hasMembers(Team team) {
        return team.getMembers().stream().anyMatch(TeamMember::isCurrentParticipant);
    }

    public boolean projectCanStart(Project project) {
        return project.getStatus() == ProjectStatus.PLANNING || project.getStatus() == ProjectStatus.ACTIVE;
    }
}
~~~

## Phase 1 — backend/src/main/java/com/example/starter_project_2025/system/project/workspace/dto/WorkspaceSectionDtos.java

Tạo file mới. DTO whitelist cho dữ liệu đọc, action và metadata quyền. Không serialize Entity trực tiếp.

Đích: `D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/backend/src/main/java/com/example/starter_project_2025/system/project/workspace/dto/WorkspaceSectionDtos.java`

~~~java
package com.example.starter_project_2025.system.project;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.*;
import java.util.List;
import java.util.Map;

public final class WorkspaceSectionDtos {
    private WorkspaceSectionDtos() { }
    public record Scope(Long tenantId, Long workspaceId, Long projectId, Long teamId) {
        public static Scope from(Workspace workspace) {
            return new Scope(workspace.getTenant().getId(), workspace.getId(),
                    workspace.getProject().getId(), workspace.getTeam().getId());
        }
    }
    public record Access(String key, boolean canRead, Map<String, Boolean> actions) { }
    public record Navigation(Long workspaceId, Long projectId, Long teamId,
                             String projectCode, String projectName, String teamName,
                             ProjectStatus projectStatus, List<Access> sections) { }
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Item(String id, String title, String description, String status, boolean published,
                       Double score, java.time.Instant occurredAt) {
        public Item(String id, String title, String description, String status, boolean published, Double score) {
            this(id, title, description, status, published, score, null);
        }
    }
    public record Content(Long workspaceId, Long projectId, Long teamId, String section, List<Item> items) { }
    public record Create(@NotBlank @Size(max = 120) String title,
                         @Size(max = 2000) String description, boolean published) { }
    public enum ReviewKind { ARTIFACT, MILESTONE, SPRINT }
    public record Review(@NotNull ReviewKind kind, @NotBlank String targetId,
                         @NotBlank @Size(max = 2000) String comment,
                         @DecimalMin("0.0") @DecimalMax("10.0") Double score, boolean published) { }
    public enum MockMode { DATA, EMPTY, NOT_FOUND, ERROR }
    public record MockControl(@NotNull MockMode mode, @Min(0) @Max(5000) long delayMs) { }
}
~~~

## Phase 2 — backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspaceSectionPolicy.java

Tạo file mới. Một nơi ánh xạ READ/action; ARTIFACT_WRITE không kéo theo SUBMIT. Người chỉ READ không xem draft milestone/feedback.

Đích: `D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspaceSectionPolicy.java`

~~~java
package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Predicate;

@Component @RequiredArgsConstructor
public class WorkspaceSectionPolicy {
    private final WorkspaceAccessService access;

    public WorkspaceSection section(String key) {
        return Arrays.stream(WorkspaceSection.values()).filter(item -> item.getKey().equals(key)).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Workspace section was not found"));
    }
    public String readPermission(WorkspaceSection section) {
        return switch (section) {
            case OVERVIEW -> "WORKSPACE_READ";
            case MEMBERS -> "WORKSPACE_MEMBER_READ";
            case MILESTONE -> "MILESTONE_READ";
            case SPRINT, BACKLOG -> "SPRINT_READ";
            case ARTIFACT -> "ARTIFACT_READ";
            case FEEDBACK -> "FEEDBACK_READ";
            case ACTIVITY -> "WORKSPACE_ACTIVITY_READ";
        };
    }
    public boolean canRead(User user, WorkspaceSection section) {
        return section == WorkspaceSection.OVERVIEW ? access.canRead(user)
                : access.permitted(user, readPermission(section));
    }
    public WorkspaceSectionDtos.Access describe(User user, WorkspaceSection section) {
        boolean readable = canRead(user, section);
        Predicate<String> has = permission -> readable && access.permitted(user, permission);
        Map<String, Boolean> actions = new LinkedHashMap<>();
        switch (section) {
            case MEMBERS -> actions.put("manage", has.test("TEAM_UPDATE"));
            case MILESTONE -> {
                actions.put("create", has.test("MILESTONE_WRITE"));
                actions.put("review", has.test("MILESTONE_WRITE"));
            }
            case SPRINT -> {
                actions.put("create", has.test("SPRINT_WRITE"));
                actions.put("createTask", has.test("SPRINT_WRITE") || has.test("TASK_WRITE"));
                actions.put("review", has.test("MILESTONE_WRITE"));
            }
            case BACKLOG -> actions.put("createTask", has.test("SPRINT_WRITE") || has.test("TASK_WRITE"));
            case ARTIFACT -> {
                actions.put("create", has.test("ARTIFACT_WRITE"));
                actions.put("submit", has.test("ARTIFACT_SUBMIT"));
                actions.put("review", has.test("ARTIFACT_REVIEW") || has.test("FEEDBACK_WRITE"));
            }
            case FEEDBACK -> actions.put("create", has.test("FEEDBACK_WRITE"));
            default -> { }
        }
        return new WorkspaceSectionDtos.Access(section.getKey(), readable, actions);
    }
    public boolean canSeeDrafts(User user, WorkspaceSection section) {
        return switch (section) {
            case MILESTONE -> access.permitted(user, "MILESTONE_WRITE");
            case FEEDBACK -> access.permitted(user, "FEEDBACK_WRITE") || access.permitted(user, "ARTIFACT_REVIEW");
            default -> true;
        };
    }
}
~~~

## Phase 2 — backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspaceSectionDataSource.java

Tạo file mới. Điểm thay thế mock bằng Repository sau này. Controller/DTO/permission không phụ thuộc Entity của nhóm khác.

Đích: `D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspaceSectionDataSource.java`

~~~java
package com.example.starter_project_2025.system.project;

import java.util.List;
import static com.example.starter_project_2025.system.project.WorkspaceSectionDtos.*;

public interface WorkspaceSectionDataSource {
    List<Item> list(Scope scope, WorkspaceSection section);
    Item create(Scope scope, WorkspaceSection section, Create request, String status);
    Item updateTask(Scope scope, String id, Create request);
    Item review(Scope scope, Review request);
}
~~~

## Phase 2 — backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspacePermissionInitializer.java

Sửa file hiện có. Tạo WRITE/SUBMIT/REVIEW rõ ràng vì CrudAction hiện chỉ có CREATE/READ/UPDATE/DELETE.

Đích: `D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspacePermissionInitializer.java`

~~~java
package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.system.rbac.permission.Permission;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(1)
@RequiredArgsConstructor
public class WorkspacePermissionInitializer implements CommandLineRunner {
    private final PermissionRepository permissions;
    @Override public void run(String... args) {
        for (String name : java.util.List.of("MILESTONE_READ", "MILESTONE_WRITE", "SPRINT_READ", "SPRINT_WRITE",
                "TASK_WRITE", "ARTIFACT_READ", "ARTIFACT_WRITE", "ARTIFACT_SUBMIT", "ARTIFACT_REVIEW",
                "FEEDBACK_READ", "FEEDBACK_WRITE", "WORKSPACE_ACTIVITY_READ")) {
            if (!this.permissions.existsByName(name)) {
                int split = name.lastIndexOf('_');
                this.permissions.save(Permission.builder().name(name).resource(name.substring(0, split))
                        .action(name.substring(split + 1)).description("US-PRJ-001-03 section permission").build());
            }
        }
        ensure("VIEW_PROJECT_WORKSPACE", "READ");
        ensure("CREATE_PROJECT_WORKSPACE", "CREATE");
        if (!permissions.existsByName("WORKSPACE_MEMBER_READ")) {
            permissions.save(Permission.builder().name("WORKSPACE_MEMBER_READ")
                    .resource("WORKSPACE_MEMBER").action("READ")
                    .description("US-PRJ-001-02: view workspace members").build());
        }
    }
    private void ensure(String name, String action) {
        if (!permissions.existsByName(name)) permissions.save(Permission.builder().name(name)
                .resource("WORKSPACE").action(action).description("US-PRJ-001-01 workspace permission").build());
    }
}
~~~

## Phase 2 — backend/src/main/java/com/example/starter_project_2025/init/RoleDataInitializer.java

Sửa file hiện có. Gán đúng ma trận đã chốt. Teacher không có ARTIFACT_SUBMIT; Student có TASK_WRITE. PM nếu đã tồn tại nhận quyền nhưng vẫn giữ scope.

Đích: `D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/backend/src/main/java/com/example/starter_project_2025/init/RoleDataInitializer.java`

~~~java
package com.example.starter_project_2025.init;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.example.starter_project_2025.system.rbac.permission.Permission;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Order(2)
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class RoleDataInitializer implements CommandLineRunner {

    private static final String ADMIN_ROLE = "ADMIN";
    private static final String STUDENT_ROLE = "STUDENT";
    private static final String TEACHER_ROLE = "TEACHER";

    RoleRepository roleRepository;
    PermissionRepository permissionRepository;

    @Override
    @Transactional
    public void run(String... args) {
        ensurePermission("EXAM", "TAKE");
        List<Permission> allPermissions = permissionRepository.findAll();

        upsertRole(
                ADMIN_ROLE,
                "Administrator with full system access",
                allPermissions
        );

        upsertRole(
                STUDENT_ROLE,
                "Student with read-only access to books and courses",
                findPermissions(
                        "MENU_READ",
                        "BOOK_READ",
                        "COURSE_READ",
                        "ENROLLMENT_READ",
                        "ENROLLMENT_CREATE",
                        "LESSON_READ",
                        "EXAM_TAKE",
                        "WORKSPACE_READ", "WORKSPACE_MEMBER_READ",
                        "MILESTONE_READ", "SPRINT_READ", "TASK_WRITE", "ARTIFACT_READ", "ARTIFACT_SUBMIT",
                        "FEEDBACK_READ", "WORKSPACE_ACTIVITY_READ"
                )
        );

        upsertRole(
                TEACHER_ROLE,
                "Teacher with book, course and exam management permissions",
                findPermissions(
                        "MENU_READ",
                        "BOOK_CREATE", "BOOK_READ", "BOOK_UPDATE", "BOOK_DELETE",
                        "COURSE_CREATE", "COURSE_READ", "COURSE_UPDATE", "COURSE_DELETE",
                        "LESSON_CREATE", "LESSON_READ", "LESSON_UPDATE", "LESSON_DELETE",
                        "EXAM_CREATE", "EXAM_READ", "EXAM_UPDATE", "EXAM_DELETE",
                        "QUESTION_CREATE", "QUESTION_READ", "QUESTION_UPDATE", "QUESTION_DELETE",
                        "INVITATION_CREATE", "INVITATION_READ", "INVITATION_UPDATE", "INVITATION_DELETE",
                        "WORKSPACE_READ", "WORKSPACE_CREATE", "WORKSPACE_MEMBER_READ", "TEAM_READ", "TEAM_UPDATE",
                        "MILESTONE_READ", "MILESTONE_WRITE", "SPRINT_READ", "SPRINT_WRITE",
                        "ARTIFACT_READ", "ARTIFACT_WRITE", "ARTIFACT_REVIEW", "FEEDBACK_READ", "FEEDBACK_WRITE",
                        "WORKSPACE_ACTIVITY_READ"
                )
        );

        // Grant an existing PM role; do not create extra roles/accounts or expand data scope.
        roleRepository.findByName("PM").ifPresent(pm -> {
            pm.getPermissions().addAll(findPermissions("WORKSPACE_READ", "WORKSPACE_MEMBER_READ",
                    "MILESTONE_READ", "MILESTONE_WRITE", "SPRINT_READ", "SPRINT_WRITE",
                    "ARTIFACT_READ", "ARTIFACT_WRITE", "ARTIFACT_SUBMIT", "ARTIFACT_REVIEW",
                    "FEEDBACK_READ", "FEEDBACK_WRITE", "WORKSPACE_ACTIVITY_READ"));
            roleRepository.save(pm);
        });
        log.info("Ensured roles and permission mappings: ADMIN, STUDENT, TEACHER.");
    }

    private void upsertRole(String roleName, String description, Collection<Permission> permissions) {
        Role role = roleRepository.findByName(roleName).orElseGet(Role::new);

        role.setName(roleName);
        role.setDescription(description);
        role.setIsActive(true);
        role.setPermissions(new HashSet<>(permissions));

        roleRepository.save(role);
    }

    private List<Permission> findPermissions(String... permissionNames) {
        List<Permission> permissions = new ArrayList<>();

        for (String permissionName : permissionNames) {
            permissionRepository.findByName(permissionName).ifPresent(permissions::add);
        }

        return permissions;
    }

    private void ensurePermission(String resource, String action) {
        String name = resource + "_" + action;
        if (permissionRepository.existsByName(name)) return;
        permissionRepository.save(Permission.builder()
                .name(name).resource(resource).action(action)
                .description("Manually defined permission").build());
    }
}
~~~

## Phase 3 — backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/MockWorkspaceSectionDataSource.java

Tạo file mới. Mock in-memory theo tenant/workspace/project/team. GET không seed; control local mô phỏng empty/404/500/delay. Activity dùng repository sẵn có.

Đích: `D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/MockWorkspaceSectionDataSource.java`

~~~java
package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import static com.example.starter_project_2025.system.project.WorkspaceSectionDtos.*;

@Service @RequiredArgsConstructor
@ConditionalOnProperty(name = "app.workspace.sections.provider", havingValue = "mock", matchIfMissing = true)
public class MockWorkspaceSectionDataSource implements WorkspaceSectionDataSource {
    private record Key(Scope scope, WorkspaceSection section) { }
    private final Map<Key, List<Item>> records = new ConcurrentHashMap<>();
    private final Map<Key, MockControl> controls = new ConcurrentHashMap<>();
    private final WorkspaceActivityRepository activities;
    private final UserRepository users;

    @Override public List<Item> list(Scope scope, WorkspaceSection section) {
        var control = controls.get(new Key(scope, section));
        if (control != null) {
            try { if (control.delayMs() > 0) Thread.sleep(control.delayMs()); }
            catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Request was interrupted");
            }
            switch (control.mode()) {
                case EMPTY -> { return List.of(); }
                case NOT_FOUND -> throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Section data was not found");
                case ERROR -> throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Section data could not be loaded");
                default -> { }
            }
        }
        if (section == WorkspaceSection.ACTIVITY) {
            return activities.findByWorkspaceIdOrderByOccurredAtDesc(scope.workspaceId()).stream()
                    .map(item -> new Item(item.getEventId(), item.getAction(),
                            users.findById(item.getActorId()).map(user -> user.getFullName()).orElse("Former member"),
                            "RECORDED", true, null, item.getOccurredAt())).toList();
        }
        // No computeIfAbsent/seed/save during GET.
        return records.getOrDefault(new Key(scope, section), List.of());
    }

    @Override public Item create(Scope scope, WorkspaceSection section, Create request, String status) {
        Item item = new Item(UUID.randomUUID().toString(), request.title().trim(), request.description(),
                status, request.published(), null);
        append(new Key(scope, section), item);
        return item;
    }
    @Override public Item updateTask(Scope scope, String id, Create request) {
        Key key = new Key(scope, WorkspaceSection.BACKLOG);
        var result = new Item[1];
        records.compute(key, (ignored, old) -> {
            var items = new ArrayList<>(old == null ? List.<Item>of() : old);
            for (int i = 0; i < items.size(); i++) if (items.get(i).id().equals(id)) {
                Item previous = items.get(i);
                result[0] = new Item(id, request.title().trim(), request.description(),
                        previous.status(), previous.published(), null);
                items.set(i, result[0]); return List.copyOf(items);
            }
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Task was not found in this workspace");
        });
        return result[0];
    }
    @Override public Item review(Scope scope, Review request) {
        WorkspaceSection target = switch (request.kind()) {
            case ARTIFACT -> WorkspaceSection.ARTIFACT;
            case MILESTONE -> WorkspaceSection.MILESTONE;
            case SPRINT -> WorkspaceSection.SPRINT;
        };
        Item item = records.getOrDefault(new Key(scope, target), List.of()).stream()
                .filter(row -> row.id().equals(request.targetId())).findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Review target was not found in this workspace"));
        Item review = new Item(UUID.randomUUID().toString(), "Review: " + item.title(), request.comment(),
                request.published() ? "PUBLISHED" : "DRAFT", request.published(), request.score());
        append(new Key(scope, WorkspaceSection.FEEDBACK), review);
        // Reviewing does not auto-complete the target or change the Project.
        return review;
    }
    private void append(Key key, Item item) {
        records.compute(key, (ignored, old) -> {
            var values = new ArrayList<>(old == null ? List.<Item>of() : old);
            values.add(item); return List.copyOf(values);
        });
    }
    public void seed(Scope scope) {
        for (WorkspaceSection section : List.of(WorkspaceSection.MILESTONE, WorkspaceSection.SPRINT,
                WorkspaceSection.BACKLOG, WorkspaceSection.ARTIFACT, WorkspaceSection.FEEDBACK))
            seedSection(scope, section);
    }
    private void seedSection(Scope scope, WorkspaceSection section) {
        if (section == WorkspaceSection.OVERVIEW || section == WorkspaceSection.MEMBERS || section == WorkspaceSection.ACTIVITY) return;
        records.putIfAbsent(new Key(scope, section), List.of(
                new Item(section.getKey() + "-" + scope.workspaceId() + "-published",
                        "Workspace " + scope.workspaceId() + " · " + section.getKey(),
                        "Published sample for project " + scope.projectId() + ", team " + scope.teamId(),
                        "OPEN", true, section == WorkspaceSection.FEEDBACK ? 8.0 : null),
                new Item(section.getKey() + "-" + scope.workspaceId() + "-draft",
                        "Draft · workspace " + scope.workspaceId(),
                        "Unpublished sample", "DRAFT", false,
                        section == WorkspaceSection.FEEDBACK ? 2.0 : null)));
    }
    public void configure(Scope scope, WorkspaceSection section, MockControl control) {
        controls.put(new Key(scope, section), control);
        if (control.mode() == MockMode.DATA) seedSection(scope, section);
    }
    public long size(Scope scope) {
        return records.entrySet().stream().filter(entry -> entry.getKey().scope().equals(scope))
                .mapToLong(entry -> entry.getValue().size()).sum();
    }
}
~~~

## Phase 3 — backend/src/main/java/com/example/starter_project_2025/system/project/workspace/controller/WorkspaceMockSectionsController.java

Tạo file mới. Control chỉ bật bằng property và dùng H2 local; mặc định tắt, ADMIN vẫn phải qua tenant/scope. Không có query ?debug bypass quyền.

Đích: `D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/backend/src/main/java/com/example/starter_project_2025/system/project/workspace/controller/WorkspaceMockSectionsController.java`

~~~java
package com.example.starter_project_2025.system.project;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import javax.sql.DataSource;
import static com.example.starter_project_2025.system.project.WorkspaceSectionDtos.*;

@RestController @RequiredArgsConstructor
@ConditionalOnProperty(name = "app.workspace.sections.mock-controls.enabled", havingValue = "true")
@RequestMapping("/api/workspaces/{id}/mock-sections")
@PreAuthorize("hasRole('ADMIN')")
public class WorkspaceMockSectionsController {
    private final WorkspaceAccessService access;
    private final WorkspaceContextService contexts;
    private final WorkspaceSectionPolicy policy;
    private final MockWorkspaceSectionDataSource mock;
    private final DataSource dataSource;

    @PutMapping("/{key}")
    public MockControl configure(@PathVariable Long id, @PathVariable String key, @Valid @RequestBody MockControl request) throws Exception {
        try (var connection = dataSource.getConnection()) {
            if (!connection.getMetaData().getURL().startsWith("jdbc:h2:"))
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Mock controls are disabled");
        }
        var user = access.requireUser(false);
        mock.configure(Scope.from(contexts.require(user, id)), policy.section(key), request);
        return request;
    }
}
~~~

## Phase 3 — backend/src/main/java/com/example/starter_project_2025/system/project/workspace/demo/WorkspaceSectionMockInitializer.java

Tạo file mới. Nạp mock vào các workspace demo đã tồn tại khi startup; không tạo workspace/team/user, không seed lúc GET.

Đích: `D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/backend/src/main/java/com/example/starter_project_2025/system/project/workspace/demo/WorkspaceSectionMockInitializer.java`

~~~java
package com.example.starter_project_2025.system.project;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import javax.sql.DataSource;

@Component @Order(30) @Profile("!test") @RequiredArgsConstructor
@ConditionalOnProperty(name = "app.workspace.sections.mock-fixtures.enabled", havingValue = "true")
public class WorkspaceSectionMockInitializer implements CommandLineRunner {
    private final WorkspaceRepository workspaces;
    private final MockWorkspaceSectionDataSource mock;
    private final DataSource dataSource;
    @Override @Transactional
    public void run(String... args) throws Exception {
        try (var connection = dataSource.getConnection()) {
            if (!connection.getMetaData().getURL().startsWith("jdbc:h2:")) return;
        }
        workspaces.findAll().stream()
                .filter(workspace -> workspace.getProject().getCode().startsWith("WS-DEMO-"))
                .forEach(workspace -> mock.seed(WorkspaceSectionDtos.Scope.from(workspace)));
    }
}
~~~

## Phase 4 — backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspaceSectionService.java

Tạo file mới. Service kiểm tra quyền trước khi đọc/ghi mock, lọc draft bằng permission và xác định context từ workspace; không tin projectId/teamId do client gửi.

Đích: `D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspaceSectionService.java`

~~~java
package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Arrays;
import static com.example.starter_project_2025.system.project.WorkspaceSectionDtos.*;

@Service @RequiredArgsConstructor @Transactional(readOnly = true)
public class WorkspaceSectionService {
    private record Context(User user, Workspace workspace, Scope scope) { }
    private final WorkspaceAccessService access;
    private final WorkspaceContextService contexts;
    private final WorkspaceSectionPolicy policy;
    private final WorkspaceSectionDataSource source;

    private Context context(Long id) {
        User user = access.requireUser(false);
        Workspace workspace = contexts.require(user, id);
        return new Context(user, workspace, Scope.from(workspace));
    }
    private void requireRead(Context context, WorkspaceSection section) {
        if (!policy.canRead(context.user(), section)) throw new AccessDeniedException("Section access has changed");
    }
    private void requireAction(Context context, WorkspaceSection section, String action) {
        requireRead(context, section);
        if (!Boolean.TRUE.equals(policy.describe(context.user(), section).actions().get(action)))
            throw new AccessDeniedException("This section action is not allowed");
    }
    public Navigation navigation(Long id) {
        Context context = context(id);
        return new Navigation(id, context.scope().projectId(), context.scope().teamId(),
                context.workspace().getProject().getCode(), context.workspace().getProject().getName(),
                context.workspace().getTeam().getName(), context.workspace().getProject().getStatus(),
                Arrays.stream(WorkspaceSection.values())
                .map(section -> policy.describe(context.user(), section)).toList());
    }
    public Content read(Long id, String key) {
        Context context = context(id);
        WorkspaceSection section = policy.section(key);
        requireRead(context, section);
        if (section == WorkspaceSection.OVERVIEW || section == WorkspaceSection.MEMBERS)
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.NOT_FOUND, "Use the existing Overview or Members API");
        var rows = source.list(context.scope(), section).stream()
                .filter(item -> item.published() || policy.canSeeDrafts(context.user(), section)).toList();
        return new Content(id, context.scope().projectId(), context.scope().teamId(), key, rows);
    }
    @Transactional
    public Item create(Long id, WorkspaceSection section, Create request) {
        Context context = context(id);
        requireAction(context, section, "create");
        return source.create(context.scope(), section, request, request.published() ? "OPEN" : "DRAFT");
    }
    @Transactional
    public Item task(Long id, Create request, String taskId) {
        Context context = context(id);
        requireAction(context, WorkspaceSection.BACKLOG, "createTask");
        return taskId == null ? source.create(context.scope(), WorkspaceSection.BACKLOG, request, "TODO")
                : source.updateTask(context.scope(), taskId, request);
    }
    @Transactional
    public Item submit(Long id, Create request) {
        Context context = context(id);
        requireAction(context, WorkspaceSection.ARTIFACT, "submit");
        return source.create(context.scope(), WorkspaceSection.ARTIFACT,
                new Create(request.title(), request.description(), false), "SUBMITTED");
    }
    @Transactional
    public Item review(Long id, Review request) {
        Context context = context(id);
        WorkspaceSection target = switch (request.kind()) {
            case ARTIFACT -> WorkspaceSection.ARTIFACT;
            case MILESTONE -> WorkspaceSection.MILESTONE;
            case SPRINT -> WorkspaceSection.SPRINT;
        };
        requireAction(context, target, "review");
        return source.review(context.scope(), request);
    }
}
~~~

## Phase 4 — backend/src/main/java/com/example/starter_project_2025/system/project/workspace/controller/WorkspaceSectionsController.java

Tạo file mới. API đọc và action thật. Service kiểm tra action riêng nên Teacher có ARTIFACT_WRITE vẫn nhận 403 khi submit.

Đích: `D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/backend/src/main/java/com/example/starter_project_2025/system/project/workspace/controller/WorkspaceSectionsController.java`

~~~java
package com.example.starter_project_2025.system.project;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import static com.example.starter_project_2025.system.project.WorkspaceSectionDtos.*;

@RestController @RequiredArgsConstructor
@RequestMapping("/api/workspaces/{id}")
@PreAuthorize("hasAnyAuthority('WORKSPACE_READ', 'VIEW_PROJECT_WORKSPACE')")
public class WorkspaceSectionsController {
    private final WorkspaceSectionService service;
    @GetMapping("/sections") public Navigation navigation(@PathVariable Long id) { return service.navigation(id); }

    @GetMapping({"/milestones", "/sprints", "/backlog", "/artifacts", "/feedback", "/activity"})
    public Content read(@PathVariable Long id, jakarta.servlet.http.HttpServletRequest request) {
        String path = request.getRequestURI();
        return service.read(id, path.substring(path.lastIndexOf('/') + 1));
    }
    @PostMapping("/milestones") @ResponseStatus(HttpStatus.CREATED)
    public Item milestone(@PathVariable Long id, @Valid @RequestBody Create request) {
        return service.create(id, WorkspaceSection.MILESTONE, request);
    }
    @PostMapping("/sprints") @ResponseStatus(HttpStatus.CREATED)
    public Item sprint(@PathVariable Long id, @Valid @RequestBody Create request) {
        return service.create(id, WorkspaceSection.SPRINT, request);
    }
    @PostMapping("/tasks") @ResponseStatus(HttpStatus.CREATED)
    public Item task(@PathVariable Long id, @Valid @RequestBody Create request) {
        return service.task(id, request, null);
    }
    @PutMapping("/tasks/{taskId}")
    public Item updateTask(@PathVariable Long id, @PathVariable String taskId, @Valid @RequestBody Create request) {
        return service.task(id, request, taskId);
    }
    @PostMapping("/artifacts") @ResponseStatus(HttpStatus.CREATED)
    public Item artifact(@PathVariable Long id, @Valid @RequestBody Create request) {
        return service.create(id, WorkspaceSection.ARTIFACT, request);
    }
    @PostMapping("/artifacts/submit") @ResponseStatus(HttpStatus.CREATED)
    public Item submit(@PathVariable Long id, @Valid @RequestBody Create request) { return service.submit(id, request); }

    @PostMapping("/feedback") @ResponseStatus(HttpStatus.CREATED)
    public Item feedback(@PathVariable Long id, @Valid @RequestBody Create request) {
        return service.create(id, WorkspaceSection.FEEDBACK, request);
    }
    @PostMapping("/reviews") @ResponseStatus(HttpStatus.CREATED)
    public Item review(@PathVariable Long id, @Valid @RequestBody Review request) { return service.review(id, request); }
}
~~~

## Phase 4 — backend/src/main/java/com/example/starter_project_2025/system/project/workspace/controller/WorkspaceSectionErrors.java

Tạo file mới. Lỗi riêng của phân mục có status/correlationId; không đổi lỗi thành danh sách rỗng.

Đích: `D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/backend/src/main/java/com/example/starter_project_2025/system/project/workspace/controller/WorkspaceSectionErrors.java`

~~~java
package com.example.starter_project_2025.system.project;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDateTime;

@org.springframework.core.annotation.Order(org.springframework.core.Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes = {WorkspaceSectionsController.class, WorkspaceMockSectionsController.class})
public class WorkspaceSectionErrors {
    public record Error(int status, String message, LocalDateTime timestamp, String correlationId) { }
    private ResponseEntity<Error> response(int status, String message) {
        return ResponseEntity.status(status).body(new Error(status, message, LocalDateTime.now(), WorkspaceCorrelation.current()));
    }
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Error> denied(AccessDeniedException exception) {
        return response(403, "Your access has changed. Reload the available sections.");
    }
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Error> status(ResponseStatusException exception) {
        return response(exception.getStatusCode().value(), exception.getReason());
    }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Error> validation(MethodArgumentNotValidException exception) {
        return response(422, exception.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage()).findFirst().orElse("Invalid input"));
    }
    @ExceptionHandler({org.springframework.http.converter.HttpMessageNotReadableException.class,
            org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class})
    public ResponseEntity<Error> input(Exception exception) { return response(422, "Invalid request"); }
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Error> failed(RuntimeException exception) {
        return response(500, "The section could not be loaded. Try again.");
    }
}
~~~

## Phase 4 — backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspaceReadService.java

Sửa file hiện có. Overview không tải payload Activity nữa; trả activities=null, phần Activity đọc API riêng có quyền/lỗi riêng.

Đích: `D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspaceReadService.java`

~~~java
package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WorkspaceReadService {
    private final WorkspaceContextService contexts;
    private final WorkspaceAccessService access;
    private final WorkspaceRosterService roster;
    private final ProjectTopicSnapshotRepository snapshots;
    private final UserRepository users;
    private final ObjectMapper json;

    public WorkspaceDetailResponse overview(Long id) {
        User user = access.requireUser(false);
        Workspace workspace = contexts.require(user, id);
        Project project = workspace.getProject();
        Team team = workspace.getTeam();
        Cohort cohort = project.getCohort();
        var snapshot = snapshots.findByProjectId(project.getId()).map(this::snapshotResponse).orElse(null);
        // A blank snapshot description stays blank; do not substitute newer project content.
        String description = snapshot != null ? snapshot.description() : project.getDescription();
        return WorkspaceDetailResponse.builder()
                .id(workspace.getId()).code(workspace.getCode()).name(workspace.getName())
                .status(workspace.getStatus())
                .projectId(project.getId()).projectCode(project.getCode()).projectName(project.getName())
                .projectDescription(description).projectStatus(project.getStatus())
                .teamId(team.getId()).teamCode(team.getCode()).teamName(team.getName())
                .mentorName(team.getMentor() != null ? team.getMentor().getFullName() : null)
                .charter(ProjectHubDtos.Charter.from(team))
                .cohortId(cohort != null ? cohort.getId() : null)
                .cohortName(cohort != null ? cohort.getName() : null)
                .createdAt(workspace.getCreatedAt())
                .createdByName(workspace.getCreatedBy() == null ? null :
                        users.findById(workspace.getCreatedBy()).map(User::getFullName).orElse("Former member"))
                .memberCount(roster.current(team).size())
                .canViewMembers(access.canViewMembers(user))
                .topicSnapshot(snapshot)
                .sections(workspace.getSections().stream().map(WorkspaceSection::getKey).toList())
                .activities(null).build();
    }

    public List<WorkspaceMemberResponse> members(Long id) {
        User user = access.requireUser(false);
        access.requireMemberRead(user);
        Workspace workspace = contexts.require(user, id);
        return roster.response(roster.current(workspace.getTeam()));
    }

    private WorkspaceTopicSnapshotResponse snapshotResponse(ProjectTopicSnapshot snapshot) {
        List<String> requirements = readList(snapshot.getRequirementsJson(),
                new TypeReference<List<String>>() { });
        List<WorkspaceTopicSnapshotResponse.Attachment> attachments = readList(
                snapshot.getAttachmentsJson(),
                new TypeReference<List<WorkspaceTopicSnapshotResponse.Attachment>>() { });
        return new WorkspaceTopicSnapshotResponse(
                snapshot.getTopicCode(), snapshot.getTopicTitle(), snapshot.getVersion(),
                snapshot.getDescription(), snapshot.getObjectives(),
                requirements.stream().filter(item -> !item.isBlank()).toList(), attachments);
    }

    private <T> List<T> readList(String value, TypeReference<List<T>> type) {
        if (value == null || value.isBlank()) return List.of();
        try {
            List<T> values = json.readValue(value, type);
            return values == null ? List.of() : values.stream().filter(Objects::nonNull).toList();
        } catch (JsonProcessingException exception) {
            // Broken stored data must produce an error, not a misleading empty state.
            throw new IllegalStateException("Stored topic snapshot contains invalid JSON", exception);
        }
    }
}
~~~

## Phase 5 — frontend/src/types/features/workspace.ts

Sửa file hiện có. Type cho manifest/context/item/action; activities nullable vì dữ liệu Activity chuyển sang API riêng.

Đích: `D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/frontend/src/types/features/workspace.ts`

~~~typescript
import type { TeamCharter } from "./project-hub";

export interface WorkspaceCandidateItem {
  projectId?: number | null;
  projectName?: string;
  projectCode?: string;
  projectStatus?: string;

  teamId: number;
  teamName?: string;
  teamCode?: string;
  memberCount?: number;

  cohortId?: number;
  cohortName?: string;

  workspaceId?: number;
  workspaceStatus?: string;
  eligibleForWorkspace: boolean;
  ineligibleReason?: string;
}

export interface WorkspaceCreateRequest {
  projectId: number;
  teamId: number;
}

export interface WorkspaceProjectOption {
  projectId?: number | null;
  name: string;
  code: string;
  status: string;
  cohortName?: string;
}

export interface WorkspaceResponse {
  id?: number;
  projectId: number;
  teamId: number;
  tenantId?: number;
  code?: string;
  name?: string;
  status?: string;
  createdBy?: number;
  createdAt?: string;
  sections: string[];
}

export interface WorkspaceActivity {
  eventId: string;
  action: string;
  actorId: number;
  actorName: string;
  occurredAt: string;
  correlationId: string;
}

export type ProjectRole = "UNASSIGNED" | "TEAM_LEADER" | "DEV" | "FE_DEV" | "BE_DEV" | "BA" | "QA" | "TESTER";
export type ParticipationStatus = "ACTIVE" | "INACTIVE" | "LEFT";

export interface WorkspaceMember {
  user_code: string | null;
  display_name: string;
  project_role: ProjectRole;
  status: ParticipationStatus;
}

export interface WorkspaceTopicSnapshot {
  topic_code: string;
  topic_title: string;
  version: string;
  description: string | null;
  objectives: string | null;
  requirements: string[];
  attachments: { name: string; url: string }[];
}

export interface WorkspaceDetail extends WorkspaceResponse {
  id: number;
  projectCode: string;
  projectName: string;
  projectDescription?: string;
  projectStatus: string;
  teamCode: string;
  teamName: string;
  mentorName?: string;
  charter: TeamCharter;
  cohortId?: number;
  cohortName?: string;
  createdAt?: string;
  createdByName?: string;
  member_count: number;
  can_view_members: boolean;
  topic_snapshot: WorkspaceTopicSnapshot | null;
  activities: WorkspaceActivity[] | null;
}

export type WorkspaceSectionKey = "overview" | "members" | "milestones" | "sprints" | "backlog" | "artifacts" | "feedback" | "activity";
export interface WorkspaceSectionAccess { key: WorkspaceSectionKey; canRead: boolean; actions: Record<string, boolean> }
export interface WorkspaceNavigation {
  workspaceId: number; projectId: number; teamId: number; projectCode: string; projectName: string;
  teamName: string; projectStatus: string; sections: WorkspaceSectionAccess[];
}
export interface WorkspaceSectionItem {
  id: string; title: string; description: string | null; status: string; published: boolean; score?: number; occurredAt?: string;
}
export interface WorkspaceSectionContent {
  workspaceId: number; projectId: number; teamId: number; section: WorkspaceSectionKey; items: WorkspaceSectionItem[];
}
export interface SectionCreate { title: string; description: string; published: boolean }
export interface SectionReview {
  kind: "ARTIFACT" | "MILESTONE" | "SPRINT"; targetId: string; comment: string; score?: number; published: boolean;
}
~~~

## Phase 5 — frontend/src/api/features/workspace.api.ts

Sửa file hiện có. Tất cả GET mới nhận AbortSignal; giữ client refresh-token chung và API US01/US02.

Đích: `D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/frontend/src/api/features/workspace.api.ts`

~~~typescript
import axiosInstance from "@/api/axios";
import type { WorkspaceCandidateItem, WorkspaceCreateRequest, WorkspaceDetail, WorkspaceResponse, WorkspaceProjectOption, WorkspaceMember, WorkspaceNavigation, WorkspaceSectionKey, WorkspaceSectionContent, WorkspaceSectionItem, SectionCreate, SectionReview } from "@/types/features/workspace";

export const workspaceApi = {
  navigation: async (id: number, signal?: AbortSignal) =>
    (await axiosInstance.get<WorkspaceNavigation>("/workspaces/" + id + "/sections", { signal })).data,
  section: async (id: number, key: WorkspaceSectionKey, signal?: AbortSignal) =>
    (await axiosInstance.get<WorkspaceSectionContent>("/workspaces/" + id + "/" + key, { signal })).data,
  createSectionItem: async (id: number, path: string, input: SectionCreate) =>
    (await axiosInstance.post<WorkspaceSectionItem>("/workspaces/" + id + "/" + path, input)).data,
  updateTask: async (id: number, taskId: string, input: SectionCreate) =>
    (await axiosInstance.put<WorkspaceSectionItem>("/workspaces/" + id + "/tasks/" + encodeURIComponent(taskId), input)).data,
  review: async (id: number, input: SectionReview) =>
    (await axiosInstance.post<WorkspaceSectionItem>("/workspaces/" + id + "/reviews", input)).data,
  getMembers: async (id: number, signal?: AbortSignal): Promise<WorkspaceMember[]> => {
    const response = await axiosInstance.get<WorkspaceMember[]>("/workspaces/" + id + "/members", { signal });
    return response.data;
  },
  getProjectOptions: async (teamId: number): Promise<WorkspaceProjectOption[]> => {
    const response = await axiosInstance.get<WorkspaceProjectOption[]>("/workspaces/projects", { params: { teamId } });
    return response.data;
  },
  getCandidates: async (): Promise<WorkspaceCandidateItem[]> => {
    const response = await axiosInstance.get<WorkspaceCandidateItem[]>("/workspaces/candidates");
    return response.data;
  },

  confirmCreate: async (request: WorkspaceCreateRequest): Promise<WorkspaceCandidateItem> => {
    const response = await axiosInstance.post<WorkspaceCandidateItem>("/workspaces/confirm", request);
    return response.data;
  },

  getById: async (id: number, signal?: AbortSignal): Promise<WorkspaceDetail> => {
    const response = await axiosInstance.get<WorkspaceDetail>(`/workspaces/${id}`, { signal });
    return response.data;
  },

  create: async (request: WorkspaceCreateRequest, idempotencyKey: string): Promise<WorkspaceResponse> => {
    const response = await axiosInstance.post<WorkspaceResponse>("/workspaces", request, {
      headers: { "X-Idempotency-Key": idempotencyKey },
    });
    return response.data;
  },
};
~~~

## Phase 5 — frontend/src/pages/management/workspace/workspace.section-access.ts

Tạo file mới. Kết hợp capability từ backend với role đang preview trên UI. Backend vẫn là ranh giới bảo mật.

Đích: `D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/frontend/src/pages/management/workspace/workspace.section-access.ts`

~~~typescript
import type { WorkspaceSectionKey, WorkspaceSectionAccess } from "@/types/features/workspace";

const READ: Record<WorkspaceSectionKey, string> = {
  overview: "WORKSPACE_READ", members: "WORKSPACE_MEMBER_READ", milestones: "MILESTONE_READ",
  sprints: "SPRINT_READ", backlog: "SPRINT_READ", artifacts: "ARTIFACT_READ",
  feedback: "FEEDBACK_READ", activity: "WORKSPACE_ACTIVITY_READ"
};
const WRITE: Partial<Record<WorkspaceSectionKey, Record<string, string[]>>> = {
  members: { manage: ["TEAM_UPDATE"] },
  milestones: { create: ["MILESTONE_WRITE"], review: ["MILESTONE_WRITE"] },
  sprints: { create: ["SPRINT_WRITE"], createTask: ["SPRINT_WRITE", "TASK_WRITE"], review: ["MILESTONE_WRITE"] },
  backlog: { createTask: ["SPRINT_WRITE", "TASK_WRITE"] },
  artifacts: { create: ["ARTIFACT_WRITE"], submit: ["ARTIFACT_SUBMIT"], review: ["ARTIFACT_REVIEW", "FEEDBACK_WRITE"] },
  feedback: { create: ["FEEDBACK_WRITE"] }
};
export function sectionAccess(server: WorkspaceSectionAccess, hasPermission: (permission: string) => boolean): WorkspaceSectionAccess {
  const canRead = server.canRead && (hasPermission(READ[server.key]) || server.key === "overview" && hasPermission("VIEW_PROJECT_WORKSPACE"));
  const actions = Object.fromEntries(Object.entries(server.actions).map(([key, enabled]) => [
    key, canRead && enabled && (WRITE[server.key]?.[key] ?? []).some(hasPermission)
  ]));
  return { ...server, canRead, actions };
}
~~~

## Phase 5 — frontend/src/pages/management/workspace/WorkspaceSectionState.tsx

Tạo file mới. Một trạng thái lỗi/403 dùng chung; lỗi không giả thành empty, có thao tác khôi phục.

Đích: `D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/frontend/src/pages/management/workspace/WorkspaceSectionState.tsx`

~~~tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { isAxiosError } from "axios";
import { getWorkspaceError } from "./workspace.shared";

export const sectionForbidden = (error: unknown) => isAxiosError(error) && error.response?.status === 403;

export function WorkspaceSectionState({ loading, denied, error, retry }: {
  loading?: boolean; denied?: boolean; error?: unknown; retry: () => void;
}) {
  return <Card>
    <CardHeader><CardTitle>{denied ? "Access changed" : loading ? "Loading section..." : "Unable to load section"}</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      {loading ? <Loader2 className="size-4 animate-spin" /> : <>
        <p className="text-sm">{denied ? "Your access to this section has changed. Reload the available sections." : getWorkspaceError(error)}</p>
        <Button variant="outline" onClick={retry}>{denied ? "Reload access" : "Try again"}</Button>
      </>}
    </CardContent>
  </Card>;
}
~~~

## Phase 5 — frontend/src/pages/management/workspace/WorkspaceSectionActionDialog.tsx

Tạo file mới. Action dialog uses real POST/PUT; only submits on an explicit user action.

Đích: `D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/frontend/src/pages/management/workspace/WorkspaceSectionActionDialog.tsx`

~~~tsx
import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { workspaceApi } from "@/api/features/workspace.api";
import type { WorkspaceSectionKey, WorkspaceSectionItem, SectionReview } from "@/types/features/workspace";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sectionForbidden } from "./WorkspaceSectionState";
import { getWorkspaceError } from "./workspace.shared";

export function WorkspaceSectionActionDialog({ workspaceId, section, action, items, editing,
  onClose, onAccessChanged }: {
  workspaceId: number; section: WorkspaceSectionKey; action: string;
  items: WorkspaceSectionItem[]; editing?: WorkspaceSectionItem;
  onClose: () => void; onAccessChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(editing?.title ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [published, setPublished] = useState(false);
  const [targetId, setTargetId] = useState(items[0]?.id ?? "");
  const [score, setScore] = useState("");
  const review = action === "review";
  const labels: Record<string, string> = { create: "Create item", createTask: "Create task",
    submit: "Submit artifact", review: "Record review", edit: "Edit task" };
  const mutation = useMutation({
    mutationFn: () => {
      if (review) {
        const kinds: Partial<Record<WorkspaceSectionKey, SectionReview["kind"]>> = {
          milestones: "MILESTONE", sprints: "SPRINT", artifacts: "ARTIFACT"
        };
        const kind = kinds[section];
        if (!kind) throw new Error("This section cannot be reviewed.");
        return workspaceApi.review(workspaceId, {
          kind, targetId, comment: description, score: score === "" ? undefined : Number(score), published
        });
      }
      const input = { title, description, published };
      if (editing) return workspaceApi.updateTask(workspaceId, editing.id, input);
      const path = action === "submit" ? "artifacts/submit" : action === "createTask" ? "tasks" : section;
      return workspaceApi.createSectionItem(workspaceId, path, input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workspace-section", workspaceId] });
      onClose();
    },
    onError: error => { if (sectionForbidden(error)) onAccessChanged(); }
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!mutation.isPending && !sectionForbidden(mutation.error)) mutation.mutate();
  }
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent><DialogHeader><DialogTitle>{labels[action]}</DialogTitle>
      <DialogDescription>Apply this action to the current workspace.</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        {review ? <div className="space-y-2"><Label>Review target</Label>
          <Select value={targetId} onValueChange={setTargetId}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{items.map(item => <SelectItem key={item.id} value={item.id}>{item.title}</SelectItem>)}</SelectContent>
          </Select></div>
          : <div className="space-y-2"><Label htmlFor="section-title">Title</Label><Input id="section-title"
              required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} /></div>}
        <div className="space-y-2"><Label htmlFor="section-description">{review ? "Review comments" : "Description"}</Label>
          <Textarea id="section-description" required={review} maxLength={2000} value={description}
            onChange={event => setDescription(event.target.value)} /></div>
        {review && <div className="space-y-2"><Label htmlFor="section-score">Score (optional)</Label>
          <Input id="section-score" type="number" min={0} max={10} step="0.1" value={score}
            onChange={event => setScore(event.target.value)} /></div>}
        {(review || action === "create" && ["milestones", "feedback"].includes(section)) &&
          <div className="flex items-center gap-2"><Checkbox id="section-published" checked={published}
            onCheckedChange={value => setPublished(value === true)} /><Label htmlFor="section-published">Publish for students</Label></div>}
        {mutation.isError && <p role="alert" className="text-sm text-destructive">{getWorkspaceError(mutation.error)}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending || sectionForbidden(mutation.error) || review && !targetId}>
            {mutation.isPending ? "Saving..." : labels[action]}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
~~~

## Phase 5 — frontend/src/pages/management/workspace/WorkspaceBusinessSectionPanel.tsx

Tạo file mới. Independent loading, context verification, empty/error states and fresh permission guards.

Đích: `D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/frontend/src/pages/management/workspace/WorkspaceBusinessSectionPanel.tsx`

~~~tsx
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { workspaceApi } from "@/api/features/workspace.api";
import { usePermissions } from "@/hooks/usePermissions";
import type { WorkspaceSectionKey, WorkspaceSectionAccess, WorkspaceSectionItem } from "@/types/features/workspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceSectionState, sectionForbidden } from "./WorkspaceSectionState";
import { WorkspaceSectionActionDialog } from "./WorkspaceSectionActionDialog";

export function WorkspaceBusinessSectionPanel({ workspaceId, projectId, teamId, section, label, access, onAccessChanged }: {
  workspaceId: number; projectId: number; teamId: number; section: WorkspaceSectionKey; label: string;
  access: WorkspaceSectionAccess; onAccessChanged: () => void;
}) {
  const { user, activeRole } = usePermissions();
  const [action, setAction] = useState<string>();
  const [editing, setEditing] = useState<WorkspaceSectionItem>();
  const query = useQuery({
    queryKey: ["workspace-section", workspaceId, section, user.email, activeRole],
    queryFn: ({ signal }) => workspaceApi.section(workspaceId, section, signal),
    retry: false, staleTime: 0, gcTime: 0, refetchOnMount: "always"
  });
  const denied = sectionForbidden(query.error);
  useEffect(() => { if (denied) onAccessChanged(); }, [denied, onAccessChanged]);
  if (denied || query.isError || query.isPending || query.isFetching)
    return <WorkspaceSectionState loading={!query.isError && query.isFetching} denied={denied}
      error={query.error} retry={() => denied ? onAccessChanged() : void query.refetch()} />;
  const data = query.data;
  if (!data || data.workspaceId !== workspaceId || data.projectId !== projectId || data.teamId !== teamId || data.section !== section)
    return <WorkspaceSectionState error={new Error("Section context does not match this workspace.")}
      retry={() => void query.refetch()} />;
  const labels: Record<string, string> = { create: "Create " + (section === "milestones" ? "milestone" : section === "sprints" ? "sprint" : section === "feedback" ? "feedback" : "artifact"),
    createTask: "Create task", submit: "Submit artifact", review: "Record review" };
  return <>
    <Card>
      <CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>{label}</CardTitle>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void query.refetch()}>Refresh section</Button>
          {Object.entries(access.actions).filter(([key, allowed]) => allowed && key in labels).map(([key]) =>
            <Button key={key} onClick={() => { setEditing(undefined); setAction(key); }}
              disabled={key === "review" && data.items.length === 0}>{labels[key]}</Button>)}</div>
      </div></CardHeader>
      <CardContent>{data.items.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No {label.toLowerCase()} yet.</p>
        : <div className="divide-y">{data.items.map(item => <div key={item.id} className="space-y-2 py-4">
          <div className="flex items-start justify-between gap-3"><p className="font-medium">{item.title}</p><Badge variant="outline">{item.status}</Badge></div>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.description || "No information available"}</p>
          {item.occurredAt && <p className="text-xs text-muted-foreground">{new Date(item.occurredAt).toLocaleString("en-GB")}</p>}
          {item.score != null && <p className="text-sm">Score: {item.score}/10</p>}
          {section === "backlog" && access.actions.createTask && <Button variant="outline" size="sm"
            onClick={() => { setEditing(item); setAction("edit"); }}>Edit task</Button>}
        </div>)}</div>}</CardContent>
    </Card>
    {action && <WorkspaceSectionActionDialog key={action + (editing?.id ?? "")} workspaceId={workspaceId} section={section}
      action={action} items={data.items} editing={editing} onClose={() => setAction(undefined)} onAccessChanged={onAccessChanged} />}
  </>;
}
~~~

## Phase 5 — frontend/src/pages/management/workspace/WorkspaceOverviewSection.tsx

Tạo file mới. Overview and charter failures do not block unrelated business section queries.

Đích: `D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/frontend/src/pages/management/workspace/WorkspaceOverviewSection.tsx`

~~~tsx
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { workspaceApi } from "@/api/features/workspace.api";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceOverviewPanel } from "./WorkspaceOverviewPanel";
import { TeamCharterForm } from "./TeamCharterForm";
import { WorkspaceSectionState, sectionForbidden } from "./WorkspaceSectionState";

export function WorkspaceOverviewSection({ workspaceId, projectId, teamId, canViewMembers, onViewMembers,
  onAccessChanged, charter = false, canManageMembers = false }: {
  workspaceId: number; projectId: number; teamId: number; canViewMembers: boolean; onViewMembers: () => void;
  onAccessChanged: () => void; charter?: boolean; canManageMembers?: boolean;
}) {
  const { user, activeRole } = usePermissions();
  const query = useQuery({
    queryKey: ["workspace-detail", workspaceId, user.email, activeRole],
    queryFn: ({ signal }) => workspaceApi.getById(workspaceId, signal),
    retry: false, staleTime: 0, gcTime: 0, refetchOnMount: "always"
  });
  const denied = sectionForbidden(query.error);
  useEffect(() => { if (denied) onAccessChanged(); }, [denied, onAccessChanged]);
  if (query.isError || query.isPending || query.isFetching)
    return <WorkspaceSectionState loading={!query.isError && query.isFetching} denied={denied} error={query.error}
      retry={() => denied ? onAccessChanged() : void query.refetch()} />;
  const workspace = query.data;
  if (!workspace || workspace.id !== workspaceId || workspace.teamId !== teamId || workspace.projectId !== projectId)
    return <WorkspaceSectionState error={new Error("Overview context does not match this workspace.")} retry={() => void query.refetch()} />;
  return charter ? <Card><CardHeader><CardTitle>Team charter</CardTitle></CardHeader><CardContent>
    <TeamCharterForm key={teamId} teamId={teamId} initial={workspace.charter}
      canManage={canManageMembers} onAccessChanged={onAccessChanged} />
  </CardContent></Card> : <WorkspaceOverviewPanel workspace={workspace}
    canViewMembers={canViewMembers && workspace.can_view_members} onViewMembers={onViewMembers} />;
}
~~~

## Phase 5 — frontend/src/pages/management/workspace/WorkspaceMembersPanel.tsx

Sửa file hiện có. Keep existing roster UI, add signal and fresh server capability/403 guard.

Đích: `D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/frontend/src/pages/management/workspace/WorkspaceMembersPanel.tsx`

~~~tsx
import { useEffect, useState } from "react";
import { workspaceApi } from "@/api/features/workspace.api";
import { usePermissions } from "@/hooks/usePermissions";
import type { WorkspaceMember } from "@/types/features/workspace";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Users } from "lucide-react";
import { getWorkspaceError } from "./workspace.shared";
import { PROJECT_ROLE_LABELS, PARTICIPATION_LABELS } from "./workspace.roles";
import { WorkspaceMemberManagementDialog } from "./WorkspaceMemberManagementDialog";
import { WorkspaceSectionState } from "./WorkspaceSectionState";

export function WorkspaceMembersPanel({ workspaceId, teamId, canViewMembers, canManageMembers = false, onAccessChanged }: {
  workspaceId: number;
  teamId: number;
  canViewMembers: boolean;
  canManageMembers?: boolean;
  onAccessChanged?: () => void;
}) {
  const { user, activeRole, hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [managementOpen, setManagementOpen] = useState(false);
  const query = useQuery<WorkspaceMember[]>({
    queryKey: ["workspace-members", workspaceId, user.email, activeRole],
    queryFn: ({ signal }) => workspaceApi.getMembers(workspaceId, signal),
    enabled: canViewMembers,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always"
  });

  const denied = isAxiosError(query.error) && query.error.response?.status === 403;
  useEffect(() => { if (denied) onAccessChanged?.(); }, [denied, onAccessChanged]);
  if (denied) return <WorkspaceSectionState denied retry={() => onAccessChanged?.()} />;

  if (!canViewMembers) {
    return <Card><CardHeader><CardTitle>Members</CardTitle></CardHeader>
      <CardContent>You do not have permission to view member details.</CardContent></Card>;
  }
  const members = query.data ?? [];
  const loading = query.isFetching || query.isLoading;
  function changeManagementOpen(open: boolean) {
    setManagementOpen(open);
    if (!open) void queryClient.invalidateQueries({ queryKey: ["workspace-detail", workspaceId] });
  }
  return <>
    <Card>
      <CardHeader><div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>{query.isError ? "Unable to load members" : loading ? "Members" : "Members (" + members.length + ")"}</CardTitle>
        {canManageMembers && hasPermission("TEAM_UPDATE") && <Button variant="outline" onClick={() => setManagementOpen(true)}><Users />Manage members</Button>}
      </div></CardHeader>
      <CardContent>{loading ? <p className="flex items-center justify-center gap-2 py-10"><Loader2 className="size-4 animate-spin" />Loading members...</p>
        : query.isError ? <div className="space-y-3"><p className="text-sm">{denied ? "You do not have permission to view member details." : getWorkspaceError(query.error)}</p><Button variant="outline" onClick={() => void query.refetch()}>Try again</Button></div>
        : members.length === 0 ? <p className="text-sm text-muted-foreground">No team members</p>
        : <Table><TableHeader><TableRow><TableHead>Member code</TableHead><TableHead>Display name</TableHead><TableHead>Project role</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>{members.map((member, index) => <TableRow key={member.user_code ?? "uncoded-" + index}>
            <TableCell>{member.user_code || "Not assigned"}</TableCell>
            <TableCell>{member.display_name}</TableCell>
            <TableCell>{PROJECT_ROLE_LABELS[member.project_role] ?? "Unassigned role"}</TableCell>
            <TableCell>{PARTICIPATION_LABELS[member.status]}</TableCell>
          </TableRow>)}</TableBody></Table>}
      </CardContent>
    </Card>
    {canManageMembers && hasPermission("TEAM_UPDATE") && <WorkspaceMemberManagementDialog teamId={teamId} workspaceId={workspaceId} open={managementOpen} onOpenChange={changeManagementOpen} onAccessChanged={onAccessChanged} />}
  </>;
}
~~~

## Phase 5 — frontend/src/pages/management/workspace/TeamCharterForm.tsx

Sửa file hiện có. Retain existing charter; revoke cached write access after403.

Đích: `D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/frontend/src/pages/management/workspace/TeamCharterForm.tsx`

~~~tsx
import { projectHubApi } from "@/api/features/project-hub.api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/hooks/usePermissions";
import type { TeamCharter } from "@/types/features/project-hub";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2, Save } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { sectionForbidden } from "./WorkspaceSectionState";
import { getWorkspaceError } from "./workspace.shared";

export function TeamCharterForm({ teamId, initial, canManage = false, onAccessChanged }: { teamId: number; initial: TeamCharter; canManage?: boolean; onAccessChanged?: () => void }) {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<TeamCharter>({ mission: initial.mission ?? "", definitionOfDone: initial.definitionOfDone ?? "", primaryChannel: initial.primaryChannel ?? "", coreHours: initial.coreHours ?? "", conflictResolution: initial.conflictResolution ?? "" });
  const canEdit = canManage && hasPermission("TEAM_UPDATE");
  const channels = ["Microsoft Teams", "Slack", "Discord", "Google Chat", "Email"];
  const channel = form.primaryChannel === "Teams" ? "Microsoft Teams" : form.primaryChannel;
  const save = useMutation({
    mutationFn: () => projectHubApi.saveCharter(teamId, form),
    onError: error => { if (sectionForbidden(error)) onAccessChanged?.(); },
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["workspace-detail"] }), queryClient.invalidateQueries({ queryKey: ["project-teams"] })]);
      toast.success("Team charter saved");
    },
  });
  function submit(event: FormEvent) { event.preventDefault(); if (canEdit && !save.isPending && !sectionForbidden(save.error)) save.mutate(); }
  return (
    <form onSubmit={submit} className="space-y-4">
      <fieldset disabled={!canEdit || save.isPending || sectionForbidden(save.error)} className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="team-mission">Team mission</Label><Textarea id="team-mission" maxLength={2000} rows={4} value={form.mission} placeholder="The team's shared goals and intended value..." onChange={event => setForm({ ...form, mission: event.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="team-done">Definition of done</Label><Textarea id="team-done" maxLength={2000} rows={4} value={form.definitionOfDone} placeholder="Conditions a task must meet to be considered complete..." onChange={event => setForm({ ...form, definitionOfDone: event.target.value })} /></div>
        <div className="space-y-2"><Label htmlFor="team-channel">Primary channel</Label><Select value={channel || "__none__"} onValueChange={value => setForm({ ...form, primaryChannel: value === "__none__" ? "" : value })} disabled={!canEdit || save.isPending}><SelectTrigger id="team-channel" className="w-full"><SelectValue placeholder="Select a channel" /></SelectTrigger><SelectContent><SelectItem value="__none__">Not selected</SelectItem>{channel && !channels.includes(channel) && <SelectItem value={channel}>{channel}</SelectItem>}{channels.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label htmlFor="team-hours">Core hours</Label><Input id="team-hours" maxLength={255} value={form.coreHours} placeholder="For example: Monday–Friday, 19:00–21:00" onChange={event => setForm({ ...form, coreHours: event.target.value })} /></div>
        <div className="space-y-2 sm:col-span-2"><Label htmlFor="team-conflict">Conflict resolution</Label><Textarea id="team-conflict" maxLength={2000} rows={3} value={form.conflictResolution} placeholder="How the team discusses issues, reaches agreement and involves the mentor..." onChange={event => setForm({ ...form, conflictResolution: event.target.value })} /></div>
      </fieldset>
      {save.isError && <Alert variant="destructive"><AlertCircle /><AlertDescription>{getWorkspaceError(save.error)}</AlertDescription></Alert>}
      {canEdit && <div className="flex justify-end"><Button type="submit" disabled={save.isPending || sectionForbidden(save.error)}>{save.isPending ? <Loader2 className="animate-spin" /> : <Save />}Save charter</Button></div>}
    </form>
  );
}
~~~

## Phase 5 — frontend/src/pages/management/workspace/WorkspaceMemberManagementDialog.tsx

Sửa file hiện có. A direct roster write/read403 clears dialog content and rechecks workspace capabilities.

Đích: `D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/frontend/src/pages/management/workspace/WorkspaceMemberManagementDialog.tsx`

~~~tsx
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { projectHubApi } from "@/api/features/project-hub.api";
import { usePermissions } from "@/hooks/usePermissions";
import type { ManagedTeamMember, TeamMembershipUpdate } from "@/types/features/project-hub";
import type { ProjectRole, ParticipationStatus } from "@/types/features/workspace";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { sectionForbidden } from "./WorkspaceSectionState";
import { getWorkspaceError } from "./workspace.shared";
import { PROJECT_ROLE_LABELS, PARTICIPATION_LABELS } from "./workspace.roles";

export function WorkspaceMemberManagementDialog({ teamId, workspaceId, open, onOpenChange, onAccessChanged }: {
  teamId: number; workspaceId: number; open: boolean; onOpenChange: (open: boolean) => void; onAccessChanged?: () => void;
}) {
  const { user, activeRole, hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const allowed = hasPermission("TEAM_UPDATE") && hasPermission("WORKSPACE_MEMBER_READ");
  const roster = useQuery({ queryKey: ["team-managed-members", teamId, user.email, activeRole],
    queryFn: () => projectHubApi.getMembers(teamId), enabled: open && allowed, retry: false, staleTime: 0, gcTime: 0 });
  const options = useQuery({ queryKey: ["team-member-options", teamId, user.email, activeRole],
    queryFn: () => projectHubApi.getMemberOptions(teamId), enabled: open && allowed, retry: false, staleTime: 0, gcTime: 0 });
  const [selectedUser, setSelectedUser] = useState("");
  const [newRole, setNewRole] = useState<ProjectRole>("UNASSIGNED");
  const save = useMutation({
    mutationFn: ({ userId, ...update }: TeamMembershipUpdate & { userId: number }) => projectHubApi.saveMember(teamId, userId, update),
    onError: error => { if (sectionForbidden(error)) onAccessChanged?.(); },
    onSuccess: async () => {
      setSelectedUser(""); setNewRole("UNASSIGNED");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["team-managed-members", teamId] }),
        queryClient.invalidateQueries({ queryKey: ["workspace-members", workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ["workspace-detail", workspaceId], refetchType: "none" }),
        queryClient.invalidateQueries({ queryKey: ["workspace-candidates"] }),
        queryClient.invalidateQueries({ queryKey: ["project-teams"] })
      ]);
      toast.success("Team membership saved");
    }
  });
  const denied = sectionForbidden(roster.error) || sectionForbidden(options.error) || sectionForbidden(save.error);
  useEffect(() => { if (denied) onAccessChanged?.(); }, [denied, onAccessChanged]);
  if (denied) return null;
  const available = options.data?.filter(option => !roster.data?.some(member => member.userId === option.userId)) ?? [];
  const loading = roster.isLoading || options.isLoading;
  const failed = roster.isError || options.isError;
  return <Dialog open={open && allowed} onOpenChange={value => { if (!save.isPending) onOpenChange(value); }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl" onInteractOutside={event => { if (save.isPending) event.preventDefault(); }} onEscapeKeyDown={event => { if (save.isPending) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>Manage members</DialogTitle><DialogDescription>Assign project roles and update participation in this team.</DialogDescription></DialogHeader>
      {loading ? <p className="flex items-center gap-2 py-6"><Loader2 className="size-4 animate-spin" />Loading team members...</p>
        : failed ? <div className="space-y-3"><p>{getWorkspaceError(roster.error ?? options.error)}</p><Button variant="outline" onClick={() => void Promise.all([roster.refetch(), options.refetch()])}>Try again</Button></div>
        : <>
          <div className="space-y-3">{roster.data?.length ? roster.data.map(member =>
            <MembershipRow key={`${member.userId}:${member.projectRole}:${member.status}`} member={member} pending={save.isPending}
              onSave={update => save.mutate({ userId: member.userId, ...update })} />)
            : <p className="text-muted-foreground">No team members</p>}</div>
          <div className="space-y-3 rounded-lg border p-4">
            <p className="font-medium">Add an existing user</p>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <Select value={selectedUser} onValueChange={setSelectedUser} disabled={save.isPending || available.length === 0}>
                <SelectTrigger aria-label="User to add" className="w-full"><SelectValue placeholder={available.length ? "Select a user" : "No other users available"} /></SelectTrigger>
                <SelectContent>{available.map(option => <SelectItem key={option.userId} value={String(option.userId)}>{option.displayName} · {option.userCode ?? "No member code"}</SelectItem>)}</SelectContent>
              </Select>
              <RoleSelect value={newRole} onChange={setNewRole} disabled={save.isPending} label="New member project role" />
              <Button disabled={!selectedUser || save.isPending} onClick={() => save.mutate({ userId: Number(selectedUser), projectRole: newRole, status: "ACTIVE" })}>Add member</Button>
            </div>
          </div>
        </>}
      {save.isError && <Alert variant="destructive"><AlertDescription>{getWorkspaceError(save.error)}</AlertDescription></Alert>}
      <div className="flex justify-end"><Button variant="outline" disabled={save.isPending} onClick={() => onOpenChange(false)}>Done</Button></div>
    </DialogContent>
  </Dialog>;
}

function RoleSelect({ value, onChange, disabled, label }: { value: ProjectRole; onChange: (value: ProjectRole) => void; disabled: boolean; label: string }) {
  return <Select value={value} onValueChange={value => onChange(value as ProjectRole)} disabled={disabled}>
    <SelectTrigger aria-label={label} className="w-full"><SelectValue /></SelectTrigger>
    <SelectContent>{Object.entries(PROJECT_ROLE_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
  </Select>;
}

function MembershipRow({ member, pending, onSave }: { member: ManagedTeamMember; pending: boolean; onSave: (update: TeamMembershipUpdate) => void }) {
  const [projectRole, setProjectRole] = useState(member.projectRole);
  const [status, setStatus] = useState(member.status);
  const changed = projectRole !== member.projectRole || status !== member.status;
  return <div className="grid items-center gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px_auto]">
    <div className="min-w-0"><p className="break-words font-medium">{member.displayName}</p><p className="text-xs text-muted-foreground">{member.userCode ?? "No member code"}</p></div>
    <RoleSelect value={projectRole} onChange={setProjectRole} disabled={pending} label={`Project role for ${member.displayName}`} />
    <Select value={status} onValueChange={value => setStatus(value as ParticipationStatus)} disabled={pending}>
      <SelectTrigger aria-label={`Participation for ${member.displayName}`} className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent>{Object.entries(PARTICIPATION_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
    </Select>
    <Button variant="outline" disabled={pending || !changed} aria-label={`Save membership for ${member.displayName}`} onClick={() => onSave({ projectRole, status })}><Save />Save</Button>
  </div>;
}
~~~

## Phase 5 — frontend/src/pages/management/workspace/WorkspaceDetailPage.tsx

Sửa file hiện có. Navigation manifest controls tabs; every panel owns its request and permission failure.

Đích: `D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/frontend/src/pages/management/workspace/WorkspaceDetailPage.tsx`

~~~tsx
import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { workspaceApi } from "@/api/features/workspace.api";
import { usePermissions } from "@/hooks/usePermissions";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { WorkspaceSectionKey } from "@/types/features/workspace";
import { WORKSPACE_SECTIONS, WorkspaceStatusBadge } from "./workspace.shared";
import { WorkspaceSectionState, sectionForbidden } from "./WorkspaceSectionState";
import { WorkspaceBusinessSectionPanel } from "./WorkspaceBusinessSectionPanel";
import { WorkspaceOverviewSection } from "./WorkspaceOverviewSection";
import { WorkspaceMembersPanel } from "./WorkspaceMembersPanel";
import { sectionAccess } from "./workspace.section-access";

export default function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, activeRole } = usePermissions();
  return <WorkspaceContext key={id + ":" + user.email + ":" + activeRole} workspaceId={Number(id)} />;
}
function WorkspaceContext({ workspaceId }: { workspaceId: number }) {
  const { user, activeRole, hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const selected = params.get("tab") ?? "overview";
  const tab: WorkspaceSectionKey = WORKSPACE_SECTIONS.find(section => section.id === selected)?.id ?? "overview";
  const [blocked, setBlocked] = useState<WorkspaceSectionKey>();
  const validId = Number.isSafeInteger(workspaceId) && workspaceId > 0;
  const navigation = useQuery({
    queryKey: ["workspace-navigation", workspaceId, user.email, activeRole],
    queryFn: ({ signal }) => workspaceApi.navigation(workspaceId, signal),
    enabled: validId, retry: false, staleTime: 0, gcTime: 0, refetchOnMount: "always"
  });
  const reloadAccess = useCallback(() => {
    setBlocked(tab); // Unmount the panel immediately, including any open action dialog.
    void navigation.refetch().then(result => { if (result.isSuccess) setBlocked(undefined); });
  }, [tab, navigation.refetch]);
  function changeTab(value: string) {
    setParams(previous => { const next = new URLSearchParams(previous);
      if (value === "overview") next.delete("tab"); else next.set("tab", value); return next;
    }, { replace: true });
  }
  const context = navigation.data?.workspaceId === workspaceId ? navigation.data : undefined;
  const sections = context?.sections.map(item => sectionAccess(item, hasPermission)) ?? [];
  const current = sections.find(item => item.key === tab);
  const members = sections.find(item => item.key === "members");
  const denied = blocked === tab || !current?.canRead;
  const validContext = context && Number.isSafeInteger(context.projectId) && Number.isSafeInteger(context.teamId);
  async function refresh() {
    await navigation.refetch();
    await Promise.all(["workspace-detail", "workspace-members", "workspace-section"].map(key =>
      queryClient.invalidateQueries({ queryKey: [key, workspaceId] })));
  }
  return <MainLayout pathName={{ management: "Management", workspaces: "Workspace",
    [String(workspaceId)]: navigation.isError ? "Workspace details" : context?.projectName ?? "Workspace details" }}>
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" asChild><Link to="/management/workspaces/candidates"><ArrowLeft />Workspace list</Link></Button>
        <Button variant="outline" disabled={!validId || navigation.isFetching} onClick={() => void refresh()}><RefreshCw />Refresh access</Button>
      </div>
      {!validId || navigation.isError || navigation.isPending || !validContext
        ? <WorkspaceSectionState loading={validId && navigation.isPending} denied={sectionForbidden(navigation.error)}
            error={navigation.error} retry={() => void navigation.refetch()} />
        : <>
          <Card><CardHeader><div className="flex items-center justify-between gap-3">
            <div className="space-y-2"><Badge variant="outline">{context.projectCode}</Badge>
              <CardTitle>{context.projectName}</CardTitle><p className="text-sm text-muted-foreground">{context.teamName}</p></div>
            <WorkspaceStatusBadge status={context.projectStatus} />
          </div></CardHeader></Card>
          <Tabs value={tab} onValueChange={changeTab} className="gap-5">
            <div className="overflow-x-auto border-b pb-1"><TabsList variant="line" aria-label="Workspace sections"
              className="w-max min-w-full justify-start">{WORKSPACE_SECTIONS.map(({ id, label, icon: Icon }) =>
              <TabsTrigger key={id} value={id} disabled={!sections.find(item => item.key === id)?.canRead}
                className="gap-2 px-4 py-2"><Icon />{label}</TabsTrigger>)}</TabsList></div>
            <TabsContent key={tab} value={tab} className="space-y-5">
              {denied || !current ? <WorkspaceSectionState denied retry={reloadAccess} />
                : tab === "overview" ? <WorkspaceOverviewSection workspaceId={workspaceId} projectId={context.projectId}
                    teamId={context.teamId} canViewMembers={!!members?.canRead} onViewMembers={() => changeTab("members")}
                    onAccessChanged={reloadAccess} />
                : tab === "members" ? <>
                    <WorkspaceMembersPanel workspaceId={workspaceId} teamId={context.teamId} canViewMembers
                      canManageMembers={current.actions.manage} onAccessChanged={reloadAccess} />
                    <WorkspaceOverviewSection workspaceId={workspaceId} projectId={context.projectId} teamId={context.teamId}
                      charter canManageMembers={current.actions.manage} canViewMembers onViewMembers={() => changeTab("members")}
                      onAccessChanged={reloadAccess} />
                  </>
                : <WorkspaceBusinessSectionPanel key={workspaceId + ":" + tab} workspaceId={workspaceId}
                    projectId={context.projectId} teamId={context.teamId} section={tab}
                    label={WORKSPACE_SECTIONS.find(section => section.id === tab)!.label}
                    access={current} onAccessChanged={reloadAccess} />}
            </TabsContent>
          </Tabs>
        </>}
    </div>
  </MainLayout>;
}
~~~

## Phase 6 — backend/src/test/java/com/example/starter_project_2025/system/project/WorkspaceOverviewIntegrationTest.java

Sửa file hiện có. History assertions move to permission-gated activity API.

Đích: `D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/backend/src/test/java/com/example/starter_project_2025/system/project/WorkspaceOverviewIntegrationTest.java`

~~~java
package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class WorkspaceOverviewIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired TransactionTemplate tx;
    @Autowired JdbcTemplate jdbc;
    @Autowired TenantRepository tenants;
    @Autowired UserRepository users;
    @Autowired RoleRepository roles;
    @Autowired PermissionRepository permissions;
    @Autowired ProjectRepository projects;
    @Autowired TeamRepository teams;
    @Autowired TeamMemberRepository memberships;
    @Autowired ProjectTopicSnapshotRepository snapshots;
    @Autowired UserDetailsService userDetails;
    @Autowired RefreshTokenService tokens;
    Long tenantId, actorId, roleId, projectId, teamId, membershipId, workspaceId;
    String token;

    @BeforeEach
    void fixture() throws Exception {
        tx.executeWithoutResult(status -> {
            var tenant = tenants.saveAndFlush(Tenant.builder()
                    .code("US02-" + UUID.randomUUID()).name("US02 test tenant").build());
            tenantId = tenant.getId();
            var role = new Role();
            role.setName("US02-" + UUID.randomUUID());
            role.setPermissions(new HashSet<>(List.of(
                    permissions.findByName("WORKSPACE_READ").orElseThrow(),
                    permissions.findByName("WORKSPACE_CREATE").orElseThrow(),
                    permissions.findByName("WORKSPACE_MEMBER_READ").orElseThrow(),
                    permissions.findByName("WORKSPACE_ACTIVITY_READ").orElseThrow())));
            roleId = roles.saveAndFlush(role).getId();
            var user = new User();
            user.setEmail(UUID.randomUUID() + "@us02.test");
            user.setFirstName("Workspace"); user.setLastName("Reader");
            user.setUserCode("MEM-" + UUID.randomUUID());
            user.setPasswordHash("unused-test-password");
            user.setTenant(tenant); user.setRoles(new HashSet<>(Set.of(role)));
            actorId = users.saveAndFlush(user).getId();
            var project = new Project();
            project.setCode("PROJECT-" + UUID.randomUUID()); project.setName("Project A");
            project.setDescription("Live project description");
            project.setTenant(tenant); project.setStatus(ProjectStatus.PLANNING);
            projectId = projects.saveAndFlush(project).getId();
            var team = new Team();
            team.setCode("TEAM-" + UUID.randomUUID()); team.setName("Team A");
            team.setTenant(tenant); team.setProject(project); team.setMentor(user);
            teamId = teams.saveAndFlush(team).getId();
            var membership = new TeamMember();
            membership.setTeam(team); membership.setUser(user);
            membershipId = memberships.saveAndFlush(membership).getId();
            var principal = userDetails.loadUserByUsername(user.getEmail());
            token = tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(
                    principal, null, principal.getAuthorities()));
        });
        var created = mvc.perform(post("/api/workspaces")
                .header("Authorization", "Bearer " + token)
                .header("X-Idempotency-Key", UUID.randomUUID().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("projectId", projectId, "teamId", teamId))))
                .andExpect(status().isCreated()).andReturn();
        workspaceId = json.readTree(created.getResponse().getContentAsString()).get("id").asLong();
    }

    JsonNode overview() throws Exception {
        return json.readTree(mvc.perform(get("/api/workspaces/{id}", workspaceId)
                .header("Authorization", "Bearer " + token)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }
    JsonNode activity() throws Exception {
        return json.readTree(mvc.perform(get("/api/workspaces/{id}/activity", workspaceId)
                .header("Authorization", "Bearer " + token)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }
    JsonNode members() throws Exception {
        return json.readTree(mvc.perform(get("/api/workspaces/{id}/members", workspaceId)
                .header("Authorization", "Bearer " + token)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }
    void snapshot(String requirements) {
        tx.executeWithoutResult(status -> snapshots.saveAndFlush(ProjectTopicSnapshot.builder()
                .project(projects.findById(projectId).orElseThrow())
                .topicCode("TOPIC-001").topicTitle("Fixed topic title").version("v1.0.0")
                .description("Frozen description").objectives("Frozen objectives")
                .requirementsJson(requirements)
                .attachmentsJson("[{\"name\":\"Brief\",\"url\":\"https://example.com/brief.pdf\"}]")
                .build()));
    }

    @Test void ac01OverviewMatchesWorkspaceAndHasNoEmbeddedRoster() throws Exception {
        var result = overview();
        assertThat(result.get("id").asLong()).isEqualTo(workspaceId);
        assertThat(result.get("projectId").asLong()).isEqualTo(projectId);
        assertThat(result.get("teamId").asLong()).isEqualTo(teamId);
        assertThat(result.get("projectName").asText()).isEqualTo("Project A");
        assertThat(result.has("members")).isFalse();
    }

    @Test void ac02SnapshotRemainsFixedWhenLiveProjectContentChanges() throws Exception {
        snapshot("[\"Requirement A\"]");
        tx.executeWithoutResult(status -> projects.findById(projectId).orElseThrow()
                .setDescription("New content from a later source version"));
        var result = overview();
        assertThat(result.get("projectDescription").asText()).isEqualTo("Frozen description");
        assertThat(result.at("/topic_snapshot/version").asText()).isEqualTo("v1.0.0");
        assertThat(result.at("/topic_snapshot/topic_title").asText()).isEqualTo("Fixed topic title");
        assertThat(result.at("/topic_snapshot/objectives").asText()).isEqualTo("Frozen objectives");
        assertThat(result.at("/topic_snapshot/requirements/0").asText()).isEqualTo("Requirement A");
    }

    @Test void ac03MemberResponseHasExactlyFourApprovedFields() throws Exception {
        tx.executeWithoutResult(status -> memberships.findById(membershipId).orElseThrow()
                .setProjectRole(ProjectRole.FE_DEV));
        var result = members();
        assertThat(result).hasSize(1);
        var fields = new HashSet<String>();
        result.get(0).fieldNames().forEachRemaining(fields::add);
        assertThat(fields).containsExactlyInAnyOrder("user_code", "display_name", "project_role", "status");
        assertThat(result.at("/0/user_code").asText()).startsWith("MEM-");
        assertThat(result.at("/0/display_name").asText()).isEqualTo("Workspace Reader");
        assertThat(result.at("/0/project_role").asText()).isEqualTo("FE_DEV");
        assertThat(result.at("/0/status").asText()).isEqualTo("ACTIVE");
    }

    @Test void ac03ForeignTenantMembershipIsExcluded() throws Exception {
        tx.executeWithoutResult(status -> {
            var foreign = tenants.saveAndFlush(Tenant.builder().code("OTHER-" + UUID.randomUUID()).name("Other").build());
            var user = new User();
            user.setEmail(UUID.randomUUID() + "@foreign.test"); user.setFirstName("Foreign");
            user.setPasswordHash("unused"); user.setTenant(foreign);
            users.saveAndFlush(user);
            var membership = new TeamMember();
            membership.setUser(user); membership.setTeam(teams.findById(teamId).orElseThrow());
            memberships.saveAndFlush(membership);
        });
        assertThat(members()).hasSize(1);
        assertThat(overview().get("member_count").asInt()).isEqualTo(1);
    }

    @Test void ac04ProjectRoleIsNotInferredFromSystemRoles() throws Exception {
        tx.executeWithoutResult(status -> users.findById(actorId).orElseThrow().getRoles()
                .add(roles.findByName("TEACHER").orElseThrow()));
        assertThat(members().at("/0/project_role").asText()).isEqualTo("UNASSIGNED");
    }

    @Test void ac05RosterRefreshExcludesLeftMemberAndRetainsHistory() throws Exception {
        var oldEvent = activity().at("/items/0/id").asText();
        tx.executeWithoutResult(status -> memberships.findById(membershipId).orElseThrow()
                .setParticipationStatus(ParticipationStatus.LEFT));
        assertThat(members()).isEmpty();
        var result = overview();
        assertThat(result.get("member_count").asInt()).isZero();
        assertThat(activity().at("/items/0/id").asText()).isEqualTo(oldEvent);
        assertThat(activity().at("/items/0/description").asText()).isEqualTo("Workspace Reader");
    }

    @Test void ac06OverviewOnlyRoleSeesCountButMembersApiIs403() throws Exception {
        tx.executeWithoutResult(status -> roles.findById(roleId).orElseThrow().getPermissions()
                .removeIf(permission -> permission.getName().equals("WORKSPACE_MEMBER_READ")));
        var result = overview();
        assertThat(result.get("member_count").asInt()).isEqualTo(1);
        assertThat(result.get("can_view_members").asBoolean()).isFalse();
        assertThat(result.has("members")).isFalse();
        mvc.perform(get("/api/workspaces/{id}/members", workspaceId)
                .header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    }

    @Test void ac07OptionalContentAndEmptyRosterAreNotErrors() throws Exception {
        tx.executeWithoutResult(status -> {
            projects.findById(projectId).orElseThrow().setDescription(null);
            memberships.findById(membershipId).orElseThrow().setParticipationStatus(ParticipationStatus.INACTIVE);
        });
        var result = overview();
        assertThat(result.get("projectDescription").isNull()).isTrue();
        assertThat(result.get("topic_snapshot").isNull()).isTrue();
        assertThat(result.get("member_count").asInt()).isZero();
        assertThat(members()).isEmpty();
    }

    @Test void ac08NeitherResponseContainsRestrictedFields() throws Exception {
        for (var result : List.of(overview(), members())) {
            for (String field : List.of("password", "passwordHash", "token", "accessToken",
                    "email", "phone", "draftScores", "unreleasedFeedback")) {
                assertThat(result.findValues(field)).as(field).isEmpty();
            }
        }
    }

    @Test void ac09MissingAuthenticationIs401AndUnknownWorkspaceIs404() throws Exception {
        mvc.perform(get("/api/workspaces/{id}", workspaceId)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/workspaces/{id}/members", workspaceId)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/workspaces/{id}", Long.MAX_VALUE)
                .header("Authorization", "Bearer " + token)).andExpect(status().isNotFound());
    }

    @Test void ac09InactiveTenantIs403() throws Exception {
        tx.executeWithoutResult(status -> tenants.findById(tenantId).orElseThrow().setActive(false));
        mvc.perform(get("/api/workspaces/{id}", workspaceId)
                .header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    }

    @Test void ac09LeftMemberWithoutMentorAssignmentLosesScope() throws Exception {
        tx.executeWithoutResult(status -> {
            memberships.findById(membershipId).orElseThrow().setParticipationStatus(ParticipationStatus.LEFT);
            teams.findById(teamId).orElseThrow().setMentor(null);
        });
        mvc.perform(get("/api/workspaces/{id}", workspaceId)
                .header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        mvc.perform(get("/api/workspaces/{id}/members", workspaceId)
                .header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    }

    @Test void ac10MalformedStoredSnapshotIsAnErrorRatherThanEmptyData() throws Exception {
        snapshot("not-json");
        mvc.perform(get("/api/workspaces/{id}", workspaceId)
                .header("Authorization", "Bearer " + token)).andExpect(status().isInternalServerError());
    }

    @Test void ac10ReadsDoNotWriteOrActivateTheProject() throws Exception {
        tx.executeWithoutResult(status -> projects.findById(projectId).orElseThrow().setStatus(ProjectStatus.PLANNING));
        var tables = List.of("projects", "teams", "team_members", "workspaces", "workspace_sections",
                "workspace_activities", "workspace_audits", "workspace_outbox_events",
                "workspace_creation_requests", "project_topic_snapshots");
        var before = new LinkedHashMap<String, Long>();
        for (String table : tables) before.put(table, jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Long.class));
        overview(); members(); overview(); members();
        for (String table : tables) assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Long.class))
                .as(table).isEqualTo(before.get(table));
        tx.executeWithoutResult(status -> {
            assertThat(projects.findById(projectId).orElseThrow().getStatus()).isEqualTo(ProjectStatus.PLANNING);
            assertThat(memberships.findById(membershipId).orElseThrow().getParticipationStatus()).isEqualTo(ParticipationStatus.ACTIVE);
        });
    }
}
~~~

## Phase 6 — backend/src/test/java/com/example/starter_project_2025/system/project/WorkspaceAcceptanceIntegrationTest.java

Sửa file hiện có. Update the aggregate contract and retain the US01 history assertion through Activity.

Đích: `D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/backend/src/test/java/com/example/starter_project_2025/system/project/WorkspaceAcceptanceIntegrationTest.java`

~~~java
package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ActiveProfiles("test")
@SpringBootTest
@AutoConfigureMockMvc
class WorkspaceAcceptanceIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired TransactionTemplate tx;
    @Autowired JdbcTemplate jdbc;
    @Autowired TenantRepository tenants;
    @Autowired ProjectRepository projects;
    @Autowired CohortRepository cohorts;
    @Autowired TeamRepository teams;
    @Autowired TeamMemberRepository members;
    @Autowired UserRepository users;
    @Autowired RoleRepository roles;
    @Autowired PermissionRepository permissions;
    @Autowired UserDetailsService userDetails;
    @Autowired RefreshTokenService tokens;
    @Autowired JwtEncoder encoder;
    @Autowired WorkspaceOutboxDelivery delivery;
    @SpyBean WorkspaceRepository workspaces;
    @SpyBean WorkspaceAuditRepository audits;
    @SpyBean WorkspaceOutboxRepository outbox;
    @SpyBean WorkspaceActivityRepository activities;
    @SpyBean WorkspaceCreationRequestRepository requests;
    Long tenantId, projectId, teamId, cohortId, actorId, roleId, membershipId;
    String token, email;

    @BeforeEach
    void fixture() {
        tx.executeWithoutResult(status -> {
            Tenant tenant = tenants.saveAndFlush(Tenant.builder().code("AC-" + UUID.randomUUID()).name("Acceptance tenant").build());
            tenantId = tenant.getId();
            Role role = new Role();
            role.setName("WORKSPACE_MEMBER_" + UUID.randomUUID());
            role.setPermissions(new HashSet<>(List.of(permissions.findByName("VIEW_PROJECT_WORKSPACE").orElseThrow(),
                    permissions.findByName("CREATE_PROJECT_WORKSPACE").orElseThrow(),
                    permissions.findByName("WORKSPACE_ACTIVITY_READ").orElseThrow())));
            roleId = roles.saveAndFlush(role).getId();
            email = UUID.randomUUID() + "@workspace.test";
            User actor = new User();
            actor.setEmail(email); actor.setFirstName("Workspace"); actor.setLastName("Creator");
            actor.setPasswordHash("unused-test-password"); actor.setTenant(tenant); actor.setRoles(new HashSet<>(Set.of(role)));
            actorId = users.saveAndFlush(actor).getId();
            Cohort cohort = new Cohort();
            cohort.setCode("COHORT-" + UUID.randomUUID()); cohort.setName("SE18A"); cohort.setTenant(tenant); cohort.setStatus(CohortStatus.ACTIVE);
            cohortId = cohorts.saveAndFlush(cohort).getId();
            Project project = new Project();
            project.setCode("PRJ-" + UUID.randomUUID()); project.setName("Campus portal"); project.setDescription("Existing project brief");
            project.setTenant(tenant); project.setCohort(cohort); project.setStatus(ProjectStatus.PLANNING);
            projectId = projects.saveAndFlush(project).getId();
            Team team = new Team();
            team.setCode("TEAM-" + UUID.randomUUID()); team.setName("Atlas"); team.setTenant(tenant); team.setProject(project);
            teamId = teams.saveAndFlush(team).getId();
            TeamMember member = new TeamMember();
            member.setTeam(team); member.setUser(actor);
            membershipId = members.saveAndFlush(member).getId();
            token = token(email);
        });
        assertCleanCreationState();
    }

    void assertCleanCreationState() {
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM workspaces WHERE project_id = ? AND team_id = ?", Long.class, projectId, teamId)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM workspace_creation_requests WHERE tenant_id = ? AND actor_id = ?", Long.class, tenantId, actorId)).isZero();
    }

    @AfterEach
    void cleanupWorkspaceRecords() {
        if (tenantId == null) return;
        tx.executeWithoutResult(status -> {
            for (String table : List.of("workspace_creation_requests", "workspace_activities", "workspace_audits", "workspace_outbox_events", "workspace_sections"))
                jdbc.update("DELETE FROM " + table + " WHERE workspace_id IN (SELECT id FROM workspaces WHERE tenant_id = ?)", tenantId);
            jdbc.update("DELETE FROM workspaces WHERE tenant_id = ?", tenantId);
        });
        assertCleanCreationState();
    }

    String token(String username) {
        var principal = userDetails.loadUserByUsername(username);
        return tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }
    String body() throws Exception { return body(projectId, teamId); }
    String body(Long project, Long team) throws Exception { return json.writeValueAsString(Map.of("projectId", project, "teamId", team)); }
    MvcResult create(String key, String payload) throws Exception {
        return mvc.perform(post("/api/workspaces").header("Authorization", "Bearer " + token)
                .header("X-Idempotency-Key", key).header("X-Correlation-ID", "acceptance-correlation")
                .contentType(MediaType.APPLICATION_JSON).content(payload)).andReturn();
    }
    JsonNode created(String key) throws Exception {
        var result = create(key, body());
        assertThat(result.getResponse().getStatus()).as(result.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).isEqualTo(201);
        return json.readTree(result.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
    }
    void confirm() throws Exception {
        mvc.perform(post("/api/workspaces/confirm").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(body())).andExpect(status().isOk());
    }
    Map<String, Long> creationCounts() {
        var counts = new LinkedHashMap<String, Long>();
        for (String table : List.of("workspaces", "workspace_sections", "workspace_audits", "workspace_outbox_events",
                "workspace_activities", "workspace_creation_requests"))
            counts.put(table, jdbc.queryForObject("SELECT COUNT(*) FROM " + table, Long.class));
        return counts;
    }

    Long unassignedTeam() {
        return unassignedTeam(true);
    }
    Long unassignedTeam(boolean withMember) {
        return tx.execute(status -> {
            Team team = new Team();
            team.setCode("UNASSIGNED-" + UUID.randomUUID()); team.setName("Unassigned " + UUID.randomUUID());
            team.setTenant(tenants.findById(tenantId).orElseThrow()); team.setMentor(users.findById(actorId).orElseThrow());
            teams.saveAndFlush(team);
            if (withMember) {
                TeamMember member = new TeamMember(); member.setTeam(team); member.setUser(users.findById(actorId).orElseThrow());
                members.saveAndFlush(member);
            }
            return team.getId();
        });
    }


    @Test void unassignedTeamChoosesAnyFreeProjectAndBindsOnlyOnCommit() throws Exception {
        tx.executeWithoutResult(status -> teams.findById(teamId).orElseThrow().setProject(null));
        Long unassigned = unassignedTeam();
        var before = creationCounts();
        mvc.perform(get("/api/workspaces/candidates").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.teamId == " + unassigned + ")].projectId").value(org.hamcrest.Matchers.contains(org.hamcrest.Matchers.nullValue())));
        mvc.perform(get("/api/workspaces/candidates/page").param("onlyUncreated", "true").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content[?(@.teamId == " + unassigned + ")].projectId").value(org.hamcrest.Matchers.contains(org.hamcrest.Matchers.nullValue())));
        mvc.perform(get("/api/workspaces/projects").param("teamId", unassigned.toString()).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.projectId == " + projectId + ")].name").value(org.hamcrest.Matchers.contains("Campus portal")));
        mvc.perform(post("/api/workspaces/confirm").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(body(projectId, unassigned)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.projectId").value(projectId)).andExpect(jsonPath("$.eligibleForWorkspace").value(true));
        tx.executeWithoutResult(status -> {
            assertThat(teams.findById(unassigned).orElseThrow().getProject()).isNull();
            assertThat(projects.findById(projectId).orElseThrow().getStatus()).isEqualTo(ProjectStatus.PLANNING);
        });
        assertThat(creationCounts()).isEqualTo(before);
        var created = create("bind-project", body(projectId, unassigned));
        assertThat(created.getResponse().getStatus()).isEqualTo(201);
        tx.executeWithoutResult(status -> {
            assertThat(teams.findById(unassigned).orElseThrow().getProject().getId()).isEqualTo(projectId);
            assertThat(projects.findById(projectId).orElseThrow().getStatus()).isEqualTo(ProjectStatus.ACTIVE);
        });
        mvc.perform(get("/api/workspaces/projects").param("teamId", teamId.toString()).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.projectId == " + projectId + ")]").isEmpty());
        assertThat(create("occupied-project", body()).getResponse().getStatus()).isEqualTo(422);
        assertThat(create("duplicate-team", body(projectId, unassigned)).getResponse().getStatus()).isEqualTo(409);
    }

    @Test void projectIsReservedForItsTeamEvenBeforeWorkspaceExists() throws Exception {
        Long otherTeam = unassignedTeam();
        var before = creationCounts();
        mvc.perform(get("/api/workspaces/projects").param("teamId", otherTeam.toString()).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.projectId == " + projectId + ")]").isEmpty());
        mvc.perform(post("/api/workspaces/confirm").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(body(projectId, otherTeam)))
                .andExpect(status().isUnprocessableEntity());
        assertThat(create("reserved-project", body(projectId, otherTeam)).getResponse().getStatus()).isEqualTo(422);
        assertThat(creationCounts()).isEqualTo(before);
        assertThatThrownBy(() -> tx.executeWithoutResult(status -> teams.findById(otherTeam).orElseThrow()
                .setProject(projects.findById(projectId).orElseThrow()))).isInstanceOf(DataIntegrityViolationException.class);
        tx.executeWithoutResult(status -> assertThat(teams.findById(otherTeam).orElseThrow().getProject()).isNull());
        assertThat(created("owner-project").get("projectId").asLong()).isEqualTo(projectId);
    }

    @Test void teamWithAssignedProjectCannotSelectAnotherProject() throws Exception {
        mvc.perform(get("/api/workspaces/projects").param("teamId", teamId.toString()).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].projectId").value(projectId));
        Long otherProject = tx.execute(status -> {
            Project project = new Project(); project.setName("Other project"); project.setCode("OTHER-" + UUID.randomUUID());
            project.setTenant(tenants.findById(tenantId).orElseThrow()); project.setStatus(ProjectStatus.PLANNING);
            return projects.saveAndFlush(project).getId();
        });
        mvc.perform(post("/api/workspaces/confirm").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(body(otherProject, teamId))).andExpect(status().isUnprocessableEntity());
        assertThat(create("replace-project", body(otherProject, teamId)).getResponse().getStatus()).isEqualTo(422);
    }

    @Test void emptyTeamCannotConfirmOrCreateWithProject() throws Exception {
        Long emptyTeam = unassignedTeam(false);
        tx.executeWithoutResult(status -> teams.findById(teamId).orElseThrow().setProject(null));
        var before = creationCounts();
        long projectCount = projects.count();
        mvc.perform(get("/api/workspaces/candidates").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.teamId == " + emptyTeam + ")].eligibleForWorkspace").value(org.hamcrest.Matchers.contains(false)));
        for (String payload : List.of(body(projectId, emptyTeam))) {
            mvc.perform(post("/api/workspaces/confirm").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON).content(payload))
                    .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("at least one active member")));
            assertThat(create(UUID.randomUUID().toString(), payload).getResponse().getStatus()).isEqualTo(422);
        }
        assertThat(projects.count()).isEqualTo(projectCount);
        assertThat(creationCounts()).isEqualTo(before);
        tx.executeWithoutResult(status -> assertThat(teams.findById(emptyTeam).orElseThrow().getProject()).isNull());
    }

    @Test void removingLastActiveMemberAfterConfirmationBlocksCreation() throws Exception {
        confirm();
        var before = creationCounts();
        tx.executeWithoutResult(status -> members.findById(membershipId).orElseThrow().setIsActive(false));
        tx.executeWithoutResult(status -> teams.findById(teamId).orElseThrow().setMentor(users.findById(actorId).orElseThrow()));
        assertThat(create("last-member-removed", body()).getResponse().getStatus()).isEqualTo(422);
        assertThat(creationCounts()).isEqualTo(before);
        tx.executeWithoutResult(status -> assertThat(projects.findById(projectId).orElseThrow().getStatus()).isEqualTo(ProjectStatus.PLANNING));
    }




    @Test void twoTeamsRacingForSameProjectProduceOnlyOneWorkspace() throws Exception {
        tx.executeWithoutResult(status -> teams.findById(teamId).orElseThrow().setProject(null));
        Long otherTeam = unassignedTeam();
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> { ready.countDown(); start.await(); return create("race-original", body()); });
            var second = executor.submit(() -> { ready.countDown(); start.await(); return create("race-other", body(projectId, otherTeam)); });
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            assertThat(List.of(first.get(20, TimeUnit.SECONDS).getResponse().getStatus(), second.get(20, TimeUnit.SECONDS).getResponse().getStatus()))
                    .containsExactlyInAnyOrder(201, 422);
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM workspaces WHERE project_id = ?", Long.class, projectId)).isEqualTo(1);
    }

    @Test
    void ac05ConfirmationReloadsSelectedPairAndWritesNothing() throws Exception {
        var before = creationCounts();
        mvc.perform(get("/api/workspaces/candidates").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].teamName").value("Atlas"));
        tx.executeWithoutResult(status -> teams.findById(teamId).orElseThrow().setName("Renamed after list"));
        mvc.perform(post("/api/workspaces/confirm").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(body()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.projectId").value(projectId))
                .andExpect(jsonPath("$.teamId").value(teamId)).andExpect(jsonPath("$.teamName").value("Renamed after list"))
                .andExpect(jsonPath("$.cohortName").value("SE18A")).andExpect(jsonPath("$.memberCount").value(1));
        assertThat(creationCounts()).isEqualTo(before);
    }

    @Test
    void ac06CreatesActiveProjectAndWorkspaceWithEightSectionsAndNoSampleData() throws Exception {
        Map<String, Long> before = new HashMap<>();
        for (String table : jdbc.queryForList("SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'PUBLIC' AND TABLE_TYPE = 'BASE TABLE'", String.class)) {
            if (!table.toLowerCase(Locale.ROOT).startsWith("workspace") && !table.equalsIgnoreCase("workspaces"))
                before.put(table, jdbc.queryForObject("SELECT COUNT(*) FROM \"" + table + "\"", Long.class));
        }
        var response = created(UUID.randomUUID().toString());
        long id = response.get("id").asLong();
        assertThat(response.get("status").asText()).isEqualTo("ACTIVE");
        assertThat(response.get("tenantId").asLong()).isEqualTo(tenantId);
        assertThat(response.get("createdBy").asLong()).isEqualTo(actorId);
        assertThat(response.get("createdAt").asText()).isNotBlank();
        assertThat(response.get("sections")).hasSize(8);
        tx.executeWithoutResult(status -> {
            assertThat(workspaces.findById(id).orElseThrow().getSections()).containsExactly(WorkspaceSection.values());
            assertThat(projects.findById(projectId).orElseThrow().getStatus()).isEqualTo(ProjectStatus.ACTIVE);
        });
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM workspace_sections WHERE workspace_id = ?", Long.class, id)).isEqualTo(8L);
        before.forEach((table, count) -> assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM \"" + table + "\"", Long.class)).as(table).isEqualTo(count));
        for (int refresh = 0; refresh < 2; refresh++) {
            mvc.perform(get("/api/workspaces/{id}", id).header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id))
                    .andExpect(jsonPath("$.sections.length()").value(8)).andExpect(jsonPath("$.member_count").value(1))
                    .andExpect(jsonPath("$.activities").isEmpty());
        }
        tx.executeWithoutResult(status -> members.findById(membershipId).orElseThrow().setIsActive(false));
        tx.executeWithoutResult(status -> teams.findById(teamId).orElseThrow().setMentor(users.findById(actorId).orElseThrow()));
        mvc.perform(get("/api/workspaces/{id}", id).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.member_count").value(0));
    }

    @Test
    void ac08DifferentKeyReturnsExistingWorkspaceAndDatabaseAlsoEnforcesUniqueness() throws Exception {
        long id = created("first").get("id").asLong();
        var before = creationCounts();
        var conflict = create("another", body());
        assertThat(conflict.getResponse().getStatus()).isEqualTo(409);
        var error = json.readTree(conflict.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8));
        assertThat(error.get("message").asText()).isEqualTo("This team already has a workspace");
        assertThat(error.get("workspaceId").asLong()).isEqualTo(id);
        assertThatThrownBy(() -> tx.executeWithoutResult(status -> {
            var original = workspaces.findById(id).orElseThrow();
            Workspace duplicate = new Workspace();
            duplicate.setTenant(original.getTenant()); duplicate.setProject(original.getProject()); duplicate.setTeam(original.getTeam());
            duplicate.setCode("DUPLICATE"); duplicate.setName("Duplicate"); duplicate.setStatus(WorkspaceStatus.ACTIVE);
            workspaces.saveAndFlush(duplicate);
        })).isInstanceOf(DataIntegrityViolationException.class);
        assertThat(creationCounts()).isEqualTo(before);
    }

    @Test
    void ac09ReplayIsDurableAndDifferentPayloadConflicts() throws Exception {
        assertCleanCreationState();
        var first = created("durable-key");
        var before = creationCounts();
        assertThat(created("durable-key")).isEqualTo(first);
        // A fresh service instance must recover the response solely from database records.
        var freshService = new WorkspaceIdempotencyService(requests, json);
        assertThat(freshService.response(freshService.find(tenantId, actorId, "durable-key")).getId()).isEqualTo(first.get("id").asLong());
        assertThat(create("durable-key", body(projectId, Long.MAX_VALUE)).getResponse().getStatus()).isEqualTo(409);
        assertThat(creationCounts()).isEqualTo(before);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void ac10ConcurrentRequestsProduceOnlyOneLogicalCreation(boolean sameKey) throws Exception {
        assertCleanCreationState();
        String payload = body();
        var ready = new CountDownLatch(2);
        var start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            List<Future<MvcResult>> futures = new ArrayList<>();
            for (int i = 0; i < 2; i++) {
                String key = sameKey ? "parallel-shared" : "parallel-" + i;
                futures.add(executor.submit(() -> {
                    ready.countDown();
                    if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Concurrent test start timed out");
                    return create(key, payload);
                }));
            }
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            var first = futures.get(0).get(20, TimeUnit.SECONDS);
            var second = futures.get(1).get(20, TimeUnit.SECONDS);
            assertThat(List.of(first.getResponse().getStatus(), second.getResponse().getStatus()))
                    .containsExactlyInAnyOrderElementsOf(sameKey ? List.of(201, 201) : List.of(201, 409));
            if (sameKey) assertThat(json.readTree(first.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8))).isEqualTo(json.readTree(second.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8)));
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM workspaces WHERE project_id = ? AND team_id = ?", Long.class, projectId, teamId)).isEqualTo(1L);
        long id = workspaces.findByProjectIdAndTeamId(projectId, teamId).orElseThrow().getId();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM workspace_creation_requests WHERE tenant_id = ? AND actor_id = ?", Long.class, tenantId, actorId)).isEqualTo(1L);
        assertThat(audits.findByWorkspaceId(id)).hasSize(1);
        assertThat(outbox.findByWorkspaceId(id)).hasSize(1);
        assertThat(activities.findByWorkspaceIdOrderByOccurredAtDesc(id)).hasSize(1);
    }

    @ParameterizedTest
    @ValueSource(strings = {"COMPLETED", "CANCELLED", "DRAFT"})
    void ac11RejectsProjectStatusChangedSinceConfirmation(String status) throws Exception {
        confirm();
        var before = creationCounts();
        tx.executeWithoutResult(transaction -> projects.findById(projectId).orElseThrow().setStatus(ProjectStatus.valueOf(status)));
        assertThat(create("changed-status", body()).getResponse().getStatus()).isEqualTo(409);
        assertThat(creationCounts()).isEqualTo(before);
    }

    @ParameterizedTest
    @ValueSource(strings = {"TENANT", "PERMISSION", "SCOPE", "ACCOUNT", "ROLE"})
    void ac11RechecksRevocationSinceConfirmation(String change) throws Exception {
        confirm();
        var before = creationCounts();
        tx.executeWithoutResult(status -> {
            switch (change) {
                case "TENANT" -> tenants.findById(tenantId).orElseThrow().setActive(false);
                case "PERMISSION" -> roles.findById(roleId).orElseThrow().getPermissions().clear();
                case "SCOPE" -> members.deleteById(membershipId);
                case "ACCOUNT" -> users.findById(actorId).orElseThrow().setIsActive(false);
                case "ROLE" -> roles.findById(roleId).orElseThrow().setIsActive(false);
            }
        });
        assertThat(create("revoked", body()).getResponse().getStatus()).isEqualTo(403);
        assertThat(creationCounts()).isEqualTo(before);
    }

    @Test
    void ac11ExpiredSessionIs401AndWritesNothing() throws Exception {
        confirm();
        var before = creationCounts();
        token = encoder.encode(JwtEncoderParameters.from(JwtClaimsSet.builder().subject(email)
                .issuedAt(Instant.now().minusSeconds(7200)).expiresAt(Instant.now().minusSeconds(3600))
                .claim("type", "access").build())).getTokenValue();
        assertThat(create("expired", body()).getResponse().getStatus()).isEqualTo(401);
        assertThat(creationCounts()).isEqualTo(before);
    }

    @ParameterizedTest
    @ValueSource(strings = {"TEAM", "PROJECT"})
    void ac11MissingTargetIs404(String target) throws Exception {
        confirm();
        var before = creationCounts();
        tx.executeWithoutResult(status -> {
            members.deleteById(membershipId);
            teams.deleteById(teamId); teams.flush();
            if ("PROJECT".equals(target)) projects.deleteById(projectId);
        });
        assertThat(create("removed", body()).getResponse().getStatus()).isEqualTo(404);
        assertThat(creationCounts()).isEqualTo(before);
    }

    @Test
    void ac11InvalidSelection422AndForeignTenant403() throws Exception {
        confirm();
        var before = creationCounts();
        Long otherProject = tx.execute(status -> {
            var original = projects.findById(projectId).orElseThrow();
            Project project = new Project();
            project.setName("Other"); project.setCode("OTHER"); project.setTenant(original.getTenant()); project.setStatus(ProjectStatus.ACTIVE);
            return projects.saveAndFlush(project).getId();
        });
        assertThat(create("invalid-selection", body(otherProject, teamId)).getResponse().getStatus()).isEqualTo(422);
        tx.executeWithoutResult(status -> {
            var foreign = tenants.saveAndFlush(Tenant.builder().code("OTHER-" + UUID.randomUUID()).name("Other").build());
            projects.findById(projectId).orElseThrow().setTenant(foreign);
            teams.findById(teamId).orElseThrow().setTenant(foreign);
        });
        assertThat(create("foreign-tenant", body()).getResponse().getStatus()).isEqualTo(403);
        assertThat(creationCounts()).isEqualTo(before);
    }

    @ParameterizedTest
    @ValueSource(strings = {"WORKSPACE", "SECTIONS", "AUDIT", "OUTBOX", "ACTIVITY", "IDEMPOTENCY"})
    void ac12MandatorySaveFailureRollsEverythingBackAndSameKeyCanRetry(String step) throws Exception {
        confirm();
        var before = creationCounts();
        var failure = new IllegalStateException("Injected mandatory save failure");
        switch (step) {
            case "WORKSPACE" -> doThrow(failure).when(workspaces).saveAndFlush(any(Workspace.class));
            case "SECTIONS" -> doAnswer(invocation -> {
                WorkspaceAudit audit = invocation.getArgument(0);
                jdbc.update("INSERT INTO workspace_sections (workspace_id, display_order, section) VALUES (?, 99, 'OVERVIEW')", audit.getWorkspaceId());
                return null;
            }).when(audits).saveAndFlush(any(WorkspaceAudit.class));
            case "AUDIT" -> doThrow(failure).when(audits).saveAndFlush(any(WorkspaceAudit.class));
            case "OUTBOX" -> doThrow(failure).when(outbox).saveAndFlush(any(WorkspaceOutboxEvent.class));
            case "ACTIVITY" -> doThrow(failure).when(activities).saveAndFlush(any(WorkspaceActivity.class));
            case "IDEMPOTENCY" -> doThrow(failure).when(requests).saveAndFlush(any(WorkspaceCreationRequest.class));
        }
        assertThat(create("retry-after-rollback", body()).getResponse().getStatus()).isEqualTo(500);
        assertThat(creationCounts()).isEqualTo(before);
        tx.executeWithoutResult(status -> assertThat(projects.findById(projectId).orElseThrow().getStatus()).isEqualTo(ProjectStatus.PLANNING));
        reset(workspaces, audits, outbox, activities, requests);
        assertThat(created("retry-after-rollback").get("status").asText()).isEqualTo("ACTIVE");
    }

    @Test
    void ac12AuditHasFullContextAndOutboxRedeliveryNeverDuplicatesActivity() throws Exception {
        var response = created("audit");
        long id = response.get("id").asLong();
        var audit = audits.findByWorkspaceId(id).getFirst();
        assertThat(audit.getActorId()).isEqualTo(actorId);
        assertThat(audit.getTenantId()).isEqualTo(tenantId);
        assertThat(audit.getProjectId()).isEqualTo(projectId);
        assertThat(audit.getTeamId()).isEqualTo(teamId);
        assertThat(audit.getCreatedAt()).isNotNull();
        assertThat(audit.getAction()).isEqualTo("WORKSPACE_CREATED");
        assertThat(audit.getCorrelationId()).isEqualTo("acceptance-correlation");
        assertThat(audit.getBeforeJson()).isEqualTo("null");
        assertThat(json.readTree(audit.getAfterJson())).isEqualTo(response);
        var event = outbox.findByWorkspaceId(id).getFirst();
        assertThat(event.getEventId()).isEqualTo(audit.getEventId());
        delivery.deliver(event.getId());
        tx.executeWithoutResult(status -> outbox.findById(event.getId()).orElseThrow().setDeliveredAt(null));
        delivery.deliver(event.getId());
        delivery.deliver(event.getId());
        assertThat(activities.findByWorkspaceIdOrderByOccurredAtDesc(id)).hasSize(1);
        assertThat(outbox.findById(event.getId()).orElseThrow().getDeliveredAt()).isNotNull();
        mvc.perform(get("/api/workspaces/{id}/activity", id).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].id").value(event.getEventId()))
                .andExpect(jsonPath("$.items[0].description").value("Workspace Creator"));
    }

    @Test
    void ac01And02ScopeFiltersAndCountsAgreeWithoutDuplicates() throws Exception {
        Long outside = tx.execute(status -> {
            var team = teams.findById(teamId).orElseThrow();
            Team other = new Team();
            other.setName("Outside"); other.setCode("OUT"); other.setTenant(team.getTenant());
            return teams.saveAndFlush(other).getId();
        });
        mvc.perform(get("/api/workspaces/candidates/page").param("size", "1").param("cohortId", cohortId.toString())
                        .param("onlyUncreated", "true").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content.length()").value(1)).andExpect(jsonPath("$.content[0].teamId").value(teamId));
        created("filters");
        mvc.perform(get("/api/workspaces/candidates/page").param("cohortId", cohortId.toString())
                        .param("onlyUncreated", "true").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get("/api/workspaces/candidates").param("workspaceStatus", "ACTIVE").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].teamId").value(teamId));
        assertThat(outside).isNotEqualTo(teamId);
    }

    @ParameterizedTest
    @ValueSource(strings = {"0", "-1", "101", "200000", "bad"})
    void ac02InvalidPageSizeIs422(String size) throws Exception {
        mvc.perform(get("/api/workspaces/candidates/page").param("size", size).header("Authorization", "Bearer " + token))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("size")));
    }

    @Test
    void ac04ReadOnlyCannotCreateAndCreateOnlyConflictDoesNotExposeWorkspaceId() throws Exception {
        long id = created("permissions").get("id").asLong();
        tx.executeWithoutResult(status -> roles.findById(roleId).orElseThrow().getPermissions()
                .removeIf(permission -> permission.getName().equals("CREATE_PROJECT_WORKSPACE")));
        assertThat(create("reader", body()).getResponse().getStatus()).isEqualTo(403);
        tx.executeWithoutResult(status -> {
            var role = roles.findById(roleId).orElseThrow();
            role.setPermissions(new HashSet<>(List.of(permissions.findByName("CREATE_PROJECT_WORKSPACE").orElseThrow())));
        });
        var conflict = create("creator-only", body());
        assertThat(conflict.getResponse().getStatus()).isEqualTo(409);
        assertThat(json.readTree(conflict.getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8)).get("workspaceId").isNull()).isTrue();
        mvc.perform(get("/api/workspaces/{id}", id).header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    }

    @Test
    void assignedMentorCanCreateWithoutBeingATeamMember() throws Exception {
        tx.executeWithoutResult(status -> {
            members.deleteById(membershipId);
            var team = teams.findById(teamId).orElseThrow();
            team.setMentor(users.findById(actorId).orElseThrow());
            User teammate = new User(); teammate.setEmail(UUID.randomUUID() + "@teammate.test"); teammate.setFirstName("Active"); teammate.setLastName("Member");
            teammate.setTenant(team.getTenant()); teammate.setPasswordHash("unused"); users.saveAndFlush(teammate);
            TeamMember member = new TeamMember(); member.setTeam(team); member.setUser(teammate); members.saveAndFlush(member);
        });
        mvc.perform(get("/api/workspaces/candidates").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].teamId").value(teamId));
        confirm();
        assertThat(created("assigned-mentor").get("teamId").asLong()).isEqualTo(teamId);
    }

    @Test
    void missingKeyAndInvalidIdsAre422AndWriteNothing() throws Exception {
        var before = creationCounts();
        mvc.perform(post("/api/workspaces").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content(body())).andExpect(status().isUnprocessableEntity());
        mvc.perform(post("/api/workspaces/confirm").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"projectId\":0}")).andExpect(status().isUnprocessableEntity());
        assertThat(creationCounts()).isEqualTo(before);
    }
}
~~~

## Phase 6 — backend/src/test/java/com/example/starter_project_2025/system/project/WorkspaceSectionsIntegrationTest.java

Tạo file mới. 13 integration cases verify actual HTTP security, mock isolation and read-only navigation.

Đích: `D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/backend/src/test/java/com/example/starter_project_2025/system/project/WorkspaceSectionsIntegrationTest.java`

~~~java
package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = "app.workspace.sections.mock-controls.enabled=true")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class WorkspaceSectionsIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired TransactionTemplate tx;
    @Autowired JdbcTemplate jdbc;
    @Autowired TenantRepository tenants;
    @Autowired UserRepository users;
    @Autowired RoleRepository roles;
    @Autowired PermissionRepository permissions;
    @Autowired ProjectRepository projects;
    @Autowired TeamRepository teams;
    @Autowired TeamMemberRepository memberships;
    @Autowired ProjectTopicSnapshotRepository snapshots;
    @Autowired UserDetailsService userDetails;
    @Autowired RefreshTokenService tokens;
    @Autowired MockWorkspaceSectionDataSource mock;
    @Autowired WorkspaceRepository workspaces;
    Long tenantId, actorId, roleId, projectId, teamId, membershipId, workspaceId;
    String token;

    @BeforeEach
    void fixture() throws Exception {
        tx.executeWithoutResult(status -> {
            var tenant = tenants.saveAndFlush(Tenant.builder()
                    .code("US02-" + UUID.randomUUID()).name("US02 test tenant").build());
            tenantId = tenant.getId();
            var role = new Role();
            role.setName("US02-" + UUID.randomUUID());
            role.setPermissions(new HashSet<>(permissions.findAll()));
            roleId = roles.saveAndFlush(role).getId();
            var user = new User();
            user.setEmail(UUID.randomUUID() + "@us02.test");
            user.setFirstName("Workspace"); user.setLastName("Reader");
            user.setUserCode("MEM-" + UUID.randomUUID());
            user.setPasswordHash("unused-test-password");
            user.setTenant(tenant); user.setRoles(new HashSet<>(Set.of(role)));
            actorId = users.saveAndFlush(user).getId();
            var project = new Project();
            project.setCode("PROJECT-" + UUID.randomUUID()); project.setName("Project A");
            project.setDescription("Live project description");
            project.setTenant(tenant); project.setStatus(ProjectStatus.PLANNING);
            projectId = projects.saveAndFlush(project).getId();
            var team = new Team();
            team.setCode("TEAM-" + UUID.randomUUID()); team.setName("Team A");
            team.setTenant(tenant); team.setProject(project); team.setMentor(user);
            teamId = teams.saveAndFlush(team).getId();
            var membership = new TeamMember();
            membership.setTeam(team); membership.setUser(user);
            membershipId = memberships.saveAndFlush(membership).getId();
            var principal = userDetails.loadUserByUsername(user.getEmail());
            token = tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(
                    principal, null, principal.getAuthorities()));
        });
        var created = mvc.perform(post("/api/workspaces")
                .header("Authorization", "Bearer " + token)
                .header("X-Idempotency-Key", UUID.randomUUID().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("projectId", projectId, "teamId", teamId))))
                .andExpect(status().isCreated()).andReturn();
        workspaceId = json.readTree(created.getResponse().getContentAsString()).get("id").asLong();
    }


    WorkspaceSectionDtos.Scope scope() {
        return new WorkspaceSectionDtos.Scope(tenantId, workspaceId, projectId, teamId);
    }
    JsonNode read(String path) throws Exception {
        return json.readTree(mvc.perform(get("/api/workspaces/" + workspaceId + path)
                .header("Authorization", "Bearer " + token)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }
    void grant(String... names) {
        tx.executeWithoutResult(status -> roles.findById(roleId).orElseThrow().setPermissions(
                new HashSet<>(Arrays.stream(names).map(name -> permissions.findByName(name).orElseThrow()).toList())));
    }
    void student() {
        grant("WORKSPACE_READ", "WORKSPACE_MEMBER_READ", "MILESTONE_READ", "SPRINT_READ", "TASK_WRITE",
                "ARTIFACT_READ", "ARTIFACT_SUBMIT", "FEEDBACK_READ", "WORKSPACE_ACTIVITY_READ");
    }
    void teacher() {
        grant("WORKSPACE_READ", "WORKSPACE_MEMBER_READ", "MILESTONE_READ", "MILESTONE_WRITE",
                "SPRINT_READ", "SPRINT_WRITE", "ARTIFACT_READ", "ARTIFACT_WRITE",
                "ARTIFACT_REVIEW", "FEEDBACK_READ", "FEEDBACK_WRITE", "WORKSPACE_ACTIVITY_READ");
    }
    void postItem(String path, int expected) throws Exception {
        mvc.perform(post("/api/workspaces/" + workspaceId + path)
                .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"New item\",\"description\":\"Explicit action\",\"published\":true}"))
                .andExpect(status().is(expected));
    }
    void review(String kind, String targetId, int expected) throws Exception {
        mvc.perform(post("/api/workspaces/" + workspaceId + "/reviews")
                .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("kind", kind, "targetId", targetId,
                        "comment", "Review comments", "score", 9, "published", false))))
                .andExpect(status().is(expected));
    }

    @Test void ac01And02AllDirectSectionApisUseWorkspaceContext() throws Exception {
        mock.seed(scope());
        var navigation = read("/sections");
        assertThat(navigation.get("sections")).hasSize(8);
        for (String key : List.of("milestones", "sprints", "backlog", "artifacts", "feedback", "activity")) {
            var body = read("/" + key);
            assertThat(body.get("workspaceId").asLong()).isEqualTo(workspaceId);
            assertThat(body.get("projectId").asLong()).isEqualTo(projectId);
            assertThat(body.get("teamId").asLong()).isEqualTo(teamId);
            assertThat(body.get("section").asText()).isEqualTo(key);
            assertThat(body.get("items").isArray()).isTrue();
        }
    }
    @Test void ac03UnseededSectionsAreValidEmptyArrays() throws Exception {
        for (String key : List.of("milestones", "sprints", "backlog", "artifacts", "feedback"))
            assertThat(read("/" + key).get("items")).isEmpty();
        assertThat(mock.size(scope())).isZero();
    }
    @Test void ac04SectionDenialPrecedesMockAndAggregateContainsNoActivity() throws Exception {
        mock.seed(scope());
        mock.configure(scope(), WorkspaceSection.MILESTONE,
                new WorkspaceSectionDtos.MockControl(WorkspaceSectionDtos.MockMode.ERROR, 0));
        grant("WORKSPACE_READ");
        assertThat(read("").get("activities").isNull()).isTrue();
        var sections = read("/sections").get("sections");
        assertThat(sections.get(2).get("canRead").asBoolean()).isFalse();
        assertThat(sections.get(7).get("canRead").asBoolean()).isFalse();
        for (String key : List.of("members", "milestones", "sprints", "backlog", "artifacts", "feedback", "activity"))
            mvc.perform(get("/api/workspaces/" + workspaceId + "/" + key)
                    .header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    }
    @Test void ac04StudentsNeverReceiveDraftMilestonesOrDraftScores() throws Exception {
        mock.seed(scope()); student();
        for (String key : List.of("milestones", "feedback")) {
            var items = read("/" + key).get("items");
            assertThat(items).hasSize(1);
            assertThat(items.get(0).get("published").asBoolean()).isTrue();
        }
        assertThat(read("/feedback").at("/items/0/score").asDouble()).isEqualTo(8.0);
        assertThat(read("").get("activities").isNull()).isTrue();
    }
    @Test void ac05StudentCanWriteTasksAndSubmitButCannotCreateOrReviewStaffItems() throws Exception {
        mock.seed(scope()); student();
        for (String key : List.of("/milestones", "/sprints", "/artifacts", "/feedback")) postItem(key, 403);
        postItem("/tasks", 201);
        postItem("/artifacts/submit", 201);
        review("ARTIFACT", "artifacts-" + workspaceId + "-published", 403);
        review("MILESTONE", "milestones-" + workspaceId + "-published", 403);
        review("SPRINT", "sprints-" + workspaceId + "-published", 403);
        String taskId = read("/backlog").at("/items/0/id").asText();
        mvc.perform(put("/api/workspaces/" + workspaceId + "/tasks/" + taskId)
                .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Updated task\",\"published\":true}")).andExpect(status().isOk());
        assertThat(read("/backlog").at("/items/0/title").asText()).isEqualTo("Updated task");
    }
    @Test void ac05TeacherWritesAndBothReviewTypesWorkButSubmissionRequiresSeparatePermission() throws Exception {
        mock.seed(scope()); teacher();
        for (String key : List.of("/milestones", "/sprints", "/tasks", "/artifacts", "/feedback")) postItem(key, 201);
        postItem("/artifacts/submit", 403);
        review("ARTIFACT", "artifacts-" + workspaceId + "-published", 201);
        review("MILESTONE", "milestones-" + workspaceId + "-published", 201);
        review("SPRINT", "sprints-" + workspaceId + "-published", 201);
        // Either ARTIFACT_REVIEW or FEEDBACK_WRITE is sufficient, still requiring ARTIFACT_READ.
        grant("WORKSPACE_READ", "ARTIFACT_READ", "FEEDBACK_WRITE");
        review("ARTIFACT", "artifacts-" + workspaceId + "-published", 201);
        grant("WORKSPACE_READ", "ARTIFACT_READ", "ARTIFACT_REVIEW");
        review("ARTIFACT", "artifacts-" + workspaceId + "-published", 201);
    }
    @Test void ac05ReadOnlyUsersCannotInvokeAnyWriteEndpoint() throws Exception {
        grant("WORKSPACE_READ", "MILESTONE_READ", "SPRINT_READ", "ARTIFACT_READ", "FEEDBACK_READ");
        for (String key : List.of("/milestones", "/sprints", "/tasks", "/artifacts", "/artifacts/submit", "/feedback"))
            postItem(key, 403);
        review("ARTIFACT", "any", 403);
        mvc.perform(put("/api/workspaces/" + workspaceId + "/tasks/any")
                .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Forbidden edit\"}")).andExpect(status().isForbidden());
    }
    @Test void ac06ForeignWorkspaceTargetsCannotBeReadOrReviewedThroughCurrentContext() throws Exception {
        mock.seed(scope());
        var foreignScope = new WorkspaceSectionDtos.Scope(tenantId, workspaceId + 100000, projectId + 100000, teamId + 100000);
        mock.seed(foreignScope);
        review("ARTIFACT", "artifacts-" + foreignScope.workspaceId() + "-published", 404);
        assertThat(read("/artifacts").get("items").toString()).doesNotContain("workspace " + foreignScope.workspaceId());
        mvc.perform(put("/api/workspaces/" + workspaceId + "/tasks/backlog-" + foreignScope.workspaceId() + "-published")
                .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Cross context edit\"}")).andExpect(status().isNotFound());
    }
    @Test void ac07ErrorAndEmptyControlsStayInsideOneSection() throws Exception {
        mock.seed(scope());
        for (var mode : List.of(WorkspaceSectionDtos.MockMode.ERROR, WorkspaceSectionDtos.MockMode.NOT_FOUND)) {
            mock.configure(scope(), WorkspaceSection.MILESTONE, new WorkspaceSectionDtos.MockControl(mode, 0));
            mvc.perform(get("/api/workspaces/" + workspaceId + "/milestones")
                    .header("Authorization", "Bearer " + token))
                    .andExpect(status().is(mode == WorkspaceSectionDtos.MockMode.ERROR ? 500 : 404))
                    .andExpect(jsonPath("$.correlationId").isNotEmpty());
            assertThat(read("/sprints").get("items")).hasSize(2);
            assertThat(read("").get("id").asLong()).isEqualTo(workspaceId);
        }
        mock.configure(scope(), WorkspaceSection.MILESTONE,
                new WorkspaceSectionDtos.MockControl(WorkspaceSectionDtos.MockMode.EMPTY, 0));
        assertThat(read("/milestones").get("items")).isEmpty();
    }
    @Test void ac08SameTokenReflectsPermissionAndAssignmentRevocation() throws Exception {
        mock.seed(scope());
        read("/feedback");
        tx.executeWithoutResult(status -> roles.findById(roleId).orElseThrow().getPermissions()
                .removeIf(permission -> permission.getName().equals("FEEDBACK_READ")));
        mvc.perform(get("/api/workspaces/" + workspaceId + "/feedback")
                .header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        assertThat(read("/sections").get("sections").get(6).get("canRead").asBoolean()).isFalse();
        tx.executeWithoutResult(status -> {
            teams.findById(teamId).orElseThrow().setMentor(null);
            memberships.findById(membershipId).orElseThrow().setParticipationStatus(ParticipationStatus.LEFT);
        });
        mvc.perform(get("/api/workspaces/" + workspaceId + "/sprints")
                .header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        mvc.perform(get("/api/workspaces/" + workspaceId + "/sections")
                .header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    }
    @Test void ac02AuthenticationTenantAndNotFoundAreRechecked() throws Exception {
        mvc.perform(get("/api/workspaces/" + workspaceId + "/milestones")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/workspaces/" + workspaceId + "/milestones")
                .header("Authorization", "Bearer invalid-token")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/workspaces/9223372036854775806/milestones")
                .header("Authorization", "Bearer " + token)).andExpect(status().isNotFound());
        tx.executeWithoutResult(status -> tenants.findById(tenantId).orElseThrow().setActive(false));
        mvc.perform(get("/api/workspaces/" + workspaceId + "/milestones")
                .header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
    }
    @Test void ac09NavigationDoesNotCreateOrChangeBusinessData() throws Exception {
        mock.seed(scope());
        long rows = mock.size(scope()), workspaceCount = workspaces.count(), memberCount = memberships.count();
        long activityCount = jdbc.queryForObject("select count(*) from workspace_activities", Long.class);
        for (int repeat = 0; repeat < 2; repeat++) {
            read("/sections"); read(""); read("/members");
            for (String key : List.of("milestones", "sprints", "backlog", "artifacts", "feedback", "activity")) read("/" + key);
        }
        assertThat(mock.size(scope())).isEqualTo(rows);
        assertThat(workspaces.count()).isEqualTo(workspaceCount);
        assertThat(memberships.count()).isEqualTo(memberCount);
        assertThat(jdbc.queryForObject("select count(*) from workspace_activities", Long.class)).isEqualTo(activityCount);
        assertThat(projects.findById(projectId).orElseThrow().getStatus()).isEqualTo(ProjectStatus.ACTIVE);
    }
    @Test void localMockControlsRequireAdminAndDoNotGrantSectionAccess() throws Exception {
        mvc.perform(put("/api/workspaces/" + workspaceId + "/mock-sections/milestones")
                .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"mode\":\"DATA\",\"delayMs\":0}")).andExpect(status().isForbidden());
        tx.executeWithoutResult(status -> users.findById(actorId).orElseThrow().getRoles()
                .add(roles.findByName("ADMIN").orElseThrow()));
        mvc.perform(put("/api/workspaces/" + workspaceId + "/mock-sections/milestones")
                .header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"mode\":\"DATA\",\"delayMs\":0}")).andExpect(status().isOk());
        assertThat(read("/milestones").get("items")).hasSize(2);
    }
}
~~~

## Phase 6 — backend/src/test/java/com/example/starter_project_2025/system/project/WorkspacePersistenceIntegrationTest.java

Sửa file hiện có. Giữ kiểm thử persistence của lịch sử sau khi tách Activity API.

Đích: `D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10/backend/src/test/java/com/example/starter_project_2025/system/project/WorkspacePersistenceIntegrationTest.java`

~~~java
package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.StarterProject2025Application;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.support.GenericWebApplicationContext;
import org.springframework.mock.web.MockServletContext;
import java.nio.file.Path;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.assertj.core.api.Assertions.assertThat;

class WorkspacePersistenceIntegrationTest {
    @TempDir Path storage;

    private ConfigurableApplicationContext boot() {
        return new SpringApplicationBuilder(StarterProject2025Application.class).contextFactory(type -> {
            var context = new GenericWebApplicationContext();
            context.setServletContext(new MockServletContext());
            return context;
        }).run("--spring.profiles.active=test",
                "--spring.datasource.url=jdbc:h2:file:" + storage.resolve("workspace").toAbsolutePath().toString().replace('\\', '/'),
                "--spring.jpa.hibernate.ddl-auto=update", "--logging.level.root=WARN");
    }

    private void authenticate(ConfigurableApplicationContext context) {
        var principal = context.getBean(UserDetailsService.class).loadUserByUsername("admin@example.com");
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    @Test
    void workspaceSectionsAuditActivityAndIdempotencySurviveBackendRestart() {
        WorkspaceCreateRequest payload = new WorkspaceCreateRequest();
        WorkspaceResponse first;
        String key = UUID.randomUUID().toString();
        try (var context = boot()) {
            context.getBean(TransactionTemplate.class).executeWithoutResult(status -> {
                var tenant = context.getBean(UserRepository.class).findByEmail("admin@example.com").orElseThrow().getTenant();
                Project project = new Project();
                project.setCode("RESTART"); project.setName("Persistent project"); project.setStatus(ProjectStatus.ACTIVE); project.setTenant(tenant);
                context.getBean(ProjectRepository.class).saveAndFlush(project);
                Team team = new Team();
                team.setCode("RESTART"); team.setName("Persistent team"); team.setProject(project); team.setTenant(tenant);
                context.getBean(TeamRepository.class).saveAndFlush(team);
                TeamMember member = new TeamMember(); member.setTeam(team);
                member.setUser(context.getBean(UserRepository.class).findByEmail("admin@example.com").orElseThrow());
                context.getBean(TeamMemberRepository.class).saveAndFlush(member);
                payload.setProjectId(project.getId()); payload.setTeamId(team.getId());
            });
            authenticate(context);
            first = context.getBean(WorkspaceService.class).createWorkspace(key, payload);
            // Simulate the old schema and an already-created workspace whose project remained Planning.
            context.getBean(JdbcTemplate.class).update("UPDATE projects SET status = 'PLANNING' WHERE id = ?", payload.getProjectId());
            context.getBean(JdbcTemplate.class).execute("ALTER TABLE teams ALTER COLUMN project_id SET NOT NULL");
        } finally { SecurityContextHolder.clearContext(); }

        try (var context = boot()) {
            authenticate(context);
            var service = context.getBean(WorkspaceService.class);
            var detail = service.getWorkspace(first.getId());
            assertThat(detail.getSections()).hasSize(8);
            assertThat(detail.getActivities()).isNull();
            assertThat(context.getBean(WorkspaceSectionService.class).read(first.getId(), "activity").items()).hasSize(1);
            assertThat(detail.getStatus()).isEqualTo(WorkspaceStatus.ACTIVE);
            assertThat(detail.getProjectStatus()).isEqualTo(ProjectStatus.ACTIVE);
            assertThat(service.createWorkspace(key, payload)).isEqualTo(first);
            assertThat(context.getBean(WorkspaceAuditRepository.class).findByWorkspaceId(first.getId())).hasSize(1);
            assertThat(context.getBean(WorkspaceOutboxRepository.class).findByWorkspaceId(first.getId())).hasSize(1);
            assertThat(context.getBean(WorkspaceRepository.class).count()).isEqualTo(1);
            context.getBean(TransactionTemplate.class).executeWithoutResult(status -> {
                Team unassigned = new Team();
                unassigned.setCode("UNASSIGNED-AFTER-UPGRADE"); unassigned.setName("No project after upgrade");
                unassigned.setTenant(context.getBean(UserRepository.class).findByEmail("admin@example.com").orElseThrow().getTenant());
                context.getBean(TeamRepository.class).saveAndFlush(unassigned);
                assertThat(unassigned.getProject()).isNull();
            });
        } finally { SecurityContextHolder.clearContext(); }
    }


}
~~~
