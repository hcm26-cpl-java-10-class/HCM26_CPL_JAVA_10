export interface LessonProgress {
    id: number;
    enrollmentId: number;
    lessonId: number;
    isCompleted: boolean;
    completedAt: string | null;
    lastAccessedAt: string;
}

export interface ProgressLesson {
    id: number;
    title: string;
    sectionTitle?: string;
}
