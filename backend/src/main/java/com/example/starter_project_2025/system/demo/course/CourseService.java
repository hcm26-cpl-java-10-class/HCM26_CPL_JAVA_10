package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.system.demo.course.dto.PublishValidationResult;
import com.example.starter_project_2025.system.demo.course.dto.ReorderRequest;

public interface CourseService
        extends BaseCrudService<Long, CourseDTO, CourseFilter> {

    /** Validate xem khoá học có đủ điều kiện publish chưa (không thay đổi trạng thái). */
    PublishValidationResult validateForPublish(Long courseId);

    /** Validate rồi chuyển trạng thái khoá học sang PUBLISHED. */
    CourseDTO publishCourse(Long courseId);

    /** Cập nhật thứ tự section/lesson hàng loạt, cho phép chuyển lesson sang section khác. */
    void reorderCurriculum(Long courseId, ReorderRequest request);
}

