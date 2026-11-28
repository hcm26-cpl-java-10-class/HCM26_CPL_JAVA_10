# Course bundle test data

Use [the canonical course workbook](course-import-15-courses-150-lessons.xlsx) from **Courses > Import** while signed in as an administrator. Its existing filename is retained for compatibility; its contents now contain twenty courses.

- 20 published courses, each with 2 sections and 10 lessons total.
- 40 sections and 200 lessons overall, with 5 lessons per section.
- Each section contains one VIDEO, AUDIO, TEXT, DOCUMENT, and LINK lesson; no assessment lessons.
- All 12 existing categories are covered through valid category-code relationships.

Expected import result: **260 successful records**. Re-importing updates matching course, section, and lesson names. The original fifteen courses are preserved. `CourseStarterDataTest` uses this same workbook to verify parsing, relationships, content types, and repeat imports without maintaining a duplicate fixture.
