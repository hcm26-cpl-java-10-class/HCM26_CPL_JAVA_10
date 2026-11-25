package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.system.demo.lesson.LessonContentType;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** Optional plain-text AI plan; never allowed to remove or change source Topic IDs. */
final class SectionExpansionPlan {
    private SectionExpansionPlan() {}

    record Source(String title, List<String> topics) {}
    record Proposal(String kind, int sectionIndex, int topicIndex, String sectionTitle, String lessonTitle, LessonContentType type) {}

    static List<Proposal> parse(String response, List<Source> source, int maxNewSections, int maxExtraLessons) {
        if (response == null || response.isBlank()) return List.of();
        List<Proposal> accepted = new ArrayList<>();
        Set<Integer> newSectionSources = new HashSet<>();
        Set<String> titles = new HashSet<>();
        for (Source section : source) titles.add(key(section.title()));
        int newSections = 0;
        for (String raw : response.split("\\R")) {
            String line = raw.strip();
            if (line.isBlank() || line.equalsIgnoreCase("NONE")) continue;
            String[] fields = line.split("\\|", -1);
            boolean extraSection = (fields.length == 5 || fields.length == 6) && fields[0].equalsIgnoreCase("SECTION");
            boolean extraLesson = (fields.length == 4 || fields.length == 5) && fields[0].equalsIgnoreCase("LESSON");
            if (!extraSection && !extraLesson) continue;
            if (accepted.size() >= maxExtraLessons) break;
            LessonContentType type = LessonContentType.TEXT;
            if (fields.length == (extraSection ? 6 : 5)) {
                try { type = LessonContentType.valueOf(fields[fields.length - 1].strip().toUpperCase(Locale.ROOT)); }
                catch (IllegalArgumentException ex) { continue; }
            }
            int s = ordinal(fields[1], source.size());
            if (s < 0) continue;
            int t = ordinal(fields[extraSection ? 4 : 2], source.get(s).topics().size());
            if (t < 0) continue;
            String sectionTitle = extraSection ? title(fields[2], 150) : "";
            String lessonTitle = title(fields[extraSection ? 3 : 3], 200);
            if (lessonTitle.isBlank() || !SyllabusCourseAiJobService.englishOnly(lessonTitle)) continue;
            if (extraSection) {
                if (newSections >= maxNewSections || newSectionSources.contains(s)
                        || sectionTitle.isBlank() || !SyllabusCourseAiJobService.englishOnly(sectionTitle)
                        || titles.contains(key(sectionTitle))) continue;
                newSectionSources.add(s);
                titles.add(key(sectionTitle));
                newSections++;
            }
            accepted.add(new Proposal(extraSection ? "SECTION" : "LESSON", s, t,
                    sectionTitle, lessonTitle, type));
        }
        return List.copyOf(accepted);
    }

    static void apply(List<SyllabusCourseAiJobService.SectionWork> sections, List<Proposal> proposals) {
        List<SyllabusCourseAiJobService.SectionWork> base = new ArrayList<>(sections);
        var originalTopics = base.stream().map(section -> List.copyOf(section.lessons)).toList();
        for (Proposal proposal : proposals) {
            if (proposal.sectionIndex() >= base.size()) continue;
            SyllabusCourseAiJobService.SectionWork source = base.get(proposal.sectionIndex());
            List<SyllabusCourseAiJobService.LessonWork> mapped = originalTopics.get(proposal.sectionIndex());
            if (proposal.topicIndex() >= mapped.size()) continue;
            var original = mapped.get(proposal.topicIndex());
            String contextTopic = original.relatedTopic;
            if (proposal.kind().equals("SECTION")) {
                if (sections.size() >= 100) break;
                SyllabusCourseAiJobService.SectionWork extra =
                        new SyllabusCourseAiJobService.SectionWork(proposal.sectionTitle(), "AI-suggested practice");
                extra.lessons.add(new SyllabusCourseAiJobService.LessonWork(
                        proposal.lessonTitle(), original.topicId, contextTopic, proposal.type()));
                sections.add(extra);
            } else {
                if (source.lessons.size() >= 200 || source.lessons.stream().anyMatch(l ->
                        key(l.title).equals(key(proposal.lessonTitle())))) continue;
                source.lessons.add(new SyllabusCourseAiJobService.LessonWork(
                        proposal.lessonTitle(), original.topicId, contextTopic, proposal.type()));
            }
        }
    }

    private static int ordinal(String raw, int count) {
        try {
            int number = Integer.parseInt(raw.strip());
            return number >= 1 && number <= count ? number - 1 : -1;
        } catch (NumberFormatException ex) { return -1; }
    }
    private static String title(String value, int max) {
        String clean = value.strip().replaceAll("\\s+", " ");
        return clean.length() < 3 || clean.length() > max ? "" : clean;
    }
    private static String key(String value) { return value.strip().toLowerCase(Locale.ROOT); }
}
