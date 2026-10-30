package com.example.starter_project_2025.system.question.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

/**
 * Mo ta bai lap trinh kieu Coderbyte: giao vien khai bao ham (ten, tham so, kieu tra ve) va 10 test case
 * (2 hien thi + 8 an). Duoc luu dang JSON trong Question.codeSpec.
 */
@Getter @Setter
public class CodeSpecDTO {

    private String functionName;
    private String returnType;
    private List<Param> params = new ArrayList<>();
    private List<TestCase> tests = new ArrayList<>();

    /** Chi de tra ve (sinh tu dong tu khai bao ham). */
    private String starterCode;

    @Getter @Setter
    public static class Param {
        private String name;
        private String type;
    }

    @Getter @Setter
    public static class TestCase {
        /** Moi phan tu la gia tri cua 1 tham so, theo dung thu tu tham so. */
        private List<String> inputs = new ArrayList<>();
        private String expected;
        private boolean visible;
    }
}
