package com.example.starter_project_2025.system.exam.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter @Setter
public class CodeVerifyResponse {

    private List<Item> tests = new ArrayList<>();
    /** So test co dau ra khop ket qua mong doi. */
    private int matched;
    private int total;
    /** Khong goi duoc may cham cho it nhat mot test. */
    private boolean infraError;
    /** Loi bien dich (neu co) cua loi giai mau. */
    private String compileError;

    @Getter @Setter
    public static class Item {
        private int index;
        private boolean visible;
        /** OK (khop), WRONG_ANSWER (chay duoc nhung khac mong doi), COMPILE_ERROR, RUNTIME_ERROR, TIME_LIMIT, INFRA_ERROR, SKIPPED */
        private String status;
        private String actual;
        private String error;
        private boolean matches;
    }
}
