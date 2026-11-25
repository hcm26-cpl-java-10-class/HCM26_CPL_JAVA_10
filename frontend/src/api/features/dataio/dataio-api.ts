import { downloadBlob, getFilenameFromHeader } from "@/components/datatable/util/dataio.utils";
import axiosInstance from "../../axios";

export const downloadTemplate = async (entity: string, format: "xlsx" | "csv" = "xlsx") => {
    let url = `/import/template?entity=${entity}&format=${format}`;
    if (entity.toLowerCase() === "question") {
        url = `/questions/export/template?format=${format}`;
    }

    const res = await axiosInstance.get(url, {
        responseType: "blob",
    });

    const contentDisposition = res.headers["content-disposition"];
    const filename = getFilenameFromHeader(contentDisposition);

    const isCsv = format === "csv" || (filename?.endsWith(".csv") ?? false) ||
        String(res.headers["content-type"] ?? "").includes("csv");
    const blob = new Blob([res.data], {
        type: isCsv
            ? "text/csv;charset=utf-8"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    downloadBlob(blob, filename || (isCsv ? `${entity}-template.csv` : `${entity}-template.xlsx`));
};
