package com.example.starter_project_2025.system.exam.dto;

import com.example.starter_project_2025.system.question.dto.CodeSpecDTO;
import lombok.Getter;
import lombok.Setter;

/** Giao vien doi chieu loi giai mau voi khai bao ham + test case (chua luu). */
@Getter @Setter
public class CodeVerifyRequest {
    private CodeSpecDTO spec;
    /** Loi giai mau (lop Solution, Java). */
    private String code;
}
