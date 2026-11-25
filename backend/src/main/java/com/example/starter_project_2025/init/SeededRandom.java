package com.example.starter_project_2025.init;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

/**
 * Tiện ích dùng chung cho các {@code DataInitializer} để sinh dữ liệu mẫu
 * <b>ổn định theo seed</b> (deterministic).
 *
 * <p>Yêu cầu: mọi logic phân bổ ngẫu nhiên (số lượng sinh viên từng khóa, danh sách
 * sinh viên được chọn, điểm thi, số lượt thi lại) phải dùng {@link Random} với
 * <b>fixed seed</b> để dữ liệu sinh ra đa dạng nhưng luôn giống hệt nhau mỗi khi
 * restart Backend hoặc chạy trên máy khác.
 *
 * <p>Cách dùng chuẩn:
 * <pre>{@code
 * Random random = SeededRandom.forScope("enrollment", courseId);
 * List<User> picked = SeededRandom.shuffled(pool, random).subList(0, n);
 * }</pre>
 */
public final class SeededRandom {

    /** Seed gốc của toàn bộ dữ liệu mẫu. Đổi seed này sẽ đổi toàn bộ dữ liệu sinh ra. */
    public static final long ROOT_SEED = 2026L;

    private SeededRandom() {
    }

    /**
     * Tạo {@link Random} có seed ổn định cho một "phạm vi" nghiệp vụ.
     *
     * <p>Seed được tính bằng hash ổn định (không phụ thuộc {@code String.hashCode} vì
     * hàm viên chuẩn không đảm bảo giống nhau giữa mọi JVM) nên cùng một scope +
     * cùng một khóa luôn cho ra cùng một chuỗi số ngẫu nhiên.
     *
     * @param scope  tên phạm vi, ví dụ {@code "enrollment"}, {@code "exam-attempt"}
     * @param keys   các khóa phân biệt, ví dụ {@code courseId}
     */
    public static Random forScope(String scope, Object... keys) {
        return new Random(seedFor(scope, keys));
    }

    /** Tính seed ổn định cho một scope + các khóa. */
    public static long seedFor(String scope, Object... keys) {
        long seed = ROOT_SEED;
        seed = 31L * seed + stableHash(scope == null ? "" : scope);
        if (keys != null) {
            for (Object key : keys) {
                seed = 31L * seed + stableHash(key);
            }
        }
        return seed;
    }

    /**
     * Hash ổn định theo đặc tả Java {@link String#hashCode()} nhưng dùng biến
     * {@code long} để tránh tràn số và không phụ thuộc chi tiết nội bộ của JDK.
     */
    private static long stableHash(Object value) {
        if (value == null) {
            return 0L;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value instanceof CharSequence text) {
            long hash = 0L;
            for (int i = 0; i < text.length(); i++) {
                hash = 31L * hash + text.charAt(i);
            }
            return hash;
        }
        return value.hashCode();
    }

    /**
     * Trả về bản sao đã xáo trộn của {@code source} bằng {@code random} được cung cấp.
     * Không thay đổi danh sách gốc.
     */
    public static <T> List<T> shuffled(List<T> source, Random random) {
        List<T> copy = new ArrayList<>(source);
        Collections.shuffle(copy, random);
        return copy;
    }

    /**
     * Chọn ngẫu nhiên {@code count} phần tử từ {@code source} (không lặp phần tử).
     * Trả về list mới; danh sách gốc không bị thay đổi.
     */
    public static <T> List<T> pick(List<T> source, int count, Random random) {
        if (source.isEmpty() || count <= 0) {
            return List.of();
        }
        List<T> pool = shuffled(source, random);
        return new ArrayList<>(pool.subList(0, Math.min(count, pool.size())));
    }
}
