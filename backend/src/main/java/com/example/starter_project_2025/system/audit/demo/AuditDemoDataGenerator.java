package com.example.starter_project_2025.system.audit.demo;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.DayOfWeek;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;

/**
 * Builds realistic demo audit-log rows (pure Java, no Spring) for testing and for writing the SRS.
 *
 * <ul>
 *   <li>Every row has its own timestamp: no two rows share the same second.</li>
 *   <li>Every day has a different number of rows: busy weekdays, quiet weekends, a few spikes.</li>
 *   <li>Covers create / update / delete / lifecycle actions of every feature, plus login and
 *       security events.</li>
 * </ul>
 */
public final class AuditDemoDataGenerator {

    public static final String CORRELATION_PREFIX = "demo-seed-";

    public record Actor(Long id, String email) {
    }

    public record Row(
            Long actorId,
            String actorEmail,
            String action,
            String entityType,
            String entityId,
            String oldValue,
            String newValue,
            String correlationId,
            String result,
            LocalDateTime createdAt
    ) {
    }

    private enum Kind { ADMIN, TEACHER, STUDENT, ANY, SYSTEM }

    private record Op(String entity, String action, int weight, Kind kind) {
    }

    private static Op op(String entity, String action, int weight, Kind kind) {
        return new Op(entity, action, weight, kind);
    }

    /** Every feature with its create / update / delete and special actions. */
    private static final List<Op> CATALOG = List.of(
            // account & access
            op("USER", "CREATE", 5, Kind.ADMIN), op("USER", "UPDATE", 8, Kind.ADMIN), op("USER", "DELETE", 1, Kind.ADMIN),
            op("ROLE", "CREATE", 1, Kind.ADMIN), op("ROLE", "UPDATE", 3, Kind.ADMIN), op("ROLE", "DELETE", 1, Kind.ADMIN),
            op("PERMISSION", "CREATE", 1, Kind.ADMIN), op("PERMISSION", "UPDATE", 3, Kind.ADMIN), op("PERMISSION", "DELETE", 1, Kind.ADMIN),
            op("DEPARTMENT", "CREATE", 2, Kind.ADMIN), op("DEPARTMENT", "UPDATE", 3, Kind.ADMIN), op("DEPARTMENT", "DELETE", 1, Kind.ADMIN),
            op("LOCATION", "CREATE", 2, Kind.ADMIN), op("LOCATION", "UPDATE", 3, Kind.ADMIN), op("LOCATION", "DELETE", 1, Kind.ADMIN),
            op("LOCATION", "ASSIGN", 2, Kind.ADMIN), op("LOCATION", "UNLINK", 1, Kind.ADMIN),
            op("MODULE", "CREATE", 1, Kind.ADMIN), op("MODULE", "UPDATE", 2, Kind.ADMIN), op("MODULE", "DELETE", 1, Kind.ADMIN),
            op("EMAIL_TEMPLATE", "CREATE", 1, Kind.ADMIN), op("EMAIL_TEMPLATE", "UPDATE", 3, Kind.ADMIN),
            op("NOTIFICATION_POLICY", "UPDATE", 2, Kind.ADMIN),

            // courses & content
            op("COURSE", "CREATE", 4, Kind.TEACHER), op("COURSE", "UPDATE", 9, Kind.TEACHER), op("COURSE", "DELETE", 1, Kind.ADMIN),
            op("COURSE", "PUBLISH", 2, Kind.TEACHER), op("COURSE", "UNPUBLISH", 1, Kind.TEACHER), op("COURSE", "ARCHIVE", 1, Kind.ADMIN),
            op("SECTION", "CREATE", 5, Kind.TEACHER), op("SECTION", "UPDATE", 6, Kind.TEACHER), op("SECTION", "DELETE", 2, Kind.TEACHER),
            op("LESSON", "CREATE", 6, Kind.TEACHER), op("LESSON", "UPDATE", 8, Kind.TEACHER), op("LESSON", "DELETE", 2, Kind.TEACHER),
            op("SESSION", "CREATE", 3, Kind.TEACHER), op("SESSION", "UPDATE", 4, Kind.TEACHER), op("SESSION", "DELETE", 1, Kind.TEACHER),
            op("CATEGORY", "CREATE", 2, Kind.ADMIN), op("CATEGORY", "UPDATE", 2, Kind.ADMIN), op("CATEGORY", "DELETE", 1, Kind.ADMIN),
            op("BOOK", "CREATE", 2, Kind.ADMIN), op("BOOK", "UPDATE", 3, Kind.ADMIN), op("BOOK", "DELETE", 1, Kind.ADMIN),
            op("CERTIFICATE", "CREATE", 2, Kind.ADMIN), op("CERTIFICATE", "UPDATE", 2, Kind.ADMIN), op("CERTIFICATE", "DELETE", 1, Kind.ADMIN),
            op("SUBJECT", "CREATE", 2, Kind.ADMIN), op("SUBJECT", "UPDATE", 4, Kind.ADMIN), op("SUBJECT", "DELETE", 1, Kind.ADMIN),
            op("SUBJECT", "IMPORT", 1, Kind.ADMIN),
            op("SYLLABUS", "CREATE", 2, Kind.TEACHER), op("SYLLABUS", "UPDATE", 4, Kind.TEACHER), op("SYLLABUS", "DELETE", 1, Kind.ADMIN),
            op("ENROLLMENT", "CREATE", 6, Kind.ANY), op("ENROLLMENT", "DELETE", 2, Kind.ADMIN),

            // training
            op("TRAINING_PROGRAM", "CREATE", 2, Kind.ADMIN), op("TRAINING_PROGRAM", "UPDATE", 3, Kind.ADMIN),
            op("TRAINING_PROGRAM", "DELETE", 1, Kind.ADMIN), op("TRAINING_PROGRAM", "CLONE", 1, Kind.ADMIN),
            op("TRAINING_PROGRAM", "ACTIVATE", 1, Kind.ADMIN),
            op("TRAINING_CLASS", "CREATE", 3, Kind.ADMIN), op("TRAINING_CLASS", "UPDATE", 4, Kind.ADMIN),
            op("TRAINING_CLASS", "DEACTIVATE", 1, Kind.ADMIN), op("TRAINING_CLASS", "IMPORT", 1, Kind.ADMIN),
            op("TRAINING_CALENDAR", "CREATE", 3, Kind.ADMIN), op("TRAINING_CALENDAR", "UPDATE", 3, Kind.ADMIN),
            op("TRAINING_CALENDAR", "DELETE", 1, Kind.ADMIN),
            op("TRAINER", "CREATE", 1, Kind.ADMIN), op("TRAINER", "UPDATE", 2, Kind.ADMIN), op("TRAINER", "DELETE", 1, Kind.ADMIN),

            // exams & scores
            op("EXAM", "CREATE", 4, Kind.TEACHER), op("EXAM", "UPDATE", 7, Kind.TEACHER), op("EXAM", "DELETE", 1, Kind.TEACHER),
            op("EXAM", "PUBLISH", 2, Kind.TEACHER),
            op("QUESTION", "CREATE", 8, Kind.TEACHER), op("QUESTION", "UPDATE", 6, Kind.TEACHER), op("QUESTION", "DELETE", 2, Kind.TEACHER),
            op("QUESTION", "IMPORT", 1, Kind.TEACHER),
            op("INVITATION", "INVITE", 4, Kind.TEACHER), op("INVITATION", "RESEND", 2, Kind.TEACHER), op("INVITATION", "REVOKE", 1, Kind.TEACHER),
            op("INVITATION", "ACCEPT", 3, Kind.STUDENT),
            op("EXAM_ATTEMPT", "SUBMIT", 6, Kind.STUDENT),
            op("EXAM_INTEGRITY", "REVIEW", 1, Kind.TEACHER),
            op("EXAM_GRADE_SCALE", "UPDATE", 1, Kind.TEACHER),
            op("STUDENT_SCORE", "CREATE", 4, Kind.TEACHER), op("STUDENT_SCORE", "UPDATE", 5, Kind.TEACHER), op("STUDENT_SCORE", "DELETE", 1, Kind.TEACHER),
            op("GRADEBOOK_COLUMN", "CREATE", 2, Kind.TEACHER), op("GRADEBOOK_COLUMN", "UPDATE", 3, Kind.TEACHER),
            op("GRADEBOOK_COLUMN", "DELETE", 1, Kind.TEACHER), op("GRADEBOOK_COLUMN", "IMPORT", 1, Kind.TEACHER),
            op("SCORE_APPEAL", "SUBMIT", 2, Kind.STUDENT), op("SCORE_APPEAL", "RESOLVE", 2, Kind.TEACHER),

            // project management
            op("PROJECT", "CREATE", 2, Kind.ADMIN), op("PROJECT", "UPDATE", 4, Kind.ADMIN), op("PROJECT", "DELETE", 1, Kind.ADMIN),
            op("PROJECT_TEMPLATE", "CREATE", 2, Kind.ADMIN), op("PROJECT_TEMPLATE", "UPDATE", 3, Kind.ADMIN),
            op("PROJECT_TEMPLATE", "DELETE", 1, Kind.ADMIN), op("PROJECT_TEMPLATE", "CLONE", 1, Kind.ADMIN),
            op("PROJECT_TEMPLATE_VERSION", "CREATE", 2, Kind.ADMIN), op("PROJECT_TEMPLATE_VERSION", "PUBLISH", 1, Kind.ADMIN),
            op("WORKSPACE", "CREATE", 2, Kind.TEACHER), op("WORKSPACE", "UPDATE", 3, Kind.TEACHER), op("WORKSPACE", "DELETE", 1, Kind.ADMIN),
            op("SPRINT", "CREATE", 4, Kind.TEACHER), op("SPRINT", "UPDATE", 5, Kind.TEACHER), op("SPRINT", "DELETE", 1, Kind.TEACHER),
            op("SPRINT_BACKLOG", "CREATE", 5, Kind.ANY), op("SPRINT_BACKLOG", "UPDATE", 7, Kind.ANY), op("SPRINT_BACKLOG", "DELETE", 2, Kind.ANY),
            op("TASK", "CREATE", 9, Kind.ANY), op("TASK", "UPDATE", 12, Kind.ANY), op("TASK", "DELETE", 2, Kind.ANY),
            op("TASK", "ASSIGN", 4, Kind.TEACHER),
            op("TEAM_CHARTER", "UPDATE", 2, Kind.STUDENT), op("TEAM_CHARTER", "CONFIRM", 1, Kind.STUDENT),
            op("ARTIFACT_SUBMISSION", "CREATE", 3, Kind.STUDENT), op("ARTIFACT_SUBMISSION", "SUBMIT", 3, Kind.STUDENT),
            op("MILESTONE_SUBMISSION", "SUBMIT", 2, Kind.STUDENT),
            op("PROJECT_TEAM", "ASSIGN", 2, Kind.TEACHER), op("PROJECT_TEAM", "PUBLISH", 1, Kind.TEACHER),
            op("AI_SUGGESTION", "APPROVE", 2, Kind.TEACHER), op("AI_SUGGESTION", "REJECT", 1, Kind.TEACHER),

            // authentication
            op("AUTH", "LOGIN", 40, Kind.ANY), op("AUTH", "LOGOUT", 18, Kind.ANY),
            op("AUTH", "REGISTER", 2, Kind.STUDENT), op("AUTH", "VERIFY_EMAIL", 2, Kind.STUDENT),
            op("AUTH", "FORGOT_PASSWORD", 2, Kind.ANY), op("AUTH", "RESET_PASSWORD", 1, Kind.ANY),
            op("USER", "CHANGE_PASSWORD", 2, Kind.ANY),
            op("USER_SESSION", "REVOKE", 1, Kind.ANY),

            // security
            op("SECURITY_ALERT", "SECURITY_ALERT", 2, Kind.STUDENT),
            op("USER", "BLOCK", 1, Kind.ADMIN), op("USER", "EXTEND_BLOCK", 1, Kind.ADMIN),
            op("USER", "UNBLOCK", 1, Kind.ADMIN), op("USER", "AUTO_UNBLOCK", 1, Kind.SYSTEM)
    );

    private static final String[] WORDS = {
            "Java Core", "Spring Boot", "React Basics", "SQL Advanced", "DevOps", "Testing", "Microservices",
            "Algorithms", "Clean Code", "Docker", "Git Flow", "REST API", "Security", "UI Design", "Cloud 101",
            "Data Structures", "Agile", "Kotlin", "Python Intro", "System Design"
    };
    private static final String[] STATUS = {"DRAFT", "ACTIVE", "PUBLISHED", "ARCHIVED", "PENDING"};
    private static final String[] BROWSERS = {"Chrome / Windows", "Edge / Windows", "Safari / macOS", "Firefox / Linux", "Chrome / Android"};

    private AuditDemoDataGenerator() {
    }

    /** Rows per day, all different from each other. */
    static Map<LocalDate, Integer> dailyCounts(LocalDate from, LocalDate to, Random rnd) {
        List<LocalDate> days = new ArrayList<>();
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            days.add(d);
        }

        Set<LocalDate> spikes = new HashSet<>();
        Set<LocalDate> quiet = new HashSet<>();
        while (spikes.size() < Math.min(3, days.size())) {
            spikes.add(days.get(rnd.nextInt(days.size())));
        }
        while (quiet.size() < Math.min(2, days.size())) {
            LocalDate d = days.get(rnd.nextInt(days.size()));
            if (!spikes.contains(d)) {
                quiet.add(d);
            }
        }

        Map<LocalDate, Integer> counts = new HashMap<>();
        Set<Integer> used = new HashSet<>();

        for (LocalDate day : days) {
            int count;
            if (spikes.contains(day)) {
                count = 90 + rnd.nextInt(50);
            } else if (quiet.contains(day)) {
                count = 1 + rnd.nextInt(4);
            } else if (day.getDayOfWeek() == DayOfWeek.SUNDAY) {
                count = 2 + rnd.nextInt(11);
            } else if (day.getDayOfWeek() == DayOfWeek.SATURDAY) {
                count = 8 + rnd.nextInt(18);
            } else {
                count = 25 + rnd.nextInt(46);
            }

            while (!used.add(count)) {
                count++;
            }
            counts.put(day, count);
        }

        return counts;
    }

    /** Distinct sorted seconds-of-day inside the working window, clustered around morning and afternoon. */
    static List<Integer> secondsOfDay(int count, int latest, Random rnd) {
        int earliest = 6 * 3600 + 30 * 60;
        int end = Math.max(earliest + 1, Math.min(latest, 22 * 3600 + 30 * 60));
        int capacity = end - earliest;
        int wanted = Math.min(count, capacity);

        Set<Integer> picked = new HashSet<>();
        while (picked.size() < wanted) {
            int second;
            double roll = rnd.nextDouble();
            if (roll < 0.35) {
                second = 9 * 3600 + rnd.nextInt(2 * 3600 + 1800);
            } else if (roll < 0.65) {
                second = 14 * 3600 + rnd.nextInt(2 * 3600 + 1800);
            } else {
                second = earliest + rnd.nextInt(capacity);
            }

            if (second >= earliest && second < end) {
                picked.add(second);
            } else {
                picked.add(earliest + rnd.nextInt(capacity));
            }
        }

        return picked.stream().sorted().toList();
    }

    public static List<Row> generate(
            LocalDate from,
            LocalDateTime now,
            Actor admin,
            List<Actor> teachers,
            List<Actor> students,
            long seed
    ) {
        Random rnd = new Random(seed);
        LocalDate lastDay = now.toLocalDate();
        Map<LocalDate, Integer> counts = dailyCounts(from, lastDay, rnd);
        int totalWeight = CATALOG.stream().mapToInt(Op::weight).sum();

        Map<String, List<Long>> alive = new HashMap<>();
        Map<String, Long> nextId = new HashMap<>();
        List<Row> rows = new ArrayList<>();

        for (LocalDate day = from; !day.isAfter(lastDay); day = day.plusDays(1)) {
            int latest = day.equals(lastDay) ? now.toLocalTime().toSecondOfDay() : 24 * 3600;
            int wanted = counts.get(day);

            if (day.equals(lastDay)) {
                double elapsed = Math.max(0.1, Math.min(1.0, latest / (double) (16 * 3600)));
                wanted = Math.max(1, (int) Math.round(wanted * elapsed));
            }

            boolean spikeDay = wanted >= 90;

            for (int second : secondsOfDay(wanted, latest, rnd)) {
                Op chosen = pick(rnd, totalWeight);
                Actor actor = actorFor(chosen.kind(), admin, teachers, students, rnd);
                boolean failed = rnd.nextDouble() < failureChance(chosen, spikeDay);

                rows.add(buildRow(
                        chosen, actor, failed, day.atTime(LocalTime.ofSecondOfDay(second)),
                        alive, nextId, students, rnd));
            }
        }

        rows.sort(Comparator.comparing(Row::createdAt));
        return rows;
    }

    private static double failureChance(Op op, boolean spikeDay) {
        double base = spikeDay ? 0.22 : 0.07;
        if ("LOGIN".equals(op.action())) {
            base += 0.15;
        }
        if ("SECURITY_ALERT".equals(op.action()) || "AUTO_UNBLOCK".equals(op.action())) {
            return 0;
        }
        return base;
    }

    private static Op pick(Random rnd, int totalWeight) {
        int roll = rnd.nextInt(totalWeight);
        for (Op op : CATALOG) {
            roll -= op.weight();
            if (roll < 0) {
                return op;
            }
        }
        return CATALOG.get(0);
    }

    private static Actor actorFor(Kind kind, Actor admin, List<Actor> teachers, List<Actor> students, Random rnd) {
        return switch (kind) {
            case ADMIN -> rnd.nextDouble() < 0.9 ? admin : any(teachers, admin, rnd);
            case TEACHER -> rnd.nextDouble() < 0.85 ? any(teachers, admin, rnd) : admin;
            case STUDENT -> any(students, admin, rnd);
            case SYSTEM -> new Actor(null, "SYSTEM");
            case ANY -> {
                double roll = rnd.nextDouble();
                yield roll < 0.4 ? admin : roll < 0.7 ? any(teachers, admin, rnd) : any(students, admin, rnd);
            }
        };
    }

    private static Actor any(List<Actor> pool, Actor fallback, Random rnd) {
        return pool.isEmpty() ? fallback : pool.get(rnd.nextInt(pool.size()));
    }

    private static Row buildRow(
            Op op,
            Actor actor,
            boolean failed,
            LocalDateTime at,
            Map<String, List<Long>> alive,
            Map<String, Long> nextId,
            List<Actor> students,
            Random rnd
    ) {
        String entityType = op.entity();
        String action = op.action();
        String entityId;
        String oldValue = null;
        String newValue = null;
        Long actorId = actor.id();
        String actorEmail = actor.email();

        if ("AUTH".equals(entityType)) {
            entityId = actorId == null ? null : String.valueOf(actorId);
            if (failed && "LOGIN".equals(action)) {
                newValue = json("reason", "Bad credentials", "device", BROWSERS[rnd.nextInt(BROWSERS.length)]);
                if (rnd.nextBoolean()) {
                    actorId = null;
                    actorEmail = "unknown" + (1 + rnd.nextInt(9)) + "@mail.test";
                    entityId = null;
                }
            } else {
                newValue = json("ip", "10.0." + rnd.nextInt(4) + "." + (2 + rnd.nextInt(250)),
                        "device", BROWSERS[rnd.nextInt(BROWSERS.length)]);
            }
        } else if ("USER_SESSION".equals(entityType) || "CHANGE_PASSWORD".equals(action)) {
            entityId = actorId == null ? null : String.valueOf(actorId);
            newValue = json("device", BROWSERS[rnd.nextInt(BROWSERS.length)]);
        } else if ("SECURITY_ALERT".equals(entityType)) {
            entityId = String.valueOf(nextId.merge("SECURITY_ALERT", 1L, Long::sum) + 40);
            newValue = json("type", rnd.nextBoolean() ? "RATE_LIMIT" : "REPEATED_DENIED",
                    "requests", 130 + rnd.nextInt(300), "windowSeconds", 10);
        } else if ("BLOCK".equals(action) || "EXTEND_BLOCK".equals(action)
                || "UNBLOCK".equals(action) || "AUTO_UNBLOCK".equals(action)) {
            Actor target = students.isEmpty() ? actor : students.get(rnd.nextInt(students.size()));
            entityId = target.id() == null ? "0" : String.valueOf(target.id());
            LocalDate until = at.toLocalDate().plusDays(1 + rnd.nextInt(7));
            if ("BLOCK".equals(action)) {
                newValue = json("blockedUntil", until + "T00:00:00", "reason", "Request spam");
            } else if ("EXTEND_BLOCK".equals(action)) {
                oldValue = json("blockedUntil", until + "T00:00:00");
                newValue = json("blockedUntil", until.plusDays(2) + "T00:00:00", "addedDays", 2);
            } else {
                oldValue = json("blockedUntil", at.toLocalDate() + "T00:00:00");
            }
        } else {
            List<Long> ids = alive.computeIfAbsent(entityType, k -> {
                List<Long> seedIds = new ArrayList<>();
                for (long i = 1; i <= 12; i++) {
                    seedIds.add(i);
                }
                return seedIds;
            });

            if ("CREATE".equals(action) || "REGISTER".equals(action)) {
                long id = nextId.merge("id:" + entityType, 1L, Long::sum) + 100;
                ids.add(id);
                entityId = String.valueOf(id);
                newValue = snapshot(entityType, id, rnd);
            } else {
                long id = ids.isEmpty() ? 1 : ids.get(rnd.nextInt(ids.size()));
                entityId = String.valueOf(id);
                if ("DELETE".equals(action)) {
                    oldValue = snapshot(entityType, id, rnd);
                    if (!failed && ids.size() > 3) {
                        ids.remove(Long.valueOf(id));
                    }
                } else if ("UPDATE".equals(action)) {
                    oldValue = snapshot(entityType, id, rnd);
                    newValue = snapshot(entityType, id, rnd);
                } else {
                    newValue = json("status", STATUS[rnd.nextInt(STATUS.length)]);
                }
            }
        }

        return new Row(
                actorId, actorEmail, action, entityType, entityId, oldValue, newValue,
                CORRELATION_PREFIX + String.format("%012x", rnd.nextLong() & 0xFFFFFFFFFFFFL),
                failed ? "FAILURE" : "SUCCESS", at);
    }

    private static String snapshot(String entityType, long id, Random rnd) {
        String label = WORDS[rnd.nextInt(WORDS.length)] + " " + id;

        if ("USER".equals(entityType)) {
            return json("fullName", "Demo User " + id, "email", "user" + id + "@example.test",
                    "active", rnd.nextInt(10) > 0);
        }
        if ("TASK".equals(entityType) || "SPRINT_BACKLOG".equals(entityType)) {
            return json("title", label, "status", STATUS[rnd.nextInt(STATUS.length)],
                    "priority", 1 + rnd.nextInt(3));
        }
        if ("STUDENT_SCORE".equals(entityType) || "GRADEBOOK_COLUMN".equals(entityType)) {
            return json("name", label, "score", 40 + rnd.nextInt(61));
        }
        return json("name", label, "status", STATUS[rnd.nextInt(STATUS.length)]);
    }

    private static String json(Object... keyValues) {
        StringBuilder out = new StringBuilder("{");
        for (int i = 0; i < keyValues.length; i += 2) {
            if (i > 0) {
                out.append(',');
            }
            out.append('"').append(keyValues[i]).append("\":");
            Object value = keyValues[i + 1];
            if (value instanceof Number || value instanceof Boolean) {
                out.append(value);
            } else {
                out.append('"').append(String.valueOf(value).replace("\\", "\\\\").replace("\"", "\\\"")).append('"');
            }
        }
        return out.append('}').toString();
    }
}
