import java.sql.*;

public class H2Clear {
    public static void main(String[] args) throws Exception {
        String url = "jdbc:h2:file:E:/OJT/HCM26_CPL_JAVA_10/backend/data/fams_lms_after_merge_fresh";
        try (Connection conn = DriverManager.getConnection(url, "sa", "")) {
            try (Statement st = conn.createStatement()) {
                try (ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM i18n_translation_cache")) {
                    rs.next();
                    System.out.println("total cache rows: " + rs.getInt(1));
                }
                try (ResultSet rs = st.executeQuery(
                        "SELECT source_language, target_language, COUNT(*) AS c FROM i18n_translation_cache GROUP BY source_language, target_language ORDER BY source_language, target_language")) {
                    while (rs.next()) {
                        System.out.println("  " + rs.getString(1) + " -> " + rs.getString(2) + " : " + rs.getInt(3));
                    }
                }
                int deleted = st.executeUpdate(
                        "DELETE FROM i18n_translation_cache WHERE source_language = 'vi' AND target_language = 'en'");
                System.out.println("deleted (vi->en): " + deleted);
                int deleted2 = st.executeUpdate(
                        "DELETE FROM i18n_translation_cache WHERE source_language = 'en' AND target_language = 'vi'");
                System.out.println("deleted (en->vi): " + deleted2);
                int deleted3 = st.executeUpdate(
                        "DELETE FROM i18n_translation_cache WHERE source_language = 'auto'");
                System.out.println("deleted (auto): " + deleted3);
                try (ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM i18n_translation_cache")) {
                    rs.next();
                    System.out.println("remaining cache rows: " + rs.getInt(1));
                }
            }
        }
    }
}
