package com.example.starter_project_2025.system.demo.course;

import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class SectionExpansionPlanTest {
    private final List<SectionExpansionPlan.Source> source = List.of(
            new SectionExpansionPlan.Source("Web Fundamentals", List.of("DNS", "HTML")),
            new SectionExpansionPlan.Source("JavaScript", List.of("Async", "DOM")));

    @Test void aiMayAddSectionsAndLessonsWithoutDroppingSourceTopics() {
        String plan = "SECTION|1|Hands-on DNS Workshop|Explore DNS Records|1\n"
                + "LESSON|2|2|DOM Project Practice";
        var proposals = SectionExpansionPlan.parse(plan, source, 3, 6);
        assertEquals(2, proposals.size());
        var sections = new ArrayList<SyllabusCourseAiJobService.SectionWork>();
        for (int i = 0; i < source.size(); i++) {
            var section = new SyllabusCourseAiJobService.SectionWork(source.get(i).title(), "");
            for (int j = 0; j < source.get(i).topics().size(); j++) {
                section.lessons.add(new SyllabusCourseAiJobService.LessonWork(
                        source.get(i).topics().get(j), (long) (10 * i + j + 1),
                        source.get(i).topics().get(j)));
            }
            sections.add(section);
        }
        SectionExpansionPlan.apply(sections, proposals);
        assertEquals(3, sections.size());
        assertEquals(6, sections.stream().mapToInt(s -> s.lessons.size()).sum());
        assertEquals(6, sections.stream().flatMap(s -> s.lessons.stream())
                .filter(l -> l.topicId != null).count());
        assertEquals("Hands-on DNS Workshop", sections.get(2).title);
        assertEquals(1L, sections.get(2).lessons.getFirst().topicId);
        assertEquals(12L, sections.get(1).lessons.getLast().topicId);
    }

    @Test void invalidAndRepeatedSectionSuggestionsCannotCorruptCoverage() {
        String proposal = "SECTION|1|Web Fundamentals|Duplicate|1\n"
                + "SECTION|9|Irrelevant Extra|Out of Scope|1\n"
                + "SECTION|1|Practical DNS Lab|Use DNS Lookup|1\n"
                + "SECTION|1|Another DNS Lab|Duplicate Source Section|2\n"
                + "LESSON|2|2|Build a DOM Project";
        var parsed = SectionExpansionPlan.parse(proposal, source, 3, 6);
        assertEquals(2, parsed.size());
        assertEquals("Practical DNS Lab", parsed.getFirst().sectionTitle());
    }

    @Test void nonePreservesExactlyTheOriginalSections() {
        assertTrue(SectionExpansionPlan.parse("NONE", source, 3, 6).isEmpty());
        assertTrue(SectionExpansionPlan.parse("bad output", source, 3, 6).isEmpty());
    }
    @Test void typedHeadingsKeepMappingAndDoNotNeedMaterialGeneration() {
        var proposals = SectionExpansionPlan.parse("LESSON|1|1|DNS demonstration|VIDEO\n"
                + "LESSON|1|2|HTML knowledge check|QUIZ\nLESSON|1|1|Bad type|PDF", source, 3, 12);
        assertEquals(2, proposals.size());
        var sections = new ArrayList<SyllabusCourseAiJobService.SectionWork>();
        var first = new SyllabusCourseAiJobService.SectionWork("Web Fundamentals", "");
        first.lessons.add(new SyllabusCourseAiJobService.LessonWork("DNS", 1L, "DNS"));
        first.lessons.add(new SyllabusCourseAiJobService.LessonWork("HTML", 2L, "HTML"));
        sections.add(first);
        SectionExpansionPlan.apply(sections, proposals);
        assertEquals(4, first.lessons.size());
        var video = first.lessons.get(2);
        assertEquals(1L, video.topicId);
        assertEquals(com.example.starter_project_2025.system.demo.lesson.LessonContentType.VIDEO, video.type);
        assertTrue(video.complete());
        assertTrue(video.material.isBlank());
        assertTrue(video.duration() >= 360);
        assertFalse(first.lessons.getFirst().complete());
    }
}
