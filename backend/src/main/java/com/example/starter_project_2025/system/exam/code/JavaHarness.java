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
        return "import java.util.*;import java.io.*;" + code + "\n" + mainClass(spec);
    }

    /** stdin: moi tham so mot dong. */
    public static String buildStdin(List<String> inputs) {
        StringBuilder sb = new StringBuilder();
        for (String in : inputs) {
            sb.append(in == null ? "" : in.replace("\r", "").replace("\n", " ")).append('\n');
        }
        return sb.toString();
    }

    private static String mainClass(CodeSpecDTO spec) {
        StringBuilder sb = new StringBuilder();
        sb.append("class Main {\n");
        sb.append("    static int[] ia(String s) { s = s.trim(); if (s.isEmpty()) return new int[0];")
          .append(" String[] t = s.split(\",\", -1); int[] r = new int[t.length];")
          .append(" for (int i = 0; i < t.length; i++) r[i] = Integer.parseInt(t[i].trim()); return r; }\n");
        sb.append("    static String[] sa(String s) { s = s.trim(); if (s.isEmpty()) return new String[0];")
          .append(" String[] t = s.split(\",\", -1); for (int i = 0; i < t.length; i++) t[i] = t[i].trim(); return t; }\n");
        sb.append("    static String f(Object o) { return o == null ? \"\" : o.toString(); }\n");
        sb.append("    static String f(int[] a) { StringBuilder b = new StringBuilder();")
          .append(" for (int i = 0; i < a.length; i++) { if (i > 0) b.append(','); b.append(a[i]); } return b.toString(); }\n");
        sb.append("    static String f(String[] a) { StringBuilder b = new StringBuilder();")
          .append(" for (int i = 0; i < a.length; i++) { if (i > 0) b.append(','); b.append(a[i]); } return b.toString(); }\n");
        sb.append("    public static void main(String[] args) throws Exception {\n");
        sb.append("        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n");
        int n = spec.getParams().size();
        sb.append("        String[] L = new String[").append(n).append("];\n");
        sb.append("        for (int i = 0; i < L.length; i++) { String s = br.readLine(); L[i] = s == null ? \"\" : s; }\n");
        StringBuilder call = new StringBuilder();
        for (int i = 0; i < n; i++) {
            CodeSpecDTO.Param p = spec.getParams().get(i);
            String type = p.getType().trim();
            sb.append("        ").append(type).append(" p").append(i).append(" = ").append(parse(type, "L[" + i + "]")).append(";\n");
            if (i > 0) call.append(", ");
            call.append('p').append(i);
        }
        // Nuot moi thu sinh vien in ra (System.out.println debug) de khong lam sai ket qua; chi in ket qua that.
        sb.append("        PrintStream real = System.out;\n");
        sb.append("        System.setOut(new PrintStream(OutputStream.nullOutputStream()));\n");
        sb.append("        ").append(spec.getReturnType().trim()).append(" r = Solution.")
          .append(spec.getFunctionName().trim()).append('(').append(call).append(");\n");
        sb.append("        real.println(f(r));\n");
        sb.append("        real.flush();\n");
        sb.append("    }\n");
        sb.append("}\n");
        return sb.toString();
    }

    private static String parse(String type, String expr) {
        return switch (type) {
            case "int" -> "Integer.parseInt(" + expr + ".trim())";
            case "long" -> "Long.parseLong(" + expr + ".trim())";
            case "double" -> "Double.parseDouble(" + expr + ".trim())";
            case "boolean" -> "Boolean.parseBoolean(" + expr + ".trim())";
            case "int[]" -> "ia(" + expr + ")";
            case "String[]" -> "sa(" + expr + ")";
            default -> expr;
        };
    }

    /** So sanh ket qua that voi ket qua mong doi theo kieu tra ve. */
    public static boolean outputsEqual(String returnType, String actual, String expected) {
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
