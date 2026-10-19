import ExcelJS from "exceljs";
import Papa from "papaparse";
import { z } from "zod";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 1000;

const difficultySchema = z.preprocess(
  (value) => String(value ?? "").trim().toLowerCase(),
  z.enum(["easy", "medium", "hard"], {
    error: "difficulty must be Easy, Medium, or Hard",
  }),
);

const rowSchema = z.object({
  quiz_title: z.string().trim().min(1, "quiz title missing").max(160, "quiz title must be 160 characters or fewer"),
  category: z.string().trim().min(1, "category missing").max(100, "category must be 100 characters or fewer"),
  difficulty: difficultySchema,
  question: z.string().trim().min(1, "question missing").max(2000, "question must be 2000 characters or fewer"),
  type: z.preprocess(
    (value) => String(value ?? "").trim().toUpperCase(),
    z.enum(["MCQ", "TRUE_FALSE", "MULTI_SELECT"], {
      error: "type must be MCQ, TRUE_FALSE, or MULTI_SELECT",
    }),
  ),
  option_a: z.string().trim().max(500, "option_a must be 500 characters or fewer"),
  option_b: z.string().trim().max(500, "option_b must be 500 characters or fewer"),
  option_c: z.string().trim().max(500, "option_c must be 500 characters or fewer"),
  option_d: z.string().trim().max(500, "option_d must be 500 characters or fewer"),
  correct: z.string().trim().min(1, "correct answer missing").max(2000, "correct answer is too long"),
  explanation: z.string().trim().max(2000, "explanation must be 2000 characters or fewer"),
});

const columns = [
  "quiz_title",
  "category",
  "difficulty",
  "question",
  "type",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct",
  "explanation",
];

function toRecord(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const normalized = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      String(key).trim().toLowerCase(),
      value == null ? "" : String(value).trim(),
    ]),
  );
  return Object.fromEntries(columns.map((column) => [column, normalized[column] ?? ""]));
}

function parseRow(rowNumber, raw) {
  const parsed = rowSchema.safeParse(toRecord(raw));
  if (!parsed.success) {
    return {
      rowNumber,
      data: toRecord(raw),
      errors: parsed.error.issues.map((issue) => issue.message),
    };
  }

  const row = parsed.data;
  const errors = [];
  const options = [row.option_a, row.option_b, row.option_c, row.option_d].filter(Boolean);
  const correctAnswers = row.correct.split("|").map((answer) => answer.trim()).filter(Boolean);

  if (row.type === "TRUE_FALSE") {
    if (options.length && (options.length !== 2 || options[0] !== "True" || options[1] !== "False")) {
      errors.push("TRUE_FALSE options must be blank or exactly True and False");
    }
    if (row.correct.toLowerCase() !== "true" && row.correct.toLowerCase() !== "false") {
      errors.push("correct answer must be True or False");
    }
  } else {
    if (options.length < 2) errors.push("at least two answer options required");
    if (row.type === "MCQ" && correctAnswers.length !== 1) {
      errors.push("MCQ must have exactly one correct answer");
    }
    if (
      correctAnswers.some((answer) => !options.some((option) => option === answer))
    ) {
      errors.push(
        row.type === "MULTI_SELECT"
          ? "each correct answer must match an option (separate answers with |)"
          : "correct answer must match one of the options",
      );
    }
    if (row.type === "MULTI_SELECT" && correctAnswers.length < 2) {
      errors.push("MULTI_SELECT needs at least two correct answers separated by |");
    }
  }

  return {
    rowNumber,
    data: {
      ...row,
      correct: row.type === "TRUE_FALSE" ? row.correct[0].toUpperCase() + row.correct.slice(1).toLowerCase() : row.correct,
    },
    errors,
  };
}

function addQuizConsistencyErrors(rows) {
  const definitions = new Map();
  for (const row of rows) {
    if (!row.data.quiz_title || !row.data.category || !row.data.difficulty) continue;
    const key = row.data.quiz_title.trim().toLocaleLowerCase();
    const value = `${row.data.category.trim()}\u0000${row.data.difficulty.trim().toLowerCase()}`;
    const previous = definitions.get(key);
    if (previous && previous.value !== value) {
      row.errors.push("category and difficulty must be consistent for all rows in a quiz");
    } else if (!previous) {
      definitions.set(key, { value, rowNumber: row.rowNumber });
    }
  }
  return rows;
}

function summarize(rows) {
  const validRows = rows.filter((row) => row.errors.length === 0);
  return {
    rows,
    summary: {
      questionCount: rows.length,
      validCount: validRows.length,
      errorCount: rows.filter((row) => row.errors.length > 0).length,
      quizCount: new Set(
        validRows.map((row) => row.data.quiz_title.trim().toLocaleLowerCase()),
      ).size,
    },
  };
}

export function validateImportRows(inputRows) {
  if (!Array.isArray(inputRows) || inputRows.length === 0) {
    return { rows: [], summary: { questionCount: 0, validCount: 0, errorCount: 0, quizCount: 0 } };
  }

  return summarize(
    addQuizConsistencyErrors(
      inputRows.map((item, index) => {
        const value = item && typeof item === "object" && "data" in item ? item : { data: item };
        return parseRow(
          Number.isInteger(value.rowNumber) && value.rowNumber > 0 ? value.rowNumber : index + 2,
          value.data,
        );
      }),
    ),
  );
}

function recordsFromCsv(text) {
  const rows = [];
  let cursor = Math.max(0, text.indexOf("\n") + 1);
  let rowNumber = 2;
  Papa.parse(text, {
    header: true,
    skipEmptyLines: "greedy",
    step(result) {
      const consumed = text.slice(cursor, result.meta.cursor);
      rows.push({
        rowNumber,
        data: result.data,
        ...(result.errors.length
          ? { parseError: result.errors.map((issue) => issue.message).join("; ") }
          : {}),
      });
      rowNumber += (consumed.match(/\n/g) ?? []).length;
      cursor = result.meta.cursor;
    },
  });
  return rows;
}

async function recordsFromExcel(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("The workbook does not contain a worksheet.");

  const headers = sheet.getRow(1).values.slice(1).map((value) => String(value ?? "").trim().toLowerCase());
  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const data = {};
    headers.forEach((header, index) => {
      if (header) data[header] = row.getCell(index + 1).text.trim();
    });
    if (Object.values(data).some(Boolean)) rows.push({ rowNumber, data });
  });
  return rows;
}

export async function parseQuizImport(filename, buffer) {
  const extension = filename.split(".").pop()?.toLowerCase();
  let rows;

  if (extension === "csv") {
    rows = recordsFromCsv(buffer.toString("utf8"));
  } else if (extension === "xlsx") {
    rows = await recordsFromExcel(buffer);
  } else if (extension === "json") {
    let parsed;
    try {
      parsed = JSON.parse(buffer.toString("utf8"));
    } catch {
      throw new Error("The JSON file is not valid JSON.");
    }
    const records = Array.isArray(parsed) ? parsed : parsed?.rows;
    if (!Array.isArray(records)) {
      throw new Error("JSON must contain an array of quiz question rows.");
    }
    rows = records.map((data, index) => ({ rowNumber: index + 1, data }));
  } else {
    throw new Error("Unsupported file type. Choose a CSV, XLSX, or JSON file.");
  }

  const nonEmpty = rows.filter((row) =>
    Object.values(row.data ?? {}).some((value) => String(value ?? "").trim()),
  );
  if (!nonEmpty.length) throw new Error("The file contains no quiz question rows.");
  if (nonEmpty.length > MAX_IMPORT_ROWS) {
    throw new Error(`The file exceeds the ${MAX_IMPORT_ROWS}-question limit.`);
  }

  const validated = validateImportRows(nonEmpty);
  for (const row of validated.rows) {
    const source = nonEmpty.find((item) => item.rowNumber === row.rowNumber);
    if (source?.parseError) row.errors.unshift(source.parseError);
  }
  return validated;
}

export const QUIZ_IMPORT_COLUMNS = columns;
