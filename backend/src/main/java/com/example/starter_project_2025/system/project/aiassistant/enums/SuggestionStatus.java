package com.example.starter_project_2025.system.project.aiassistant.enums;

public enum SuggestionStatus {
    PENDING,
    APPROVED,
    REJECTED,
    APPLIED;

    // Check whether this suggestion can be edited
    public boolean canEdit() {
        return this == PENDING;
    }

    // Check whether this suggestion can transition to another status
    public boolean canTransitionTo(SuggestionStatus target) {

        if (target == null) {
            return false;
        }

        return switch (this) {
            case PENDING ->
                    target == APPROVED || target == REJECTED;

            case APPROVED ->
                    target == APPLIED;

            case REJECTED, APPLIED -> false;
        };
    }
}


//Status	Ý nghĩa
//PENDING	Chờ mentor review
//APPROVED	Mentor đã chấp thuận
//REJECTED	Mentor từ chối
//APPLIED	Đã áp dụng vào ProjectTemplate