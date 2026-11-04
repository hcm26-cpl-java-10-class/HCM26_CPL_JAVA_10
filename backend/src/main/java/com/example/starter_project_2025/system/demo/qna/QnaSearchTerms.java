package com.example.starter_project_2025.system.demo.qna;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/** Chuẩn hóa từ khóa tìm kiếm Q&A thành danh sách từ (AND) đã escape ký tự đặc biệt của LIKE. */
final class QnaSearchTerms {

    static final int MAX_KEYWORD_LENGTH = 100;
    static final int MAX_TERMS = 6;
    /** Ký tự escape dùng cho LIKE (không dùng "\" để chạy giống nhau trên H2 / SQL Server / PostgreSQL). */
    static final char ESCAPE = '!';

    private QnaSearchTerms() {
    }

    /**
     * @return danh sách pattern dạng {@code %từ%} (đã lower-case, đã escape); rỗng nếu không có từ khóa.
     * @throws ResponseStatusException 400 nếu từ khóa dài quá {@link #MAX_KEYWORD_LENGTH} ký tự
     */
    static List<String> toLikePatterns(String keyword) {
        if (keyword == null) {
            return List.of();
        }
        String normalized = keyword.strip();
        if (normalized.isEmpty()) {
            return List.of();
        }
        if (normalized.length() > MAX_KEYWORD_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Search keyword must not exceed " + MAX_KEYWORD_LENGTH + " characters");
        }
        return Arrays.stream(normalized.toLowerCase(Locale.ROOT).split("\\s+"))
                .filter(term -> !term.isEmpty())
                .distinct()
                .limit(MAX_TERMS)
                .map(term -> "%" + escapeLike(term) + "%")
                .toList();
    }

    static String escapeLike(String value) {
        StringBuilder out = new StringBuilder(value.length() + 4);
        for (char ch : value.toCharArray()) {
            if (ch == ESCAPE || ch == '%' || ch == '_' || ch == '[') {
                out.append(ESCAPE);
            }
            out.append(ch);
        }
        return out.toString();
    }
}
