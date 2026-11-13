import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.sql.*;
import java.time.*;
import java.util.*;
import org.springframework.security.crypto.bcrypt.BCrypt;

/** Explicit, offline local fixture. Never run by application startup. */
public class AddDashboardReviewClasses {
    static final String PASSWORD = "DemoDashboard2026!";
    static final String CLASS_FILTER = "TENANT_ID=1 AND CODE IN ('DASH-C','DASH-D')";
    static final String USER_FILTER = "TENANT_ID=1 AND (EMAIL LIKE 'dash.c%@demo.example.test' OR EMAIL LIKE 'dash.d%@demo.example.test')";
    static final Map<String, Integer> ADDITIONS = Map.of("TRAINING_CLASSES", 2, "USERS", 12,
            "USER_ROLES", 12, "CLASS_MEMBERS", 12, "CLASS_STAFF_ASSIGNMENTS", 2);

    public static void main(String[] args) throws Exception {
        if (args.length != 3) throw new IllegalArgumentException("prepare|apply|verify DATABASE.mv.db BACKUP_DIRECTORY");
        Path db = Path.of(args[1]).toAbsolutePath().normalize();
        Path output = Path.of(args[2]).toAbsolutePath().normalize();
        if (!Files.isRegularFile(db) || !db.getFileName().toString().equals("fams_lms_after_merge.mv.db"))
            throw new IllegalArgumentException("Existing reviewed local database required");
        if (!output.startsWith(db.getParent().resolve("backups")) || !output.getFileName().toString().startsWith("dashboard-review-"))
            throw new IllegalArgumentException("Use a dedicated backups/dashboard-review-* directory");
        switch (args[0]) {
            case "prepare" -> {
                if (Files.exists(output)) throw new IllegalStateException("Backup directory already exists");
                String hash = fileHash(db);
                try (Connection c = open(db, true)) { validate(c); }
                require(hash.equals(fileHash(db)), "Source changed during validation");
                Files.createDirectories(output);
                Files.copy(db, output.resolve("before.mv.db"));
                Files.copy(db, output.resolve("rehearsal.mv.db"));
                require(hash.equals(fileHash(output.resolve("before.mv.db"))), "Backup hash mismatch");
                String report = insert(output.resolve("rehearsal.mv.db"));
                require(hash.equals(fileHash(db)), "Source changed during rehearsal");
                require(hash.equals(fileHash(output.resolve("before.mv.db"))), "Backup changed during rehearsal");
                Properties manifest = new Properties();
                manifest.setProperty("source", db.toString());
                manifest.setProperty("sha256", hash);
                manifest.setProperty("createdAt", ZonedDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")).toString());
                try (var out = Files.newOutputStream(output.resolve("prepared.properties"))) { manifest.store(out, "DASH-C/D additive fixture"); }
                Files.writeString(output.resolve("rehearsal.txt"), report);
                System.out.println(report + "\nBackup and rehearsal: " + output);
            }
            case "apply" -> {
                Properties manifest = new Properties();
                try (var in = Files.newInputStream(output.resolve("prepared.properties"))) { manifest.load(in); }
                String hash = manifest.getProperty("sha256");
                require(db.toString().equals(manifest.getProperty("source")), "Wrong source database");
                require(hash.equals(fileHash(db)), "Source changed since rehearsal; prepare a new backup");
                require(hash.equals(fileHash(output.resolve("before.mv.db"))), "Backup changed");
                String report = insert(db);
                require(hash.equals(fileHash(output.resolve("before.mv.db"))), "Backup changed during apply");
                Files.writeString(output.resolve("applied.txt"), report);
                System.out.println(report);
            }
            case "verify" -> {
                try (Connection c = open(db, true)) {
                    String report = verify(c);
                    Files.writeString(output.resolve("verified.txt"), report);
                    System.out.println(report);
                }
            }
            default -> throw new IllegalArgumentException("Unknown mode");
        }
    }

    static Connection open(Path file, boolean readOnly) throws SQLException {
        String path = file.toString().replace('\\', '/');
        return DriverManager.getConnection("jdbc:h2:file:" + path.substring(0, path.length() - 6)
                + ";IFEXISTS=TRUE;DB_CLOSE_ON_EXIT=FALSE;ACCESS_MODE_DATA=" + (readOnly ? "r" : "rw"), "sa", "");
    }

    static void validate(Connection c) throws Exception {
        require(scalar(c, "SELECT COUNT(*) FROM USERS WHERE EMAIL='admin@example.com' AND TENANT_ID=1 AND IS_ACTIVE=TRUE") == 1,
                "Local tenant/admin missing");
        require(scalar(c, "SELECT COUNT(*) FROM TRAINING_CLASSES WHERE CODE='WS-DEMO-CLASS' AND TENANT_ID=1") == 1,
                "Source class context missing");
        require(scalar(c, "SELECT COUNT(*) FROM TRAINING_CLASSES WHERE " + CLASS_FILTER) == 0, "DASH-C/D already exist; refusing to overwrite");
        require(scalar(c, "SELECT COUNT(*) FROM USERS WHERE EMAIL LIKE 'dash.c%@demo.example.test' OR EMAIL LIKE 'dash.d%@demo.example.test' OR USER_CODE LIKE 'DASH-C%' OR USER_CODE LIKE 'DASH-D%'") == 0,
                "DASH-C/D accounts already exist; refusing to overwrite");
        require(scalar(c, "SELECT COUNT(*) FROM ROLES WHERE NAME='STUDENT' AND IS_ACTIVE=TRUE") == 1, "Student role missing");
        require(scalar(c, "SELECT COUNT(*) FROM USERS U JOIN TRAINING_CLASSES C ON C.MENTOR_ID=U.ID WHERE C.CODE='WS-DEMO-CLASS' AND C.TENANT_ID=1 AND U.TENANT_ID=1 AND U.IS_ACTIVE=TRUE AND U.LOCKED=FALSE") == 1,
                "Source class mentor unavailable");
    }

    static String insert(Path file) throws Exception {
        try (Connection c = open(file, false)) {
            c.setAutoCommit(false);
            try {
                validate(c);
                var before = snapshot(c);
                long actor = scalar(c, "SELECT ID FROM USERS WHERE EMAIL='admin@example.com' AND TENANT_ID=1");
                long role = scalar(c, "SELECT ID FROM ROLES WHERE NAME='STUDENT' AND IS_ACTIVE=TRUE");
                var source = rows(c, "SELECT PROGRAM_ID,PROGRAM_NAME,COHORT_ID,COHORT_NAME,MENTOR_ID FROM TRAINING_CLASSES WHERE CODE='WS-DEMO-CLASS' AND TENANT_ID=1").getFirst();
                Timestamp now = Timestamp.valueOf(LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")));
                for (String letter : List.of("C", "D")) {
                    long classId = generated(c, "INSERT INTO TRAINING_CLASSES (CREATED_AT,CREATED_BY,IS_ACTIVE,UPDATED_AT,UPDATED_BY,CODE,COHORT_ID,COHORT_NAME,MENTOR_ID,NAME,PROGRAM_ID,PROGRAM_NAME,STATUS,TENANT_ID,PROJECT_TEMPLATE_ID) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                            now,actor,true,now,actor,"DASH-"+letter,source.get("COHORT_ID"),source.get("COHORT_NAME"),source.get("MENTOR_ID"),
                            "Dashboard Demo - Lop "+letter,source.get("PROGRAM_ID"),source.get("PROGRAM_NAME"),"ONGOING",1L,null);
                    generated(c, "INSERT INTO CLASS_STAFF_ASSIGNMENTS (CREATED_AT,CREATED_BY,IS_ACTIVE,UPDATED_AT,UPDATED_BY,ROLE_TYPE,CLASS_ID,USER_ID) VALUES (?,?,?,?,?,?,?,?)",
                            now,actor,true,now,actor,"MENTOR",classId,source.get("MENTOR_ID"));
                    for (int i = 1; i <= (letter.equals("C") ? 8 : 4); i++) {
                        String suffix = letter + String.format(Locale.ROOT, "%02d", i);
                        long userId = generated(c, "INSERT INTO USERS (CREATED_AT,CREATED_BY,IS_ACTIVE,UPDATED_AT,UPDATED_BY,EMAIL,FIRST_NAME,LAST_NAME,LOCKED,PASSWORD_HASH,TENANT_ID,USER_CODE) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                                now,actor,true,now,actor,"dash."+suffix.toLowerCase(Locale.ROOT)+"@demo.example.test","Dashboard",suffix,false,
                                BCrypt.hashpw(PASSWORD, BCrypt.gensalt()),1L,"DASH-"+suffix);
                        execute(c, "INSERT INTO USER_ROLES (USER_ID,ROLE_ID) VALUES (?,?)", userId, role);
                        generated(c, "INSERT INTO CLASS_MEMBERS (CREATED_AT,CREATED_BY,IS_ACTIVE,UPDATED_AT,UPDATED_BY,JOINED_AT,STATUS,CLASS_ID,USER_ID) VALUES (?,?,?,?,?,?,?,?,?)",
                                now,actor,true,now,actor,now,"ACTIVE",classId,userId);
                    }
                }
                var after = snapshot(c);
                require(before.keySet().equals(after.keySet()), "Schema changed");
                for (String table : before.keySet()) {
                    var remaining = new HashMap<>(after.get(table));
                    before.get(table).forEach((hash, count) -> {
                        require(remaining.getOrDefault(hash, 0) >= count, "An existing row changed in " + table);
                        remaining.merge(hash, -count, Integer::sum);
                    });
                    int added = remaining.values().stream().mapToInt(Integer::intValue).sum();
                    require(added == ADDITIONS.getOrDefault(table, 0), "Unexpected additions in " + table);
                }
                String report = verify(c) + "\nVerified tables: " + before.size()
                        + "\nAll existing rows unchanged.\nAdded rows: " + ADDITIONS;
                c.commit();
                return report;
            } catch (Exception failure) { c.rollback(); throw failure; }
        }
    }

    static String verify(Connection c) throws Exception {
        var classes = rows(c, "SELECT C.CLASS_ID,C.CODE,C.NAME,C.STATUS,C.MENTOR_ID,COUNT(M.MEMBER_ID) MEMBER_COUNT FROM TRAINING_CLASSES C LEFT JOIN CLASS_MEMBERS M ON M.CLASS_ID=C.CLASS_ID AND M.IS_ACTIVE=TRUE AND M.STATUS='ACTIVE' WHERE C.TENANT_ID=1 AND C.CODE IN ('DASH-C','DASH-D') GROUP BY C.CLASS_ID ORDER BY C.CODE");
        require(classes.size() == 2 && classes.get(0).get("MEMBER_COUNT").toString().equals("8")
                && classes.get(1).get("MEMBER_COUNT").toString().equals("4"), "Unexpected class sizes");
        String ids = "SELECT CLASS_ID FROM TRAINING_CLASSES WHERE " + CLASS_FILTER;
        require(scalar(c, "SELECT COUNT(*) FROM PROJECT_TEAMS WHERE CLASS_ID IN (" + ids + ")") == 0, "Teams must be created manually");
        require(scalar(c, "SELECT COUNT(*) FROM TEAM_ALLOCATION_SESSIONS WHERE CLASS_ID IN (" + ids + ")") == 0, "Sessions must be created manually");
        require(scalar(c, "SELECT COUNT(*) FROM USERS U JOIN USER_ROLES UR ON UR.USER_ID=U.ID JOIN ROLES R ON R.ID=UR.ROLE_ID WHERE U.TENANT_ID=1 AND (U.EMAIL LIKE 'dash.c%@demo.example.test' OR U.EMAIL LIKE 'dash.d%@demo.example.test') AND R.NAME='STUDENT'") == 12,
                "Student roles mismatch");
        int verified = 0;
        try (Statement s = c.createStatement(); ResultSet r = s.executeQuery("SELECT PASSWORD_HASH FROM USERS WHERE " + USER_FILTER + " AND IS_ACTIVE=TRUE AND LOCKED=FALSE")) {
            while (r.next()) { require(BCrypt.checkpw(PASSWORD, r.getString(1)), "Account password mismatch"); verified++; }
        }
        require(verified == 12, "Demo accounts must all be active and unlocked");
        var roster = rows(c, "SELECT C.CODE CLASS_CODE,U.USER_CODE,U.EMAIL FROM TRAINING_CLASSES C JOIN CLASS_MEMBERS M ON M.CLASS_ID=C.CLASS_ID JOIN USERS U ON U.ID=M.USER_ID WHERE C.TENANT_ID=1 AND C.CODE IN ('DASH-C','DASH-D') ORDER BY C.CODE,U.USER_CODE");
        require(roster.size() == 12, "Roster mismatch");
        return "DASH-C/D ready for manual practice.\n" + classes + "\n" + roster
                + "\nVerified credentials: " + verified + "\nAllocation sessions: 0; teams: 0. No business workflow executed.";
    }

    static Map<String, Map<String, Integer>> snapshot(Connection c) throws Exception {
        var tables = rows(c, "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='PUBLIC' AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME");
        var snapshot = new TreeMap<String, Map<String, Integer>>();
        for (var table : tables) {
            String name = table.get("TABLE_NAME").toString();
            var hashes = new HashMap<String, Integer>();
            try (Statement s = c.createStatement(); ResultSet r = s.executeQuery("SELECT * FROM PUBLIC.\"" + name.replace("\"", "\"\"") + "\"")) {
                while (r.next()) {
                    var row = new StringBuilder();
                    for (int i = 1; i <= r.getMetaData().getColumnCount(); i++) {
                        String value = r.getString(i);
                        row.append(value == null ? "N;" : "V" + value.length() + ":" + value + ";");
                    }
                    hashes.merge(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(row.toString().getBytes(StandardCharsets.UTF_8))), 1, Integer::sum);
                }
            }
            snapshot.put(name, hashes);
        }
        return snapshot;
    }

    static String fileHash(Path file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (var in = Files.newInputStream(file)) {
            byte[] buffer = new byte[65536];
            for (int count; (count = in.read(buffer)) != -1;) digest.update(buffer, 0, count);
        }
        return HexFormat.of().formatHex(digest.digest());
    }
    static void require(boolean condition, String message) { if (!condition) throw new IllegalStateException(message); }
    static void bind(PreparedStatement s, Object... values) throws SQLException { for (int i=0; i<values.length; i++) s.setObject(i+1, values[i]); }
    static long generated(Connection c, String sql, Object... values) throws SQLException {
        try (PreparedStatement s = c.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            bind(s, values); require(s.executeUpdate() == 1, "Insert failed");
            try (ResultSet r = s.getGeneratedKeys()) { require(r.next(), "Missing generated ID"); return r.getLong(1); }
        }
    }
    static void execute(Connection c, String sql, Object... values) throws SQLException {
        try (PreparedStatement s = c.prepareStatement(sql)) { bind(s, values); require(s.executeUpdate() == 1, "Insert failed"); }
    }
    static long scalar(Connection c, String sql) throws SQLException {
        try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(sql)) { require(r.next(), "Missing scalar"); return r.getLong(1); }
    }
    static List<Map<String, Object>> rows(Connection c, String sql) throws SQLException {
        var rows = new ArrayList<Map<String, Object>>();
        try (Statement s = c.createStatement(); ResultSet r = s.executeQuery(sql)) {
            while (r.next()) {
                var row = new LinkedHashMap<String, Object>();
                for (int i=1; i<=r.getMetaData().getColumnCount(); i++) row.put(r.getMetaData().getColumnLabel(i), r.getObject(i));
                rows.add(row);
            }
        }
        return rows;
    }
}
