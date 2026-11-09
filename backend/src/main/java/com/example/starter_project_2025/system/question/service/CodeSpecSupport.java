package com.example.starter_project_2025.system.question.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.starter_project_2025.system.exam.code.JavaHarness;
import com.example.starter_project_2025.system.question.dto.CodeSpecDTO;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/** Doc/ghi JSON, kiem tra hop le va sinh code khung cho bai lap trinh Java. */
public final class CodeSpecSupport {

    /** So test mac dinh khi seed du lieu mau (2 test dau hien thi). Giao vien co the them/bot va chon test hien thi. */
    public static final int VISIBLE_TESTS = 2;
    public static final int MIN_TESTS = 1;
    public static final int MAX_PARAMS = 6;
    public static final int MAX_VALUE_LENGTH = 1000;
    public static final int MAX_MAIN_LENGTH = 20000;
    public static final int DEFAULT_TIME_LIMIT_SECONDS = 5;
    public static final int MIN_TIME_LIMIT_SECONDS = 1;
    public static final int MAX_TIME_LIMIT_SECONDS = 10;

    public static final Set<String> TYPES =
            Set.of("int", "long", "double", "boolean", "char", "String", "int[]", "boolean[]", "String[]");

    private static final Pattern IDENT = Pattern.compile("[A-Za-z_][A-Za-z0-9_]{0,49}");
    private static final Set<String> KEYWORDS = Set.of(
            "abstract", "assert", "boolean", "break", "byte", "case", "catch", "char", "class", "const",
            "continue", "default", "do", "double", "else", "enum", "extends", "final", "finally", "float",
            "for", "goto", "if", "implements", "import", "instanceof", "int", "interface", "long", "native",
            "new", "package", "private", "protected", "public", "return", "short", "static", "strictfp",
            "super", "switch", "synchronized", "this", "throw", "throws", "transient", "try", "void",
            "volatile", "while", "true", "false", "null", "var", "record", "yield", "_");

    private static final Pattern MAIN_CLASS = Pattern.compile("\\bclass\\s+Main\\b");
    private static final Pattern MAIN_METHOD = Pattern.compile("\\bstatic\\s+void\\s+main\\s*\\(");

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private CodeSpecSupport() {
    }

    // ------------------------------------------------------------------ JSON

    public static String toJson(CodeSpecDTO spec) {
        if (spec == null) return null;
        try {
            CodeSpecDTO copy = new CodeSpecDTO();
            copy.setFunctionName(spec.getFunctionName() == null ? null : spec.getFunctionName().trim());
            copy.setReturnType(spec.getReturnType() == null ? null : spec.getReturnType().trim());
            copy.setTimeLimitSeconds(spec.getTimeLimitSeconds());
            copy.setCustomMain(spec.isCustomMain());
            copy.setMainCode(spec.isCustomMain() ? spec.getMainCode() : null);
            String ref = spec.getReferenceCode();
            copy.setReferenceCode(ref == null || ref.isBlank() || ref.length() > MAX_MAIN_LENGTH ? null : ref);
            for (CodeSpecDTO.Param p : spec.getParams() == null ? List.<CodeSpecDTO.Param>of() : spec.getParams()) {
                CodeSpecDTO.Param c = new CodeSpecDTO.Param();
                c.setName(p.getName() == null ? null : p.getName().trim());
                c.setType(p.getType() == null ? null : p.getType().trim());
                copy.getParams().add(c);
            }
            for (CodeSpecDTO.TestCase t : spec.getTests() == null ? List.<CodeSpecDTO.TestCase>of() : spec.getTests()) {
                CodeSpecDTO.TestCase c = new CodeSpecDTO.TestCase();
                c.setInputs(t.getInputs() == null ? new ArrayList<>() : new ArrayList<>(t.getInputs()));
                c.setExpected(t.getExpected());
                c.setVisible(t.isVisible());
                copy.getTests().add(c);
            }
            return MAPPER.writeValueAsString(copy);
        } catch (Exception e) {
            throw new IllegalStateException("Cannot serialize code spec", e);
        }
    }

    public static CodeSpecDTO fromJson(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return MAPPER.readValue(json, CodeSpecDTO.class);
        } catch (Exception e) {
            return null;
        }
    }

    /** Ban day du (co code khung) danh cho giao vien. */
    public static CodeSpecDTO forTeacher(String json) {
        CodeSpecDTO spec = fromJson(json);
        if (spec != null) {
            spec.setStarterCode(starterCode(spec));
            spec.setTimeLimitSeconds(effectiveTimeLimit(spec));
            attachMain(spec);
        }
        return spec;
    }

    /** Ban danh cho thi sinh: chi con 2 test hien thi, khong lo test an. */
    public static CodeSpecDTO forTaker(String json) {
        CodeSpecDTO spec = fromJson(json);
        if (spec == null) return null;
        CodeSpecDTO out = new CodeSpecDTO();
        out.setFunctionName(spec.getFunctionName());
        out.setReturnType(spec.getReturnType());
        out.setParams(spec.getParams());
        out.setTimeLimitSeconds(effectiveTimeLimit(spec));
        out.setStarterCode(starterCode(spec));
        out.setCustomMain(spec.isCustomMain());
        out.setMainCode(spec.getMainCode());
        attachMain(out);
        for (CodeSpecDTO.TestCase t : spec.getTests()) {
            if (t.isVisible()) out.getTests().add(t);
        }
        return out;
    }

    /** Dam bao mainCode luon co gia tri de hien thi: ban tu viet neu co, nguoc lai ban he thong tu sinh. */
    private static void attachMain(CodeSpecDTO spec) {
        String custom = spec.getMainCode();
        if (spec.isCustomMain() && custom != null && !custom.isBlank()) return;
        spec.setCustomMain(false);
        try {
            spec.setMainCode(JavaHarness.generatedMain(spec));
        } catch (RuntimeException e) {
            spec.setMainCode(null);
        }
    }

    /** Gioi han thoi gian (giay) dang ap dung, luon nam trong [1, 10]. */
    public static int effectiveTimeLimit(CodeSpecDTO spec) {
        Integer v = spec == null ? null : spec.getTimeLimitSeconds();
        if (v == null) return DEFAULT_TIME_LIMIT_SECONDS;
        return Math.max(MIN_TIME_LIMIT_SECONDS, Math.min(MAX_TIME_LIMIT_SECONDS, v));
    }

    // ------------------------------------------------------------------ code khung

    public static String starterCode(CodeSpecDTO spec) {
        StringBuilder sb = new StringBuilder();
        sb.append("class Solution {\n");
        sb.append("    public static ").append(spec.getReturnType()).append(' ').append(spec.getFunctionName()).append('(');
        for (int i = 0; i < spec.getParams().size(); i++) {
            if (i > 0) sb.append(", ");
            sb.append(spec.getParams().get(i).getType()).append(' ').append(spec.getParams().get(i).getName());
        }
        sb.append(") {\n");
        sb.append("        // Viết code của bạn ở đây\n");
        sb.append("        return ").append(defaultValue(spec.getReturnType())).append(";\n");
        sb.append("    }\n");
        sb.append("}\n");
        return sb.toString();
    }

    private static String defaultValue(String type) {
        return switch (type) {
            case "int" -> "0";
            case "long" -> "0L";
            case "double" -> "0.0";
            case "boolean" -> "false";
            case "char" -> "' '";
            case "String" -> "\"\"";
            case "int[]" -> "new int[0]";
            case "boolean[]" -> "new boolean[0]";
            case "String[]" -> "new String[0]";
            default -> "null";
        };
    }

    // ------------------------------------------------------------------ kiem tra

    /** Kiem tra phan khai bao ham (ten, kieu, tham so, gioi han thoi gian); khong kiem tra test case. */
    public static List<String> validateSignature(CodeSpecDTO spec) {
        List<String> errors = new ArrayList<>();
        if (spec == null) {
            errors.add("Cần khai báo hàm và test case cho câu hỏi lập trình");
            return errors;
        }
        String fn = spec.getFunctionName() == null ? "" : spec.getFunctionName().trim();
        if (!isIdentifier(fn) || fn.equals("main")) {
            errors.add("Tên hàm không hợp lệ (chỉ gồm chữ, số, dấu _, không bắt đầu bằng số, không trùng từ khóa Java)");
        }
        String ret = spec.getReturnType() == null ? "" : spec.getReturnType().trim();
        if (!TYPES.contains(ret)) {
            errors.add("Kiểu trả về phải là một trong: " + String.join(", ", TYPES.stream().sorted().toList()));
        }
        Integer timeLimit = spec.getTimeLimitSeconds();
        if (timeLimit != null && (timeLimit < MIN_TIME_LIMIT_SECONDS || timeLimit > MAX_TIME_LIMIT_SECONDS)) {
            errors.add("Giới hạn thời gian phải từ " + MIN_TIME_LIMIT_SECONDS + " đến " + MAX_TIME_LIMIT_SECONDS + " giây");
        }

        List<CodeSpecDTO.Param> params = spec.getParams() == null ? List.of() : spec.getParams();
        if (params.size() > MAX_PARAMS) {
            errors.add("Tối đa " + MAX_PARAMS + " tham số");
        }
        java.util.Set<String> names = new java.util.HashSet<>();
        for (CodeSpecDTO.Param p : params) {
            String name = p == null || p.getName() == null ? "" : p.getName().trim();
            String type = p == null || p.getType() == null ? "" : p.getType().trim();
            if (!isIdentifier(name)) {
                errors.add("Tên tham số không hợp lệ: '" + name + "'");
            } else if (!names.add(name)) {
                errors.add("Tên tham số bị trùng: " + name);
            }
            if (!TYPES.contains(type)) {
                errors.add("Kiểu tham số '" + name + "' không được hỗ trợ");
            }
        }
        if (spec.isCustomMain()) {
            String main = spec.getMainCode() == null ? "" : spec.getMainCode();
            if (main.isBlank()) {
                errors.add("Hàm main tự viết đang trống");
            } else if (main.length() > MAX_MAIN_LENGTH) {
                errors.add("Hàm main quá dài (tối đa " + MAX_MAIN_LENGTH + " ký tự)");
            } else if (!MAIN_CLASS.matcher(main).find() || !MAIN_METHOD.matcher(main).find()) {
                errors.add("Hàm main phải nằm trong lớp Main và có dạng public static void main(String[] args)");
            }
        }
        return errors;
    }

    /** Tra ve danh sach loi (rong neu hop le). */
    public static List<String> validate(CodeSpecDTO spec) {
        List<String> errors = new ArrayList<>();
        if (spec == null) {
            errors.add("Cần khai báo hàm và test case cho câu hỏi lập trình");
            return errors;
        }
        errors.addAll(validateSignature(spec));
        String ret = spec.getReturnType() == null ? "" : spec.getReturnType().trim();
        List<CodeSpecDTO.Param> params = spec.getParams() == null ? List.of() : spec.getParams();

        List<CodeSpecDTO.TestCase> tests = spec.getTests() == null ? List.of() : spec.getTests();
        if (tests.size() < MIN_TESTS) {
            errors.add("Cần ít nhất " + MIN_TESTS + " test case");
        }

        boolean specOk = errors.isEmpty();
        int index = 0;
        for (CodeSpecDTO.TestCase t : tests) {
            index++;
            String label = "Test " + index + (t != null && t.isVisible() ? " (hiển thị)" : " (ẩn)");
            if (t == null) {
                errors.add(label + ": không được để trống");
                continue;
            }
            List<String> inputs = t.getInputs() == null ? List.of() : t.getInputs();
            if (inputs.size() != params.size()) {
                errors.add(label + ": cần " + params.size() + " giá trị đầu vào");
                continue;
            }
            if (!specOk) continue;
            for (int i = 0; i < inputs.size(); i++) {
                String problem = checkValue(params.get(i).getType().trim(), inputs.get(i));
                if (problem != null) {
                    errors.add(label + ", tham số '" + params.get(i).getName().trim() + "': " + problem);
                }
            }
            String problem = checkValue(ret, t.getExpected());
            if (problem != null) {
                errors.add(label + ", kết quả mong đợi: " + problem);
            }
        }
        return errors;
    }

    private static boolean isIdentifier(String s) {
        return IDENT.matcher(s).matches() && !KEYWORDS.contains(s);
    }

    /** null neu gia tri hop le voi kieu. */
    public static String checkValue(String type, String value) {
        if (value == null) return "không được để trống";
        if (value.length() > MAX_VALUE_LENGTH) return "quá dài (tối đa " + MAX_VALUE_LENGTH + " ký tự)";
        if (value.indexOf('\n') >= 0 || value.indexOf('\r') >= 0) return "không được chứa xuống dòng";
        try {
            switch (type) {
                case "int" -> Integer.parseInt(value.trim());
                case "long" -> Long.parseLong(value.trim());
                case "double" -> {
                    double d = Double.parseDouble(value.trim());
                    if (Double.isNaN(d) || Double.isInfinite(d)) return "không phải số hợp lệ";
                }
                case "boolean" -> {
                    String v = value.trim().toLowerCase(Locale.ROOT);
                    if (!v.equals("true") && !v.equals("false")) return "phải là true hoặc false";
                }
                case "char" -> {
                    if (value.length() != 1) return "phải đúng 1 ký tự";
                }
                case "boolean[]" -> {
                    String v = value.trim();
                    if (!v.isEmpty()) {
                        for (String part : v.split(",", -1)) {
                            String b = part.trim().toLowerCase(Locale.ROOT);
                            if (!b.equals("true") && !b.equals("false")) return "mảng boolean cách nhau bởi dấu phẩy (true/false)";
                        }
                    }
                }
                case "int[]" -> {
                    String v = value.trim();
                    if (!v.isEmpty()) {
                        for (String part : v.split(",", -1)) Integer.parseInt(part.trim());
                    }
                }
                default -> { }
            }
        } catch (NumberFormatException e) {
            return "không đúng định dạng của kiểu " + type;
        }
        return null;
    }
}
