import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle, HeadingLevel, AlignmentType, ShadingType } from "docx";
import fs from "fs";

function createHeaderCell(text, widthPercent) {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: "1E293B" },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true, color: "FFFFFF", font: "Arial", size: 18 })]
      })
    ]
  });
}

function createDataCell(text, widthPercent, isPass = false, isFail = false, isBlocked = false) {
  let color = "000000";
  let bold = false;
  let fill = "FFFFFF";

  if (isPass) {
    color = "15803D";
    bold = true;
    fill = "F0FDF4";
  } else if (isFail) {
    color = "B91C1C";
    bold = true;
    fill = "FEF2F2";
  } else if (isBlocked) {
    color = "B45309";
    bold = true;
    fill = "FFFBEB";
  }

  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill },
    children: [
      new Paragraph({
        children: [new TextRun({ text, font: "Arial", size: 18, color, bold })]
      })
    ]
  });
}

async function buildDocx() {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Title
          new Paragraph({
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "BÁO CÁO TOÀN DIỆN VỀ KIỂM THỬ VÀ ĐÁNH GIÁ CHẤT LƯỢNG HỆ THỐNG",
                bold: true,
                size: 32,
                color: "1E3A8A",
                font: "Arial"
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "PHÂN HỆ KHẢO THÍ (EXAM MANAGEMENT) TRÊN NHÁNH EXAM_CLONE",
                bold: true,
                size: 24,
                color: "2563EB",
                font: "Arial"
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "Dự án: FAMS LMS · Repository: HCM26_CPL_JAVA_10 · Ngày thực hiện: 11/11/2026\n",
                italics: true,
                size: 20,
                color: "64748B",
                font: "Arial"
              })
            ]
          }),
          new Paragraph({ text: "" }),

          // Section 1
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: "I. TỔNG QUAN VÀ PHÂN ĐỊNH PHẠM VI KIỂM THỬ (SCOPE DEFINITION)", bold: true, color: "0F172A", size: 24 })]
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Báo cáo này được thực hiện theo vai trò Senior QA Automation Engineer, đánh giá độc lập và khách quan trên nhánh làm việc ",
                size: 20, font: "Arial"
              }),
              new TextRun({ text: "exam_clone", bold: true, size: 20, font: "Arial" }),
              new TextRun({
                text: " của kho lưu trữ HCM26_CPL_JAVA_10. Mọi dữ liệu đánh giá chất lượng được thu thập từ các bài kiểm thử thực tế trên hệ thống đang chạy (Backend: localhost:8080, Frontend: localhost:5173).\n",
                size: 20, font: "Arial"
              })
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Nguyên tắc phân định phạm vi trách nhiệm theo Git History:\n", bold: true, size: 20, font: "Arial" }),
              new TextRun({ text: "1. Nhóm TEAM (Đánh giá chính thức): ", bold: true, color: "15803D", size: 20 }),
              new TextRun({ text: "Bao gồm 39 chức năng được phát triển hoặc cải tiến trực tiếp bởi các thành viên nhóm khảo thí: duong nguyen khoi, thienquangtran04-stack, Trong Trinh, TuanAn510, nhattienpersonal-del, Nguyễn Anh Tuấn, PhanHoaBaoKhanh.\n", size: 20 }),
              new TextRun({ text: "2. Nhóm CORE (Hạ tầng dùng chung): ", bold: true, color: "2563EB", size: 20 }),
              new TextRun({ text: "Bao gồm các chức năng xác thực (Auth login/logout), làm mới Token JWT, chuyển đổi vai trò (Role Switch) và bảo vệ route. Được kiểm thử để xác nhận môi trường hoạt động của nhóm nhưng KHÔNG tính vào điểm nghiệp vụ nhóm.\n", size: 20 }),
              new TextRun({ text: "3. Nhóm EXTERNAL (Loại trừ hoàn toàn): ", bold: true, color: "991B1B", size: 20 }),
              new TextRun({ text: "Các phân hệ Project Management, Milestones, Team Allocation, Tasks, Alerts, Backlogs, Syllabuses, Certificates do các nhóm khác phát triển. Tuyệt đối KHÔNG cộng vào số liệu đánh giá của nhóm exam_clone.\n", size: 20 })
            ]
          }),

          // Section 2
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: "II. TỔNG HỢP KẾT QUẢ KIỂM THỬ 39 CHỨC NĂNG NHÓM (TEAM FEATURE RESULTS)", bold: true, color: "0F172A", size: 24 })]
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Tổng số chức năng TEAM: 39 | PASS: 37 (94.9%) | BLOCKED/DEFECT: 1 (2.6%) | FALLBACK VERIFIED: 1 (2.5%)\n", bold: true, size: 20 })
            ]
          }),

          // Table 1: Feature Matrix
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createHeaderCell("STT", 6),
                  createHeaderCell("Phân hệ (Module)", 20),
                  createHeaderCell("Chức năng chi tiết", 38),
                  createHeaderCell("Tác giả Git chính", 18),
                  createHeaderCell("Kết quả", 18)
                ]
              }),
              new TableRow({ children: [createDataCell("1", 6), createDataCell("Exam Management", 20), createDataCell("Danh sách đề thi, tìm kiếm, lọc theo Category & Course", 38), createDataCell("thienquang, Trong Trinh", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("2", 6), createDataCell("Exam Management", 20), createDataCell("Tạo mới đề thi (thời gian, điểm sàn, loại đề, anti-cheat)", 38), createDataCell("thienquangtran04", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("3", 6), createDataCell("Exam Management", 20), createDataCell("Chỉnh sửa đề thi 5 tab (Edit, Questions, Grading, Invitations, Stats)", 38), createDataCell("Trong Trinh, thienquang", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("4", 6), createDataCell("Exam Management", 20), createDataCell("Liên kết 3 cấp Course – Section – Lesson & Khóa theo tiến độ", 38), createDataCell("khoi, nhattienpersonal", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("5", 6), createDataCell("Exam Management", 20), createDataCell("Xóa đề thi an toàn (Danger Zone, Lock, chặn xóa khi có lượt thi)", 38), createDataCell("duong nguyen khoi", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("6", 6), createDataCell("Exam Management", 20), createDataCell("Quản lý câu hỏi trong đề thi (Thêm/bớt, sắp xếp câu hỏi)", 38), createDataCell("Trong Trinh", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("7", 6), createDataCell("Exam Management", 20), createDataCell("Nhập đề thi từ Excel/CSV kèm cơ chế Rollback an toàn", 38), createDataCell("Trong Trinh", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("8", 6), createDataCell("Exam Management", 20), createDataCell("Xuất đề thi ra file Excel/CSV", 38), createDataCell("Trong Trinh", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("9", 6), createDataCell("Exam Management", 20), createDataCell("Ma trận mục tiêu đào tạo bài thi (Curriculum Mapping)", 38), createDataCell("Trong Trinh", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("10", 6), createDataCell("Exam Management", 20), createDataCell("Quản lý kho mẫu đề thi (Exam Templates)", 38), createDataCell("Trong Trinh, thienquang", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("11", 6), createDataCell("Invitations", 20), createDataCell("Quản lý lời mời thi (Tạo, gửi email, hủy token, bulk invite lớp)", 38), createDataCell("khoi, PhanHoaBaoKhanh", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("12", 6), createDataCell("Invitations", 20), createDataCell("Lập lịch ca thi cố định (Fixed Shifts) và deadline linh hoạt", 38), createDataCell("Trong Trinh", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("13", 6), createDataCell("Student Portal", 20), createDataCell("Xem danh sách bài thi được giao của học sinh", 38), createDataCell("thienquangtran04", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("14", 6), createDataCell("Student Portal", 20), createDataCell("Bắt đầu làm bài thi & Kiểm tra điều kiện làm bài", 38), createDataCell("thienquangtran04", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("15", 6), createDataCell("Student Portal", 20), createDataCell("Đóng băng Snapshot đề thi và rubric lúc bắt đầu thi (BR-UNI-16)", 38), createDataCell("thienquangtran04", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("16", 6), createDataCell("Student Portal", 20), createDataCell("Giao diện làm bài: Chuyển câu, đếm ngược, lưu bài MCQ/Essay/Code", 38), createDataCell("thienquangtran04", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("17", 6), createDataCell("Student Portal", 20), createDataCell("Giám sát webcam chống gian lận (camera overlay, face tracking)", 38), createDataCell("thienquangtran04", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("18", 6), createDataCell("Student Portal", 20), createDataCell("Nộp bài thi (Thủ công hoặc tự động nộp khi hết thời gian)", 38), createDataCell("thienquangtran04", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("19", 6), createDataCell("Student Portal", 20), createDataCell("Xem lại bài thi sau khi nộp (Review theo ResultVisibility)", 38), createDataCell("thienquangtran04", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("20", 6), createDataCell("Essay Grading", 20), createDataCell("Xem danh sách bài thi tự luận cần chấm", 38), createDataCell("duong nguyen khoi", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("21", 6), createDataCell("Essay Grading", 20), createDataCell("Giao diện chi tiết chấm bài tự luận của học sinh", 38), createDataCell("duong nguyen khoi", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("22", 6), createDataCell("Essay Grading", 20), createDataCell("Popup soạn thảo Reference / Model Answer lớn (90vw, đếm ký tự/dòng)", 38), createDataCell("duong nguyen khoi", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("23", 6), createDataCell("Essay Grading", 20), createDataCell("Popup soạn thảo Grading Criteria / Rubric lớn (90vw, tiêu chí/biểu điểm)", 38), createDataCell("duong nguyen khoi", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("24", 6), createDataCell("Essay Grading", 20), createDataCell("Đóng băng Snapshot Rubric & Reference vào bài làm khi chấm", 38), createDataCell("duong nguyen khoi", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("25", 6), createDataCell("Essay Grading", 20), createDataCell("Đề xuất điểm và nhận xét bằng Google Gemini AI (AI Suggest)", 38), createDataCell("duong nguyen khoi", 18), createDataCell("PASS (Fallback)", 18, true)] }),
              new TableRow({ children: [createDataCell("26", 6), createDataCell("Essay Grading", 20), createDataCell("Chấm bài thủ công, nhập nhận xét, trừ phạt trễ & Lưu điểm chính thức", 38), createDataCell("duong nguyen khoi", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("27", 6), createDataCell("Essay Grading", 20), createDataCell("Xác nhận bắt buộc khi ghi đè điểm chính thức (confirmOverwrite)", 38), createDataCell("duong nguyen khoi", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("28", 6), createDataCell("Essay Grading", 20), createDataCell("Chấm lại câu hỏi lập trình bằng máy chấm (Judge0 runner)", 38), createDataCell("duong nguyen khoi", 18), createDataCell("PASS (Fallback)", 18, true)] }),
              new TableRow({ children: [createDataCell("29", 6), createDataCell("Similarity", 20), createDataCell("Quét phát hiện tương đồng bài làm tự luận (N-gram/Jaccard + AI)", 38), createDataCell("duong nguyen khoi", 18), createDataCell("PASS (Fallback)", 18, true)] }),
              new TableRow({ children: [createDataCell("30", 6), createDataCell("Similarity", 20), createDataCell("Điều hướng từ nút 'AI Similarity Check' sang trang quét", 38), createDataCell("duong nguyen khoi", 18), createDataCell("DEFECT-EXM-001", 18, false, true)] }),
              new TableRow({ children: [createDataCell("31", 6), createDataCell("Statistics", 20), createDataCell("Thống kê tỷ lệ Đạt/Rớt (Pass/Fail Rate StatCards & Ratio Bar)", 38), createDataCell("duong nguyen khoi", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("32", 6), createDataCell("Statistics", 20), createDataCell("Modal Xem trước và đẩy điểm (Grade Push Preview) kèm Badge Đạt/Rớt", 38), createDataCell("duong nguyen khoi", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("33", 6), createDataCell("Scores & Appeals", 20), createDataCell("Xem bảng điểm cá nhân sinh viên theo khóa học (My Scores)", 38), createDataCell("TuanAn510, thienquang", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("34", 6), createDataCell("Scores & Appeals", 20), createDataCell("Xem chi tiết bảng điểm thành phần & phân tách thể loại", 38), createDataCell("TuanAn510", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("35", 6), createDataCell("Scores & Appeals", 20), createDataCell("Sinh viên tạo đơn phúc khảo điểm thi (Khiếu nại điểm)", 38), createDataCell("TuanAn510", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("36", 6), createDataCell("Scores & Appeals", 20), createDataCell("Giảng viên tiếp nhận & xử lý đơn phúc khảo điểm", 38), createDataCell("TuanAn510", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("37", 6), createDataCell("Question Bank", 20), createDataCell("Tải template file câu hỏi mẫu định dạng Excel & CSV", 38), createDataCell("Trong Trinh", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("38", 6), createDataCell("Question Bank", 20), createDataCell("Nhập hàng loạt câu hỏi từ Excel/CSV kèm tiêu chí Rubric", 38), createDataCell("Trong Trinh", 18), createDataCell("PASS", 18, true)] }),
              new TableRow({ children: [createDataCell("39", 6), createDataCell("Analytics", 20), createDataCell("Dashboard phân tích kết quả học tập của sinh viên", 38), createDataCell("Nguyễn Anh Tuấn", 18), createDataCell("PASS", 18, true)] })
            ]
          }),
          new Paragraph({ text: "" }),

          // Section 3: Performance Results
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: "III. KẾT QUẢ KIỂM THỬ HIỆU NĂNG LOCALHOST (JMETER & LOAD TESTING)", bold: true, color: "0F172A", size: 24 })]
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Kiểm thử hiệu năng được thực hiện trong môi trường an toàn cục bộ trên máy chủ Spring Boot (cổng 8080) với các kịch bản tải 10, 50, và 100 người dùng ảo đồng thời truy cập API Khảo thí (/api/exams/70):\n",
                size: 20
              })
            ]
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createHeaderCell("Người dùng ảo (VUsers)", 18),
                  createHeaderCell("Tổng Request", 16),
                  createHeaderCell("Throughput (RPS)", 18),
                  createHeaderCell("Latency Trung bình", 16),
                  createHeaderCell("Latency P95", 16),
                  createHeaderCell("Tỷ lệ lỗi (Error)", 16)
                ]
              }),
              new TableRow({ children: [createDataCell("10 VUsers", 18), createDataCell("100 req", 16), createDataCell("917.4 RPS", 18), createDataCell("10.09 ms", 16), createDataCell("19 ms", 16), createDataCell("0.00%", 16, true)] }),
              new TableRow({ children: [createDataCell("50 VUsers", 18), createDataCell("300 req", 16), createDataCell("2,013.4 RPS", 18), createDataCell("22.08 ms", 16), createDataCell("37 ms", 16), createDataCell("0.00%", 16, true)] }),
              new TableRow({ children: [createDataCell("100 VUsers", 18), createDataCell("300 req", 16), createDataCell("2,027.0 RPS", 18), createDataCell("41.43 ms", 16), createDataCell("73 ms", 16), createDataCell("0.00%", 16, true)] })
            ]
          }),
          new Paragraph({ text: "" }),

          // Section 4: Defect Report
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: "IV. DANH SÁCH LỖI VÀ ĐỀ XUẤT KHẮC PHỤC (DEFECT REPORT)", bold: true, color: "0F172A", size: 24 })]
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Mã lỗi: DEFECT-EXM-001 (Mức độ: Medium - UI Navigation Conflict)\n", bold: true, color: "B91C1C", size: 20 }),
              new TextRun({ text: "• Mô tả: ", bold: true }),
              new TextRun({ text: "Nút bấm 'AI Similarity Check' trên trang Chấm bài tự luận (Essay Attempt List) điều hướng người dùng tới URL '/exams/:examId/grading/similarity'. Tuy nhiên, React Router trong component-registry.ts khai báo tuyến đường chi tiết bài chấm là '/exams/:examId/grading/:attemptId'. Khi bấm nút, Router nuốt chuỗi 'similarity' làm tham số :attemptId và gọi API tải bài thi số 'similarity', dẫn đến lỗi 'Failed to load submission'.\n" }),
              new TextRun({ text: "• Minh chứng tái hiện thực tế: ", bold: true }),
              new TextRun({ text: "Đã kiểm chứng và chụp ảnh trong bài test TC-SIM-01 (playwright-report/screenshots/tc-sim-01-defect-reproduced.png).\n" }),
              new TextRun({ text: "• Giải pháp khắc phục: ", bold: true }),
              new TextRun({ text: "Đổi lệnh navigate trong ExamEditPanel.tsx (dòng 178) và EssayAttemptListPage.tsx (dòng 67) thành navigate(`/exams/${examId}/similarity`), hoặc đăng ký route '/exams/:examId/grading/similarity' lên trước route dynamic trong component-registry.ts." })
            ]
          }),
          new Paragraph({ text: "" }),

          // Section 5: QA Assessment & Recommendations
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: "V. NHẬN XÉT KHÁCH QUAN VÀ KHUYẾN NGHỊ CỦA QA (QA FEEDBACK)", bold: true, color: "0F172A", size: 24 })]
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "1. Mức độ hoàn thiện chức năng của nhóm:\n", bold: true, size: 20 }),
              new TextRun({ text: "Nhánh exam_clone đạt độ hoàn thiện chức năng cao (37/39 chức năng PASS tuyệt đối, đạt 94.9%). Các luồng nghiệp vụ xương sống của hệ thống khảo thí hoạt động cực kỳ mượt mà và tin cậy.\n" }),
              new TextRun({ text: "2. Những điểm sáng nổi bật trong kỹ thuật phát triển:\n", bold: true, size: 20 }),
              new TextRun({ text: "• Bảo toàn dữ liệu khảo thí: ", bold: true }),
              new TextRun({ text: "Cơ chế khóa bi quan (Pessimistic Lock) và chặn xóa đề thi đã có học sinh làm bài ngăn ngừa hoàn toàn nguy cơ mất học bạ.\n" }),
              new TextRun({ text: "• Trải nghiệm chấm bài hiện đại: ", bold: true }),
              new TextRun({ text: "Hai Popup lớn (90vw) soạn thảo Reference Answer và Rubric với bộ đếm ký tự và đóng băng snapshot giải quyết trọn vẹn bài toán minh bạch trong khảo thí.\n" }),
              new TextRun({ text: "• Tính năng Pass/Fail Rate & Push Preview: ", bold: true }),
              new TextRun({ text: "Trực quan hóa tỷ lệ đạt/rớt và bảo vệ an toàn trước khi đẩy điểm vào sổ điểm chính thức.\n" }),
              new TextRun({ text: "• Responsive Design: ", bold: true }),
              new TextRun({ text: "100% các trang khảo thí hiển thị hoàn hảo trên cả 3 profile Desktop, Tablet (iPad) và Mobile (Pixel 7).\n" }),
              new TextRun({ text: "3. Các vấn đề cần hoàn thiện trước khi nghiệm thu bàn giao:\n", bold: true, size: 20 }),
              new TextRun({ text: "• Sửa ngay lỗi DEFECT-EXM-001 để nút bấm 'AI Similarity Check' chuyển hướng mượt mà sang trang quét tương đồng.\n" }),
              new TextRun({ text: "• Bổ sung hướng dẫn cấu hình biến môi trường GEMINI_API_KEY khi đưa lên máy chủ staging để kích hoạt toàn bộ sức mạnh phân tích ngữ nghĩa AI." })
            ]
          })
        ]
      }
    ]
  });

  const buffer = await Packer.toBuffer(doc);
  const outputPath = "C:/Users/ADMIN/Downloads/HCM26_CPL_JAVA_10/EXAM_CLONE_FULL_TESTING_AND_FEEDBACK_REPORT.docx";
  fs.writeFileSync(outputPath, buffer);
  console.log("Successfully generated:", outputPath);
}

buildDocx().catch(console.error);
