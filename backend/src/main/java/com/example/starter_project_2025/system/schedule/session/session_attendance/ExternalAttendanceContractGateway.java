package com.example.starter_project_2025.system.schedule.session.session_attendance;

import com.example.starter_project_2025.system.external_api.ExternalApiService;
import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * T1 — Adapter mặc định của {@link AttendanceContractGateway}, đọc dữ liệu lớp từ
 * {@link ExternalApiService} (hệ thống tổng).
 *
 * <p>Lỗi mạng/5xx được chuyển thành {@code unavailable} thay vì ném ra ngoài, để service áp
 * dụng policy fail-open hoặc 503 tuỳ cấu hình {@code attendance.contract.strict}.</p>
 *
 * <p>Roster học viên và ánh xạ tài khoản ⇒ studentId chưa được expose bởi
 * {@link ExternalApiService}. Hai phương thức tương ứng trả {@code unknown}/rỗng và được ghi
 * nhận là điểm nối (seam) để thay adapter khi contract UFR-PEO-010 sẵn sàng.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ExternalAttendanceContractGateway implements AttendanceContractGateway {

    /**
     * Short-lived cache: the class status is read on every attendance write. Without it an
     * unreachable external system would add its connect timeout to each request (including each
     * row of a bulk save) — with it the penalty is paid at most once per TTL per class.
     */
    static final Duration CLASS_CACHE_TTL = Duration.ofSeconds(30);

    final Map<Long, CachedClass> classCache = new ConcurrentHashMap<>();

    ExternalApiService externalApiService;

    @Override
    public ClassSnapshot loadClass(Long classId) {
        if (classId == null) {
            return ClassSnapshot.unavailable();
        }

        CachedClass cached = classCache.get(classId);
        if (cached != null && cached.expiresAt().isAfter(Instant.now())) {
            return cached.snapshot();
        }

        ClassSnapshot snapshot;
        try {
            ExternalClassDTO classInfo = externalApiService.fetchClassById(classId);
            snapshot = classInfo == null
                    ? ClassSnapshot.unavailable()
                    : ClassSnapshot.available(classInfo.getStatus());
        } catch (RuntimeException ex) {
            log.warn("Cannot resolve external class status for classId={}: {}", classId, ex.getMessage());
            snapshot = ClassSnapshot.unavailable();
        }

        classCache.put(classId, new CachedClass(snapshot, Instant.now().plus(CLASS_CACHE_TTL)));
        return snapshot;
    }

    @Override
    public MembershipSnapshot loadMembership(Long classId, Long studentId, LocalDate attendanceDate) {
        // Contract roster (UFR-PEO-010) chưa được expose — trả UNKNOWN để service fail-open.
        return MembershipSnapshot.unknown();
    }

    @Override
    public Optional<Long> resolveStudentIdForActor(Long actorUserId) {
        // Account ⇒ studentId mapping is provided by the training contract (not available yet).
        return Optional.empty();
    }

    private record CachedClass(ClassSnapshot snapshot, Instant expiresAt) {
    }
}
