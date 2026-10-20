package com.example.starter_project_2025.system.schedule.calendar.crud;

import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus;
import com.example.starter_project_2025.base.crud.dto.*;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;
import static com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY;

@Getter
@Setter
public class CalendarVersionDTO extends BaseDTO {
    public CalendarVersionDTO() { setIsActive(true); }
    @NotNull(groups = OnCreate.class)
    @Positive(groups = {OnCreate.class, OnUpdate.class})
    private Long calendarId;
    @NotBlank(groups = OnCreate.class)
    @Pattern(regexp = "(?s).*\\S.*", groups = OnUpdate.class)
    @Size(max = 150, groups = {OnCreate.class, OnUpdate.class})
    private String name;
    @Size(max = 1000, groups = {OnCreate.class, OnUpdate.class})
    private String description;
    @JsonProperty(access = READ_ONLY)
    private Integer versionNumber;
    @JsonProperty(access = READ_ONLY)
    private LocalDateTime publishedAt;
    @JsonProperty(access = READ_ONLY)
    private CalendarVersionStatus status;
}
