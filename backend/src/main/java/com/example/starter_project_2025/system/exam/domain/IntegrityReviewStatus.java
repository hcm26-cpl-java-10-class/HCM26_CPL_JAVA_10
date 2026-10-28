package com.example.starter_project_2025.system.exam.domain;

/** NEW (anti-cheat nang cao): ket qua reviewer xem xet 1 luot thi. NOT_REVIEWED = chua co ban ghi. */
public enum IntegrityReviewStatus {
    NOT_REVIEWED,
    REVIEWED_NORMAL,      // da xem - binh thuong
    REVIEWED_SUSPICIOUS   // da xem - nghi van (van la nhan dinh so bo, khong ket luan gian lan)
}
