package com.example.starter_project_2025.system.schedule.session.session_attendance;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * T1 / US-DEV6-01 — Bản ghi điểm danh cho cặp <b>(studentId, sessionId)</b>.
 *
 * <p>Đây là dữ liệu DEV 6 sở hữu. {@code Session}, {@code Class}, {@code Student} chỉ được
 * tham chiếu logic (không ràng buộc vật lý xuyên bounded context); các trường
 * {@code classId}, {@code calendarVersionId}, {@code attendanceDate}, {@code membershipStatus}
 * là <b>snapshot</b> tại thời điểm ghi để tra cứu/thống kê không phụ thuộc contract sống.</p>
 *
 * <p>Quy ước audit (NFR-AUD): {@code createdBy/createdAt} của {@link BaseEntity} chính là
 * {@code recordedBy/recordedAt} (actor + thời điểm ghi), {@code updatedBy/updatedAt} là actor +
 * thời điểm cập nhật gần nhất. Tất cả do server set, client không được gửi.</p>
 *
 * <p>Không có hard delete: bản ghi được giữ lại kể cả khi session bị hủy (trạng thái
 * {@code RETAINED} ở tầng nghiệp vụ) theo SRS Mục 7.1.</p>
 */
@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "attendance_records",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_attendance_session_student",
                columnNames = {"session_id", "student_id"}),
        indexes = {
                @Index(name = "idx_attendance_session", columnList = "session_id"),
                @Index(name = "idx_attendance_student_date", columnList = "student_id,attendance_date"),
                @Index(name = "idx_attendance_class_date", columnList = "class_id,attendance_date")
        })
@FieldDefaults(level = AccessLevel.PRIVATE)
@ResourcePermission("ATTENDANCE")
public class Attendance extends BaseEntity {

    /** Buổi học (DEV 6 chỉ đọc qua contract — UFR-PEO-014). */
    @Column(name = "session_id", nullable = false)
    Long sessionId;

    /** Snapshot lớp tại thời điểm ghi. */
    @Column(name = "class_id", nullable = false)
    Long classId;

    /** Snapshot Calendar Version tại thời điểm ghi (BR-UNI-09). */
    @Column(name = "calendar_version_id", nullable = false)
    Long calendarVersionId;

    /** Học viên — nguồn roster từ UFR-PEO-010 (chỉ đọc). */
    @Column(name = "student_id", nullable = false)
    Long studentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    AttendanceStatus status;

    /** Ghi chú vận hành (lý do vắng, đi muộn…) — tối đa 500 ký tự. */
    @Column(name = "note", length = 500)
    String note;

    /** Ngày diễn ra buổi học (timezone tenant) — dùng cho BR-ATT-01 và thống kê. */
    @Column(name = "attendance_date", nullable = false)
    LocalDate attendanceDate;

    /** Snapshot trạng thái thành viên trong lớp tại thời điểm ghi. */
    @Enumerated(EnumType.STRING)
    @Column(name = "membership_status", length = 20)
    AttendanceMembershipStatus membershipStatus;

    /** Optimistic locking (NFR-DATA / If-Match ↔ ETag). */
    @Version
    @Column(name = "version")
    Long version;

    /** {@code recordedBy} theo contract API — chính là {@code createdBy} của BaseEntity. */
    public Long getRecordedBy() {
        return getCreatedBy();
    }

    /** {@code recordedAt} theo contract API — chính là {@code createdAt} của BaseEntity. */
    public LocalDateTime getRecordedAt() {
        return getCreatedAt();
    }

    /** Phiên bản an toàn cho response khi entity vừa persist (chưa flush xong). */
    public long versionOrZero() {
        return version != null ? version : 0L;
    }
}
