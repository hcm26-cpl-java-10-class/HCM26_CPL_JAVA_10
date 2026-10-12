import type { BaseDTO, BaseFilter } from "@/types/common/base";

export interface BookDTO extends BaseDTO {
  name?: string;
  description?: string;
}

export interface BookFilter extends BaseFilter {
} 