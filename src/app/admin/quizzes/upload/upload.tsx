"use client";

import { useRef, useState } from "react";

type PreviewRow = {
  rowNumber: number;
  data: Record<string, string>;
  errors: string[];
};

type Preview = {
  rows: PreviewRow[];
  summary: {
    questionCount: number;
    validCount: number;
    errorCount: number;
    quizCount: number;
  };
};

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "The request failed.");
  return body;
}

export default function QuizUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function upload(file?: File) {
    setError("");
    setMessage("");
    setPreview(null);
    setSkipped([]);
    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xlsx", "json"].includes(extension ?? "")) {
      setError("Unsupported file type. Choose a CSV, XLSX, or JSON file.");
      return;
    }
    if (file.size === 0) {
      setError("The selected file is empty.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File exceeds the 5 MB upload limit.");
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/admin/quizzes/upload", {
        method: "POST",
        body: form,
      });
      setPreview(await readJson<Preview>(response));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not preview the quiz file.");
    } finally {
      setBusy(false);
    }
  }

  function toggleSkipped(rowNumber: number) {
    setSkipped((current) =>
      current.includes(rowNumber)
        ? current.filter((value) => value !== rowNumber)
        : [...current, rowNumber],
    );
  }

  async function importDrafts() {
    if (!preview) return;
    const rows = preview.rows.filter(
      (row) => row.errors.length === 0 || skipped.includes(row.rowNumber),
    );
    const accepted = rows.filter((row) => row.errors.length === 0);
    if (!accepted.length) {
      setError("There are no valid questions to import.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/quizzes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: accepted }),
      });
      const result = await readJson<{
        imported: { id: string; title: string; questionCount: number }[];
      }>(response);
      const questionCount = result.imported.reduce((sum, quiz) => sum + quiz.questionCount, 0);
      setMessage(
        `Imported ${questionCount} question${questionCount === 1 ? "" : "s"} across ${result.imported.length} draft quiz${result.imported.length === 1 ? "" : "zes"}.`,
      );
      setPreview(null);
      setSkipped([]);
      if (inputRef.current) inputRef.current.value = "";
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not import quizzes.");
    } finally {
      setBusy(false);
    }
  }

  const remainingErrors =
    preview?.rows.filter((row) => row.errors.length > 0 && !skipped.includes(row.rowNumber)).length ??
    0;
  const importableCount =
    preview?.rows.filter((row) => row.errors.length === 0).length ?? 0;

  return (
    <div>
      <section
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void upload(event.dataTransfer.files[0]);
        }}
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition ${
          dragging ? "border-teal-700 bg-teal-50" : "border-slate-300 bg-white"
        }`}
      >
        <label htmlFor="quiz-file" className="block font-semibold">
          Drop a quiz file here or choose a file
        </label>
        <p className="mt-2 text-sm text-slate-500">CSV, XLSX, or JSON. Maximum size: 5 MB.</p>
        <input
          ref={inputRef}
          id="quiz-file"
          type="file"
          accept=".csv,.xlsx,.json,text/csv,application/json"
          disabled={busy}
          onChange={(event) => void upload(event.target.files?.[0])}
          className="mx-auto mt-4 block max-w-full rounded-lg border p-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        />
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <a
            href="/api/admin/quizzes/template.csv"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            Download template
          </a>
          <a
            href="/sample-quizzes.csv"
            download
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
          >
            Download 10-question sample
          </a>
        </div>
      </section>

      {busy && (
        <p className="mt-4 rounded-xl bg-white p-4 text-sm text-slate-600" role="status">
          {preview ? "Importing draft quizzes..." : "Reading and validating your file..."}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
          {message}
        </p>
      )}

      {preview && (
        <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Import preview</h2>
              <p className="mt-1 text-sm text-slate-600" aria-live="polite">
                {preview.summary.questionCount} questions across {preview.summary.quizCount} quizzes
                {" · "}
                {importableCount} valid
                {" · "}
                {preview.summary.errorCount} errors
                {skipped.length > 0 && ` · ${skipped.length} skipped`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void importDrafts()}
              disabled={busy || !importableCount || remainingErrors > 0}
              className="rounded-xl bg-teal-700 px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            >
              Import as draft
            </button>
          </div>

          {remainingErrors > 0 && (
            <p className="mt-3 text-sm text-amber-800">
              Fix the file and upload it again, or mark each invalid row to skip it.
            </p>
          )}

          <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-[1050px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="px-3 py-3">Row</th>
                  <th scope="col" className="px-3 py-3">Quiz</th>
                  <th scope="col" className="px-3 py-3">Category / difficulty</th>
                  <th scope="col" className="px-3 py-3">Question / type</th>
                  <th scope="col" className="px-3 py-3">Options</th>
                  <th scope="col" className="px-3 py-3">Correct answer</th>
                  <th scope="col" className="px-3 py-3">Validation</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => {
                  const invalid = row.errors.length > 0;
                  const isSkipped = skipped.includes(row.rowNumber);
                  return (
                    <tr
                      key={row.rowNumber}
                      className={`border-t align-top ${
                        invalid ? "bg-rose-50" : "bg-white"
                      } ${isSkipped ? "opacity-60" : ""}`}
                    >
                      <td className="px-3 py-3 font-medium">{row.rowNumber}</td>
                      <td className="px-3 py-3">
                        {row.data.quiz_title || "—"}
                      </td>
                      <td className="px-3 py-3">
                        {row.data.category || "—"} / {row.data.difficulty || "—"}
                      </td>
                      <td className="max-w-64 px-3 py-3">
                        <p>{row.data.question || "—"}</p>
                        <p className="mt-1 text-xs text-slate-500">{row.data.type || "—"}</p>
                      </td>
                      <td className="px-3 py-3">
                        {[row.data.option_a, row.data.option_b, row.data.option_c, row.data.option_d]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </td>
                      <td className="px-3 py-3">{row.data.correct || "—"}</td>
                      <td className="px-3 py-3">
                        {invalid ? (
                          <>
                            <ul className="space-y-1 text-rose-800">
                              {row.errors.map((item) => (
                                <li key={item}>Row {row.rowNumber}: {item}</li>
                              ))}
                            </ul>
                            <button
                              type="button"
                              onClick={() => toggleSkipped(row.rowNumber)}
                              aria-pressed={isSkipped}
                              className="mt-2 rounded-lg border border-rose-300 px-2 py-1 text-xs font-medium text-rose-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700"
                            >
                              {isSkipped ? "Include row" : "Skip row"}
                            </button>
                          </>
                        ) : (
                          <span className="text-emerald-700">Ready</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
