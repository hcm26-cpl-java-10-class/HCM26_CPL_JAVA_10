package com.example.starter_project_2025.system.schedule.session.session_attendance;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.schedule.session.Session;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * T1 / BR-UNI-01, BR-UNI-02 — Kiểm quyền + data scope ở backend (UI chỉ là lớp trang trí).
 *
 * <ul>
 *     <li>Trainer được phân công ({@code session.trainerId = self}) hoặc Class Admin
 *         ({@code ROLE_ADMIN}, có {@code ATTENDANCE_UNLOCK}) được ghi/cập nhật.</li>
 *     <li>Trainee chỉ đọc bản ghi của mình thông qua {@code ATTENDANCE_READ_SELF} và ánh xạ
 *         tài khoản ⇒ studentId của contract.</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class AttendanceAccessPolicy {

    public static final String PERMISSION_READ = "ATTENDANCE_READ";
    public static final String PERMISSION_CREATE = "ATTENDANCE_CREATE";
    public static final String PERMISSION_UPDATE = "ATTENDANCE_UPDATE";
    public static final String PERMISSION_UNLOCK = "ATTENDANCE_UNLOCK";
    public static final String PERMISSION_READ_SELF = "ATTENDANCE_READ_SELF";

    public static final String ROLE_ADMIN = "ROLE_ADMIN";

    AttendanceContractGateway contractGateway;

    public Long currentActorId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new AuthenticationCredentialsNotFoundException("Not authenticated.");
        }
        if (authentication.getPrincipal() instanceof UserPrincipal principal) {
            return principal.getUser().getId();
        }
        throw new AuthenticationCredentialsNotFoundException("Not authenticated.");
    }

    public Long currentActorIdOrNull() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null
                && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof UserPrincipal principal) {
            return principal.getUser().getId();
        }
        return null;
    }

    public boolean isAdmin() {
        return hasAuthority(ROLE_ADMIN);
    }

    public boolean hasAuthority(String authority) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return false;
        }
        return authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(authority::equals);
    }

    /** Đọc bảng điểm danh/record của session: Trainer được phân công hoặc Class Admin. */
    public void requireReadScope(Session session) {
        if (canAdminister() || isAssignedTrainer(session)) {
            return;
        }
        throw new AccessDeniedException("This session is outside your assigned scope.");
    }

    /** Write/update attendance: assigned trainer or Class Admin. */
    public void requireWriteScope(Session session) {
        if (canAdminister() || isAssignedTrainer(session)) {
            return;
        }
        throw new AccessDeniedException("You do not have permission to record attendance for this session.");
    }

    /** Sửa bản ghi đã LOCK (lớp COMPLETED) — chỉ Class Admin có {@code ATTENDANCE_UNLOCK}. */
    public void requireUnlockScope() {
        if (!canUnlock()) {
            throw new AccessDeniedException(
                    "Only a Class Admin with ATTENDANCE_UNLOCK can modify locked attendance.");
        }
    }

    public boolean canUnlock() {
        return isAdmin() || hasAuthority(PERMISSION_UNLOCK);
    }

    /**
     * Đọc một bản ghi: ưu tiên scope quản trị; nếu không có thì cho phép trainee đọc bản ghi
     * của chính mình khi contract ánh xạ được tài khoản ⇒ studentId.
     */
    public void requireRecordReadScope(Session session, Long studentId) {
        if (canAdminister() || isAssignedTrainer(session)) {
            return;
        }
        if (!hasAuthority(PERMISSION_READ_SELF)) {
            throw new AccessDeniedException("You do not have permission to view this attendance record.");
        }
        Long actorId = currentActorId();
        Long mappedStudentId = contractGateway.resolveStudentIdForActor(actorId).orElse(null);
        if (mappedStudentId == null || !mappedStudentId.equals(studentId)) {
            throw new AccessDeniedException("You may only view your own attendance.");
        }
    }

    private boolean canAdminister() {
        return isAdmin();
    }

    private boolean isAssignedTrainer(Session session) {
        Long actorId = currentActorIdOrNull();
        return actorId != null && session != null && actorId.equals(session.getTrainerId());
    }
}
