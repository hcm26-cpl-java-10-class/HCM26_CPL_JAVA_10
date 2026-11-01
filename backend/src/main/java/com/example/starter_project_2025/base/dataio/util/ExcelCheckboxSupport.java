package com.example.starter_project_2025.base.dataio.util;

import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.Workbook;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Collection;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

/**
 * Real Excel 365 check boxes (Insert &gt; Checkbox). A check box is a TRUE/FALSE cell whose cell style carries
 * a "checkbox" marker, and the file needs one extra part that describes that marker. Apache POI has no API for
 * this, so the workbook is written normally and {@link #addCheckboxSupport} then adds the parts exactly as
 * Excel itself writes them (copied from a file saved by Excel).
 *
 * Older Excel versions show the same cells as plain TRUE / FALSE, which can also be typed by hand.
 */
public final class ExcelCheckboxSupport {

    private static final String PART_NAME = "xl/featurePropertyBag/featurePropertyBag.xml";

    private static final String PART_XML = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>\r\n"
            + "<FeaturePropertyBags xmlns=\"http://schemas.microsoft.com/office/spreadsheetml/2022/featurepropertybag\">"
            + "<bag type=\"Checkbox\"/>"
            + "<bag type=\"XFControls\"><bagId k=\"CellControl\">0</bagId></bag>"
            + "<bag type=\"XFComplement\"><bagId k=\"XFControls\">1</bagId></bag>"
            + "<bag type=\"XFComplements\" extRef=\"XFComplementsMapperExtRef\"><a k=\"MappedFeaturePropertyBags\"><bagId>2</bagId></a></bag>"
            + "</FeaturePropertyBags>";

    private static final String CONTENT_TYPE_OVERRIDE =
            "<Override PartName=\"/xl/featurePropertyBag/featurePropertyBag.xml\" "
                    + "ContentType=\"application/vnd.ms-excel.featurepropertybag+xml\"/>";

    private static final String RELATIONSHIP =
            "<Relationship Id=\"rId9001\" "
                    + "Type=\"http://schemas.microsoft.com/office/2022/11/relationships/FeaturePropertyBag\" "
                    + "Target=\"featurePropertyBag/featurePropertyBag.xml\"/>";

    private static final String CELL_STYLE_EXTENSION =
            "<extLst><ext uri=\"{C7286773-470A-42A8-94C5-96B5CB345126}\" "
                    + "xmlns:xfpb=\"http://schemas.microsoft.com/office/spreadsheetml/2022/featurepropertybag\">"
                    + "<xfpb:xfComplement i=\"0\"/></ext></extLst>";

    private static final Pattern CELL_XFS = Pattern.compile("(<cellXfs\\b[^>]*>)(.*?)(</cellXfs>)", Pattern.DOTALL);
    private static final Pattern XF = Pattern.compile("(<xf\\b[^>]*?/>)|(<xf\\b[^>]*?>.*?</xf>)", Pattern.DOTALL);

    private ExcelCheckboxSupport() {
    }

    /** The style to give to every check box cell. Pass its {@code getIndex()} to {@link #addCheckboxSupport}. */
    public static CellStyle checkboxStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setAlignment(HorizontalAlignment.CENTER);
        return style;
    }

    /** Turns the cells that use the given styles into check boxes. Returns the file unchanged when there are none. */
    public static byte[] addCheckboxSupport(byte[] xlsx, Collection<Integer> checkboxStyleIndexes) throws IOException {
        if (checkboxStyleIndexes == null || checkboxStyleIndexes.isEmpty()) {
            return xlsx;
        }

        ByteArrayOutputStream out = new ByteArrayOutputStream(xlsx.length + 2048);
        try (ZipInputStream in = new ZipInputStream(new ByteArrayInputStream(xlsx));
             ZipOutputStream zip = new ZipOutputStream(out)) {

            ZipEntry entry;
            while ((entry = in.getNextEntry()) != null) {
                byte[] content = in.readAllBytes();

                switch (entry.getName()) {
                    case "[Content_Types].xml" -> content = insertBefore(content, "</Types>", CONTENT_TYPE_OVERRIDE);
                    case "xl/_rels/workbook.xml.rels" ->
                            content = insertBefore(content, "</Relationships>", RELATIONSHIP);
                    case "xl/styles.xml" -> content = markCheckboxStyles(content, checkboxStyleIndexes);
                    default -> {
                    }
                }

                zip.putNextEntry(new ZipEntry(entry.getName()));
                zip.write(content);
                zip.closeEntry();
            }

            zip.putNextEntry(new ZipEntry(PART_NAME));
            zip.write(PART_XML.getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
        }
        return out.toByteArray();
    }

    private static byte[] insertBefore(byte[] xml, String closingTag, String addition) {
        String text = new String(xml, StandardCharsets.UTF_8);
        int at = text.lastIndexOf(closingTag);
        if (at < 0) {
            throw new IllegalStateException("Unexpected workbook part: missing " + closingTag);
        }
        return (text.substring(0, at) + addition + text.substring(at)).getBytes(StandardCharsets.UTF_8);
    }

    private static byte[] markCheckboxStyles(byte[] xml, Collection<Integer> indexes) {
        String text = new String(xml, StandardCharsets.UTF_8);

        Matcher block = CELL_XFS.matcher(text);
        if (!block.find()) {
            throw new IllegalStateException("Unexpected styles part: missing cellXfs");
        }

        StringBuilder xfs = new StringBuilder();
        Matcher xf = XF.matcher(block.group(2));
        int index = 0;
        int last = 0;
        while (xf.find()) {
            xfs.append(block.group(2), last, xf.start());
            String element = xf.group();
            if (indexes.contains(index)) {
                element = element.endsWith("/>")
                        ? element.substring(0, element.length() - 2) + ">" + CELL_STYLE_EXTENSION + "</xf>"
                        : element.substring(0, element.length() - "</xf>".length()) + CELL_STYLE_EXTENSION + "</xf>";
            }
            xfs.append(element);
            last = xf.end();
            index++;
        }
        xfs.append(block.group(2).substring(last));

        String result = text.substring(0, block.start())
                + block.group(1) + xfs + block.group(3)
                + text.substring(block.end());
        return result.getBytes(StandardCharsets.UTF_8);
    }
}
