
package com.example.starter_project_2025.system.demo.learning_note;

import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class LearningNoteServiceImpl implements LearningNoteService {

    private final LearningNoteRepository noteRepository;
    private final CourseEnrollmentRepository enrollmentRepository;

    @Override
    @Transactional
    public LearningNote create(Long userId, LearningNoteDTO request) {

        boolean enrolled = enrollmentRepository
                .existsByUser_IdAndCourse_Id(
                        userId,
                        request.getCourseId()
                );

        if (!enrolled) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "You are not enrolled in this course"
            );
        }

        LearningNote note = LearningNote.builder()
                .userId(userId)
                .courseId(request.getCourseId())
                .content(request.getContent().trim())
                .build();

        return noteRepository.save(note);
    }
}
