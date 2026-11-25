package com.example.starter_project_2025.system.demo.aicomparison;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Các hàm thống kê dùng để tính peerStats.
 *
 * <p>Tách riêng để test được độc lập với Spring. Nguyên tắc: AI không tự tính,
 * mọi thống kê đều đi qua đây.
 */
final class CourseAiComparisonStats {

    private CourseAiComparisonStats() {
    }

    /** Trung vị của một danh sách đã sắp xếp tăng dần. */
    static double median(List<Double> sorted) {
        int n = sorted.size();
        if (n == 0) return 0;
        if (n % 2 == 1) return round2(sorted.get(n / 2));
        return round2((sorted.get(n / 2 - 1) + sorted.get(n / 2)) / 2.0);
    }

    /** Trung vị của một danh sách chưa sắp xếp. */
    static double medianOf(List<Double> values) {
        List<Double> sorted = new ArrayList<>(values);
        Collections.sort(sorted);
        return median(sorted);
    }

    /** Trung bình, làm tròn 2 chữ số. */
    static double mean(List<Double> values) {
        if (values.isEmpty()) return 0;
        return round2(values.stream().mapToDouble(Double::doubleValue).average().orElse(0));
    }

    /**
     * Số khóa học có giá trị TỐT HƠN giá trị của target.
     *
     * @param higherIsBetter {@code true} nếu giá trị cao hơn là tốt hơn.
     */
    static int betterCount(List<Double> peerValues, double targetValue, boolean higherIsBetter) {
        int count = 0;
        for (Double value : peerValues) {
            if (value == null) continue;
            if (higherIsBetter ? value > targetValue : value < targetValue) {
                count++;
            }
        }
        return count;
    }

    /**
     * Thứ hạng của target trong tổng (peers + target): 1 = tốt nhất.
     */
    static int rank(List<Double> peerValues, double targetValue, boolean higherIsBetter) {
        return betterCount(peerValues, targetValue, higherIsBetter) + 1;
    }

    /**
     * Percentile 0-100, cao = tốt.
     *
     * <p>Công thức đối xứng: target đứng hạng {@code r} trong tổng {@code n+1}
     * khóa thì percentile = (n+1-r)/n * 100.
     *
     * <p>Với 5 khóa: hạng 1 → 100, hạng 2 → 75, hạng 3 → 50, hạng 4 → 25, hạng 5 → 0.
     * Nhờ vậy ngưỡng 67 / 33 chia đều: hạng 1-2 là ABOVE, hạng 4-5 là BELOW.
     *
     * <p>Chỉ có mình target (không có peer) thì không có gì để so sánh → 50 (AT_PAR).
     */
    static int percentile(List<Double> peerValues, double targetValue, boolean higherIsBetter) {
        int total = peerValues.size() + 1;
        int rank = rank(peerValues, targetValue, higherIsBetter);
        if (total <= 1) {
            return 50;
        }
        return (int) Math.round((double) (total - rank) / (total - 1) * 100.0);
    }

    /**
     * Vị trí của target trong một module, theo percentile của các chỉ số chính.
     *
     * @return {@code ABOVE}, {@code AT_PAR} hoặc {@code BELOW}.
     */
    static String position(List<Integer> percentiles) {
        if (percentiles == null || percentiles.isEmpty()) return "AT_PAR";
        int avg = (int) Math.round(percentiles.stream().mapToInt(Integer::intValue).average().orElse(50));
        if (avg >= 67) return "ABOVE";
        if (avg <= 33) return "BELOW";
        return "AT_PAR";
    }

    static double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
