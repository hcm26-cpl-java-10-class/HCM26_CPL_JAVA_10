import { jsPDF } from "jspdf";
import { dateText, rangeText, reportBlocks, translator } from "./report-content";
import type { ReportDetail } from "./report-api";

// The browser's Unicode font fallback shapes Vietnamese without requiring a shipped font.
export async function exportReportPdf(detail: ReportDetail) {
  await document.fonts.ready;
  const { report, snapshot } = detail;
  const t = translator(report.language);
  const pdf = new jsPDF({ format: "a4", unit: "mm", compress: true });
  const canvas = document.createElement("canvas");
  canvas.width = 1190;
  canvas.height = 1684;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("PDF rendering is unavailable.");
  ctx.scale(2, 2);
  const left = 42;
  const right = 553;
  let y = 0;
  let page = 1;

  function text(value: string, x: number, y: number, size: number, bold = false, color = "#182239") {
    ctx!.font = (bold ? "bold " : "") + size + "px Arial, sans-serif";
    ctx!.fillStyle = color;
    ctx!.fillText(value, x, y);
  }

  function lines(value: string, width: number, size: number, bold = false) {
    ctx!.font = (bold ? "bold " : "") + size + "px Arial, sans-serif";
    const output: string[] = [];
    for (const paragraph of value.split(/\r?\n/)) {
      let line = "";
      for (const word of paragraph.trim().split(/\s+/)) {
        const combined = line ? line + " " + word : word;
        if (line && ctx!.measureText(combined).width > width) {
          output.push(line);
          line = "";
        }
        if (ctx!.measureText(word).width > width) {
          for (const character of word) {
            if (ctx!.measureText(line + character).width > width) { output.push(line); line = ""; }
            line += character;
          }
        } else {
          line += (line ? " " : "") + word;
        }
      }
      output.push(line);
    }
    return output;
  }

  function begin() {
    ctx!.fillStyle = "#fff";
    ctx!.fillRect(0, 0, 595, 842);
    text("LMS  /  " + t("Personal Learning Report", "Báo cáo học tập cá nhân"), left, 38, 11, true, "#174d91");
    y = 65;
  }
  function finish() {
    ctx!.fillStyle = "#dbe3ed";
    ctx!.fillRect(left, 797, right - left, 1);
    text(t("Page ", "Trang ") + page, left, 814, 10, false, "#53647a");
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 210, 297, "page-" + page, "FAST");
  }
  function newPage() {
    finish();
    pdf.addPage();
    page++;
    begin();
  }
  function full(value: string, size: number, bold = false) {
    for (const line of lines(value, right - left, size, bold)) {
      if (y > 775) newPage();
      text(line, left, y, size, bold);
      y += size + 5;
    }
  }

  begin();
  full(report.title, 22, true);
  full(rangeText(report) + " · " + report.zone + (report.periodToDate ? t(" · Period to date", " · Đến hiện tại") : ""), 11);
  full(snapshot.learner + " · " + t("Generated ", "Tạo lúc ") + dateText(report.generatedAt, report.language, report.zone), 11);
  y += 12;
  for (const block of reportBlocks(detail)) {
    if (y + 50 > 775) newPage();
    full(block.title, 15, true);
    const rows = block.rows.length ? block.rows : [["", t("No data available", "Không có dữ liệu")] as [string, string]];
    for (const [label, value] of rows) {
      const key = lines(label, 158, 10, true);
      const body = lines(value, label ? 330 : right - left, 10);
      const count = Math.max(key.length, body.length);
      if (y + count * 15 + 7 > 775 && count * 15 < 650) newPage();
      for (let index = 0; index < count; index++) {
        if (y > 775) newPage();
        if (key[index]) text(key[index], left, y, 10, true);
        if (body[index]) text(body[index], label ? left + 175 : left, y, 10);
        y += 15;
      }
      ctx.fillStyle = "#edf1f6";
      ctx.fillRect(left, y - 2, right - left, 0.6);
      y += 6;
    }
    y += 9;
  }
  finish();
  pdf.save("learning-report-" + report.id + ".pdf");
}
