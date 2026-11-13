package com.example.starter_project_2025.system.exam.dto;

import java.math.BigDecimal;
import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.crud.dto.OnUpdate;
import com.example.starter_project_2025.system.exam.domain.ExamCategory;
import com.example.starter_project_2025.system.exam.domain.ExamType;
import com.example.starter_project_2025.system.exam.domain.LatePolicy;
import com.example.starter_project_2025.system.exam.domain.ResultVisibility;
import com.example.starter_project_2025.system.question.dto.QuestionDTO;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.List;

import static com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY;

@Getter @Setter
public class ExamDTO extends BaseDTO {

    /** Ten nguoi tao (chi de hien thi, he thong tu dien). */
    @JsonProperty(access = READ_ONLY)
    private String createdByName;

    /** So bai da nop dang cho giao vien cham (chi de hien thi). */
    @JsonProperty(access = READ_ONLY)
    private Long pendingGradingCount;

    /** Da co sinh vien lam bai hay chua (dung de khoa sua/them/xoa cau hoi; chi de hien thi). */
    @JsonProperty(access = READ_ONLY)
    private Boolean hasAttempts;

    @NotBlank(groups = OnCreate.class)
    @Size(max = 200, groups = {OnCreate.class, OnUpdate.class})
    private String title;

    @NotNull(groups = OnCreate.class)
    @Min(value = 1, groups = {OnCreate.class, OnUpdate.class})
    private Integer durationMinutes;

    @Min(value = 1, groups = {OnCreate.class, OnUpdate.class}, message = "maxAttempts phải >= 1")
    private Integer maxAttempts;

    private Boolean shuffleQuestions;

    private Boolean shuffleOptions;

    private Boolean showAnswersAfterExam;

    @DecimalMin(value = "0", groups = {OnCreate.class, OnUpdate.class}, message = "passScore phải >= 0")
    private BigDecimal passScore;

    @DecimalMin(value="0", groups={OnCreate.class,OnUpdate.class})
    @DecimalMax(value="100", groups={OnCreate.class,OnUpdate.class})
    @jakarta.validation.constraints.Digits(integer=3,fraction=2,groups={OnCreate.class,OnUpdate.class})
    private BigDecimal courseWeight;
    @JsonIgnore private boolean courseWeightProvided;
    public void setCourseWeight(BigDecimal weight) {
        this.courseWeight=weight;
        this.courseWeightProvided=true;
    }

    @DecimalMin(value = "0.01", groups = {OnCreate.class, OnUpdate.class}, message = "maxScore phải > 0")
    @DecimalMax(value = "1000", groups = {OnCreate.class, OnUpdate.class}, message = "maxScore tối đa 1000")
    private BigDecimal maxScore;

    private LatePolicy latePolicy;

    @Min(value = 1, groups = {OnCreate.class, OnUpdate.class}, message = "latePenaltyPercent phải từ 1 đến 100")
    @Max(value = 100, groups = {OnCreate.class, OnUpdate.class}, message = "latePenaltyPercent phải từ 1 đến 100")
    private Integer latePenaltyPercent;

    @Min(value = 0, groups = {OnCreate.class, OnUpdate.class}, message = "lateGraceMinutes phải >= 0")
    private Integer lateGraceMinutes;

    private ResultVisibility resultVisibility;

    private ExamType examType;

    private ExamCategory category;

    private List<Long> questionIds;

    @JsonProperty(access = READ_ONLY)
    private List<QuestionDTO> questions;

    @JsonProperty(access = READ_ONLY)
    private Integer totalPoints;

    @Size(max = 100, groups = {OnCreate.class, OnUpdate.class})
    private String accessCode;

    // NEW (anti-cheat)
    private Boolean antiCheatEnabled;
    private Boolean detectTabSwitch;
    private Boolean blockCopyPaste;
    private Boolean requireFullscreen;
    private Boolean singleSession;
    private Boolean cameraProctoring;
    private Boolean notifyOnViolation;
    /** Chi dat luc tao de thi (null = mac dinh 35 do / 2 giay / 20%); khi doc luon tra ve gia tri dang ap dung. */
    private Integer headTurnAngleDeg;
    private Integer headTurnSeconds;
    private Integer fastSubmitPercent;

    // ---- Lien ket voi course / section / lesson (tuy chon) ----
    private Long courseId;
    private Long sectionId;
    private Long lessonId;
    /** Ten hien thi (chi doc, he thong tu dien). */
    @JsonProperty(access = READ_ONLY)
    private String courseName;
    @JsonProperty(access = READ_ONLY)
    private String sectionTitle;
    @JsonProperty(access = READ_ONLY)
    private String lessonTitle;

    /** true khi request co gui it nhat mot trong courseId/sectionId/lessonId (ke ca gia tri null = go lien ket). */
    @JsonIgnore
    private boolean courseLinkProvided;

    public void setCourseId(Long courseId) {
        this.courseId = courseId;
        this.courseLinkProvided = true;
    }

    public void setSectionId(Long sectionId) {
        this.sectionId = sectionId;
        this.courseLinkProvided = true;
    }

    public void setLessonId(Long lessonId) {
        this.lessonId = lessonId;
        this.courseLinkProvided = true;
    }

    @JsonProperty(access = READ_ONLY)
    private Boolean hasPassword;
}