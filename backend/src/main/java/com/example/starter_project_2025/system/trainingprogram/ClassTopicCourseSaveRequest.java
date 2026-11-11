package com.example.starter_project_2025.system.trainingprogram;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record ClassTopicCourseSaveRequest(
        @NotEmpty(message = "Danh sách liên kết Course theo Topic không được rỗng.")
        List<@Valid TopicCourseItem> items
) {
    public record TopicCourseItem(
            @NotNull(message = "programSubjectId là bắt buộc.")
            Long programSubjectId,
            Long courseId
    ) {}
}

