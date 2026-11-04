package com.example.starter_project_2025.system.demo.qna;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.regex.Pattern;

/**
 * Chuẩn hóa và kiểm tra nội dung câu hỏi / câu trả lời trước khi lưu.
 *
 * <p>Lưu ý về XSS: nội dung được lưu ở dạng văn bản thuần, KHÔNG escape HTML lúc lưu (escape hai lần sẽ hiển
 * thị sai). Việc escape nằm ở lớp hiển thị: React render text node, còn email dùng {@code th:text}. Không
 * được đổi sang {@code dangerouslySetInnerHTML} / {@code th:utext} cho các trường này.
 */
public final class QnaContentPolicy {

    public static final int MIN_LENGTH = 3;
    public static final int MAX_LENGTH = 2000;

    /** Ký tự điều khiển (trừ \n và \t) và ký tự độ rộng bằng 0 dùng để "giấu" nội dung rỗng. */
    private static final Pattern INVISIBLE = Pattern.compile(
            "[\\p{Cntrl}&&[^\\n\\t]]|[\\u200B-\\u200F\\u2060\\uFEFF\\u202A-\\u202E]");
    private static final Pattern EXTRA_BLANK_LINES = Pattern.compile("\\n{3,}");

    private QnaContentPolicy() {
    }

    /** Trả về nội dung đã làm sạch, hoặc ném 400 nếu không hợp lệ. */
    public static String normalize(String raw) {
        String text = raw == null ? "" : raw;
        text = text.replace("\r\n", "\n").replace('\r', '\n');
        text = INVISIBLE.matcher(text).replaceAll("");
        text = EXTRA_BLANK_LINES.matcher(text).replaceAll("\n\n");
        text = text.strip();

        if (text.isEmpty()) {
            throw badRequest("Content must not be blank");
        }
        if (text.codePointCount(0, text.length()) < MIN_LENGTH) {
            throw badRequest("Content must be at least " + MIN_LENGTH + " characters");
        }
        if (text.length() > MAX_LENGTH) {
            throw badRequest("Content must not exceed " + MAX_LENGTH + " characters");
        }
        if (text.codePoints().noneMatch(Character::isLetterOrDigit)) {
            throw badRequest("Content must contain text, not only symbols or emoji");
        }
        if (looksLikeRepeatedCharacters(text)) {
            throw badRequest("Content looks like spam (repeated characters)");
        }
        return text;
    }

    /** Từ 10 ký tự trở lên mà chỉ gồm tối đa 2 ký tự khác nhau, ví dụ "aaaaaaaaaaaa" hoặc "hahahahaha". */
    private static boolean looksLikeRepeatedCharacters(String text) {
        long visible = text.codePoints().filter(cp -> !Character.isWhitespace(cp)).count();
        if (visible < 10) {
            return false;
        }
        return text.codePoints().filter(cp -> !Character.isWhitespace(cp)).distinct().count() <= 2;
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}