import TrainingCalendarAdjustDemo from "./TrainingCalendarAdjustDemo";

/**
 * ScheduleVersionManagementPage
 *
 * Màn hình Điều chỉnh Lịch Đào Tạo (Training Calendar Adjust).
 * Đã bỏ hoàn toàn danh sách bản nháp / phiên bản để đi thẳng vào không gian điều chỉnh lịch 3 cấp:
 * Topic -> Day -> Activity theo đúng đặc tả FAMS SRS.
 */
export default function ScheduleVersionManagementPage() {
  return <TrainingCalendarAdjustDemo defaultClassId="HCM26_FR_FU_KS_JAVA_01" />;
}
