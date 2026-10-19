import { createBaseApiService } from "@/api/base-service.api";
import type { BookDTO, BookFilter } from "@/types";

const path = "/books";

const base = createBaseApiService<BookDTO, BookFilter>({
  path: path,
});

export const bookApi = Object.assign({}, base, {});
