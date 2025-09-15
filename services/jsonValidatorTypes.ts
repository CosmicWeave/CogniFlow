
// services/jsonValidatorTypes.ts

export interface ValidationResult {
  isValid: boolean;
  parsed: any | null;
  errors: string[];
  detailedErrors: DetailedError[];
  suggestions: string[];
  fixedJSON: string | null;
  schemaIssues: SchemaIssue[];
}

export interface SchemaIssue {
  type: 'error' | 'warning' | 'info';
  path: string;
  message: string;
}

export interface DetailedError {
  type: string;
  line: number | null;
  column: number | null;
  expected: string;
  actual: string;
  context: string;
  message: string;
  friendlyMessage?: string;
}

export interface FixAttempt {
  success: boolean;
  fixed: string | null;
  suggestions: string[];
}

export interface FixOperation {
  regex: RegExp;
  replacement: string;
  description: string;
}
