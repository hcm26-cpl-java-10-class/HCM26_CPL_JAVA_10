import type { UserDTO, UserFilter } from "@/types";
import { createBaseApiService } from "../../base-service.api";

const path = "/users";

const base = createBaseApiService<UserDTO, UserFilter>({ path: path });

export const userApi = Object.assign({}, base, {});
