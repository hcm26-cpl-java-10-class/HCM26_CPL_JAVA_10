export interface BaseDTO {

  id?: number;

  isActive?: boolean;

  createdAt?: string;

  updatedAt?: string;

  createdBy?: number;

  updatedBy?: number;
}

export interface BaseFilter {

  ids: number[];

  isActive?: boolean;

  createdRange?: [string, string];

  updatedRange?: [string, string];
  
  createdBy?: number;

  updatedBy?: number;
}
