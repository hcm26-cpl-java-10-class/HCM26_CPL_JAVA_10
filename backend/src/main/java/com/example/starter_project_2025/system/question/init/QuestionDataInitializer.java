package com.example.starter_project_2025.system.question.init;

import com.example.starter_project_2025.system.question.domain.*;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.Set;

@Component
@RequiredArgsConstructor
public class QuestionDataInitializer implements CommandLineRunner {

    private final QuestionRepository repository;

    @Override
    public void run(String... args) {
        if (repository.count() > 0) return;


        repository.save(make("Java là ngôn ngữ lập trình chạy dựa trên cơ chế nào dưới đây?", QuestionType.MULTIPLE_CHOICE, Difficulty.EASY, "java", Set.of(2),
                "Biên dịch trực tiếp ra mã máy", "Chỉ thông dịch từng dòng lệnh", "Biên dịch ra bytecode rồi chạy trên máy ảo JVM", "Chạy trực tiếp trên trình duyệt"));

        repository.save(make("Từ khóa nào được dùng để ngăn một class không cho phép lớp khác kế thừa?", QuestionType.MULTIPLE_CHOICE, Difficulty.EASY, "java", Set.of(1),
                "static", "final", "abstract", "private"));

        repository.save(make("Kiểu dữ liệu nào dưới đây KHÔNG phải là kiểu nguyên thủy (primitive type) trong Java?", QuestionType.MULTIPLE_CHOICE, Difficulty.EASY, "java", Set.of(3),
                "int", "double", "boolean", "String"));

        repository.save(make("Để so sánh giá trị chuỗi của hai đối tượng String, phương thức nào tối ưu nhất?", QuestionType.MULTIPLE_CHOICE, Difficulty.EASY, "java", Set.of(1),
                "==", "equals()", "compare()", "hashCode()"));

        repository.save(make("Lớp cha tối cao (gốc) của tất cả các class trong cấu trúc Java là lớp nào?", QuestionType.MULTIPLE_CHOICE, Difficulty.EASY, "java", Set.of(1),
                "Class", "Object", "System", "Main"));

        repository.save(make("Khối lệnh 'finally' trong cấu trúc try-catch-finally sẽ được thực thi khi nào?", QuestionType.MULTIPLE_CHOICE, Difficulty.MEDIUM, "java", Set.of(2),
                "Chỉ khi có ngoại lệ xảy ra", "Chỉ khi KHÔNG có ngoại lệ xảy ra", "Luôn luôn được thực thi dù có ngoại lệ hay không", "Chỉ khi hệ thống bị lỗi crash"));

        repository.save(make("Trong cấu trúc OOP của Java, một class có thể 'extends' trực tiếp cùng lúc bao nhiêu lớp?", QuestionType.MULTIPLE_CHOICE, Difficulty.EASY, "java", Set.of(0),
                "Tối đa 1 lớp", "Không giới hạn số lượng", "Tối đa 2 lớp", "Phụ thuộc vào RAM"));

        repository.save(make("Sự khác biệt cốt lõi về cấu trúc dữ liệu giữa ArrayList và LinkedList là gì?", QuestionType.MULTIPLE_CHOICE, Difficulty.MEDIUM, "java", Set.of(0),
                "ArrayList dùng mảng động, LinkedList dùng danh sách liên kết kép", "ArrayList chạy chậm hơn LinkedList khi tìm kiếm bằng index", "LinkedList không chứa được phần tử null", "ArrayList tốn bộ nhớ hơn LinkedList"));

        repository.save(make("Từ khóa 'super' trong lập trình hướng đối tượng Java được dùng để làm gì?", QuestionType.MULTIPLE_CHOICE, Difficulty.MEDIUM, "java", Set.of(0),
                "Gọi constructor hoặc phương thức của lớp cha", "Tạo ra một thực thể siêu cấp", "Giải phóng vùng nhớ ngay lập tức", "Biến thuộc tính thành hằng số"));

        repository.save(make("Sự khác biệt lớn nhất giữa Checked Exception và Unchecked Exception là gì?", QuestionType.MULTIPLE_CHOICE, Difficulty.HARD, "java", Set.of(1),
                "Checked xảy ra lúc runtime, Unchecked xảy ra lúc compile", "Checked bắt buộc phải xử lý bằng try-catch hoặc throws, Unchecked thì không bắt buộc", "Unchecked nghiêm trọng hơn Checked", "Java không hỗ trợ Unchecked Exception"));

        repository.save(make("Phương thức main nào dưới đây là điểm khởi đầu (entry point) chuẩn của ứng dụng Java?", QuestionType.MULTIPLE_CHOICE, Difficulty.EASY, "java", Set.of(0),
                "public static void main(String[] args)", "public void start()", "public static int main()", "private static void main(String args)"));

        repository.save(make("Cơ chế Garbage Collection (GC) trong Java có vai trò chính là gì?", QuestionType.MULTIPLE_CHOICE, Difficulty.EASY, "java", Set.of(2),
                "Tăng tốc xử lý tính toán", "Tự động định dạng mã nguồn", "Tự động giải phóng vùng nhớ Heap không còn thực thể nào tham chiếu", "Mã hóa dữ liệu bộ nhớ"));

        repository.save(make("Hãy phân tích ý nghĩa và cách áp dụng 4 tính chất cơ bản của lập trình hướng đối tượng (OOP).", QuestionType.ESSAY, Difficulty.MEDIUM, "java", Set.of(),
                "Hãy trình bày rõ: Đóng gói, Kế thừa, Đa hình và Trừu tượng kèm theo ví dụ code minh họa."));

        repository.save(make("Trình bày sự khác biệt giữa Interface và Abstract Class từ phiên bản Java 8 trở đi.", QuestionType.ESSAY, Difficulty.MEDIUM, "java", Set.of(),
                "Phân tích sâu về khả năng đa kế thừa, phương thức default/static và mục đích thiết kế của từng loại."));

        repository.save(make("Hãy giải thích chi tiết về cơ chế hoạt động và lợi ích của vùng nhớ String Pool trong Java.", QuestionType.ESSAY, Difficulty.HARD, "java", Set.of(),
                "Phân biệt rõ việc khởi tạo chuỗi bằng String literal so với sử dụng từ khóa 'new String()'."));

        repository.save(make("Giải thích cơ chế hoạt động của từ khóa 'volatile' trong lập trình đa luồng (Multi-threading) Java.", QuestionType.ESSAY, Difficulty.HARD, "java", Set.of(),
                "Phân tích cách volatile giải quyết vấn đề bộ nhớ đệm (CPU Cache) và tính hiển thị dữ liệu (visibility) giữa các luồng."));

        repository.save(make("Điểm khác biệt cơ bản giữa HashMap và HashTable trong Java Collection Framework là gì?", QuestionType.MULTIPLE_CHOICE, Difficulty.MEDIUM, "java", Set.of(1),
                "HashMap tốn nhiều bộ nhớ hơn HashTable", "HashMap cho phép khóa null và không đồng bộ, HashTable đồng bộ và không cho phép khóa null", "HashTable chạy nhanh hơn HashMap", "HashMap không thể duyệt bằng Iterator"));


        // ==========================================
        // CHỦ ĐỀ 2: SPRING BOOT (17 câu) - Topic: "spring_boot"
        // ==========================================
        repository.save(make("Annotation nào biến một class thông thường thành một RESTful Web Controller trong Spring Boot?", QuestionType.MULTIPLE_CHOICE, Difficulty.EASY, "spring_boot", Set.of(2),
                "@Controller", "@Service", "@RestController", "@Component"));

        repository.save(make("Annotation nào dùng để thực hiện cơ chế nhúng phụ thuộc tự động (Dependency Injection) của Spring?", QuestionType.MULTIPLE_CHOICE, Difficulty.EASY, "spring_boot", Set.of(1),
                "@Inject", "@Autowired", "@Resource", "@Bean"));

        repository.save(make("Để đổi cổng chạy (port) mặc định của ứng dụng sang 8085, ta viết cấu hình nào trong application.properties?", QuestionType.MULTIPLE_CHOICE, Difficulty.EASY, "spring_boot", Set.of(3),
                "port=8085", "app.port=8085", "spring.port=8085", "server.port=8085"));

        repository.save(make("Annotation @PathVariable được tích hợp nhằm mục đích gì?", QuestionType.MULTIPLE_CHOICE, Difficulty.MEDIUM, "spring_boot", Set.of(0),
                "Trích xuất giá trị trực tiếp từ các tham số nằm trên đường dẫn URI", "Đọc dữ liệu JSON từ phần thân Request Body", "Lấy dữ liệu tham số dạng query string (?id=1)", "Khởi tạo bảng cơ sở dữ liệu"));

        repository.save(make("Đâu là giá trị vòng đời (Scope) mặc định của một Spring Bean khi được khởi tạo?", QuestionType.MULTIPLE_CHOICE, Difficulty.MEDIUM, "spring_boot", Set.of(0),
                "Singleton", "Prototype", "Request", "Session"));

        repository.save(make("Annotation @Transactional dùng ở tầng Service có vai trò thương mại gì?", QuestionType.MULTIPLE_CHOICE, Difficulty.MEDIUM, "spring_boot", Set.of(2),
                "Chuyển đổi dữ liệu sang dạng nhị phân", "Mã hóa luồng dữ liệu", "Đảm bảo tính toàn vẹn dữ liệu, tự động rollback toàn bộ nếu phát sinh lỗi trong phiên giao dịch", "Tự động phân trang dữ liệu"));

        repository.save(make("Để đọc dữ liệu JSON gửi lên từ Client và chuyển thành DTO, ta đặt annotation nào trước tham số nhận?", QuestionType.MULTIPLE_CHOICE, Difficulty.EASY, "spring_boot", Set.of(1),
                "@RequestParam", "@RequestBody", "@ModelAttribute", "@RequestHeader"));

        repository.save(make("Lớp JpaRepository cung cấp sẵn hàm nào để tìm kiếm bản ghi theo thuộc tính ID (Khóa chính)?", QuestionType.MULTIPLE_CHOICE, Difficulty.EASY, "spring_boot", Set.of(2),
                "findAll()", "search()", "findById()", "getPrimary()"));

        repository.save(make("Cặp Annotation nào thường phối hợp để xây dựng bộ xử lý ngoại lệ tập trung (Global Exception Handling)?", QuestionType.MULTIPLE_CHOICE, Difficulty.HARD, "spring_boot", Set.of(3),
                "@Controller + @Catch", "@Component + @ExceptionHandler", "@Service + @ErrorAdvice", "@ControllerAdvice + @ExceptionHandler"));

        repository.save(make("Cấu hình bảo mật nào của Spring Security giúp chống lại lỗ hổng giả mạo yêu cầu chéo trang?", QuestionType.MULTIPLE_CHOICE, Difficulty.HARD, "spring_boot", Set.of(1),
                "CORS", "CSRF Token", "JWT Auth", "Basic Auth"));

        repository.save(make("Thư viện Lombok (với các nhãn như @Data, @Getter, @Setter) mang lại lợi ích lớn nhất nào?", QuestionType.MULTIPLE_CHOICE, Difficulty.EASY, "spring_boot", Set.of(0),
                "Giảm bớt mã lặp dòng (boilerplate code) như sinh thủ công getter, setter", "Tối ưu hóa tốc độ kết nối cơ sở dữ liệu", "Bắt các lỗi logic lúc runtime", "Tự động cấu hình bảo mật tài khoản"));


    }

    private Question make(String content, QuestionType type, Difficulty diff, String topic,
                          Set<Integer> correct, String... opts) {
        Question q = new Question();
        q.setIsActive(true);
        q.setContent(content);
        q.setType(type);
        q.setDifficulty(diff);
        q.setTopic(topic);
        for (int i = 0; i < opts.length; i++) {
            QuestionOption o = new QuestionOption();
            o.setContent(opts[i]);
            o.setCorrect(correct.contains(i));
            o.setQuestion(q);
            q.getOptions().add(o);
        }
        return q;
    }
}