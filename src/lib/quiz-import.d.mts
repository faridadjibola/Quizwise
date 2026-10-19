export type QuizImportRow = {
  rowNumber: number;
  data: Record<string, string>;
  errors: string[];
};

export type QuizImportPreview = {
  rows: QuizImportRow[];
  summary: {
    questionCount: number;
    validCount: number;
    errorCount: number;
    quizCount: number;
  };
};

export const MAX_IMPORT_BYTES: number;
export const MAX_IMPORT_ROWS: number;
export const QUIZ_IMPORT_COLUMNS: string[];
export function validateImportRows(rows: unknown[]): QuizImportPreview;
export function parseQuizImport(filename: string, buffer: Buffer): Promise<QuizImportPreview>;
