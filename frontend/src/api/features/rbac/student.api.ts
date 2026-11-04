import { createBaseApiService } from "../../base-service.api";
const path = "/students";
const base = createBaseApiService<any, any>({ path: path });

export const studentApi = Object.assign({}, base, {
  // Các hàm API riêng cho student nếu có
});