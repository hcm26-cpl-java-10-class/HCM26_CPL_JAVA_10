package com.example.starter_project_2025.system.exam.dto;

import com.example.starter_project_2025.system.exam.domain.IntegrityEventType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/** NEW (anti-cheat): FE gui theo lo (batch) + heartbeat (events co the rong). */
@Getter @Setter
public class IntegrityEventRequest {

    /** Id ngau nhien cua tab/trinh duyet dang lam bai, dung de phat hien mo nhieu noi. */
    @Size(max = 64)
    private String clientId;

    @Size(max = 50)
    private List<@Valid Item> events;

    @Getter @Setter
    public static class Item {
        @NotNull
        private IntegrityEventType type;
        private Integer durationSeconds;
        @Size(max = 300)
        private String detail;
    }
}
