import { jsPDF } from "jspdf";

export interface CertificatePdfData {
  studentName: string;
  courseName: string;
  issuedAt: string;
  verificationUrl: string;
}

const PAGE_WIDTH = 297;
const PAGE_HEIGHT = 210;

const COLORS = {
  white: [255, 255, 255] as [number, number, number],
  slate900: [15, 23, 42] as [number, number, number],
  slate600: [71, 85, 105] as [number, number, number],
  slate500: [100, 116, 139] as [number, number, number],
  indigo700: [67, 56, 202] as [number, number, number],
  indigo800: [55, 48, 163] as [number, number, number],
  blue700: [29, 78, 216] as [number, number, number],
  blue200: [191, 219, 254] as [number, number, number],
  blue100: [219, 234, 254] as [number, number, number],
  blue50: [239, 246, 255] as [number, number, number],
};

type RGB = [number, number, number];

function setFillColor(pdf: jsPDF, color: RGB) {
  pdf.setFillColor(color[0], color[1], color[2]);
}

function setDrawColor(pdf: jsPDF, color: RGB) {
  pdf.setDrawColor(color[0], color[1], color[2]);
}

function setTextColor(pdf: jsPDF, color: RGB) {
  pdf.setTextColor(color[0], color[1], color[2]);
}

function setFont(
  pdf: jsPDF,
  style: "normal" | "bold" | "italic" | "bolditalic" = "normal",
  size = 10,
) {
  pdf.setFont("helvetica", style);
  pdf.setFontSize(size);
}

function drawBackground(pdf: jsPDF) {
  // White page background
  setFillColor(pdf, COLORS.white);
  pdf.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");

  // Outer border
  setDrawColor(pdf, COLORS.blue200);
  pdf.setLineWidth(0.8);
  pdf.rect(10, 10, PAGE_WIDTH - 20, PAGE_HEIGHT - 20);

  // Inner border
  setDrawColor(pdf, COLORS.blue100);
  pdf.setLineWidth(0.3);
  pdf.rect(13, 13, PAGE_WIDTH - 26, PAGE_HEIGHT - 26);

  // Top-left blue gradient approximation
  setFillColor(pdf, COLORS.blue50);
  pdf.triangle(13, 13, 67, 13, 13, 51, "F");

  // Bottom-right decorative background
  pdf.setFillColor(248, 250, 255);
  pdf.triangle(287, 200, 220, 200, 287, 145, "F");

  // Decorative circles
  setDrawColor(pdf, COLORS.blue100);
  pdf.setLineWidth(0.4);
  pdf.circle(263, 168, 22, "S");
  pdf.circle(263, 168, 18, "S");
}

function drawBrand(pdf: jsPDF) {
  // Logo block
  setFillColor(pdf, COLORS.indigo700);
  pdf.roundedRect(22, 22, 14, 14, 2, 2, "F");

  setFont(pdf, "bold", 10);
  setTextColor(pdf, COLORS.white);
  pdf.text("RB", 29, 31, { align: "center" });

  // Brand title
  setFont(pdf, "bold", 12);
  setTextColor(pdf, COLORS.slate900);
  pdf.text("RBAC System", 40, 27.5);

  setFont(pdf, "normal", 8);
  setTextColor(pdf, COLORS.slate500);
  pdf.text("Online Learning Platform", 40, 33.5);

  // Top-right label
  setFont(pdf, "bold", 8);
  setTextColor(pdf, COLORS.blue700);
  pdf.text("LEARNING ACHIEVEMENT", 271, 28, {
    align: "right",
    charSpace: 0.6,
  });
}

function drawRibbon(pdf: jsPDF) {
  const x = 248;
  const y = 40;
  const width = 24;
  const height = 43;

  // Ribbon body
  setFillColor(pdf, COLORS.blue700);
  pdf.rect(x, y, width, height, "F");

  // Pointed ribbon bottom
  pdf.triangle(
    x,
    y + height,
    x + width,
    y + height,
    x + width / 2,
    y + height + 8,
    "F",
  );

  // Simple graduation-cap illustration
  setDrawColor(pdf, COLORS.white);
  pdf.setLineWidth(0.8);
  pdf.line(x + 5, y + 10, x + 12, y + 6);
  pdf.line(x + 12, y + 6, x + 19, y + 10);
  pdf.line(x + 5, y + 10, x + 12, y + 14);
  pdf.line(x + 12, y + 14, x + 19, y + 10);
  pdf.line(x + 7, y + 11, x + 7, y + 15);
  pdf.line(x + 17, y + 11, x + 17, y + 15);

  // Ribbon text
  setFont(pdf, "bold", 6.5);
  setTextColor(pdf, COLORS.white);
  pdf.text(["COURSE", "COMPLETION"], x + width / 2, y + 23, {
    align: "center",
    lineHeightFactor: 1.5,
  });

  // Award circle and ribbons
  setDrawColor(pdf, COLORS.blue200);
  pdf.setLineWidth(0.7);
  pdf.circle(x + width / 2, y + 34, 3, "S");
  pdf.line(x + 10, y + 37, x + 9, y + 40);
  pdf.line(x + 14, y + 37, x + 15, y + 40);
}

function drawMainContent(pdf: jsPDF, data: CertificatePdfData) {
  const x = 23;
  const maxWidth = 207;

  // Main heading
  setFont(pdf, "normal", 26);
  setTextColor(pdf, COLORS.indigo800);
  pdf.text("Certificate of Completion", x, 64);

  // Introductory text
  setFont(pdf, "normal", 10);
  setTextColor(pdf, COLORS.slate500);
  pdf.text("This certifies that", x, 79);

  // Student name
  const studentName = data.studentName?.trim() || "Student";

  let studentFontSize = 22;
  let studentLines: string[] = [];

  while (studentFontSize >= 14) {
    setFont(pdf, "bold", studentFontSize);
    studentLines = pdf.splitTextToSize(studentName, maxWidth);

    if (studentLines.length <= 2) {
      break;
    }

    studentFontSize -= 1;
  }

  setTextColor(pdf, COLORS.slate900);

  const studentY = 91;
  const studentLineHeight = studentFontSize * 0.45;
  pdf.text(studentLines, x, studentY, {
    lineHeightFactor: 1.25,
  });

  // Course description
  const descriptionY =
    studentY + studentLines.length * studentLineHeight + 5;

  setFont(pdf, "normal", 10);
  setTextColor(pdf, COLORS.slate600);
  pdf.text(
    "has successfully completed the course",
    x,
    descriptionY,
  );

  // Course name
  const courseName = data.courseName?.trim() || "Course";
  let courseFontSize = 15;
  let courseLines: string[] = [];

  while (courseFontSize >= 10) {
    setFont(pdf, "bold", courseFontSize);
    courseLines = pdf.splitTextToSize(courseName, maxWidth);

    const estimatedBottom =
      descriptionY + 10 + courseLines.length * courseFontSize * 0.5;

    if (courseLines.length <= 2 && estimatedBottom <= 157) {
      break;
    }

    courseFontSize -= 1;
  }

  setTextColor(pdf, COLORS.blue700);
  pdf.text(courseLines, x, descriptionY + 10, {
    lineHeightFactor: 1.3,
  });
}

function drawCalendarIcon(pdf: jsPDF, x: number, y: number) {
  setDrawColor(pdf, COLORS.blue700);
  pdf.setLineWidth(0.6);

  pdf.roundedRect(x, y, 6, 6, 0.6, 0.6, "S");
  pdf.line(x, y + 2, x + 6, y + 2);
  pdf.line(x + 1.5, y - 1, x + 1.5, y + 1);
  pdf.line(x + 4.5, y - 1, x + 4.5, y + 1);
}

function drawShieldIcon(pdf: jsPDF, x: number, y: number) {
  setDrawColor(pdf, COLORS.blue700);
  pdf.setLineWidth(0.6);

  pdf.line(x, y, x + 6, y);
  pdf.line(x, y, x, y + 6);
  pdf.line(x + 6, y, x + 6, y + 6);
  pdf.line(x, y + 6, x + 3, y + 9);
  pdf.line(x + 6, y + 6, x + 3, y + 9);
}

function drawFooter(pdf: jsPDF, data: CertificatePdfData) {
  const footerY = 163;

  // Separator
  setDrawColor(pdf, COLORS.blue100);
  pdf.setLineWidth(0.5);
  pdf.line(23, footerY, 274, footerY);

  // Issue date
  drawCalendarIcon(pdf, 23, 170);

  setFont(pdf, "normal", 8);
  setTextColor(pdf, COLORS.slate500);
  pdf.text("Issued on", 32, 172);

  setFont(pdf, "bold", 9);
  setTextColor(pdf, COLORS.slate900);
  pdf.text(data.issuedAt?.trim() || "-", 32, 180);

  // Verification section
  drawShieldIcon(pdf, 151, 169);

  setFont(pdf, "normal", 8);
  setTextColor(pdf, COLORS.slate500);
  pdf.text("Verify this certificate", 160, 172);

  const url = data.verificationUrl?.trim();

  if (!url) {
    return;
  }

  const urlX = 160;
  const urlY = 180;
  const urlWidth = 111;
  const lineHeight = 3.5;

  setFont(pdf, "normal", 7);
  setTextColor(pdf, COLORS.blue700);

  const urlLines: string[] = pdf.splitTextToSize(url, urlWidth);

  pdf.text(urlLines, urlX, urlY, {
    lineHeightFactor: 1.4,
  });

  // Underline each URL line
  setDrawColor(pdf, COLORS.blue200);
  pdf.setLineWidth(0.2);

  urlLines.forEach((line) => {
    const lineIndex = urlLines.indexOf(line);
    const lineWidth = Math.min(pdf.getTextWidth(line), urlWidth);
    const lineY = urlY + 0.7 + lineIndex * lineHeight;

    pdf.line(urlX, lineY, urlX + lineWidth, lineY);
  });

  // Clickable URL annotation
  pdf.link(
    urlX,
    urlY - 3,
    urlWidth,
    Math.max(8, urlLines.length * lineHeight + 2),
    { url },
  );
}

function sanitizeFilename(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 80) || "Course"
  );
}

export function downloadCertificate(data: CertificatePdfData): void {
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  // Explicitly use jsPDF's built-in fonts only.
  pdf.setFont("helvetica", "normal");

  drawBackground(pdf);
  drawBrand(pdf);
  drawRibbon(pdf);
  drawMainContent(pdf, data);
  drawFooter(pdf, data);

  const filename = sanitizeFilename(data.courseName || "Course");
  pdf.save(`Certificate-${filename}.pdf`);
}
