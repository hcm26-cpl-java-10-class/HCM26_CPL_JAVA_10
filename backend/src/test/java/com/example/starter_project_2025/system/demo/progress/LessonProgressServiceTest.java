package com.example.starter_project_2025.system.demo.progress;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LessonProgressServiceTest {

    @Test
    void marksAndUnmarksLesson() {
        CourseEnrollment enrollment = CourseEnrollment.builder().id(7L).build();
        AtomicReference<LessonProgress> stored = new AtomicReference<>();

        CourseEnrollmentRepository enrollmentRepository = repository(
                CourseEnrollmentRepository.class,
                (method, args) -> Optional.of(enrollment)
        );
        LessonProgressRepository progressRepository = repository(
                LessonProgressRepository.class,
                (method, args) -> switch (method) {
                    case "findByEnrollment_IdAndLessonId" -> Optional.ofNullable(stored.get());
                    case "save" -> {
                        LessonProgress progress = (LessonProgress) args[0];
                        progress.setId(1L);
                        stored.set(progress);
                        yield progress;
                    }
                    case "findAllByEnrollment_IdOrderByLessonIdAsc" -> List.of(stored.get());
                    default -> throw new UnsupportedOperationException(method);
                }
        );
        LessonProgressService service = new LessonProgressService(progressRepository, enrollmentRepository);

        assertTrue(service.setCompleted(3L, 7L, 11L, true).isCompleted());
        assertFalse(service.setCompleted(3L, 7L, 11L, false).isCompleted());
        assertFalse(service.getProgress(3L, 7L).getFirst().isCompleted());
    }

    @Test
    void rejectsAnotherUsersEnrollment() {
        CourseEnrollmentRepository enrollmentRepository = repository(
                CourseEnrollmentRepository.class,
                (method, args) -> Optional.empty()
        );
        LessonProgressRepository progressRepository = repository(
                LessonProgressRepository.class,
                (method, args) -> List.of()
        );
        LessonProgressService service = new LessonProgressService(progressRepository, enrollmentRepository);

        assertThrows(ResourceNotFoundException.class, () -> service.getProgress(3L, 7L));
    }

    @SuppressWarnings("unchecked")
    private static <T> T repository(Class<T> type, RepositoryCall call) {
        return (T) Proxy.newProxyInstance(
                type.getClassLoader(),
                new Class<?>[]{type},
                (proxy, method, args) -> call.invoke(method.getName(), args == null ? new Object[0] : args)
        );
    }

    @FunctionalInterface
    private interface RepositoryCall {
        Object invoke(String method, Object[] args);
    }
}
