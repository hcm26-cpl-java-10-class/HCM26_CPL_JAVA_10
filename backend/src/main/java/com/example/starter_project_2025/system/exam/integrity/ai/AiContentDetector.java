package com.example.starter_project_2025.system.exam.integrity.ai;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Heuristic estimate of how likely an essay / code answer was produced by an AI tool.
 * Runs locally (no external API). It is an ESTIMATE meant to support the grader, not proof.
 */
public final class AiContentDetector {

    public static final int HIGH = 70;
    public static final int MEDIUM = 30;

    public record Result(int percent, List<String> signals) {
        public String level() {
            return percent >= HIGH ? "HIGH" : percent >= MEDIUM ? "MEDIUM" : "LOW";
        }
    }

    private AiContentDetector() {}

    private static final String[] ESSAY_PHRASES = {
            "in conclusion", "to conclude", "in summary", "furthermore", "moreover", "additionally",
            "it is important to note", "it is worth noting", "plays a crucial role", "plays a vital role",
            "a wide range of", "in today's", "delve", "leverage", "multifaceted", "tapestry", "seamless",
            "ensuring that", "on the other hand", "overall,", "not only", "firstly", "secondly", "lastly",
            "tóm lại", "nhìn chung", "điều quan trọng là", "đóng vai trò quan trọng", "đóng vai trò then chốt",
            "bên cạnh đó", "hơn nữa", "ngoài ra", "một cách hiệu quả", "đa dạng và phong phú", "có thể thấy rằng",
            "như một", "tổng kết lại", "đầu tiên", "thứ hai", "cuối cùng"
    };

    private static final Pattern SENTENCE_SPLIT = Pattern.compile("(?<=[.!?。])\\s+|\\n+");
    private static final Pattern WORD = Pattern.compile("[\\p{L}\\p{Nd}']+");
    private static final Pattern MARKDOWN = Pattern.compile("(?m)(^\\s*#{1,4}\\s)|(\\*\\*[^*]+\\*\\*)|(^\\s*[-*]\\s+\\S)|(^\\s*\\d+[.)]\\s+\\S)|(```)");
    private static final Pattern CODE_COMMENT = Pattern.compile("(//[^\\n]*|#[^\\n!]*|/\\*[\\s\\S]*?\\*/)");
    private static final Pattern LONG_IDENT = Pattern.compile("\\b[a-z]+(?:[A-Z][a-z0-9]+){2,}\\b|\\b[a-z]+(?:_[a-z0-9]+){2,}\\b");
    private static final Pattern AI_CODE_COMMENT = Pattern.compile(
            "(?i)(//|#|\\*)\\s*(step\\s*\\d+|edge case|handle |helper|time complexity|space complexity|o\\(|base case|initialize|iterate|return the|check if|validate|main logic|example usage|this (method|function|class))");

    /** Returns null when the answer is too short to judge. */
    public static Result analyze(String text, boolean code) {
        if (text == null) return null;
        String t = text.strip();
        return code ? analyzeCode(t) : analyzeEssay(t);
    }

    // ------------------------------------------------------------------ essay
    private static Result analyzeEssay(String text) {
        List<String> words = new ArrayList<>();
        Matcher m = WORD.matcher(text);
        while (m.find()) words.add(m.group().toLowerCase(Locale.ROOT));
        if (words.size() < 40) return null;

        double score = 8;
        List<String> sig = new ArrayList<>();
        String lower = text.toLowerCase(Locale.ROOT);

        int phrases = 0;
        for (String p : ESSAY_PHRASES) {
            int idx = 0;
            while ((idx = lower.indexOf(p, idx)) >= 0) { phrases++; idx += p.length(); }
        }
        double per100 = phrases * 100.0 / words.size();
        if (phrases > 0) {
            score += Math.min(34, per100 * 8);
            sig.add(phrases + " stock AI transition phrase(s)");
        }

        String[] sentences = SENTENCE_SPLIT.split(text);
        List<Integer> lens = new ArrayList<>();
        for (String s : sentences) {
            int c = 0;
            Matcher wm = WORD.matcher(s);
            while (wm.find()) c++;
            if (c >= 3) lens.add(c);
        }
        if (lens.size() >= 4) {
            double mean = lens.stream().mapToInt(i -> i).average().orElse(0);
            double var = lens.stream().mapToDouble(i -> (i - mean) * (i - mean)).average().orElse(0);
            double cv = mean == 0 ? 1 : Math.sqrt(var) / mean;
            if (cv < 0.35) { score += 20; sig.add("Very uniform sentence length"); }
            else if (cv < 0.5) { score += 10; sig.add("Fairly uniform sentence length"); }
            if (mean > 22) { score += 5; sig.add("Long, formal sentences"); }
        }

        long distinct = words.stream().distinct().count();
        double ttr = (double) distinct / words.size();
        if (words.size() > 120 && ttr > 0.62) { score += 6; sig.add("Rich, varied vocabulary"); }

        if (MARKDOWN.matcher(text).find()) { score += 14; sig.add("Markdown / list formatting"); }

        boolean contractions = lower.contains("n't") || lower.contains("i'm") || lower.contains("it's");
        boolean typos = lower.matches("(?s).*\\b(teh|recieve|dont|cant|wont|ko|k0|dc|vs)\\b.*") || text.contains("  ");
        if (!contractions && !typos && words.size() > 80) { score += 6; sig.add("No contractions or typos"); }

        // paragraph structure intro / body / conclusion
        String[] paras = text.split("\\n\\s*\\n");
        if (paras.length >= 3) { score += 6; sig.add("Intro-body-conclusion structure"); }

        return finish(score, sig);
    }

    // ------------------------------------------------------------------- code
    private static Result analyzeCode(String code) {
        String[] lines = code.split("\\R");
        int nonEmpty = (int) java.util.Arrays.stream(lines).filter(l -> !l.isBlank()).count();
        if (nonEmpty < 6) return null;

        double score = 8;
        List<String> sig = new ArrayList<>();

        int commentLines = 0, aiComments = 0;
        Matcher cm = CODE_COMMENT.matcher(code);
        while (cm.find()) {
            commentLines += cm.group().split("\\R").length;
            if (AI_CODE_COMMENT.matcher(cm.group()).find()) aiComments++;
        }
        double ratio = (double) commentLines / nonEmpty;
        if (ratio > 0.35) { score += 24; sig.add("Very high comment density (" + Math.round(ratio * 100) + "%)"); }
        else if (ratio > 0.2) { score += 14; sig.add("High comment density (" + Math.round(ratio * 100) + "%)"); }
        if (aiComments > 0) {
            score += Math.min(26, aiComments * 8);
            sig.add(aiComments + " AI-style comment(s) (\"Step 1\", \"Edge case\", complexity...)");
        }

        if (code.contains("/**") || code.contains("\"\"\"")) { score += 10; sig.add("Formal docstring / Javadoc"); }
        if (code.contains("```")) { score += 20; sig.add("Contains markdown code fence"); }

        Matcher im = LONG_IDENT.matcher(code);
        int longIds = 0;
        while (im.find()) longIds++;
        if (longIds >= 4) { score += 12; sig.add("Long descriptive identifiers"); }

        // perfectly consistent indentation and no trailing whitespace
        int badIndent = 0, trailing = 0, indented = 0;
        for (String l : lines) {
            if (l.isBlank()) continue;
            int lead = l.length() - l.stripLeading().length();
            if (lead > 0) { indented++; if (l.startsWith("\t") ? false : lead % 2 != 0) badIndent++; }
            if (l.endsWith(" ") || l.endsWith("\t")) trailing++;
        }
        if (indented > 8 && badIndent == 0 && trailing == 0) { score += 8; sig.add("Perfectly consistent formatting"); }

        String low = code.toLowerCase(Locale.ROOT);
        if (low.contains("edge case") || low.contains("null or empty") || low.contains("illegalargumentexception")) {
            score += 6; sig.add("Defensive edge-case handling beyond the task");
        }
        return finish(score, sig);
    }

    private static Result finish(double score, List<String> sig) {
        int pct = (int) Math.round(Math.max(2, Math.min(97, score)));
        if (sig.isEmpty()) sig.add("No notable AI indicators");
        return new Result(pct, sig);
    }
}
