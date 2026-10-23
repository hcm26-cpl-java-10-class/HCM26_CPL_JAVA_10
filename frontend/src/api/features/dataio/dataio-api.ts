import { downloadBlob, getFilenameFromHeader } from "@/components/datatable/util/dataio.utils";
import axiosInstance from "../../axios";

export const downloadTemplate = async (entity: string) => {
    let url = `/import/template?entity=${entity}`;
    if (entity.toLowerCase() === "question") {
        url = `/questions/export/template?format=xlsx`;
    }

    const res = await axiosInstance.get(url, {
        responseType: "blob",
    });

    const contentDisposition = res.headers["content-disposition"];
    const filename = getFilenameFromHeader(contentDisposition);

    const isCsv = filename?.endsWith(".csv") || res.headers["content-type"]?.includes("csv");
    const blob = new Blob([res.data], {
        type: isCsv
            ? "text/csv;charset=utf-8"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    downloadBlob(blob, filename || (isCsv ? `${entity}-template.csv` : `${entity}-template.xlsx`));
};
