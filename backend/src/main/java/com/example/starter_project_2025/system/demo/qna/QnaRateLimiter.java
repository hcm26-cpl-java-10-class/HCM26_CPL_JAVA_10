package com.example.starter_project_2025.system.demo.qna;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDateTime;

/**
 * Giới hạn tần suất đặt câu hỏi, dựa trên dữ liệu đã có trong DB (chưa cần Redis).
 *
 * <ul>
 *   <li>Cooldown: tối thiểu {@code app.qna.cooldown-seconds} giây giữa hai câu hỏi của cùng một người.</li>
 *   <li>Trần theo ngày: tối đa {@code app.qna.max-questions-per-day} câu hỏi trong 24 giờ gần nhất.</li>
 *   <li>Chống trùng: không cho gửi lại đúng nội dung đã hỏi ở cùng bài học.</li>
 * </ul>
 *
 * <p>Giới hạn này kiểm tra trước khi ghi nên hai request đồng thời có thể cùng lọt qua; với quy mô lớp học
 * thì chấp nhận được. Khi cần chặt hơn, chuyển sang bộ đếm Redis (starter đã có trong pom).
 */
@Component
public class QnaRateLimiter {

    private final LessonQuestionRepository questionRepository;
    private final long cooldownSeconds;
    private final int maxQuestionsPerDay;

    public QnaRateLimiter(
            LessonQuestionRepository questionRepository,
            @Value("${app.qna.cooldown-seconds:15}") long cooldownSeconds,
            @Value("${app.qna.max-questions-per-day:30}") int maxQuestionsPerDay
    ) {
        this.questionRepository = questionRepository;
        this.cooldownSeconds = cooldownSeconds;
        this.maxQuestionsPerDay = maxQuestionsPerDay;
    }

    /** Ném 429 (quá nhanh / quá nhiều) hoặc 409 (trùng nội dung) nếu người dùng không được đặt câu hỏi lúc này. */
    @Transactional(readOnly = true)
    public void checkCanAsk(Long authorId, Long lessonId, String normalizedContent, LocalDateTime now) {
        questionRepository.findFirstByAuthor_IdOrderByCreatedAtDescIdDesc(authorId).ifPresent(last -> {
            long elapsed = Duration.between(last.getCreatedAt(), now).getSeconds();
            long wait = cooldownSeconds - Math.max(elapsed, 0);
            if (wait > 0) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                        "You are posting too fast. Please wait " + wait + " seconds");
            }
        });

        long today = questionRepository.countByAuthor_IdAndCreatedAtAfter(authorId, now.minusHours(24));
        if (today >= maxQuestionsPerDay) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "Daily question limit reached (" + maxQuestionsPerDay + "). Please try again tomorrow");
        }

        if (questionRepository.existsByLesson_IdAndAuthor_IdAndContentIgnoreCase(
                lessonId, authorId, normalizedContent)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "You already asked this question in this lesson");
        }
    }
}