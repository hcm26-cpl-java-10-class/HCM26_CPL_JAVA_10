package com.example.starter_project_2025.system.subject;

import java.math.BigDecimal;

/** Keep numeric hours precise and serialize whole hours as ordinary JSON integers. */
public final class SubjectDuration {
    private SubjectDuration() {}
    public static BigDecimal normalize(BigDecimal hours) {
        if (hours == null) return null;
        var value = hours.stripTrailingZeros();
        return value.scale() < 0 ? value.setScale(0) : value;
    }
}
