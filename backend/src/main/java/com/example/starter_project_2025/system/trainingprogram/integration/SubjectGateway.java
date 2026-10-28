
package com.example.trainingprogram.integration;

import java.util.Optional;

/**
 * Gateway dùng để truy vấn thông tin môn học từ Subject module.
 *
 * Implementation cần chuyển dữ liệu từ Subject module
 * về SubjectInfo của Training Program.
 */
public interface SubjectGateway {

    /**
     * Tìm môn học theo ID.
     *
     * @param id ID môn học
     * @return Optional chứa thông tin môn học nếu tìm thấy
     */
    Optional<SubjectInfo> findById(Long id);

    /**
     * Thông tin môn học mà Training Program cần sử dụng.
     *
     * active tương ứng với trạng thái hoạt động của môn học.
     */
    record SubjectInfo(
        Long id,
        String code,
        String name,
        Integer durationHours,
        boolean active
    ) {}
}
