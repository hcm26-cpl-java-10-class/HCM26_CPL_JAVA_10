package com.example.starter_project_2025.system.exam.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter @Setter
public class CodeRunResponse {

    private List<TestRun> tests = new ArrayList<>();
    private TestRun custom;
    private int passed;
    private int total;

    @Getter @Setter
    public static class TestRun {
        private int index;
        private boolean passed;
        /** OK, WRONG_ANSWER, COMPILE_ERROR, RUNTIME_ERROR, TIME_LIMIT, INFRA_ERROR */
        private String status;
        private List<String> inputs;
        private String expected;
        private String actual;
        private String error;
    }
}
