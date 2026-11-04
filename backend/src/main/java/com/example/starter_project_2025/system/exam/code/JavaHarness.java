package com.example.starter_project_2025.system.exam.code;

import com.example.starter_project_2025.system.question.dto.CodeSpecDTO;

import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Ghep code cua thi sinh (lop Solution) voi lop Main do he thong sinh ra.
 * Main doc moi tham so tren mot dong stdin, goi Solution.ham(...) va in ket qua.
 */
public final class JavaHarness {

    private static final Pattern PUBLIC_SOLUTION =
            Pattern.compile("\\bpublic\\s+(final\\s+|abstract\\s+)?class\\s+Solution\\b");

    /** Khai bao package trong code sinh vien se lam hong viec ghep chung file voi Main. */
    private static final Pattern PACKAGE_DECL = Pattern.compile("(?m)^\\s*package\\s+[\\w.]+\\s*;");

    private JavaHarness() {
    }

    /** Chuong trinh Java day du (mot file Main.java) de gui cho trinh bien dich. */
    public static String buildProgram(String userCode, CodeSpecDTO spec) {
        String code = userCode == null ? "" : userCode;
        // Lop Solution khong duoc public vi nam chung file voi Main.
        code = PUBLIC_SOLUTION.matcher(code).replaceAll("$1class Solution");
        code = PACKAGE_DECL.matcher(code).replaceFirst("");
        // Dat import tren CUNG dong dau tien de so dong cua loi bien dich khong bi lech.
        return "import java.util.*;import java.io.*;" + code + "\n" + mainFor(spec);
    }

    /** Lop Main do he thong tu sinh theo khai bao ham (de hien thi / lam diem xuat phat de sua). */
    public static String generatedMain(CodeSpecDTO spec) {
        return mainClass(spec);
    }

    /** Lop Main thuc su duoc dung: ban giao vien tu viet neu co, nguoc lai ban tu sinh. */
    public static String mainFor(CodeSpecDTO spec) {
        String custom = spec.getMainCode();
        return spec.isCustomMain() && custom != null && !custom.isBlank() ? custom : mainClass(spec);
    }

    /** stdin: moi tham so mot dong. */
    public static String buildStdin(List<String> inputs) {
        StringBuilder sb = new StringBuilder();
        for (String in : inputs) {
            sb.append(in == null ? "" : in.replace("\r", "").replace("\n", " ")).append('\n');
        }
        return sb.toString();
    }

    /** Ten bien trong main khong duoc trung ten tham so (them dau _ neu trung). */
    private static final java.util.Set<String> MAIN_LOCALS = java.util.Set.of("args", "br", "lines", "out", "result");

    private static String mainClass(CodeSpecDTO spec) {
        int n = spec.getParams().size();
        String ret = spec.getReturnType().trim();

        // Chi sinh cac ham phu that su can dung (theo kieu tham so / kieu tra ve).
        java.util.Set<String> parsers = new java.util.LinkedHashSet<>();
        java.util.Set<String> joiners = new java.util.LinkedHashSet<>();
        for (CodeSpecDTO.Param p : spec.getParams()) {
            String t = p.getType().trim();
            if (isArray(t)) parsers.add(t);
        }
        if (isArray(ret)) joiners.add(ret);

        StringBuilder sb = new StringBuilder();
        sb.append("class Main {\n");
        sb.append("    public static void main(String[] args) throws Exception {\n");
        sb.append("        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n");
        sb.append("        // Each parameter is on its own line of stdin, in declaration order.\n");
        sb.append("        String[] lines = new String[").append(n).append("];\n");
        sb.append("        for (int i = 0; i < lines.length; i++) {\n");
        sb.append("            String line = br.readLine();\n");
        sb.append("            lines[i] = line == null ? \"\" : line;\n");
        sb.append("        }\n");
        StringBuilder call = new StringBuilder();
        for (int i = 0; i < n; i++) {
            CodeSpecDTO.Param p = spec.getParams().get(i);
            String type = p.getType().trim();
            String name = mainVar(p.getName().trim());
            sb.append("        ").append(type).append(' ').append(name).append(" = ")
              .append(parse(type, "lines[" + i + "]")).append(";\n");
            if (i > 0) call.append(", ");
            call.append(name);
        }
        sb.append("\n");
        sb.append("        // Hide anything the student prints, so only the result below is written to stdout.\n");
        sb.append("        PrintStream out = System.out;\n");
        sb.append("        System.setOut(new PrintStream(OutputStream.nullOutputStream()));\n");
        sb.append("        ").append(ret).append(" result = Solution.").append(spec.getFunctionName().trim())
          .append('(').append(call).append(");\n");
        sb.append("        out.println(").append(printExpr(ret)).append(");\n");
        sb.append("        out.flush();\n");
        sb.append("    }\n");

        for (String t : parsers) {
            sb.append("\n");
            sb.append(parserMethod(t));
        }
        for (String t : joiners) {
            sb.append("\n");
            sb.append(joinMethod(t));
        }
        sb.append("}\n");
        return sb.toString();
    }

    private static boolean isArray(String type) {
        return type.equals("int[]") || type.equals("boolean[]") || type.equals("String[]");
    }

    private static String mainVar(String name) {
        return MAIN_LOCALS.contains(name) ? name + "_" : name;
    }

    private static String printExpr(String ret) {
        if (ret.equals("String")) return "result == null ? \"\" : result";
        if (isArray(ret)) return "join(result)";
        return "result";
    }

    private static String parserMethod(String type) {
        return switch (type) {
            case "int[]" -> "    static int[] parseInts(String s) {\n"
                    + "        s = s.trim();\n"
                    + "        if (s.isEmpty()) return new int[0];\n"
                    + "        String[] parts = s.split(\",\", -1);\n"
                    + "        int[] result = new int[parts.length];\n"
                    + "        for (int i = 0; i < parts.length; i++) result[i] = Integer.parseInt(parts[i].trim());\n"
                    + "        return result;\n"
                    + "    }\n";
            case "boolean[]" -> "    static boolean[] parseBooleans(String s) {\n"
                    + "        s = s.trim();\n"
                    + "        if (s.isEmpty()) return new boolean[0];\n"
                    + "        String[] parts = s.split(\",\", -1);\n"
                    + "        boolean[] result = new boolean[parts.length];\n"
                    + "        for (int i = 0; i < parts.length; i++) result[i] = Boolean.parseBoolean(parts[i].trim());\n"
                    + "        return result;\n"
                    + "    }\n";
            default -> "    static String[] parseStrings(String s) {\n"
                    + "        s = s.trim();\n"
                    + "        if (s.isEmpty()) return new String[0];\n"
                    + "        String[] parts = s.split(\",\", -1);\n"
                    + "        for (int i = 0; i < parts.length; i++) parts[i] = parts[i].trim();\n"
                    + "        return parts;\n"
                    + "    }\n";
        };
    }

    private static String joinMethod(String type) {
        return "    static String join(" + type + " values) {\n"
                + "        StringBuilder sb = new StringBuilder();\n"
                + "        for (int i = 0; i < values.length; i++) {\n"
                + "            if (i > 0) sb.append(',');\n"
                + "            sb.append(values[i]);\n"
                + "        }\n"
                + "        return sb.toString();\n"
                + "    }\n";
    }

    private static String parse(String type, String expr) {
        return switch (type) {
            case "int" -> "Integer.parseInt(" + expr + ".trim())";
            case "long" -> "Long.parseLong(" + expr + ".trim())";
            case "double" -> "Double.parseDouble(" + expr + ".trim())";
            case "boolean" -> "Boolean.parseBoolean(" + expr + ".trim())";
            case "char" -> expr + ".isEmpty() ? ' ' : " + expr + ".charAt(0)";
            case "int[]" -> "parseInts(" + expr + ")";
            case "boolean[]" -> "parseBooleans(" + expr + ")";
            case "String[]" -> "parseStrings(" + expr + ")";
            default -> expr;
        };
    }

    /** So sanh ket qua that voi ket qua mong doi theo kieu tra ve. */
    public static boolean outputsEqual(String returnType, String actual, String expected) {
        if ("String".equals(returnType == null ? "" : returnType.trim())) {
            // Chuoi: giu nguyen khoang trang, chi bo dau xuong dong do println them vao cuoi.
            String out = actual == null ? "" : actual;
            if (out.endsWith("\r\n")) out = out.substring(0, out.length() - 2);
            else if (out.endsWith("\n")) out = out.substring(0, out.length() - 1);
            return out.equals(expected == null ? "" : expected);
        }
        String a = actual == null ? "" : actual.strip();
        String e = expected == null ? "" : expected.strip();
        String type = returnType == null ? "" : returnType.trim();
        try {
            if (type.equals("double")) {
                double x = Double.parseDouble(a);
                double y = Double.parseDouble(e);
                return Math.abs(x - y) <= 1e-6 * Math.max(1.0, Math.abs(y));
            }
            if (type.equals("boolean")) {
                return a.toLowerCase(Locale.ROOT).equals(e.toLowerCase(Locale.ROOT));
            }
            if (type.equals("boolean[]")) {
                return normalizeList(a).toLowerCase(Locale.ROOT).equals(normalizeList(e).toLowerCase(Locale.ROOT));
            }
            if (type.equals("int[]") || type.equals("String[]")) {
                return normalizeList(a).equals(normalizeList(e));
            }
        } catch (NumberFormatException ex) {
            return false;
        }
        return a.equals(e);
    }

    private static String normalizeList(String s) {
        if (s.isEmpty()) return "";
        String[] parts = s.split(",", -1);
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < parts.length; i++) {
            if (i > 0) b.append(',');
            b.append(parts[i].trim());
        }
        return b.toString();
    }
}
