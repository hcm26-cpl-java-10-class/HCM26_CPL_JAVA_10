package com.example.starter_project_2025.system.exam.domain;

/** NEW (anti-cheat): cac loai vi pham duoc ghi lai. */
public enum IntegrityEventType {
    TAB_HIDDEN,        // roi tab / thu nho trinh duyet
    WINDOW_BLUR,       // chuyen sang cua so/ung dung khac (tab van hien)
    FULLSCREEN_EXIT,   // thoat toan man hinh
    COPY,
    CUT,
    PASTE,
    CONTEXT_MENU,      // chuot phai
    DEVTOOLS_KEY,      // F12 / Ctrl+Shift+I / Ctrl+U ...
    PRINT_ATTEMPT,     // Ctrl+P / PrintScreen
    MULTI_SESSION      // cung bai thi mo o tab/thiet bi khac
}
