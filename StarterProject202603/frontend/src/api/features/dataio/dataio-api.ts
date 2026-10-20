import { downloadBlob, getFilenameFromHeader } from "@/components/datatable/util/dataio.utils";
import axiosInstance from "../../axios";

export const downloadTemplate = async (entity: string) => {
    const res = await axiosInstance.get(`/import/template?entity=${entity}`, {
        responseType: "blob",
    });

    const contentDisposition = res.headers["content-disposition"];
    const filename = getFilenameFromHeader(contentDisposition);

    const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    downloadBlob(blob, filename || undefined);
};
