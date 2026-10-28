
package com.example.trainingprogram.integration;

/**
 * Kiểm tra Training Program có đang được sử dụng
 * bởi một hoặc nhiều lớp học trong Class module hay không.
 *
 * Implementation cần kết nối với Class module.
 */
public interface TrainingProgramUsageChecker {

    /**
     * @param programId ID chương trình đào tạo
     * @return true nếu có ít nhất một lớp học đang sử dụng chương trình
     */
    boolean isUsedByAnyClass(Long programId);
}
