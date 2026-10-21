package com.example.starter_project_2025.system.schedule.session.session_attendance;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * T1 — Truy vấn bản ghi điểm danh. Mọi truy vấn đều giới hạn trên bản ghi còn hiệu lực
 * (không hard-delete, chỉ deactivate theo retention).
 */
public interface AttendanceRepository extends BaseCrudRepository<Attendance, Long> {

    Optional<Attendance> findByIdAndIsActiveTrue(Long id);

    Optional<Attendance> findBySessionIdAndStudentId(Long sessionId, Long studentId);

    List<Attendance> findBySessionIdAndIsActiveTrueOrderByStudentIdAsc(Long sessionId);

    List<Attendance> findBySessionIdAndStudentIdIn(Long sessionId, Collection<Long> studentIds);

    List<Attendance> findByStudentIdAndIsActiveTrueOrderByAttendanceDateDescSessionIdDesc(Long studentId);

    long countBySessionIdAndIsActiveTrue(Long sessionId);

    /**
     * Khóa bi quan trên bản ghi khi cập nhật để tránh hai request đồng thời cùng ghi đè
     * (kết hợp optimistic version ở tầng If-Match).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Attendance a where a.id = :id")
    Optional<Attendance> findByIdForUpdate(@Param("id") Long id);

    /** Nguồn cho báo cáo/kiểm tra trùng theo ngày của học viên (BR-ATT-01). */
    @Query("""
            select a from Attendance a
            where a.studentId = :studentId
              and a.isActive = true
              and a.attendanceDate between :fromDate and :toDate
            order by a.attendanceDate asc, a.sessionId asc
            """)
    List<Attendance> findByStudentAndDateRange(@Param("studentId") Long studentId,
                                               @Param("fromDate") LocalDate fromDate,
                                               @Param("toDate") LocalDate toDate);
}
