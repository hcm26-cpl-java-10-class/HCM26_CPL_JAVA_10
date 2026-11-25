package com.example.starter_project_2025.system.demo.course_review.dto.response;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CourseReviewResponse extends BaseDTO {
    private Long courseId;
    private Long studentId;
    private String studentFullName;
    private Integer rating;
    private String comment;
}