import {
    downloadBlob,
    getFilenameFromHeader,
} from "@/components/datatable/util/dataio.utils";
import axiosInstance from "../axios";

export const downloadQuestionTemplate = async () => {
    const response = await axiosInstance.get(
        "/questions/export/template",
        { responseType: "blob" },
    );

    const contentDisposition =
        response.headers["content-disposition"];

    const filename = getFilenameFromHeader(contentDisposition);

    const blob = new Blob([response.data], {
        type: "text/csv;charset=utf-8;",
    });

    downloadBlob(blob, filename || "question-template.csv");
};