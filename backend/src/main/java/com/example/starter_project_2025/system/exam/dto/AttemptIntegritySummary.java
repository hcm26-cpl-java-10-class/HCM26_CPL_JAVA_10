package com.example.starter_project_2025.system.exam.dto;

import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/**
 * Tom tat trang thai gian lan cua 1 luot thi, dung cho giao vien kiem tra khi
 * xu ly khieng nai diem.
 */
@Getter
@Setter
public class AttemptIntegritySummary {

    /** Luot thi co bi gan co gian lan hay khong (it nhat 1 vi pham). */
    private boolean flagged;
    private int totalViolations;
    private int tabSwitchCount;
    private int copyPasteCount;
    private int fullscreenExitCount;
    private int shortcutCount;
    private int multiSessionCount;
    private int windowBlurCount;
    private int contextMenuCount;
    private int totalAwaySeconds;
    private Instant lastViolationAt;
    /** De thi co bat anti-cheat hay khong. */
    private boolean antiCheatEnabled;
}
