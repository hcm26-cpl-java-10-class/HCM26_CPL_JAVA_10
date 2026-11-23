import { afterEach, describe, expect, it } from "vitest";
import {
  createMemoryAutoTranslationStore,
  isAutoTranslatable,
  looksVietnamese,
  needsAutoTranslation,
  startDomTranslator,
  translatePhrase,
  type Language,
} from "@/i18n/translator";

const flush = () => new Promise<void>((resolve) => queueMicrotask(() => resolve()));

describe("translatePhrase", () => {
  it("translates exact and case-insensitive phrases, keeping ALL CAPS", () => {
    expect(translatePhrase("Cancel", "vi")).toBe("Hủy");
    expect(translatePhrase("cancel", "vi")).toBe("Hủy");
    expect(translatePhrase("ACTIVE", "vi")).toBe("ĐANG HOẠT ĐỘNG");
  });

  it("translates reviewed Japanese phrases from dictionary", () => {
    expect(translatePhrase("Cancel", "ja")).toBe("キャンセル");
    expect(translatePhrase("Save", "ja")).toBe("保存");
    expect(translatePhrase("Dashboard", "ja")).toBe("ダッシュボード");
  });

  it("returns null for unknown phrases in Japanese so original text is kept", () => {
    expect(translatePhrase("Nonexistent strange string", "ja")).toBeNull();
  });

  it("translates Vietnamese source strings back to English", () => {
    expect(translatePhrase("Hủy", "en")).toBe("Cancel");
    expect(translatePhrase("Thử lại", "en")).toBe("Try again");
  });

  it("translates dynamic patterns when the noun is known", () => {
    expect(translatePhrase("Loading students...", "vi")).toBe("Đang tải học viên...");
    expect(translatePhrase("Back to Class List", "vi")).toBe("Quay lại danh sách lớp");
    expect(translatePhrase("Create Course", "vi")).toBe("Tạo khóa học");
    expect(translatePhrase("Danh sách học viên", "en")).toBe("Student List");
    expect(translatePhrase("Quản lý khóa học", "en")).toBe("Course Management");
    expect(translatePhrase("Quay lại danh sách lớp", "en")).toBe("Back to Class List");
  });

  it("returns null for unknown phrases so the original text is kept", () => {
    expect(translatePhrase("Quarterly flux capacitor", "vi")).toBeNull();
    expect(translatePhrase("   ", "vi")).toBeNull();
  });
});

describe("isAutoTranslatable", () => {
  it("accepts plain sentences", () => {
    expect(isAutoTranslatable("Create a new quiz")).toBe(true);
    expect(isAutoTranslatable("Publish the syllabus")).toBe(true);
  });

  it("rejects numbers, symbols, urls, emails and identifiers", () => {
    expect(isAutoTranslatable("123")).toBe(false);
    expect(isAutoTranslatable("%")).toBe(false);
    expect(isAutoTranslatable("https://example.com/x")).toBe(false);
    expect(isAutoTranslatable("admin@example.com")).toBe(false);
    expect(isAutoTranslatable("module_group_name")).toBe(false);
    expect(isAutoTranslatable("A")).toBe(false);
    expect(isAutoTranslatable("x".repeat(700))).toBe(false);
  });

  it("rejects chunks that embed an email or a url", () => {
    // Translating these would mangle the address.
    expect(isAutoTranslatable("ADMIN: admin@example.com / password123")).toBe(false);
    expect(isAutoTranslatable("Visit https://fams.example.com for more")).toBe(false);
    expect(isAutoTranslatable("Report for course_analytics")).toBe(false);
  });
});

describe("looksVietnamese", () => {
  it("detects Vietnamese specific characters", () => {
    expect(looksVietnamese("Hủy bỏ")).toBe(true);
    expect(looksVietnamese("Quay lại")).toBe(true);
    expect(looksVietnamese("Cancel")).toBe(false);
  });
});

describe("needsAutoTranslation", () => {
  it("sends translatable chunks regardless of the direction", () => {
    // Chiều dịch do backend tự nhận diện nên frontend không cần suy ra.
    expect(needsAutoTranslation("Create a new quiz")).toBe(true);
    expect(needsAutoTranslation("Tạo bài thi mới")).toBe(true);
    expect(needsAutoTranslation("123")).toBe(false);
    expect(needsAutoTranslation("admin@example.com")).toBe(false);
  });
});

describe("createMemoryAutoTranslationStore", () => {
  it("stores and reads translations, case-insensitively", () => {
    const store = createMemoryAutoTranslationStore();
    store.set({ "Create a new quiz": "Tạo bài kiểm tra mới" }, "vi");

    expect(store.get("Create a new quiz", "vi")).toBe("Tạo bài kiểm tra mới");
    expect(store.get("create a new quiz", "vi")).toBe("Tạo bài kiểm tra mới");
    expect(store.get("Create a new quiz", "en")).toBeNull();
  });
});

describe("startDomTranslator", () => {
  let stop: (() => void) | undefined;
  afterEach(() => {
    stop?.();
    document.body.innerHTML = "";
  });

  const mount = (html: string, initial: Language) => {
    document.body.innerHTML = html;
    let language = initial;
    const translator = startDomTranslator(document.body, () => language);
    stop = translator.stop;
    return {
      setLanguage: (next: Language) => {
        language = next;
        translator.refresh();
      },
    };
  };

  it("translates text and placeholders, and restores English when switching back", () => {
    const { setLanguage } = mount(
      '<button>Cancel</button><input placeholder="Search" /><p>  Status  </p><p>Unknown text</p>',
      "en"
    );
    setLanguage("vi");
    expect(document.querySelector("button")!.textContent).toBe("Hủy");
    expect(document.querySelector("input")!.getAttribute("placeholder")).toBe("Tìm kiếm");
    expect(document.querySelectorAll("p")[0].textContent).toBe("  Trạng thái  ");
    expect(document.querySelectorAll("p")[1].textContent).toBe("Unknown text");

    setLanguage("ja");
    expect(document.querySelector("button")!.textContent).toBe("キャンセル");
    expect(document.querySelector("input")!.getAttribute("placeholder")).toBe("検索");
    expect(document.querySelectorAll("p")[0].textContent).toBe("  ステータス  ");

    setLanguage("en");
    expect(document.querySelector("button")!.textContent).toBe("Cancel");
    expect(document.querySelector("input")!.getAttribute("placeholder")).toBe("Search");
  });

  it("translates nodes added later and values re-written by the framework", async () => {
    const { setLanguage } = mount('<div id="root"><span id="label">Save</span></div>', "vi");
    const label = document.getElementById("label")!;
    expect(label.textContent).toBe("Lưu");

    // A re-render writes a new source value into the same text node.
    label.firstChild!.nodeValue = "Delete";
    await flush();
    expect(label.textContent).toBe("Xóa");

    const added = document.createElement("button");
    added.textContent = "Close";
    document.getElementById("root")!.appendChild(added);
    await flush();
    expect(added.textContent).toBe("Đóng");

    setLanguage("en");
    expect(label.textContent).toBe("Delete");
    expect(added.textContent).toBe("Close");
  });

  it("skips elements marked data-no-translate", () => {
    mount('<span data-no-translate>Cancel</span><span>Cancel</span>', "vi");
    const spans = document.querySelectorAll("span");
    expect(spans[0].textContent).toBe("Cancel");
    expect(spans[1].textContent).toBe("Hủy");
  });

  it("uses the auto-translation store for phrases missing from the dictionary", () => {
    document.body.innerHTML = "<button>Create a new quiz</button>";
    const store = createMemoryAutoTranslationStore();
    store.set({ "Create a new quiz": "Tạo bài kiểm tra mới" }, "vi");

    let language: Language = "vi";
    const translator = startDomTranslator(document.body, () => language, {
      lookupAuto: (sourceText, target) => store.get(sourceText, target),
    });
    stop = translator.stop;

    expect(document.querySelector("button")!.textContent).toBe("Tạo bài kiểm tra mới");

    language = "en";
    translator.refresh();
    expect(document.querySelector("button")!.textContent).toBe("Create a new quiz");
  });

  it("reports the chunks that still need auto-translation", () => {
    document.body.innerHTML = "<button>Create a new quiz</button><p>123</p>";
    let language: Language = "vi";
    const translator = startDomTranslator(document.body, () => language, {
      lookupAuto: () => null,
    });
    stop = translator.stop;

    const pending = translator.collectPending();
    expect(pending).toContain("Create a new quiz");
    // Pure numbers are never sent to the translation API.
    expect(pending).not.toContain("123");
  });
});
