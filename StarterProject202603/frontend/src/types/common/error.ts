export interface ValidationErrorResponse {
  
  message: string;

  errors: Record<string, string[]>;
}