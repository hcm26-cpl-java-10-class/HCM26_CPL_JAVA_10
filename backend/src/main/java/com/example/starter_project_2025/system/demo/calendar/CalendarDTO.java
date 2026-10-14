package com.example.starter_project_2025.system.demo.calendar;

import com.example.starter_project_2025.base.crud.dto.*;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDate;
import static com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY;

@Getter
@Setter
public class CalendarDTO extends BaseDTO {
    public CalendarDTO() { setIsActive(true); }

    @NotNull(groups = OnCreate.class)
    @Positive(groups = {OnCreate.class, OnUpdate.class})
    private Long classId;
    @NotBlank(groups = OnCreate.class)
    @Pattern(regexp = "(?s).*\\S.*", groups = OnUpdate.class)
    @Size(max = 150, groups = {OnCreate.class, OnUpdate.class})
    private String name;
    @Size(max = 1000, groups = {OnCreate.class, OnUpdate.class})
    private String description;
    @NotNull(groups = OnCreate.class)
    private LocalDate classStartDate;
    @NotNull(groups = OnCreate.class)
    private LocalDate classEndDate;
    @JsonProperty(access = READ_ONLY)
    private Long activeVersionId;
}
