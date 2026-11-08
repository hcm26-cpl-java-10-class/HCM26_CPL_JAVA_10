package com.example.starter_project_2025.system.demo.course_review;

import com.example.starter_project_2025.system.demo.course_review.dto.response.CourseReviewResponse;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface CourseReviewMapper {

    @Mapping(target = "courseId", source = "course.id")
    @Mapping(target = "studentId", source = "user.id")
    @Mapping(
            target = "studentFullName",
            expression = "java(entity.getUser().getFullName())"
    )
    CourseReviewResponse toResponse(CourseReview entity);
}
