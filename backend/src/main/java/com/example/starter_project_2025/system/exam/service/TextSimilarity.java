package com.example.starter_project_2025.system.exam.service;

import java.util.HashSet;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * NEW (anti-cheat nang cao): do do giong nhau giua 2 doan van ban (Jaccard tren cum 2 tu lien tiep).
 * Chi so sanh dap an du dai de tranh bao nham (cau tra loi ngan nhu "Spring Boot" de trung).
 */
public final class TextSimilarity {

    /** Dap an ngan hon so tu nay se khong duoc dem de so sanh. */
    public static final int MIN_WORDS = 15;

    private static final Pattern NON_WORD = Pattern.compile("[^\\p{L}\\p{N}]+");

    private TextSimilarity() {}

    /** Tap cac cum 2 tu lien tiep; rong neu van ban qua ngan. */
    public static Set<String> shingles(String text) {
        Set<String> out = new HashSet<>();
        if (text == null) return out;
        String[] words = NON_WORD.matcher(text.toLowerCase()).replaceAll(" ").trim().split(" ");
        if (words.length < MIN_WORDS) return out;
        for (int i = 0; i + 1 < words.length; i++) {
            out.add(words[i] + " " + words[i + 1]);
        }
        return out;
    }

    /** Do giong nhau 0..1; 0 neu mot trong hai rong. */
    public static double jaccard(Set<String> a, Set<String> b) {
        if (a.isEmpty() || b.isEmpty()) return 0;
        Set<String> small = a.size() <= b.size() ? a : b;
        Set<String> large = small == a ? b : a;
        int inter = 0;
        for (String s : small) if (large.contains(s)) inter++;
        int union = a.size() + b.size() - inter;
        return union == 0 ? 0 : (double) inter / union;
    }

    public static double similarity(String a, String b) {
        return jaccard(shingles(a), shingles(b));
    }
}
