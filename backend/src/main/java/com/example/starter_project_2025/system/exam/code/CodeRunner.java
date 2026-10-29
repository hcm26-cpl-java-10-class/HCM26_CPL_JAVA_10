package com.example.starter_project_2025.system.exam.code;

/** Nhan chuong trinh Java, chay trong moi truong cach ly va tra ket qua. */
public interface CodeRunner {

    RunOutcome run(String javaSource, String stdin);

    /**
     * @param infraError true neu khong goi duoc may cham (khong phai loi cua thi sinh)
     * @param statusId   ma trang thai Judge0 (3 = chay xong, 6 = loi bien dich, 5 = qua thoi gian, ...)
     */
    record RunOutcome(boolean infraError, int statusId, String statusText,
                      String stdout, String stderr, String compileOutput) {

        public boolean ranOk() {
            return !infraError && statusId == 3;
        }

        public boolean compileError() {
            return !infraError && statusId == 6;
        }

        public static RunOutcome infra(String message) {
            return new RunOutcome(true, -1, message, "", "", "");
        }
    }
}
