import api from "./axios";

export async function uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post<{ url: string }>("/uploads/images", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data.url;
}