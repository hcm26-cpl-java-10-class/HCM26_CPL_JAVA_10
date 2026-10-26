# Hướng dẫn US-PRJ-001-02 — Overview và Members

**Cập nhật 24/10/2026:** tài liệu này mô tả kiến trúc/bản triển khai ban đầu. Luồng hiện tại dùng account admin/teacher/student sẵn có, chỉ có menu Workspace và quản lý roster ngay trong tab Members. Hãy xem README.md và MANUAL_TEST_AC01_AC10.md để sử dụng/kiểm thử bản mới; không chép lại các code block cũ để ghi đè source hiện tại.

Code US-PRJ-001-02 đã được áp dụng vào source chính theo yêu cầu của bạn. Tài liệu này giải thích từng file và luồng xử lý để bạn đọc lại; không cần chép code thêm lần nữa. Kết quả kiểm tra source chính nằm trong VERIFICATION.md. Các thay đổi tổ chức thư mục đang có của bạn được giữ nguyên.

Repository gốc: D:/SE172316/Semeter 6/HCM26_CPL_JAVA_10.

## Quy tắc đã chốt

- Snapshot do Curriculum clone khi gán đề bài cho Project; Workspace chỉ đọc bản snapshot đó.
- Snapshot có topic_code, topic_title, version, description, objectives, requirements và attachments.
- Chọn lưu requirements bằng JSON mảng chuỗi; attachments bằng JSON mảng đối tượng name/url.
- User.user_code nullable và unique, không dùng email làm mã và không tự sinh mã giả trong response.
- Project role: UNASSIGNED, TEAM_LEADER, DEV, FE_DEV, BE_DEV, BA, QA, TESTER.
- Trạng thái: ACTIVE, INACTIVE, LEFT. Tab Members chỉ trả ACTIVE còn hiệu lực.
- WORKSPACE_READ cho Overview và member_count; WORKSPACE_MEMBER_READ cho chi tiết Members.
- API Members chỉ trả user_code, display_name, project_role, status.
- Việc thêm, sửa, rời team thuộc Module Management Team. Bản 24/10 bổ sung TeamMembershipService và API /api/project-hub/teams/{id}/members/{userId} cho thao tác quản lý được yêu cầu; các API GET của Workspace vẫn chỉ đọc.
- Lịch sử hoạt động không bị xóa khi một membership rời team.
- Các thao tác GET không tạo snapshot, tạo workspace, tự thêm thành viên hoặc đổi trạng thái project.

## Trước khi bắt đầu

1. Lưu các thay đổi bạn đang có. Bạn đang ở nhánh feature/Project-L; commit US01 là dbf39c0.
2. Không reset hoặc ghi đè các thay đổi tổ chức thư mục của bạn. Các đường dẫn bên dưới phản ánh những file đã được chuyển vào domain/dto/service tại thời điểm soạn.
3. Mở file bằng Ctrl+P trong VS Code và tìm tên file nếu bạn vừa đổi vị trí của nó.
4. Đọc giải thích trước mỗi file. Code đã giữ package hiện có; không tự đổi package theo tên thư mục.
5. Các nhóm DTO/service phụ thuộc nhau; kiểm tra compile backend sau khi hoàn tất bước 1–4.

## Contract API

Overview:

```http
GET /api/workspaces/{id}
Authorization: Bearer <token>
```

Ngoài các trường Project/Team hiện có, response thêm member_count, can_view_members và topic_snapshot; bỏ members. can_view_members giúp frontend phân biệt thiếu quyền với danh sách rỗng.

Members:

```http
GET /api/workspaces/{id}/members
Authorization: Bearer <token>
```

Ví dụ response:

```json
[
  {
    "user_code": "SE171828",
    "display_name": "Taylor Member",
    "project_role": "FE_DEV",
    "status": "ACTIVE"
  }
]
```

WORKSPACE_READ nhưng thiếu WORKSPACE_MEMBER_READ: Overview trả 200 và member_count; /members trả 403. Không đăng nhập: 401. Ngoài scope/tenant không hoạt động: 403. Workspace không tồn tại: 404.


## Bước 1 — Bổ sung schema và enum

Làm nhóm này trước. Các file trong module Project hiện vẫn khai báo cùng package com.example.starter_project_2025.system.project dù được chia thư mục. Giữ đúng package đó trong code bên dưới. User.java giữ package RBAC đang có.

### 1.1 — Thêm mã người dùng

**Sửa file hiện có:** `backend/src/main/java/com/example/starter_project_2025/system/rbac/user/User.java`

user_code nullable để dữ liệu cũ vẫn đọc được; unique ngăn dùng trùng mã. Không tạo mã giả từ User ID.

```java
package com.example.starter_project_2025.system.rbac.user;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportHash;
import com.example.starter_project_2025.base.dataio.template.annotation.ImportEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.project.Tenant;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

import java.util.HashSet;
import java.util.Set;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "users")
@FieldDefaults(level = AccessLevel.PRIVATE)
@ImportEntity("user")
@ExportEntity(fileName = "users", sheetName = "Users")
@ResourcePermission("USER")
@ResourceMenu(
        title = "Users",
        group = "RBAC Management",
        icon = "users",
        url = "/users",
        order = 1,
        permission = "USER_READ"
)
public class User extends BaseEntity {

    @Column(unique = true, nullable = false)
    @ImportField(name = "Email", required = true)
    @ExportField(name = "Email")
    String email;

    @Column(name = "user_code", unique = true, length = 64)
    String userCode;

    @Column(nullable = false)
    @ImportHash
    @ImportField(name = "Password", required = true)
    String passwordHash;

    @Column(nullable = false, length = 100)
    @ImportField(name = "First Name", required = true)
    @ExportField(name = "First Name")
    String firstName;

    @Column(length = 100)
    String lastName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id")
    Tenant tenant;

    @Builder.Default
    @Column(nullable = false)
    Boolean locked = false;

    @Builder.Default
    @ManyToMany(fetch = FetchType.LAZY)
    @ExportField(name = "Roles", relation = true, path = "name")
    @ImportField(name = "Roles", lookupEntity = Role.class, lookupField = "name", separator = ",")
    @JoinTable( name = "user_roles",
                joinColumns = @JoinColumn(name = "user_id"),
                inverseJoinColumns = @JoinColumn(name = "role_id"))
    Set<Role> roles = new HashSet<>();

    public String getFullName() {
        return firstName + (lastName != null ? " " + lastName : "");
    }
}
```

### 1.2 — Tạo enum vai trò dự án

**Tạo file mới:** `backend/src/main/java/com/example/starter_project_2025/system/project/team/ProjectRole.java`

Vai trò dự án tách biệt hoàn toàn với Role của tài khoản.

```java
package com.example.starter_project_2025.system.project;

public enum ProjectRole {
    UNASSIGNED, TEAM_LEADER, DEV, FE_DEV, BE_DEV, BA, QA, TESTER
}
```

### 1.3 — Tạo enum trạng thái tham gia

**Tạo file mới:** `backend/src/main/java/com/example/starter_project_2025/system/project/team/ParticipationStatus.java`

Giữ cả INACTIVE và LEFT theo nghiệp vụ đã chốt. Tab Members chỉ đọc ACTIVE.

```java
package com.example.starter_project_2025.system.project;

public enum ParticipationStatus {
    ACTIVE, INACTIVE, LEFT
}
```

### 1.4 — Bổ sung thuộc tính TeamMember

**Sửa file hiện có:** `backend/src/main/java/com/example/starter_project_2025/system/project/team/TeamMember.java`

Default ở Java và DB giữ tương thích các luồng tạo membership cũ. isActive là cờ kỹ thuật; participationStatus là trạng thái nghiệp vụ. Cả hai cùng phải hợp lệ.

```java
package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.Entity;
import jakarta.persistence.Column;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import lombok.Builder;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "team_members",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_team_member_user_team", columnNames = {"team_id", "user_id"})
        }
)
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TeamMember extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id", nullable = false)
    private Team team;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "project_role", nullable = false,
            columnDefinition = "varchar(32) default 'UNASSIGNED'")
    private ProjectRole projectRole = ProjectRole.UNASSIGNED;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "participation_status", nullable = false,
            columnDefinition = "varchar(32) default 'ACTIVE'")
    private ParticipationStatus participationStatus = ParticipationStatus.ACTIVE;

    public boolean isCurrentParticipant() {
        return Boolean.TRUE.equals(getIsActive())
                && participationStatus == ParticipationStatus.ACTIVE;
    }
}
```

### 1.5 — Tạo bảng snapshot gắn Project

**Tạo file mới:** `backend/src/main/java/com/example/starter_project_2025/system/project/domain/ProjectTopicSnapshot.java`

Workspace chỉ đọc bản clone của Curriculum. Không có quan hệ tới template/version mới nhất. @Immutable ngăn cập nhật bằng dirty checking; không thay thế kiểm soát quyền hoặc quyền ghi DB của phân hệ sở hữu snapshot.

```java
package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Immutable;

@Entity
@Table(name = "project_topic_snapshots",
       uniqueConstraints = @UniqueConstraint(name = "uk_project_topic_snapshot", columnNames = "project_id"))
@Getter
@NoArgsConstructor
@Immutable
public class ProjectTopicSnapshot extends BaseEntity {
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false, updatable = false)
    private Project project;

    @Column(name = "topic_code", nullable = false, updatable = false, length = 100)
    private String topicCode;

    @Column(name = "topic_title", nullable = false, updatable = false, length = 255)
    private String topicTitle;

    @Column(nullable = false, updatable = false, length = 50)
    private String version;

    @Lob @Column(updatable = false)
    private String description;

    @Lob @Column(updatable = false)
    private String objectives;

    @Lob @Column(name = "requirements_json", updatable = false)
    private String requirementsJson;

    @Lob @Column(name = "attachments_json", updatable = false)
    private String attachmentsJson;

    @Builder
    public ProjectTopicSnapshot(Project project, String topicCode, String topicTitle,
            String version, String description, String objectives,
            String requirementsJson, String attachmentsJson) {
        this.project = project;
        this.topicCode = topicCode;
        this.topicTitle = topicTitle;
        this.version = version;
        this.description = description;
        this.objectives = objectives;
        this.requirementsJson = requirementsJson;
        this.attachmentsJson = attachmentsJson;
    }
}
```

**Hiểu phần schema:** Hibernate update của cấu hình local sẽ tạo user_code nullable/unique và thêm hai cột TeamMember có default cho dữ liệu cũ. Với database nhóm dùng migration, chuyển các thay đổi này thành migration tương ứng; không bật create-drop trên DB đang có dữ liệu. Không xóa backend/data để cập nhật schema.


## Bước 2 — DTO và repository snapshot

Thay contract Workspace bằng DTO tường minh. DTO Team Management được tách để không ảnh hưởng Teams & Mentors. Sau bước này còn phải làm bước 3–4 trước khi biên dịch backend, vì service cũ còn tham chiếu members.

### 2.1 — Đọc snapshot theo Project ID

**Tạo file mới:** `backend/src/main/java/com/example/starter_project_2025/system/project/workspace/repository/ProjectTopicSnapshotRepository.java`

Project.java không cần thêm quan hệ hai chiều; tránh kéo cả entity snapshot vào các API Project khác.

```java
package com.example.starter_project_2025.system.project;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface ProjectTopicSnapshotRepository extends JpaRepository<ProjectTopicSnapshot, Long> {
    Optional<ProjectTopicSnapshot> findByProjectId(Long projectId);
}
```

### 2.2 — DTO thành viên đúng bốn trường

**Tạo file mới:** `backend/src/main/java/com/example/starter_project_2025/system/project/workspace/dto/WorkspaceMemberResponse.java`

JSON trả chính xác user_code, display_name, project_role, status; kể cả user_code null. Không serialize User hoặc Role entity.

```java
package com.example.starter_project_2025.system.project;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonInclude(JsonInclude.Include.ALWAYS)
public record WorkspaceMemberResponse(
        String userCode,
        String displayName,
        ProjectRole projectRole,
        ParticipationStatus status) {
}
```

### 2.3 — DTO snapshot có danh sách yêu cầu và tài liệu

**Tạo file mới:** `backend/src/main/java/com/example/starter_project_2025/system/project/workspace/dto/WorkspaceTopicSnapshotResponse.java`

Chọn JSON cho requirements: mảng chuỗi. attachments là mảng đối tượng name/url. Đây là contract dữ liệu snapshot, không bổ sung trình soạn thảo Rich text.

```java
package com.example.starter_project_2025.system.project;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import java.util.List;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record WorkspaceTopicSnapshotResponse(
        String topicCode,
        String topicTitle,
        String version,
        String description,
        String objectives,
        List<String> requirements,
        List<Attachment> attachments) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Attachment(String name, String url) { }
}
```

### 2.4 — Bỏ roster khỏi response Overview

**Sửa file hiện có:** `backend/src/main/java/com/example/starter_project_2025/system/project/workspace/dto/WorkspaceDetailResponse.java`

member_count vẫn được phép xem. can_view_members giúp UI phân biệt không có quyền với team rỗng. Xóa members khỏi API cũ để không tạo đường vòng lấy danh sách.

```java
package com.example.starter_project_2025.system.project;

import lombok.Builder;
import lombok.Data;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;
import java.time.Instant;
import java.util.List;

@Data
@Builder
public class WorkspaceDetailResponse {
    private Long id;
    private String code;
    private String name;
    private WorkspaceStatus status;
    private Long projectId;
    private String projectCode;
    private String projectName;
    private String projectDescription;
    private ProjectStatus projectStatus;
    private Long teamId;
    private String teamCode;
    private String teamName;
    private String mentorName;
    private ProjectHubDtos.Charter charter;
    private Long cohortId;
    private String cohortName;
    private LocalDateTime createdAt;
    private String createdByName;
    @JsonProperty("member_count")
    private long memberCount;
    @JsonProperty("can_view_members")
    private boolean canViewMembers;
    @JsonProperty("topic_snapshot")
    private WorkspaceTopicSnapshotResponse topicSnapshot;
    private List<String> sections;
    private List<ActivityItem> activities;

    public record ActivityItem(String eventId, String action, Long actorId, String actorName,
                               Instant occurredAt, String correlationId) { }
}
```

### 2.5 — Tách DTO của Team Management

**Sửa file hiện có:** `backend/src/main/java/com/example/starter_project_2025/system/project/dto/ProjectHubDtos.java`

Teams & Mentors đang dùng chung record Member trong WorkspaceDetailResponse. Chuyển record cũ về ProjectHubDtos để thay contract Workspace không làm đổi contract Team Management.

```java
package com.example.starter_project_2025.system.project;

import jakarta.validation.constraints.*;
import java.util.List;

public final class ProjectHubDtos {
    private ProjectHubDtos() { }

    public record Member(Long id, String name, String email) { }
    public record Mentor(Long id, String name, String email) { }
    public record MentorAssignment(Long mentorId) { }
    public record Charter(@Size(max = 2000) String mission, @Size(max = 2000) String definitionOfDone,
                          @Size(max = 255) String primaryChannel, @Size(max = 255) String coreHours,
                          @Size(max = 2000) String conflictResolution) {
        public static Charter from(Team team) {
            return new Charter(team.getMission(), team.getDefinitionOfDone(), team.getPrimaryChannel(),
                    team.getCoreHours(), team.getConflictResolution());
        }
    }
    public record TeamView(Long id, String code, String name, Long projectId, String projectName,
                           Long cohortId, String cohortName, Long mentorId, String mentorName,
                           List<Member> members, Charter charter) { }
}
```

### 2.6 — Cập nhật mapper Teams & Mentors

**Sửa file hiện có:** `backend/src/main/java/com/example/starter_project_2025/system/project/service/ProjectHubService.java`

Chỉ thay kiểu DTO nội bộ, giữ cấu trúc JSON Team Management hiện có.

```java
package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProjectHubService {
    private final TenantRepository tenants;
    private final TeamRepository teams;
    private final UserRepository users;
    private static final Set<String> MENTOR_ROLES = Set.of("MENTOR", "TRAINER", "TEACHER");

    private UserPrincipal principal() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof UserPrincipal principal)
                || principal.getTenantId() == null) throw new AccessDeniedException("Tenant context is not available");
        return principal;
    }

    private Tenant tenant() {
        Tenant tenant = tenants.findById(principal().getTenantId())
                .orElseThrow(() -> new AccessDeniedException("Tenant is not available"));
        if (!Boolean.TRUE.equals(tenant.getActive()) || !Boolean.TRUE.equals(tenant.getIsActive())) throw new AccessDeniedException("Tenant is inactive");
        return tenant;
    }

    private Specification<Team> scope() {
        return WorkspaceCandidateSpec.forScope(principal().getUser().getId(), tenant().getId());
    }

    private Team scopedTeam(Long id) {
        return teams.findOne(scope().and((root, query, cb) -> cb.equal(root.get("id"), id)))
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy team trong phạm vi được phép"));
    }

    public List<ProjectHubDtos.TeamView> getTeams() {
        return teams.findAll(scope()).stream().map(this::teamView)
                .sorted(Comparator.comparing(ProjectHubDtos.TeamView::name)).toList();
    }

    private boolean eligibleMentor(User user) {
        return Boolean.TRUE.equals(user.getIsActive()) && !Boolean.TRUE.equals(user.getLocked())
                && user.getRoles().stream().anyMatch(role -> Boolean.TRUE.equals(role.getIsActive())
                && MENTOR_ROLES.contains(role.getName().toUpperCase(java.util.Locale.ROOT)));
    }

    public List<ProjectHubDtos.Mentor> getMentors() {
        return users.findByTenantIdAndIsActiveTrue(tenant().getId()).stream().filter(this::eligibleMentor)
                .map(user -> new ProjectHubDtos.Mentor(user.getId(), user.getFullName(), user.getEmail()))
                .sorted(Comparator.comparing(ProjectHubDtos.Mentor::name)).toList();
    }

    @Transactional
    public ProjectHubDtos.TeamView assignMentor(Long id, ProjectHubDtos.MentorAssignment request) {
        Team team = scopedTeam(id);
        User mentor = null;
        if (request.mentorId() != null) {
            mentor = users.findById(request.mentorId()).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy mentor"));
            if (mentor.getTenant() == null || !mentor.getTenant().getId().equals(team.getTenant().getId()) || !eligibleMentor(mentor)) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Mentor không hợp lệ hoặc không thuộc tenant của team");
            }
        }
        team.setMentor(mentor);
        return teamView(teams.saveAndFlush(team));
    }

    @Transactional
    public ProjectHubDtos.TeamView saveCharter(Long id, ProjectHubDtos.Charter charter) {
        Team team = scopedTeam(id);
        team.setMission(charter.mission());
        team.setDefinitionOfDone(charter.definitionOfDone());
        String channel = charter.primaryChannel();
        if (channel != null && !channel.isBlank() && !Set.of("Microsoft Teams", "Teams", "Slack", "Discord", "Google Chat", "Email").contains(channel)
                && !channel.equals(team.getPrimaryChannel())) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Select a supported primary channel");
        }
        team.setPrimaryChannel("Teams".equals(channel) ? "Microsoft Teams" : channel);
        team.setCoreHours(charter.coreHours());
        team.setConflictResolution(charter.conflictResolution());
        return teamView(teams.saveAndFlush(team));
    }

    private ProjectHubDtos.TeamView teamView(Team team) {
        Project project = team.getProject();
        Cohort cohort = project != null ? project.getCohort() : null;
        var members = team.getMembers().stream().map(TeamMember::getUser)
                .map(user -> new ProjectHubDtos.Member(user.getId(), user.getFullName(), user.getEmail()))
                .sorted(Comparator.comparing(ProjectHubDtos.Member::name)).toList();
        return new ProjectHubDtos.TeamView(team.getId(), team.getCode(), team.getName(), project != null ? project.getId() : null, project != null ? project.getName() : null,
                cohort != null ? cohort.getId() : null, cohort != null ? cohort.getName() : null,
                team.getMentor() != null ? team.getMentor().getId() : null,
                team.getMentor() != null ? team.getMentor().getFullName() : null, members, ProjectHubDtos.Charter.from(team));
    }
}
```


## Bước 3 — Roster, quyền và scope

Chỉ tính membership có isActive=true và participationStatus=ACTIVE. Số lượng và danh sách dùng cùng nguồn roster. Không dựa vào vai trò hệ thống để gán project_role.

### 3.1 — Query roster hiện tại

**Sửa file hiện có:** `backend/src/main/java/com/example/starter_project_2025/system/project/team/TeamMemberRepository.java`

Lọc theo team, ACTIVE, isActive và cùng tenant. Fetch user trong cùng query để mapper không tạo N+1 khi đọc tên/mã.

```java
package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.system.rbac.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

@Repository
public interface TeamMemberRepository extends JpaRepository<TeamMember, Long> {

    List<TeamMember> findByUser(User user);

    @Query("""
        select m from TeamMember m
        join fetch m.user u
        join fetch m.team t
        where t.id = :teamId and m.isActive = true
          and m.participationStatus = :status
          and u.tenant.id = t.tenant.id
        order by u.id
        """)
    List<TeamMember> findRoster(@Param("teamId") Long teamId,
                               @Param("status") ParticipationStatus status);

    boolean existsByTeamIdAndUserId(Long teamId, Long userId);
}
```

### 3.2 — Dùng chung nguồn roster cho count và danh sách

**Tạo file mới:** `backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspaceRosterService.java`

Không clone roster vào Workspace. Module Management Team cập nhật TeamMember; lần GET tiếp theo sẽ đọc dữ liệu mới.

```java
package com.example.starter_project_2025.system.project;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WorkspaceRosterService {
    private final TeamMemberRepository members;

    public List<TeamMember> current(Team team) {
        return members.findRoster(team.getId(), ParticipationStatus.ACTIVE);
    }

    public List<WorkspaceMemberResponse> response(List<TeamMember> rows) {
        return rows.stream().map(row -> new WorkspaceMemberResponse(
                row.getUser().getUserCode(), row.getUser().getFullName(),
                row.getProjectRole() == null ? ProjectRole.UNASSIGNED : row.getProjectRole(),
                row.getParticipationStatus())).toList();
    }
}
```

### 3.3 — Mở rộng quyền và scope

**Sửa file hiện có:** `backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspaceAccessService.java`

Thành viên đã LEFT/INACTIVE không còn được tính là membership cấp scope. Mentor được phân công vẫn có scope khi roster rỗng.

```java
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
```

### 3.4 — Đồng nhất scope danh sách với scope detail

**Sửa file hiện có:** `backend/src/main/java/com/example/starter_project_2025/system/project/workspace/spec/WorkspaceCandidateSpec.java`

Tránh trường hợp người đã LEFT vẫn thấy candidate dù API detail từ chối.

```java
package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.security.UserPrincipal;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.context.SecurityContextHolder;
import java.util.ArrayList;
import java.util.Locale;

public final class WorkspaceCandidateSpec {
    private WorkspaceCandidateSpec() { }

    public static Specification<Team> forTeamList(WorkspaceCandidateFilter filter) {
        return (root, query, cb) -> {
            var predicates = new ArrayList<Predicate>();
            if (filter != null) {
                if (filter.getProjectId() != null) predicates.add(cb.equal(root.get("project").get("id"), filter.getProjectId()));
                if (filter.getCohortId() != null) predicates.add(cb.equal(root.get("project").get("cohort").get("id"), filter.getCohortId()));
                if (filter.getProjectStatus() != null) predicates.add(cb.equal(root.get("project").get("status"), filter.getProjectStatus()));
                if (filter.getProjectName() != null && !filter.getProjectName().isBlank())
                    predicates.add(cb.like(cb.lower(root.get("project").get("name")), pattern(filter.getProjectName()), '\\'));
                if (filter.getTeamName() != null && !filter.getTeamName().isBlank())
                    predicates.add(cb.like(cb.lower(root.get("name")), pattern(filter.getTeamName()), '\\'));
                if (Boolean.TRUE.equals(filter.getOnlyUncreated()) || filter.getWorkspaceStatus() != null) {
                    var workspace = query.subquery(Long.class);
                    var row = workspace.from(Workspace.class);
                    var matches = cb.equal(row.get("team").get("id"), root.get("id"));
                    if (filter.getWorkspaceStatus() != null) matches = cb.and(matches, cb.equal(row.get("status"), filter.getWorkspaceStatus()));
                    workspace.select(row.get("id")).where(matches);
                    predicates.add(Boolean.TRUE.equals(filter.getOnlyUncreated()) ? cb.not(cb.exists(workspace)) : cb.exists(workspace));
                    if (Boolean.TRUE.equals(filter.getOnlyUncreated()) && filter.getWorkspaceStatus() != null) predicates.add(cb.disjunction());
                }
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private static String pattern(String text) {
        return "%" + text.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }

    public static Specification<Team> forScope(Long userId, Long tenantId) {
        return (root, query, cb) -> {
            if (userId == null || tenantId == null) return cb.disjunction();
            var project = root.join("project", jakarta.persistence.criteria.JoinType.LEFT);
            Predicate scoped = cb.and(cb.equal(root.get("tenant").get("id"), tenantId), cb.isTrue(root.get("isActive")),
                    cb.or(cb.isNull(project.get("id")), cb.and(cb.equal(project.get("tenant").get("id"), tenantId), cb.isTrue(project.get("isActive")))));
            if (hasRole("ADMIN") || hasRole("PO")) return scoped;
            // EXISTS avoids duplicate rows/counts when a team has several members.
            var membership = query.subquery(Long.class);
            var member = membership.from(TeamMember.class);
            membership.select(member.get("id")).where(cb.equal(member.get("team").get("id"), root.get("id")),
                    cb.equal(member.get("user").get("id"), userId), cb.isTrue(member.get("isActive")),
                    cb.equal(member.get("participationStatus"), ParticipationStatus.ACTIVE));
            return cb.and(scoped, cb.or(cb.equal(root.get("mentor").get("id"), userId), cb.exists(membership)));
        };
    }

    public static boolean hasRole(String roleName) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getPrincipal() instanceof UserPrincipal && auth.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority().equalsIgnoreCase("ROLE_" + roleName));
    }
}
```

### 3.5 — Tạo quyền riêng trước khi seed ADMIN

**Sửa file hiện có:** `backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspacePermissionInitializer.java`

Initializer có Order(1), chạy trước RoleDataInitializer Order(2). Không tự cấp quyền mới cho toàn bộ các role.

```java
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
```


## Bước 4 — API Overview và Members chỉ đọc

Giữ GET /api/workspaces/{id} cho Overview, thêm GET /api/workspaces/{id}/members. Overview không chứa members ngay cả với người có quyền. Member API cần cả WORKSPACE_READ và WORKSPACE_MEMBER_READ. Hoàn thành bước này rồi kiểm tra compile backend.

### 4.1 — Giữ service cũ làm điểm gọi; tách phần đọc

**Sửa file hiện có:** `backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspaceServiceImpl.java`

Luồng tạo của US01 giữ nguyên. Candidate memberCount được cập nhật cùng quy tắc ACTIVE.

```java
package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class WorkspaceServiceImpl implements WorkspaceService {
    private final WorkspaceRepository workspaceRepository;
    private final TeamRepository teamRepository;
    private final WorkspaceReadService reads;
    private final WorkspaceAccessService access;
    private final WorkspaceCreationTransaction creation;
    private final WorkspaceProjectSelection selection;

    @Override
    @Transactional(readOnly = true)
    public List<WorkspaceProjectSelection.Option> getProjectOptions(Long teamId) {
        return selection.options(access.requireUser(true), teamId);
    }

    private Specification<Team> candidateScope(WorkspaceCandidateFilter filter, User user) {
        access.requireTenant(user, false);
        return WorkspaceCandidateSpec.forTeamList(filter).and(WorkspaceCandidateSpec.forScope(user.getId(), user.getTenant().getId()));
    }

    @Override
    @Transactional(readOnly = true)
    public List<WorkspaceCandidateItem> getCandidateItems(WorkspaceCandidateFilter filter) {
        User user = access.requireUser(false);
        return teamRepository.findAll(candidateScope(filter, user)).stream().map(this::toCandidateItem)
                .sorted(Comparator.comparing(WorkspaceCandidateItem::getProjectName, Comparator.nullsLast(String::compareTo))
                        .thenComparing(WorkspaceCandidateItem::getTeamName)).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<WorkspaceCandidateItem> getCandidatePage(WorkspaceCandidateFilter filter, Pageable pageable) {
        User user = access.requireUser(false);
        return teamRepository.findAll(candidateScope(filter, user), pageable).map(this::toCandidateItem);
    }

    private WorkspaceCandidateItem toCandidateItem(Team team) {
        Project project = team.getProject();
        Cohort cohort = project != null ? project.getCohort() : null;
        Workspace existing = workspaceRepository.findFirstByTeamIdOrderByIdAsc(team.getId()).orElse(null);
        boolean eligible = Boolean.TRUE.equals(team.getIsActive()) && existing == null
                && access.hasMembers(team)
                && (project == null || (Boolean.TRUE.equals(project.getIsActive()) && access.projectCanStart(project)));
        String reason = eligible ? null : existing != null ? "This team already has a workspace."
                : !access.hasMembers(team) ? "Add at least one active member to this team before creating a workspace."
                : "The assigned project must be Planning or Active.";
        return WorkspaceCandidateItem.builder().projectId(project != null ? project.getId() : null)
                .projectName(project != null ? project.getName() : null).projectCode(project != null ? project.getCode() : null)
                .projectStatus(project != null ? project.getStatus() : null).teamId(team.getId()).teamName(team.getName()).teamCode(team.getCode())
                .memberCount(team.getMembers().stream().filter(TeamMember::isCurrentParticipant).count())
                .cohortId(cohort != null ? cohort.getId() : null).cohortName(cohort != null ? cohort.getName() : null)
                .workspaceId(existing != null ? existing.getId() : null).workspaceStatus(existing != null ? existing.getStatus() : null)
                .eligibleForWorkspace(eligible).ineligibleReason(reason).build();
    }

    @Override
    @Transactional(readOnly = true)
    public WorkspaceCandidateItem confirmWorkspace(WorkspaceCreateRequest request) {
        User user = access.requireUser(true);
        access.requireTenant(user, false);
        var chosen = selection.resolve(user, request, false);
        var result = toCandidateItem(chosen.team());
        Project project = chosen.project();
        result.setProjectId(project.getId());
        result.setProjectName(project.getName());
        result.setProjectCode(project.getCode());
        result.setProjectStatus(project.getStatus());
        result.setCohortId(project == null || project.getCohort() == null ? null : project.getCohort().getId());
        result.setCohortName(project == null || project.getCohort() == null ? null : project.getCohort().getName());
        result.setEligibleForWorkspace(true);
        result.setIneligibleReason(null);
        return result;
    }

    @Override
    @Transactional(readOnly = true)
    public WorkspaceDetailResponse getWorkspace(Long id) {
        return reads.overview(id);
    }

    @Override
    @Transactional(readOnly = true)
    public List<WorkspaceMemberResponse> getMembers(Long id) {
        return reads.members(id);
    }

    @Override
    public WorkspaceResponse createWorkspace(String key, WorkspaceCreateRequest request) {
        try { return creation.create(key, request, WorkspaceCorrelation.current()); }
        catch (DataIntegrityViolationException exception) {
            String message = exception.getMostSpecificCause().getMessage().toLowerCase(java.util.Locale.ROOT);
            if (message.contains("uk_team_project")) throw new WorkspaceRelationshipException("Project/team relationship is invalid.");
            if (message.contains("uk_workspace_request_key")) throw new WorkspaceConflictException("Idempotency key đã được dùng với dữ liệu khác", null);
            if (message.contains("uk_workspace_tenant_project_team") || message.contains("uk_workspace_project_team")) {
                throw new WorkspaceConflictException("Project/team đã có workspace", null);
            }
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Không thể hoàn tất khởi tạo workspace. Vui lòng thử lại.", exception);
        }
    }
}
```

### 4.2 — Thêm contract đọc Members

**Sửa file hiện có:** `backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspaceService.java`

Interface giữ phong cách service/controller của codebase.

```java
package com.example.starter_project_2025.system.project;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface WorkspaceService {

    List<WorkspaceCandidateItem> getCandidateItems(WorkspaceCandidateFilter filter);

    Page<WorkspaceCandidateItem> getCandidatePage(WorkspaceCandidateFilter filter, Pageable pageable);

    WorkspaceCandidateItem confirmWorkspace(WorkspaceCreateRequest request);
    List<WorkspaceProjectSelection.Option> getProjectOptions(Long teamId);

    WorkspaceDetailResponse getWorkspace(Long id);
    List<WorkspaceMemberResponse> getMembers(Long id);

    WorkspaceResponse createWorkspace(String idempotencyKey, WorkspaceCreateRequest request);
}
```

### 4.3 — Endpoint riêng cho danh sách thành viên

**Sửa file hiện có:** `backend/src/main/java/com/example/starter_project_2025/system/project/workspace/controller/WorkspaceController.java`

Yêu cầu cả quyền mở Workspace và quyền xem thành viên. Controller và service đều kiểm tra quyền; không dựa vào việc ẩn tab.

```java
package com.example.starter_project_2025.system.project;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.BindException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/workspaces")
@RequiredArgsConstructor
public class WorkspaceController {
    private final WorkspaceService workspaceService;
    private static final String READ = "hasAnyAuthority('WORKSPACE_READ', 'VIEW_PROJECT_WORKSPACE')";
    private static final String CREATE = "hasAnyAuthority('WORKSPACE_CREATE', 'CREATE_PROJECT_WORKSPACE')";

    @GetMapping("/projects")
    @PreAuthorize(CREATE)
    public List<WorkspaceProjectSelection.Option> projects(@RequestParam Long teamId) {
        return workspaceService.getProjectOptions(teamId);
    }

    @GetMapping("/candidates")
    @PreAuthorize(READ)
    public List<WorkspaceCandidateItem> getCandidates(WorkspaceCandidateFilter filter) {
        return workspaceService.getCandidateItems(filter);
    }

    @GetMapping("/candidates/page")
    @PreAuthorize(READ)
    public Page<WorkspaceCandidateItem> getCandidatesPage(WorkspaceCandidateFilter filter, Pageable pageable,
            @RequestParam(defaultValue = "20") String size, @RequestParam(defaultValue = "0") String page) {
        // Validate raw values before Pageable's fallback/clamping hides invalid input.
        int pageSize = number(size, "size", 1, 100);
        int pageIndex = number(page, "page", 0, Integer.MAX_VALUE);
        return workspaceService.getCandidatePage(filter, PageRequest.of(pageIndex, pageSize, pageable.getSort()));
    }

    private int number(String value, String field, int min, int max) {
        try {
            int parsed = Integer.parseInt(value);
            if (parsed >= min && parsed <= max) return parsed;
        } catch (NumberFormatException ignored) { }
        throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, field + " phải trong khoảng " + min + "–" + max);
    }

    @PostMapping("/confirm")
    @PreAuthorize(CREATE)
    public WorkspaceCandidateItem confirmWorkspace(@Valid @RequestBody WorkspaceCreateRequest request) {
        return workspaceService.confirmWorkspace(request);
    }

    @GetMapping("/{id}")
    @PreAuthorize(READ)
    public WorkspaceDetailResponse getWorkspace(@PathVariable Long id) { return workspaceService.getWorkspace(id); }

    @GetMapping("/{id}/members")
    @PreAuthorize("hasAnyAuthority('WORKSPACE_READ', 'VIEW_PROJECT_WORKSPACE') and hasAuthority('WORKSPACE_MEMBER_READ')")
    public List<WorkspaceMemberResponse> getMembers(@PathVariable Long id) {
        return workspaceService.getMembers(id);
    }

    @PostMapping
    @PreAuthorize(CREATE)
    public ResponseEntity<WorkspaceResponse> createWorkspace(
            @RequestHeader(value = "X-Idempotency-Key", required = false) String key,
            @Valid @RequestBody WorkspaceCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(workspaceService.createWorkspace(key, request));
    }

    public record WorkspaceError(int status, String message, LocalDateTime timestamp, Long workspaceId, String correlationId) { }
    private ResponseEntity<WorkspaceError> error(int status, String message, Long workspaceId) {
        return ResponseEntity.status(status).body(new WorkspaceError(status, message, LocalDateTime.now(), workspaceId, WorkspaceCorrelation.current()));
    }

    @ExceptionHandler(WorkspaceConflictException.class)
    public ResponseEntity<WorkspaceError> conflict(WorkspaceConflictException exception) {
        return error(409, exception.getMessage(), exception.getWorkspaceId());
    }

    @ExceptionHandler(WorkspaceRelationshipException.class)
    public ResponseEntity<WorkspaceError> invalidRelationship(WorkspaceRelationshipException exception) {
        return error(422, exception.getMessage(), null);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<WorkspaceError> status(ResponseStatusException exception) {
        return error(exception.getStatusCode().value(), exception.getReason(), null);
    }

    @ExceptionHandler(BindException.class)
    public ResponseEntity<WorkspaceError> validation(BindException exception) {
        String message = exception.getBindingResult().getFieldErrors().stream()
                .map(field -> field.getField() + ": " + field.getDefaultMessage()).findFirst().orElse("Tham số không hợp lệ");
        return error(422, message, null);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<WorkspaceError> denied(AccessDeniedException exception) {
        return error(403, "Bạn không còn quyền truy cập project/team này", null);
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<WorkspaceError> failed(RuntimeException exception) {
        log.error("Workspace request failed; correlationId={}", WorkspaceCorrelation.current(), exception);
        return error(500, "Không thể hoàn tất thao tác workspace. Vui lòng thử lại.", null);
    }
}
```

### 4.4 — Service chỉ đọc cho Overview và Members

**Tạo file mới:** `backend/src/main/java/com/example/starter_project_2025/system/project/workspace/service/WorkspaceReadService.java`

Tái sử dụng kiểm tra tenant/scope; không gọi save, tạo snapshot hoặc đổi trạng thái trong GET. Snapshot tồn tại thì đọc đúng bản đó. Roster và lịch sử được đọc độc lập.

```java
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
    private final WorkspaceRepository workspaces;
    private final WorkspaceAccessService access;
    private final WorkspaceRosterService roster;
    private final ProjectTopicSnapshotRepository snapshots;
    private final WorkspaceActivityRepository activities;
    private final UserRepository users;
    private final ObjectMapper json;

    private Workspace authorizedWorkspace(User user, Long id) {
        access.requireTenant(user, false);
        Workspace workspace = workspaces.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Workspace was not found"));
        if (!Boolean.TRUE.equals(workspace.getIsActive()))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Workspace was not found");
        if (!workspace.getTenant().getId().equals(user.getTenant().getId()))
            throw new AccessDeniedException("Workspace is outside the current tenant");
        access.requirePair(user, workspace.getProject().getId(), workspace.getTeam().getId(), false);
        return workspace;
    }

    public WorkspaceDetailResponse overview(Long id) {
        User user = access.requireUser(false);
        Workspace workspace = authorizedWorkspace(user, id);
        Project project = workspace.getProject();
        Team team = workspace.getTeam();
        Cohort cohort = project.getCohort();
        var snapshot = snapshots.findByProjectId(project.getId()).map(this::snapshotResponse).orElse(null);
        // A blank snapshot description stays blank; do not substitute newer project content.
        String description = snapshot != null ? snapshot.description() : project.getDescription();
        var history = activities.findByWorkspaceIdOrderByOccurredAtDesc(id).stream()
                .map(item -> new WorkspaceDetailResponse.ActivityItem(
                        item.getEventId(), item.getAction(), item.getActorId(),
                        users.findById(item.getActorId()).map(User::getFullName).orElse("Former member"),
                        item.getOccurredAt(), item.getCorrelationId())).toList();

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
                .activities(history).build();
    }

    public List<WorkspaceMemberResponse> members(Long id) {
        User user = access.requireUser(false);
        access.requireMemberRead(user);
        Workspace workspace = authorizedWorkspace(user, id);
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
```

**Kiểm tra compile backend:** dùng JDK 21, tại thư mục backend chạy `mvn -DskipTests compile`. Đây chỉ là compile; chưa kết luận AC đã PASS.


## Bước 5 — TypeScript types và API client

Tách type thành viên của Team Management khỏi type Members mới. Không thêm thư viện hoặc axios instance khác.

### 5.1 — Khai báo contract frontend

**Sửa file hiện có:** `frontend/src/types/features/workspace.ts`

Không giữ email/id của DTO thành viên cũ. Outer DTO giữ các trường cũ, thêm member_count, can_view_members và topic_snapshot.

```typescript
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
  activities: WorkspaceActivity[];
}
```

### 5.2 — Tách type Team Management

**Sửa file hiện có:** `frontend/src/types/features/project-hub.ts`

Giống backend: thay đổi Members của Workspace không làm sai bảng Teams & Mentors đang sử dụng name/email.

```typescript
export interface ProjectTeamMember { id: number; name: string; email: string }

export interface TeamCharter {
  mission: string;
  definitionOfDone: string;
  primaryChannel: string;
  coreHours: string;
  conflictResolution: string;
}

export interface ProjectTeam {
  id: number;
  code: string;
  name: string;
  projectId?: number | null;
  projectName?: string | null;
  cohortId?: number;
  cohortName?: string;
  mentorId?: number;
  mentorName?: string;
  members: ProjectTeamMember[];
  charter: TeamCharter;
}

export interface ProjectMentor { id: number; name: string; email: string }
```

### 5.3 — Thêm lời gọi API Members

**Sửa file hiện có:** `frontend/src/api/features/workspace.api.ts`

Dùng axiosInstance hiện có, giữ token/interceptor/error handling chung của dự án.

```typescript
import axiosInstance from "@/api/axios";
import type { WorkspaceCandidateItem, WorkspaceCreateRequest, WorkspaceDetail, WorkspaceResponse, WorkspaceProjectOption, WorkspaceMember } from "@/types/features/workspace";

export const workspaceApi = {
  getMembers: async (id: number): Promise<WorkspaceMember[]> => {
    const response = await axiosInstance.get<WorkspaceMember[]>("/workspaces/" + id + "/members");
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

  getById: async (id: number): Promise<WorkspaceDetail> => {
    const response = await axiosInstance.get<WorkspaceDetail>(`/workspaces/${id}`);
    return response.data;
  },

  create: async (request: WorkspaceCreateRequest, idempotencyKey: string): Promise<WorkspaceResponse> => {
    const response = await axiosInstance.post<WorkspaceResponse>("/workspaces", request, {
      headers: { "X-Idempotency-Key": idempotencyKey },
    });
    return response.data;
  },
};
```


## Bước 6 — Ghép giao diện vào trang hiện có

Dùng Card/Table/Button và usePermissions của codebase. UI giữ tiếng Anh. Hai panel đọc dữ liệu riêng; error/403 không bị hiển thị như team rỗng. Không gọi API ghi trong queryFn hoặc useEffect.

### 6.1 — Component Overview chỉ đọc

**Tạo file mới:** `frontend/src/pages/management/workspace/WorkspaceOverviewPanel.tsx`

Dùng Card/Button hiện có; giữ tiêu đề Project Instance riêng với topic_title. Không render HTML thô. Snapshot description rỗng không bị thay bằng nội dung Project mới.

```tsx
import type { WorkspaceDetail } from "@/types/features/workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function information(value?: string | null) {
  return value?.trim() || "No information available";
}

function attachmentUrl(value?: string | null) {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value, window.location.origin);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function WorkspaceOverviewPanel({ workspace, canViewMembers, onViewMembers }: {
  workspace: WorkspaceDetail;
  canViewMembers: boolean;
  onViewMembers: () => void;
}) {
  const topic = workspace.topic_snapshot;
  return <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
    <div className="space-y-5">
      <Card>
        <CardHeader><CardTitle>Project brief</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {topic && <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div><p className="text-muted-foreground">Topic code</p><p>{information(topic.topic_code)}</p></div>
            <div><p className="text-muted-foreground">Version</p><p>{information(topic.version)}</p></div>
            <div className="sm:col-span-2"><p className="text-muted-foreground">Topic title</p><p>{information(topic.topic_title)}</p></div>
          </div>}
          <div><p className="mb-2 text-sm font-medium">Description</p><p className="whitespace-pre-wrap text-sm leading-7">{information(workspace.projectDescription)}</p></div>
          <div><p className="mb-2 text-sm font-medium">Objectives</p><p className="whitespace-pre-wrap text-sm leading-7">{information(topic?.objectives)}</p></div>
          <div><p className="mb-2 text-sm font-medium">Requirements</p>
            {topic?.requirements.length ? <ul className="list-disc space-y-2 pl-5 text-sm">{topic.requirements.map((item, index) => <li key={index}>{item}</li>)}</ul>
              : <p className="text-sm text-muted-foreground">No information available</p>}
          </div>
          <div><p className="mb-2 text-sm font-medium">Attachments</p>
            {topic?.attachments.length ? <ul className="space-y-2 text-sm">{topic.attachments.map((item, index) => {
              const href = attachmentUrl(item.url);
              return <li key={index}>{href ? <a className="underline" href={href} target="_blank" rel="noopener noreferrer">{information(item.name)}</a>
                : <span>{information(item.name)}</span>}</li>;
            })}</ul> : <p className="text-sm text-muted-foreground">No information available</p>}
          </div>
        </CardContent>
      </Card>
    </div>
    <div className="space-y-5">
      <Card><CardHeader><CardTitle>{workspace.teamName}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm"><span className="font-medium">{workspace.member_count}</span> active members</p>
          {canViewMembers ? <Button variant="outline" className="w-full" onClick={onViewMembers}>View members</Button>
            : <p className="text-sm text-muted-foreground">You do not have permission to view member details.</p>}
        </CardContent>
      </Card>
      <Card><CardHeader><CardTitle>Mentor</CardTitle></CardHeader>
        <CardContent className="text-sm">{workspace.mentorName?.trim() || "No mentor assigned"}</CardContent>
      </Card>
      <Card><CardHeader><CardTitle>Workspace information</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>Code: {workspace.code}</p>
          <p>Created by: {workspace.createdByName || "Not available"}</p>
          <p>Created at: {workspace.createdAt ? new Date(workspace.createdAt).toLocaleString("en-GB") : "Not available"}</p>
        </CardContent>
      </Card>
    </div>
  </div>;
}
```

### 6.2 — Component Members có query và trạng thái riêng

**Tạo file mới:** `frontend/src/pages/management/workspace/WorkspaceMembersPanel.tsx`

Không có quyền thì không gọi API. 403/error không được biến thành danh sách rỗng. Query có workspace ID và người xem; gcTime 0 tránh giữ roster sau khi rời tab.

```tsx
import { workspaceApi } from "@/api/features/workspace.api";
import { usePermissions } from "@/hooks/usePermissions";
import type { ProjectRole, WorkspaceMember } from "@/types/features/workspace";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { getWorkspaceError } from "./workspace.shared";

const ROLE_LABELS: Record<ProjectRole, string> = {
  UNASSIGNED: "Unassigned role",
  TEAM_LEADER: "Team leader",
  DEV: "Developer",
  FE_DEV: "Frontend developer",
  BE_DEV: "Backend developer",
  BA: "Business analyst",
  QA: "Quality assurance",
  TESTER: "Tester"
};

export function WorkspaceMembersPanel({ workspaceId, canViewMembers }: {
  workspaceId: number;
  canViewMembers: boolean;
}) {
  const { user } = usePermissions();
  const query = useQuery<WorkspaceMember[]>({
    queryKey: ["workspace-members", workspaceId, user.email],
    queryFn: () => workspaceApi.getMembers(workspaceId),
    enabled: canViewMembers,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always"
  });

  if (!canViewMembers) {
    return <Card><CardHeader><CardTitle>Members</CardTitle></CardHeader>
      <CardContent>You do not have permission to view member details.</CardContent></Card>;
  }
  if (query.isFetching || query.isLoading) {
    return <Card><CardContent className="flex items-center justify-center gap-2 py-10"><Loader2 className="size-4 animate-spin" />Loading members...</CardContent></Card>;
  }
  if (query.isError) {
    const denied = isAxiosError(query.error) && query.error.response?.status === 403;
    return <Card><CardHeader><CardTitle>Unable to load members</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{denied ? "You do not have permission to view member details." : getWorkspaceError(query.error)}</p>
        <Button variant="outline" onClick={() => void query.refetch()}>Try again</Button>
      </CardContent></Card>;
  }
  const members = query.data ?? [];
  return <Card>
    <CardHeader><CardTitle>Members ({members.length})</CardTitle></CardHeader>
    <CardContent>{members.length === 0 ? <p className="text-sm text-muted-foreground">No team members</p>
      : <Table><TableHeader><TableRow><TableHead>Member code</TableHead><TableHead>Display name</TableHead><TableHead>Project role</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
        <TableBody>{members.map((member, index) => <TableRow key={member.user_code ?? "uncoded-" + index}>
          <TableCell>{member.user_code || "Not assigned"}</TableCell>
          <TableCell>{member.display_name}</TableCell>
          <TableCell>{ROLE_LABELS[member.project_role] ?? "Unassigned role"}</TableCell>
          <TableCell>{member.status === "ACTIVE" ? "Active" : member.status}</TableCell>
        </TableRow>)}</TableBody></Table>}
    </CardContent>
  </Card>;
}
```

### 6.3 — Ghép hai component vào trang Workspace hiện có

**Sửa file hiện có:** `frontend/src/pages/management/workspace/WorkspaceDetailPage.tsx`

Giữ route và các tab còn lại. Overview không có roster preview. Refresh tải lại dữ liệu; không render dữ liệu cũ khi đang refetch. Team charter vẫn là chức năng sửa riêng có quyền TEAM_UPDATE, không được tự gọi khi mở trang.

```tsx
import { workspaceApi } from "@/api/features/workspace.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/usePermissions";
import { WorkspaceOverviewPanel } from "./WorkspaceOverviewPanel";
import { WorkspaceMembersPanel } from "./WorkspaceMembersPanel";
import { Activity, AlertCircle, ArrowLeft, CalendarDays, CheckCheck, ClipboardList, FolderOpen, ListTodo, Loader2, MessageSquare, RefreshCw, ShieldCheck } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { TeamCharterForm } from "./TeamCharterForm";
import { formatWorkspaceDate, getWorkspaceError, WORKSPACE_SECTIONS, WorkspaceEmptyState, WorkspaceStatusBadge } from "./workspace.shared";

export default function WorkspaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const workspaceId = Number(id);
  const validId = Number.isSafeInteger(workspaceId) && workspaceId > 0;
  const query = useQuery({ queryKey: ["workspace-detail", workspaceId, user.email], queryFn: () => workspaceApi.getById(workspaceId), enabled: validId, retry: false, staleTime: 0, gcTime: 0, refetchOnMount: "always" });
  const workspace = query.data?.id === workspaceId ? query.data : undefined;
  const canViewMembers = !!workspace?.can_view_members && hasPermission("WORKSPACE_MEMBER_READ");
  const selected = params.get("tab") ?? "overview";
  const tab = WORKSPACE_SECTIONS.some(section => section.id === selected) ? selected : "overview";
  function changeTab(value: string) { setParams(previous => { const next = new URLSearchParams(previous); if (value === "overview") next.delete("tab"); else next.set("tab", value); return next; }, { replace: true }); }
  const backParams = new URLSearchParams(params);
  backParams.delete("tab");
  const backUrl = `/management/workspaces/candidates${backParams.size ? `?${backParams}` : ""}`;

  return (
    <MainLayout pathName={{ management: "Management", workspaces: "Workspace", [id ?? ""]: workspace?.projectName ?? "Workspace details" }}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3"><Button variant="outline" asChild><Link to={backUrl}><ArrowLeft />Workspace list</Link></Button><Button variant="outline" onClick={() => void Promise.all([query.refetch(), queryClient.invalidateQueries({ queryKey: ["workspace-members", workspaceId] })])} disabled={!validId || query.isFetching}><RefreshCw className={query.isFetching ? "animate-spin" : ""} />Refresh</Button></div>
        {query.isLoading || query.isFetching ? <Card><CardContent className="flex items-center justify-center gap-2 py-20"><Loader2 className="size-4 animate-spin" />Loading workspace...</CardContent></Card>
          : !validId || query.isError || !workspace ? <Card><WorkspaceEmptyState icon={AlertCircle} title="Unable to open workspace" description={!validId ? "The workspace URL is invalid." : getWorkspaceError(query.error)} action={<Button variant="outline" onClick={() => void query.refetch()} disabled={!validId}>Try again</Button>} /></Card>
          : <>
            <Card>
              <CardHeader><div className="flex flex-wrap items-start justify-between gap-4"><div className="space-y-2"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{workspace.projectCode}</Badge><span className="text-sm text-muted-foreground">{workspace.teamName} · {workspace.cohortName ?? "Not assigned"}</span></div><CardTitle className="text-xl">{workspace.projectName}</CardTitle><CardDescription>{workspace.projectDescription?.trim() || "No information available"}</CardDescription></div><WorkspaceStatusBadge status={workspace.projectStatus} /></div></CardHeader>
            </Card>
            <Tabs value={tab} onValueChange={changeTab} className="gap-5">
              <div className="overflow-x-auto border-b pb-1"><TabsList variant="line" aria-label="Workspace sections" className="w-max min-w-full justify-start">{WORKSPACE_SECTIONS.map(({ id: sectionId, label, icon: Icon }) => <TabsTrigger key={sectionId} value={sectionId} className="gap-2 px-4 py-2"><Icon />{label}</TabsTrigger>)}</TabsList></div>
              <TabsContent value="overview" className="space-y-5">
                <WorkspaceOverviewPanel workspace={workspace} canViewMembers={canViewMembers} onViewMembers={() => changeTab("members")} />
              </TabsContent>
              <TabsContent value="members" className="space-y-5">
                  <WorkspaceMembersPanel workspaceId={workspaceId} canViewMembers={canViewMembers} />
                  <Card><CardHeader><CardTitle>Team charter</CardTitle><CardDescription>Agree on goals, communication channels and team working rules.</CardDescription></CardHeader><CardContent><TeamCharterForm key={workspace.teamId} teamId={workspace.teamId} initial={workspace.charter} /></CardContent></Card>
              </TabsContent>
              <TabsContent value="milestones"><div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]"><Card><CardHeader><CardTitle>Milestone & Submission</CardTitle><CardDescription>The team's delivery milestones, deadlines and submission versions.</CardDescription></CardHeader><CardContent><WorkspaceEmptyState icon={CalendarDays} title="No milestones yet" description="Milestones will appear after deadlines, rubrics and late submission policies are configured. No submissions are due yet." /></CardContent></Card><Card><CardHeader><CardTitle>Acceptance criteria</CardTitle></CardHeader><CardContent className="space-y-5 text-sm"><div className="flex gap-3"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div><p className="font-medium">Rubric</p><p className="mt-1 leading-6 text-muted-foreground">No assessment criteria or weights yet.</p></div></div><div className="flex gap-3"><CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div><p className="font-medium">Deadlines & late submissions</p><p className="mt-1 leading-6 text-muted-foreground">No deadlines or late submission policies yet.</p></div></div></CardContent></Card></div></TabsContent>
              <TabsContent value="sprints" className="space-y-5"><Card><CardHeader><CardTitle>Sprint Board</CardTitle><CardDescription>No active sprint. Tasks will be organized by their current status.</CardDescription></CardHeader></Card><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{["Backlog", "To do", "In progress", "Review / Done"].map(column => <Card key={column} className="min-h-72 gap-4 bg-muted/20"><CardHeader className="px-4"><div className="flex items-center justify-between"><CardTitle className="text-sm">{column}</CardTitle><Badge variant="outline">0</Badge></div></CardHeader><CardContent className="px-4"><div className="rounded-lg border border-dashed p-5 text-center text-xs leading-6 text-muted-foreground">No tasks yet</div></CardContent></Card>)}</div></TabsContent>
              <TabsContent value="backlog"><Card><CardHeader><CardTitle>Project backlog</CardTitle><CardDescription>Project tasks, priorities and assignees.</CardDescription></CardHeader><CardContent><div className="rounded-md border"><Table><TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Priority</TableHead><TableHead>Assignee</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell colSpan={4}><WorkspaceEmptyState icon={ListTodo} title="The backlog is empty" description="Project tasks will appear here when the team starts planning." /></TableCell></TableRow></TableBody></Table></div></CardContent></Card></TabsContent>
              <TabsContent value="artifacts"><Card><CardHeader><CardTitle>Artifacts & documents</CardTitle><CardDescription>Manage deliverables, repository links and document versions.</CardDescription></CardHeader><CardContent><div className="rounded-md border"><Table><TableHeader><TableRow><TableHead>Deliverable / document</TableHead><TableHead>Type</TableHead><TableHead>Version</TableHead><TableHead>Submitted by</TableHead><TableHead>Updated</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell colSpan={5}><WorkspaceEmptyState icon={FolderOpen} title="No artifacts yet" description="The team's documents and deliverables will appear here after they are added." /></TableCell></TableRow></TableBody></Table></div></CardContent></Card></TabsContent>
              <TabsContent value="feedback"><Card><CardHeader><CardTitle>Feedback</CardTitle><CardDescription>Mentor reviews and discussions about the team's deliverables.</CardDescription></CardHeader><CardContent><WorkspaceEmptyState icon={MessageSquare} title="No feedback yet" description="Feedback on milestones, deliverables and teamwork will appear here." /></CardContent></Card></TabsContent>
              <TabsContent value="activity" className="space-y-5"><Card><CardHeader><CardTitle>Workspace activity</CardTitle><CardDescription>Workspace creation and shared team activity.</CardDescription></CardHeader><CardContent>{workspace.activities.length ? <div className="divide-y">{workspace.activities.map(item => <div key={item.eventId} className="flex gap-3 py-4 first:pt-0 last:pb-0"><div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted"><Activity className="size-4" /></div><div className="space-y-1"><p className="text-sm font-medium">{item.action === "WORKSPACE_CREATED" ? "Workspace created" : item.action}</p><p className="text-sm text-muted-foreground">{item.actorName} · {formatWorkspaceDate(item.occurredAt)}</p><p className="text-xs text-muted-foreground">{workspace.projectName} / {workspace.teamName}</p></div></div>)}</div> : <WorkspaceEmptyState icon={Activity} title="No activity yet" description="Recorded workspace activity will appear here." />}</CardContent></Card><Card><CardHeader><CardTitle>Risks & Decisions</CardTitle><CardDescription>Track project risks and important decisions.</CardDescription></CardHeader><CardContent><Tabs defaultValue="risks"><TabsList><TabsTrigger value="risks">Risk log</TabsTrigger><TabsTrigger value="decisions">Decision log</TabsTrigger></TabsList><TabsContent value="risks"><WorkspaceEmptyState icon={ClipboardList} title="No risks recorded" description="Risks, owners, impact and mitigation plans will appear here." /></TabsContent><TabsContent value="decisions"><WorkspaceEmptyState icon={CheckCheck} title="No decisions recorded" description="Team decisions and their rationale will appear here." /></TabsContent></Tabs></CardContent></Card></TabsContent>
            </Tabs>
          </>}
      </div>
    </MainLayout>
  );
}
```

**Kiểm tra frontend:** tại thư mục frontend chạy `npm.cmd run build`. Trang vẫn giữ các tab của US01. TeamCharterForm còn là thao tác chỉnh sửa riêng theo TEAM_UPDATE; mở Overview/Members không được tự submit form đó.


## Bước 7 — Kiểm thử và cập nhật regression

Contract Overview đổi nên assertion cũ của US01 phải đổi theo. Không xóa regression test về tạo workspace, idempotency, concurrency hoặc rollback.

### 7.1 — Cập nhật regression test US01 theo contract Overview mới

**Sửa file hiện có:** `backend/src/test/java/com/example/starter_project_2025/system/project/WorkspaceAcceptanceIntegrationTest.java`

Overview không còn trả members; các assertion cũ chuyển sang member_count. Không xóa các kiểm tra tạo, replay, rollback hoặc concurrency đã có.

```java
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
                    permissions.findByName("CREATE_PROJECT_WORKSPACE").orElseThrow())));
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
                    .andExpect(jsonPath("$.activities.length()").value(1));
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
        mvc.perform(get("/api/workspaces/{id}", id).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andExpect(jsonPath("$.activities[0].eventId").value(event.getEventId()))
                .andExpect(jsonPath("$.activities[0].actorName").value("Workspace Creator"));
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
```

### 7.2 — Test riêng cho US02

**Tạo file mới:** `backend/src/test/java/com/example/starter_project_2025/system/project/WorkspaceOverviewIntegrationTest.java`

Tạo tenant, role, user, project, team và workspace riêng mỗi ca trong database test. Kiểm tra DTO, snapshot, quyền, scope, roster, privacy và tính chỉ đọc; không dùng dữ liệu Postman đã tiêu thụ.

```java
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
                    permissions.findByName("WORKSPACE_MEMBER_READ").orElseThrow())));
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
        var oldEvent = overview().at("/activities/0/eventId").asText();
        tx.executeWithoutResult(status -> memberships.findById(membershipId).orElseThrow()
                .setParticipationStatus(ParticipationStatus.LEFT));
        assertThat(members()).isEmpty();
        var result = overview();
        assertThat(result.get("member_count").asInt()).isZero();
        assertThat(result.at("/activities/0/eventId").asText()).isEqualTo(oldEvent);
        assertThat(result.at("/activities/0/actorName").asText()).isEqualTo("Workspace Reader");
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
```


### 7.3 — Đổi assertion của test Project Hub theo API Overview mới

**Sửa file hiện có:** `backend/src/test/java/com/example/starter_project_2025/system/project/ProjectHubIntegrationTest.java`

Test trước đây đòi email thành viên trong Overview. Theo AC06/AC08, Overview chỉ trả count, còn danh sách dùng endpoint có quyền riêng.

```java
package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.permission.PermissionRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.core.io.FileSystemResource;
import javax.sql.DataSource;
import java.nio.file.Path;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@org.springframework.test.context.ActiveProfiles("test")
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:project_hub_tests;DB_CLOSE_DELAY=-1",
        "GOOGLE_CLIENT_ID=local-test-client", "GOOGLE_CLIENT_SECRET=local-test-secret"
})
@AutoConfigureMockMvc
class ProjectHubIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired TransactionTemplate transaction;
    @Autowired UserRepository users;
    @Autowired TenantRepository tenants;
    @Autowired ProjectRepository projects;
    @Autowired TeamRepository teams;
    @Autowired TeamMemberRepository members;
    @Autowired WorkspaceRepository workspaces;
    @Autowired RoleRepository roles;
    @Autowired PermissionRepository permissions;
    @Autowired DataSource dataSource;
    @Autowired UserDetailsService userDetails;
    @Autowired RefreshTokenService tokens;
    @Autowired WorkspaceModuleCleanup moduleCleanup;
    @Autowired com.example.starter_project_2025.system.menu.module.ModuleRepository modules;
    @Autowired com.example.starter_project_2025.system.menu.module_groups.ModuleGroupRepository moduleGroups;

    private String adminToken;
    private String studentToken;
    private Team team;
    private Long teacherId;

    @BeforeEach
    void prepare() {
        transaction.executeWithoutResult(status -> {
            User admin = users.findByEmail("admin@example.com").orElseThrow();
            User student = users.findByEmail("student@example.com").orElseThrow();
            teacherId = users.findByEmail("teacher@example.com").orElseThrow().getId();
            Project project = new Project();
            project.setCode("TEST-" + UUID.randomUUID());
            project.setName("Campus portal");
            project.setDescription("A shared campus service portal");
            project.setTenant(admin.getTenant());
            project.setStatus(ProjectStatus.ACTIVE);
            projects.saveAndFlush(project);
            team = new Team();
            team.setCode("TEAM-" + UUID.randomUUID());
            team.setName("Integration team");
            team.setProject(project);
            team.setTenant(admin.getTenant());
            teams.saveAndFlush(team);
            TeamMember membership = new TeamMember();
            membership.setTeam(team);
            membership.setUser(student);
            members.saveAndFlush(membership);
            adminToken = token("admin@example.com");
            studentToken = token("student@example.com");
        });
    }

    private String token(String email) {
        var principal = userDetails.loadUserByUsername(email);
        return tokens.generateAccessToken(new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }

    private String request() throws Exception {
        return json.writeValueAsString(Map.of("projectId", team.getProject().getId(), "teamId", team.getId()));
    }

    @Test
    void retiredBuilderEndpointsAreUnavailableAndLegacyMenuPermissionsAreInactive() throws Exception {
        mvc.perform(get("/api/project-hub/templates").header("Authorization", "Bearer " + adminToken)).andExpect(status().isNotFound());
        mvc.perform(post("/api/project-hub/templates").header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isNotFound());
        transaction.executeWithoutResult(status -> {
            var group = moduleGroups.findByName("Project Management").orElseThrow();
            var legacy = new com.example.starter_project_2025.system.menu.module.Module();
            legacy.setModuleGroup(group); legacy.setTitle("Project Templates"); legacy.setUrl("/management/project-templates");
            legacy.setRequiredPermission("PROJECT_TEMPLATE_READ"); modules.saveAndFlush(legacy);
            if (permissions.findByName("PROJECT_TEMPLATE_READ").isEmpty())
                permissions.saveAndFlush(com.example.starter_project_2025.system.rbac.permission.Permission.builder()
                        .name("PROJECT_TEMPLATE_READ").resource("PROJECT_TEMPLATE").action("READ").build());
        });
        moduleCleanup.run();
        moduleCleanup.run();
        assertThat(modules.findByUrl("/management/project-templates").orElseThrow().getIsActive()).isFalse();
        assertThat(permissions.findByName("PROJECT_TEMPLATE_READ").orElseThrow().getIsActive()).isFalse();
        assertThat(modules.findByUrl("/management/workspaces/candidates").orElseThrow().getIsActive()).isTrue();
    }

    private JsonNode createWorkspace(String key) throws Exception {
        String response = mvc.perform(post("/api/workspaces").header("Authorization", "Bearer " + adminToken)
                        .header("X-Idempotency-Key", key).contentType(MediaType.APPLICATION_JSON).content(request()))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(response);
    }

    @Test
    void confirmationDoesNotCreateAndDetailUsesExistingTeamData() throws Exception {
        long before = workspaces.count();
        mvc.perform(post("/api/workspaces/confirm").header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON).content(request()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.teamId").value(team.getId()))
                .andExpect(jsonPath("$.memberCount").value(1));
        assertThat(workspaces.count()).isEqualTo(before);
        long id = createWorkspace(UUID.randomUUID().toString()).get("id").asLong();
        mvc.perform(get("/api/workspaces/{id}", id).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.projectName").value("Campus portal"))
                .andExpect(jsonPath("$.member_count").value(1))
                .andExpect(jsonPath("$.members").doesNotExist())
                .andExpect(jsonPath("$.createdByName").isNotEmpty());
        mvc.perform(get("/api/workspaces/{id}", id).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id));
    }

    @Test
    void retryReturnsSameWorkspaceAndDuplicateIsRejected() throws Exception {
        String key = UUID.randomUUID().toString();
        long id = createWorkspace(key).get("id").asLong();
        assertThat(createWorkspace(key).get("id").asLong()).isEqualTo(id);
        mvc.perform(post("/api/workspaces").header("Authorization", "Bearer " + adminToken)
                        .header("X-Idempotency-Key", UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON).content(request()))
                .andExpect(status().isConflict());
    }

    @Test
    void mentorAssignmentAndCharterPersist() throws Exception {
        mvc.perform(put("/api/project-hub/teams/{id}/mentor", team.getId()).header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("mentorId", teacherId))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.mentorId").value(teacherId));
        String charter = json.writeValueAsString(new ProjectHubDtos.Charter("Ship a usable portal", "Tests pass", "Teams", "19:00–21:00", "Discuss with mentor"));
        mvc.perform(put("/api/project-hub/teams/{id}/charter", team.getId()).header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON).content(charter))
                .andExpect(status().isOk()).andExpect(jsonPath("$.charter.mission").value("Ship a usable portal"));
        long id = createWorkspace(UUID.randomUUID().toString()).get("id").asLong();
        mvc.perform(get("/api/workspaces/{id}", id).header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.mentorName").isNotEmpty())
                .andExpect(jsonPath("$.charter.mission").value("Ship a usable portal"));
    }

    @Test
    void unassignedTeamRemainsVisibleAndCharterUsesSupportedChannelValues() throws Exception {
        transaction.executeWithoutResult(status -> teams.findById(team.getId()).orElseThrow().setProject(null));
        mvc.perform(get("/api/project-hub/teams").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.id == " + team.getId() + ")].projectName")
                        .value(org.hamcrest.Matchers.contains(org.hamcrest.Matchers.nullValue())));
        var valid = new ProjectHubDtos.Charter("Mission", "Tests pass", "Slack", "", "");
        mvc.perform(put("/api/project-hub/teams/{id}/charter", team.getId()).header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(valid)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.charter.primaryChannel").value("Slack")).andExpect(jsonPath("$.projectId").isEmpty());
        mvc.perform(put("/api/project-hub/teams/{id}/charter", team.getId()).header("Authorization", "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(new ProjectHubDtos.Charter("Changed mission", "", "Arbitrary text", "", ""))))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(get("/api/project-hub/teams").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.id == " + team.getId() + ")].charter.primaryChannel")
                        .value(org.hamcrest.Matchers.contains("Slack")));
    }


    @Test
    void foreignTenantTeamIsNotAccessible() throws Exception {
        long[] ids = transaction.execute(status -> {
            Tenant foreign = tenants.saveAndFlush(Tenant.builder().code("FOREIGN-" + UUID.randomUUID()).name("Other tenant").build());
            Project project = new Project();
            project.setCode("FOREIGN"); project.setName("Private project"); project.setStatus(ProjectStatus.ACTIVE); project.setTenant(foreign);
            projects.saveAndFlush(project);
            Team foreignTeam = new Team(); foreignTeam.setCode("FOREIGN"); foreignTeam.setName("Private team"); foreignTeam.setProject(project); foreignTeam.setTenant(foreign);
            teams.saveAndFlush(foreignTeam);
            return new long[]{project.getId(), foreignTeam.getId()};
        });
        mvc.perform(post("/api/workspaces/confirm").header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("projectId", ids[0], "teamId", ids[1]))))
                .andExpect(status().isForbidden());
    }

    @Test
    void workspaceWritesEnforceAuthenticationAndPermissions() throws Exception {
        mvc.perform(get("/api/workspaces/candidates")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/workspaces").header("Authorization", "Bearer " + studentToken)
                        .contentType(MediaType.APPLICATION_JSON).content(request())).andExpect(status().isForbidden());
        mvc.perform(post("/api/workspaces/confirm").header("Authorization", "Bearer " + studentToken)
                .contentType(MediaType.APPLICATION_JSON).content(request())).andExpect(status().isForbidden());
    }

    @Test
    void studentScopeUsesSharedTenantAndOnlyShowsMemberships() throws Exception {
        Long outsideTeamId = transaction.execute(status -> {
            User student = users.findByEmail("student@example.com").orElseThrow();
            Role viewer = new Role();
            viewer.setName("TEST_VIEWER_" + UUID.randomUUID());
            viewer.setPermissions(new java.util.HashSet<>(List.of(permissions.findByName("WORKSPACE_READ").orElseThrow())));
            roles.saveAndFlush(viewer);
            student.getRoles().add(viewer);
            users.saveAndFlush(student);
            Team outside = new Team();
            outside.setCode("OUTSIDE-" + UUID.randomUUID()); outside.setName("Outside team");
            outside.setTenant(student.getTenant());
            return teams.saveAndFlush(outside).getId();
        });
        JsonNode response = json.readTree(mvc.perform(get("/api/workspaces/candidates").header("Authorization", "Bearer " + studentToken))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        java.util.List<Long> ids = new java.util.ArrayList<>();
        response.forEach(row -> ids.add(row.get("teamId").asLong()));
        assertThat(ids).contains(team.getId()).doesNotContain(outsideTeamId);
    }

    @Test
    void inactiveTenantCannotReadWorkspaceOrProjectHub() throws Exception {
        Long tenantId = transaction.execute(status -> users.findByEmail("admin@example.com").orElseThrow().getTenant().getId());
        transaction.executeWithoutResult(status -> tenants.findById(tenantId).orElseThrow().setActive(false));
        try {
            mvc.perform(get("/api/workspaces/candidates").header("Authorization", "Bearer " + adminToken)).andExpect(status().isForbidden());
            mvc.perform(get("/api/project-hub/teams").header("Authorization", "Bearer " + adminToken)).andExpect(status().isForbidden());
        } finally {
            transaction.executeWithoutResult(status -> tenants.findById(tenantId).orElseThrow().setActive(true));
        }
    }

    @Test
    void optionalLocalFixtureCanRunTwiceWithoutCreatingWorkspace() {
        Path repository = Path.of(System.getProperty("user.dir")).toAbsolutePath();
        if (repository.getFileName().toString().equals("backend")) repository = repository.getParent();
        var fixture = new ResourceDatabasePopulator(new FileSystemResource(repository.resolve("docs/project-hub-demo.sql")));
        long workspaceCount = workspaces.count();
        fixture.execute(dataSource);
        fixture.execute(dataSource);
        var jdbc = new JdbcTemplate(dataSource);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM teams WHERE code = 'LOCAL-DEMO-TEAM'", Long.class)).isEqualTo(1L);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM team_members tm JOIN teams t ON t.id = tm.team_id WHERE t.code = 'LOCAL-DEMO-TEAM'", Long.class)).isEqualTo(2L);
        assertThat(workspaces.count()).isEqualTo(workspaceCount);
    }
}
```

## Bước 8 — Chuẩn bị quyền và dữ liệu local

1. Khởi động lại backend sau khi code backend compile được. Quyền WORKSPACE_MEMBER_READ được initializer tạo trước RoleDataInitializer.
2. ADMIN được RoleDataInitializer lấy toàn bộ permission. Với role khác, dùng màn hình Roles để cấp WORKSPACE_MEMBER_READ cho đúng nhóm được xem danh sách.
3. Không cấp quyền này cho mọi tài khoản có WORKSPACE_READ: phải giữ được một role Overview-only để test AC06. RoleDataInitializer đang seed lại các role mặc định lúc startup; dùng role riêng cho tài khoản kiểm thử để việc cấp quyền không bị seed mặc định ghi đè.
4. RoleDataInitializer hiện cấp WORKSPACE_READ/WORKSPACE_MEMBER_READ cho STUDENT; TEACHER có thêm WORKSPACE_CREATE, TEAM_READ, TEAM_UPDATE. ADMIN dùng toàn bộ quyền. Account demo riêng ngừng được tạo; account cũ bị khóa/vô hiệu hóa và lịch sử được giữ.
5. Đăng nhập lại trên frontend/Postman sau khi cấp quyền để payload permissions trên client được cập nhật.
6. Bộ seed bổ sung user_code còn thiếu cho ba account có sẵn và snapshot còn thiếu cho Nova/Pixel. Không ghi đè snapshot/roster đã sửa hoặc reset workspace hiện tại. standard-accounts.sql chỉ SELECT để tra cứu dữ liệu; dùng Manage members để phân vai trò và cập nhật participation.
7. URL attachment example.com chỉ là dữ liệu minh họa; dùng URL tài liệu thật do Curriculum/Storage cung cấp khi tích hợp.

### Quy ước tích hợp với Curriculum

Curriculum clone các giá trị vào ProjectTopicSnapshot khi gán đề bài, trong transaction của chức năng gán. Nội dung snapshot không đọc trực tiếp từ template mới nhất, và GET Workspace không làm thao tác clone.

Ví dụ giá trị hai cột JSON:

~~~json
{
  "requirements_json": "[\"Search learning resources\",\"Implement access control\"]",
  "attachments_json": "[{\"name\":\"Project brief\",\"url\":\"https://example.com/brief.pdf\"}]"
}
~~~

Khi source Curriculum lên v2, giữ nguyên snapshot v1 của Project. Không UPDATE project_topic_snapshots theo topic_code mỗi lần source thay đổi. @Immutable là bảo vệ ở ORM, không ngăn được một lệnh UPDATE SQL có chủ đích; phân hệ sở hữu dữ liệu cần bảo vệ quyền ghi tương ứng.

Project chưa có snapshot: Overview dùng description hiện tại của Project, còn các trường snapshot chưa có hiển thị No information available. Project đã có snapshot nhưng description rỗng: vẫn hiển thị No information available, không lấy mô tả live khác để thay thế snapshot.

## Bước 9 — Chạy test

Chạy lại kiểm thử source chính:

~~~powershell
Set-Location "D:\SE172316\Semeter 6\HCM26_CPL_JAVA_10\backend"
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
& "C:\Program Files\apache-maven-3.9.16\bin\mvn.cmd" "-Dtest=WorkspaceOverviewIntegrationTest,WorkspaceAcceptanceIntegrationTest,ProjectHubIntegrationTest,WorkspaceDemoIntegrationTest,WorkspacePersistenceIntegrationTest" test
~~~

Các test dùng profile test và H2 riêng, không reset database ứng dụng. WorkspaceOverviewIntegrationTest tạo fixture mới mỗi ca. Những ca từ chối quyền/phản hồi lỗi phải được kiểm tra theo assertion, không chỉ nhìn có dòng ERROR trong log.

Tại frontend:

~~~powershell
Set-Location "D:\SE172316\Semeter 6\HCM26_CPL_JAVA_10\frontend"
npm.cmd run build
~~~

## Bước 10 — Nghiệm thu từng AC

| AC | Cách kiểm tra | Kết quả |
| --- | --- | --- |
| AC01 | Mở workspace A rồi đổi URL sang B; làm chậm response B | Loading hoặc dữ liệu B; không hiển thị dữ liệu A dưới URL B |
| AC02 | Có snapshot v1; đổi nội dung source Curriculum/live Project sang bản mới | GET vẫn trả snapshot v1. Mã/tên Project Instance vẫn thuộc đúng Project |
| AC03 | GET /members; có membership ở team khác | Chỉ roster đúng team; đúng 4 trường; không trùng |
| AC04 | Membership UNASSIGNED; tài khoản có system role Teacher/Student/Admin | UI vẫn Unassigned role |
| AC05 | Module Team đổi membership thành LEFT/INACTIVE, rồi Refresh | /members loại người đó, member_count giảm tương ứng; Activity cũ còn |
| AC06 | Role chỉ WORKSPACE_READ | Overview có count; UI không gọi/hiện roster; gọi trực tiếp /members trả 403 |
| AC07 | Mô tả/mục tiêu null hoặc toàn khoảng trắng; không còn ACTIVE member | No information available / No team members; không tự thêm người xem |
| AC08 | Inspect JSON của Overview và Members bằng cả mentor và learner được cấp quyền | Không email/phone/password/token/điểm nháp/feedback chưa công bố |
| AC09 | Không xác thực, tenant inactive, người ngoài scope, ID không tồn tại | Lần lượt 401/403/403/404; không trả dữ liệu workspace |
| AC10 | Giả lập loading, chặn GET cho lỗi rồi Try again; so DB trước/sau đọc | Phân biệt loading/error/empty; không ghi dữ liệu |

### Postman cho Members

Dùng workspace ID thực tế; nếu Nova vẫn là workspace 7:

~~~http
GET {{baseUrl}}/api/workspaces/7
Authorization: Bearer {{token}}
~~~

Overview phải có member_count và không có members.

~~~http
GET {{baseUrl}}/api/workspaces/7/members
Authorization: Bearer {{token}}
~~~

Sau khi teacher/student có WORKSPACE_MEMBER_READ và đăng nhập lại, kỳ vọng 200 và chỉ bốn trường mỗi dòng. Tạm thu hồi WORKSPACE_MEMBER_READ của STUDENT theo MANUAL_TEST_AC01_AC10.md: Overview vẫn 200, /members là 403. Không dùng account demo riêng.

Khi test No Auth trong Postman, bỏ cả Authorization header và cookie phiên nếu đang có. Tên X-Idempotency-Key không quyết định status; các GET này không cần key.

### Test AC05 bằng thay đổi fixture local

Workspace chỉ đọc roster. Bản hiện tại dùng Members → Manage members để thay đổi roster; SQL dưới đây chỉ là phương án kiểm tra trực tiếp trên fixture local. Đây không phải code của GET.

~~~sql
-- Xem membership trước, lấy đúng id của student trong Pixel.
SELECT tm.id, tm.participation_status, tm.project_role, u.user_code
FROM team_members tm
JOIN teams t ON t.id = tm.team_id
JOIN users u ON u.id = tm.user_id
WHERE t.code = 'WS-DEMO-PIXEL' AND u.email = 'student@example.com';

-- Thay 123 bằng membership id trả về ở SELECT trên.
UPDATE team_members SET participation_status = 'LEFT' WHERE id = 123;
~~~

Gọi lại Overview/Members hoặc bấm Refresh. Xác minh count giảm và người đó biến mất khỏi Members; GET Activity vẫn giữ sự kiện cũ. Sau khi lưu bằng chứng, có thể khôi phục fixture bằng participation_status='ACTIVE'. Không xóa activity/audit hoặc tạo lại workspace.

### Lưu ý về bằng chứng

Build/test qua chứng minh code tham chiếu hoạt động trong môi trường kiểm thử. Nó không thay thế ảnh/nghiệm thu thủ công trên database ứng dụng của bạn. Kiểm tra lỗi 500 thực tế bằng response/correlationId/log nếu xuất hiện; không đánh dấu PASS chỉ vì một request khác đã thành công.


