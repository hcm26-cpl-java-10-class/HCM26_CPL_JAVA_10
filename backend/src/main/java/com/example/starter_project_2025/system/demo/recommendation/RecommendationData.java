package com.example.starter_project_2025.system.demo.recommendation;

import com.example.starter_project_2025.system.demo.lesson.*;
import com.example.starter_project_2025.system.demo.course.*;
import com.example.starter_project_2025.system.demo.enrollment.*;
import com.example.starter_project_2025.system.demo.certificate.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import static com.example.starter_project_2025.system.demo.recommendation.RecommendationModels.*;

/** Transactions end before any network request; no private lesson/answer data is loaded. */
@Service @RequiredArgsConstructor
public class RecommendationData {
    private static final Set<String> GOAL_STOP_WORDS = Set.of("learn", "learning", "want", "course", "courses", "study", "skills", "the", "and", "for", "học", "muốn", "tôi", "khóa", "các", "một");
    private final CourseCatalogService catalog;
    private final CourseEnrollmentRepository enrollments;
    private final CertificateRepository certificates;
    private final RecommendationPreferenceRepository preferences;

    @Transactional(readOnly=true)
    public Result automatic(Long userId) {
        var pref = preferences.findById(userId).orElseGet(() -> fresh(userId));
        var history = enrollments.findRecommendationHistory(userId);
        var completed = certificates.findAllByUser_Id(userId);
        Set<Long> excluded = new HashSet<>(pref.getDismissed());
        history.forEach(e -> excluded.add(e.getCourse().getId()));
        completed.forEach(c -> excluded.add(c.getCourse().getId()));
        Map<String,Double> topics = new HashMap<>();
        // Actual activity outweighs an old enrollment. Completion uses issued certificates,
        // which already enforce active lessons and assessment completion rules.
        for (var e : history) {
            if (e.getLastAccessedAt() == null) continue;
            long days = Math.max(0, ChronoUnit.DAYS.between(e.getLastAccessedAt(), LocalDateTime.now()));
            double weight = 5.0 / (1 + days / 30.0);
            e.getCourse().getCategories().forEach(c -> topics.merge(norm(c.getName()), weight, Double::sum));
        }
        completed.forEach(c -> c.getCourse().getCategories().forEach(t -> topics.merge(norm(t.getName()), 2.0, Double::sum)));
        int suitable = completed.stream().map(c -> c.getCourse().getLevel()).filter(Objects::nonNull)
                .mapToInt(Enum::ordinal).max().orElse(-1) + 1;
        suitable = Math.min(2, suitable);
        Map<Long,Long> popularity = new HashMap<>();
        for (var row : enrollments.recommendationPopularity()) popularity.put((Long)row[0], ((Number)row[1]).longValue());
        var all = catalog.recommendationCatalog(userId);
        List<Item> ranked = rank(all, excluded, pref, topics, suitable, popularity);
        boolean eligible = all.stream().anyMatch(c -> !c.enrolled() && !excluded.contains(c.id()));
        String state = all.isEmpty() ? "EMPTY_CATALOG" : !eligible ? "NO_MORE_ELIGIBLE" : ranked.isEmpty() ? "NO_MATCHES" : "READY";
        return new Result(ranked, dto(pref), state);
    }

    static List<Item> rank(List<CatalogCourseDTO> courses, Set<Long> excluded, RecommendationPreference pref,
                           Map<String,Double> topics, int suitable, Map<Long,Long> popularity) {
        Map<Long,CatalogCourseDTO> unique = new LinkedHashMap<>();
        boolean hasPreferences = !pref.getGoals().isBlank() || !pref.getInterests().isEmpty();
        courses.stream().filter(c -> !c.enrolled() && !excluded.contains(c.id()))
                .filter(c -> !hasPreferences || interest(c,pref))
                .forEach(c -> unique.putIfAbsent(c.id(),c));
        var remaining = new ArrayList<>(unique.values().stream().sorted(Comparator
                .comparingDouble((CatalogCourseDTO c) -> score(c,pref,topics,suitable,popularity)).reversed()
                .thenComparing(CatalogCourseDTO::id)).limit(200).toList());
        List<Item> result = new ArrayList<>();
        Map<String,Integer> categoryCounts = new HashMap<>();
        // Bounded diversity pass: at most 30 selections from the best 200 scored courses.
        while (!remaining.isEmpty() && result.size()<30) {
            CatalogCourseDTO best = remaining.stream().max(Comparator
                    .comparingDouble((CatalogCourseDTO c) -> score(c,pref,topics,suitable,popularity)
                            - 3 * categoryCounts.getOrDefault(norm(c.categoryName()),0))
                    .thenComparing(c -> -c.id())).orElseThrow();
            remaining.remove(best);
            categoryCounts.merge(norm(best.categoryName()),1,Integer::sum);
            String reason = interest(best,pref) ? "Matches your saved goals or topic interests."
                    : topics.containsKey(norm(best.categoryName())) ? "Related to topics in your learning activity."
                    : best.level()==CourseLevel.BEGINNER ? "An introductory option to explore."
                    : "An available option to explore in the catalog.";
            result.add(new Item(best,reason));
        }
        return result;
    }

    private static double score(CatalogCourseDTO c, RecommendationPreference p, Map<String,Double> topics,
                                int suitable, Map<Long,Long> popularity) {
        int level = c.level()==null ? 0 : c.level().ordinal();
        return (interest(c,p)?8:0) + topics.getOrDefault(norm(c.categoryName()),0.0)
                + (level <= suitable ? 4 : -4*(level-suitable))
                + (c.averageRating()*c.totalReviews()+3.5*5)/(c.totalReviews()+5.0)
                + Math.min(2,Math.log1p(popularity.getOrDefault(c.id(),0L))/3);
    }
    private static boolean interest(CatalogCourseDTO c, RecommendationPreference p) {
        String text = norm(c.name()+" "+c.categoryName()+" "+c.description());
        return p.getInterests().stream().anyMatch(t -> containsTerm(text,norm(t)))
                || Arrays.stream(norm(p.getGoals()).split("[^\\p{L}\\p{N}+#.]+"))
                .anyMatch(t -> t.length()>=2 && !GOAL_STOP_WORDS.contains(t) && containsTerm(text,t));
    }
    private static boolean containsTerm(String text, String term) {
        return !term.isBlank() && java.util.regex.Pattern.compile("(?<![\\p{L}\\p{N}])" + java.util.regex.Pattern.quote(term)
                + "(?![\\p{L}\\p{N}])").matcher(text).find();
    }
    static String norm(String s) { return s==null?"":s.toLowerCase(Locale.ROOT).trim(); }
    static RecommendationPreference fresh(Long id) { var p=new RecommendationPreference();p.setUserId(id);return p; }
    static Preferences dto(RecommendationPreference p) { return new Preferences(p.getGoals(),Set.copyOf(p.getInterests())); }

    @Transactional
    public Preferences save(Long id, Preferences request) {
        var p=preferences.findById(id).orElseGet(() -> fresh(id));
        p.setGoals(request.goals().trim());p.setInterests(new HashSet<>(request.interests().stream().map(String::trim).toList()));
        return dto(preferences.save(p));
    }
    @Transactional
    public void dismiss(Long id, Long courseId) {
        var p=preferences.findById(id).orElseGet(() -> fresh(id));
        if (p.getDismissed().size()>=2000 && !p.getDismissed().contains(courseId))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Reset dismissals before dismissing more courses");
        p.getDismissed().add(courseId);preferences.save(p);
    }
    @Transactional
    public void reset(Long id) { preferences.findById(id).ifPresent(preferences::delete); }
}
