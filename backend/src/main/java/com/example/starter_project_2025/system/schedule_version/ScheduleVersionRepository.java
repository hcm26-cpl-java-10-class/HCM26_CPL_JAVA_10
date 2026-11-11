package com.example.starter_project_2025.system.schedule_version;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository cho ScheduleVersion.
 * Chủ sở hữu: Phát
 */
@Repository
public interface ScheduleVersionRepository extends BaseCrudRepository<ScheduleVersion, Long> {

    /**
     * Lấy tất cả phiên bản của một lớp học, sắp xếp theo versionNumber tăng dần.
     */
    List<ScheduleVersion> findByClassIdOrderByVersionNumberAsc(String classId);

    /**
     * Lấy phiên bản đang ACTIVE của một lớp.
     * Dùng cho Tân (hiển thị thời khóa biểu) và kiểm tra trước khi kích hoạt.
     */
    Optional<ScheduleVersion> findByClassIdAndStatus(String classId, ScheduleVersionStatus status);

    /**
     * Lấy phiên bản có số thứ tự lớn nhất của lớp.
     * Dùng để tự động sinh versionNumber = maxVersion + 1 khi tạo nháp/clone.
     */
    Optional<ScheduleVersion> findTopByClassIdOrderByVersionNumberDesc(String classId);

    /**
     * Lấy danh sách lịch sử (tất cả phiên bản) của lớp, sắp xếp theo versionNumber giảm dần.
     */
    List<ScheduleVersion> findByClassIdOrderByVersionNumberDesc(String classId);

    /**
     * Kiểm tra xem lớp đã có phiên bản DRAFT đang mở không.
     * Giúp chặn tạo nhiều bản nháp trùng cho cùng một lớp.
     */
    boolean existsByClassIdAndStatus(String classId, ScheduleVersionStatus status);
}
