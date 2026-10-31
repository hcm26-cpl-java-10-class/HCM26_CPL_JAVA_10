import com.example.starter_project_2025.base.dataio.importer.parser.ExcelParser;
import java.io.FileInputStream;

public class PoiProbe {
    public static void main(String[] args) throws Exception {
        try (var input = new FileInputStream(args[0])) {
            var rows = new ExcelParser().parse(input);
            System.out.println("rows=" + rows.size());
            System.out.println("first=" + rows.getFirst());
            System.out.println("secondProgram=" + rows.get(1).get("Training Program Code"));
        }
    }
}
