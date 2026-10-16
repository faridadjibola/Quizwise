"use client";

import { useEffect, useState } from "react";
import ExcelJS from "exceljs";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/client";
import {
  filterAndSummarizeAttempts,
  type AdminAttempt,
} from "@/lib/admin-results.mjs";

type Quiz = {
  id: string;
  title: string;
  description: string;
  category: string;
  time_limit_minutes: number;
  pass_mark: number;
  attempts_allowed: number;
  is_published: boolean;
  shuffle_questions: boolean;
  shuffle_options: boolean;
};

type Question = {
  id: string;
  text: string;
  type: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  difficulty: string;
  category: string;
  image_path: string | null;
};

type QuestionImport = {
  text: string;
  options: string[];
  correct_answer: string;
  explanation: string;
  difficulty: string;
  category: string;
  type: string;
};

type StudentProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
};

type AdminResult = AdminAttempt & {
  submitted_at: string | null;
  status: string;
  quizzes: { title: string } | { title: string }[] | null;
};

type QuizOption = { id: string; title: string };
type AssignedQuestion = { id: string; text: string };

const db = () => createClient();

function setLoadError(error: unknown, setError: (message: string) => void) {
  const message = error instanceof Error ? error.message : "The request failed.";
  console.error("Admin data request failed", error);
  setError(message);
}

function normalizeImportRow(row: Record<string, unknown>): QuestionImport {
  const rawOptions = row.options;
  return {
    text: String(row.text ?? "").trim(),
    options: Array.isArray(rawOptions)
      ? rawOptions.map((option) => String(option).trim()).filter(Boolean)
      : String(rawOptions ?? "")
          .split("|")
          .map((option) => option.trim())
          .filter(Boolean),
    correct_answer: String(row.correct_answer ?? "").trim(),
    explanation: String(row.explanation ?? "").trim(),
    difficulty: String(row.difficulty ?? "medium").trim().toLowerCase(),
    category: String(row.category ?? "General").trim() || "General",
    type: String(row.type ?? "multiple_choice").trim().toLowerCase(),
  };
}

export function QuizManager() {
  const [items, setItems] = useState<Quiz[]>([]);
  const [questions, setQuestions] = useState<Pick<Question, "id" | "text">[]>([]);
  const [selected, setSelected] = useState("");
  const [assigned, setAssigned] = useState<AssignedQuestion[]>([]);
  const [error, setError] = useState("");

  async function load() {
    const client = db();
    const [quizzes, bank] = await Promise.all([
      client.from("quizzes").select("*").order("created_at", { ascending: false }),
      client.from("questions").select("id,text").order("created_at", { ascending: false }),
    ]);
    if (quizzes.error || bank.error) {
      setLoadError(quizzes.error ?? bank.error, setError);
      return;
    }
    setItems(quizzes.data ?? []);
    setQuestions(bank.data ?? []);
    setError("");
  }

  useEffect(() => {
    let active = true;
    const client = db();
    void Promise.all([
      client.from("quizzes").select("*").order("created_at", { ascending: false }),
      client.from("questions").select("id,text").order("created_at", { ascending: false }),
    ]).then(([quizzes, bank]) => {
      if (!active) return;
      if (quizzes.error || bank.error) {
        setLoadError(quizzes.error ?? bank.error, setError);
        return;
      }
      setItems(quizzes.data ?? []);
      setQuestions(bank.data ?? []);
    });
    return () => {
      active = false;
    };
  }, []);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const client = db();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) {
      setLoadError(authError ?? new Error("Sign in again to create a quiz."), setError);
      return;
    }

    const { error: insertError } = await client.from("quizzes").insert({
      title: String(form.get("title")).trim(),
      description: String(form.get("description")).trim(),
      category: String(form.get("category")).trim(),
      time_limit_minutes: Number(form.get("minutes")),
      pass_mark: Number(form.get("pass")),
      attempts_allowed: Number(form.get("attempts")),
      created_by: user.id,
    });
    if (insertError) {
      setLoadError(insertError, setError);
      return;
    }
    event.currentTarget.reset();
    await load();
  }

  async function change(id: string, key: "is_published", value: boolean) {
    const { error: updateError } = await db().from("quizzes").update({ [key]: value }).eq("id", id);
    if (updateError) setLoadError(updateError, setError);
    else await load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this quiz and its assignments?")) return;
    const { error: deleteError } = await db().from("quizzes").delete().eq("id", id);
    if (deleteError) setLoadError(deleteError, setError);
    else await load();
  }

  async function duplicate(quiz: Quiz) {
    const { id, ...values } = quiz;
    const client = db();
    const { data: copy, error: createError } = await client
      .from("quizzes")
      .insert({ ...values, title: `${quiz.title} (copy)`, is_published: false })
      .select("id")
      .single();
    if (createError) {
      setLoadError(createError, setError);
      return;
    }

    const { data: links, error: linksError } = await client
      .from("quiz_questions")
      .select("question_id,position,points")
      .eq("quiz_id", id);
    if (linksError) {
      setLoadError(linksError, setError);
      return;
    }
    if (links?.length) {
      const { error: copyError } = await client
        .from("quiz_questions")
        .insert(links.map((link) => ({ ...link, quiz_id: copy.id })));
      if (copyError) {
        setLoadError(copyError, setError);
        return;
      }
    }
    await load();
  }

  async function openAssignments(id: string) {
    setSelected(id);
    const { data, error: loadError } = await db()
      .from("quiz_questions")
      .select("question_id,position,questions(text)")
      .eq("quiz_id", id)
      .order("position");
    if (loadError) {
      setLoadError(loadError, setError);
      return;
    }
    setAssigned(
      (data ?? []).map((row) => {
        const question = Array.isArray(row.questions) ? row.questions[0] : row.questions;
        return { id: row.question_id, text: question?.text ?? "Question" };
      }),
    );
  }

  async function addQuestion(questionId: string) {
    if (!selected || assigned.some((item) => item.id === questionId)) return;
    const { error: insertError } = await db().from("quiz_questions").insert({
      quiz_id: selected,
      question_id: questionId,
      position: assigned.length,
    });
    if (insertError) {
      setLoadError(insertError, setError);
      return;
    }
    setAssigned((current) => [
      ...current,
      { id: questionId, text: questions.find((question) => question.id === questionId)?.text ?? "Question" },
    ]);
  }

  async function moveQuestion(from: number, to: number) {
    const next = [...assigned];
    const [moving] = next.splice(from, 1);
    if (!moving) return;
    next.splice(to, 0, moving);

    const client = db();
    for (const [index, question] of next.entries()) {
      const { error: moveError } = await client
        .from("quiz_questions")
        .update({ position: next.length + index })
        .eq("quiz_id", selected)
        .eq("question_id", question.id);
      if (moveError) {
        setLoadError(moveError, setError);
        await openAssignments(selected);
        return;
      }
    }
    for (const [index, question] of next.entries()) {
      const { error: moveError } = await client
        .from("quiz_questions")
        .update({ position: index })
        .eq("quiz_id", selected)
        .eq("question_id", question.id);
      if (moveError) {
        setLoadError(moveError, setError);
        await openAssignments(selected);
        return;
      }
    }
    setAssigned(next);
  }

  async function removeAssigned(questionId: string) {
    const { error: deleteError } = await db()
      .from("quiz_questions")
      .delete()
      .eq("quiz_id", selected)
      .eq("question_id", questionId);
    if (deleteError) setLoadError(deleteError, setError);
    else await openAssignments(selected);
  }

  return (
    <div>
      <form onSubmit={create} className="grid gap-3 rounded-2xl bg-white p-5 md:grid-cols-3">
        <input name="title" required placeholder="Quiz title" className="rounded-lg border p-3" />
        <input name="category" required placeholder="Category" className="rounded-lg border p-3" />
        <input name="minutes" required type="number" min="1" max="600" defaultValue="20" className="rounded-lg border p-3" />
        <input name="pass" required type="number" min="0" max="100" defaultValue="60" className="rounded-lg border p-3" />
        <input name="attempts" required type="number" min="1" max="100" defaultValue="1" className="rounded-lg border p-3" />
        <input name="description" placeholder="Description" className="rounded-lg border p-3" />
        <button className="rounded-lg bg-teal-700 p-3 text-white">Create quiz</button>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-5 space-y-3">
        {items.map((quiz) => (
          <article key={quiz.id} className="rounded-2xl bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">{quiz.title}</h2>
                <p className="text-sm text-slate-500">
                  {quiz.category} &middot; {quiz.time_limit_minutes} min &middot; {quiz.pass_mark}% pass
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => change(quiz.id, "is_published", !quiz.is_published)} className="rounded-lg border px-3 py-2">
                  {quiz.is_published ? "Unpublish" : "Publish"}
                </button>
                <button onClick={() => openAssignments(quiz.id)} className="rounded-lg border px-3 py-2">Questions</button>
                <button onClick={() => duplicate(quiz)} className="rounded-lg border px-3 py-2">Duplicate</button>
                <button onClick={() => remove(quiz.id)} className="rounded-lg border px-3 py-2 text-red-700">Delete</button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {selected && (
        <section className="mt-6 rounded-2xl border border-teal-200 bg-teal-50 p-5">
          <div className="flex justify-between">
            <h2 className="font-semibold">Assign and order questions</h2>
            <button onClick={() => setSelected("")}>Close</button>
          </div>
          <select onChange={(event) => void addQuestion(event.target.value)} defaultValue="" className="mt-3 rounded-lg border bg-white p-2">
            <option value="" disabled>Add from question bank</option>
            {questions.map((question) => <option key={question.id} value={question.id}>{question.text}</option>)}
          </select>
          <ol className="mt-4 space-y-2">
            {assigned.map((question, index) => (
              <li
                key={question.id}
                draggable
                onDragStart={(event) => event.dataTransfer.setData("text/plain", String(index))}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  void moveQuestion(Number(event.dataTransfer.getData("text/plain")), index);
                }}
                className="flex cursor-move items-center justify-between rounded-lg bg-white p-3"
              >
                <span>{index + 1}. {question.text}</span>
                <button onClick={() => void removeAssigned(question.id)} className="text-red-700">Remove</button>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-slate-500">Drag rows to change their order.</p>
        </section>
      )}
    </div>
  );
}

export function QuestionManager() {
  const [items, setItems] = useState<Question[]>([]);
  const [editing, setEditing] = useState<Question | null>(null);
  const [preview, setPreview] = useState<QuestionImport[]>([]);
  const [error, setError] = useState("");

  async function load() {
    const { data, error: loadError } = await db()
      .from("questions")
      .select("*")
      .order("created_at", { ascending: false });
    if (loadError) setLoadError(loadError, setError);
    else setItems(data ?? []);
  }

  useEffect(() => {
    let active = true;
    void db()
      .from("questions")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError) setLoadError(loadError, setError);
        else setItems(data ?? []);
      });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const client = db();
    const options = String(form.get("options"))
      .split("\n")
      .map((option) => option.trim())
      .filter(Boolean);
    const correctAnswer = String(form.get("correct_answer")).trim();
    if (options.length < 2 || options.length > 6 || !options.includes(correctAnswer)) {
      setError("Enter 2 to 6 options and choose a correct answer from those options.");
      return;
    }

    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) {
      setLoadError(authError ?? new Error("Sign in again to save questions."), setError);
      return;
    }

    let imagePath = editing?.image_path ?? null;
    const image = form.get("image");
    if (image instanceof File && image.size) {
      if (image.size > 8 * 1024 * 1024) {
        setError("Image must be under 8 MB.");
        return;
      }
      const extension = image.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "bin";
      imagePath = `${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await client.storage
        .from("question-images")
        .upload(imagePath, image, { upsert: true });
      if (uploadError) {
        setLoadError(uploadError, setError);
        return;
      }
      imagePath = client.storage.from("question-images").getPublicUrl(imagePath).data.publicUrl;
    }

    const row = {
      text: String(form.get("text")).trim(),
      type: String(form.get("type")),
      options,
      correct_answer: correctAnswer,
      explanation: String(form.get("explanation")).trim(),
      difficulty: String(form.get("difficulty")),
      category: String(form.get("category")).trim() || "General",
      image_path: imagePath,
      created_by: user.id,
    };
    const result = editing
      ? await client.from("questions").update(row).eq("id", editing.id)
      : await client.from("questions").insert(row);
    if (result.error) {
      setLoadError(result.error, setError);
      return;
    }

    setEditing(null);
    event.currentTarget.reset();
    await load();
  }

  async function bulk() {
    const valid = preview.filter(
      (row) =>
        row.text &&
        row.options.length >= 2 &&
        row.options.length <= 6 &&
        row.correct_answer &&
        row.options.includes(row.correct_answer),
    );
    if (!valid.length) {
      setError("No valid rows. Include text, 2 to 6 options, and a correct_answer matching an option.");
      return;
    }

    const { data: { user }, error: authError } = await db().auth.getUser();
    if (authError || !user) {
      setLoadError(authError ?? new Error("Sign in again to import questions."), setError);
      return;
    }

    const { error: insertError } = await db().from("questions").insert(
      valid.map((row) => ({
        ...row,
        difficulty: ["easy", "medium", "hard"].includes(row.difficulty) ? row.difficulty : "medium",
        type: row.type === "true_false" ? "true_false" : "multiple_choice",
        created_by: user.id,
      })),
    );
    if (insertError) setLoadError(insertError, setError);
    else {
      setPreview([]);
      await load();
    }
  }

  async function parseFile(file: File) {
    setError("");
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension === "csv") {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: ({ data }) => setPreview(data.map((row) => normalizeImportRow(row))),
        error: (parseError) => setError(parseError.message),
      });
      return;
    }
    if (extension !== "xlsx") {
      setError("Choose a CSV or XLSX file.");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        setError("The workbook does not contain a worksheet.");
        return;
      }
      const headers = Array.from({ length: worksheet.columnCount }, (_, index) =>
        worksheet.getRow(1).getCell(index + 1).text.trim().toLowerCase(),
      );
      const rows: Record<string, string>[] = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const record: Record<string, string> = {};
        headers.forEach((header, index) => {
          if (header) record[header] = row.getCell(index + 1).text.trim();
        });
        rows.push(record);
      });
      setPreview(rows.map((row) => normalizeImportRow(row)));
    } catch (cause) {
      setLoadError(cause, setError);
    }
  }

  async function remove(question: Question) {
    if (!confirm("Delete this question?")) return;
    const { error: deleteError } = await db().from("questions").delete().eq("id", question.id);
    if (deleteError) setLoadError(deleteError, setError);
    else await load();
  }

  return (
    <div>
      <form onSubmit={submit} className="grid gap-3 rounded-2xl bg-white p-5 md:grid-cols-2">
        <textarea name="text" required defaultValue={editing?.text} placeholder="Question text" className="rounded-lg border p-3 md:col-span-2" />
        <select name="type" defaultValue={editing?.type ?? "multiple_choice"} className="rounded-lg border p-3">
          <option value="multiple_choice">Multiple choice</option>
          <option value="true_false">True / false</option>
        </select>
        <input name="category" defaultValue={editing?.category ?? "General"} placeholder="Category" className="rounded-lg border p-3" />
        <textarea name="options" required defaultValue={editing?.options.join("\n") ?? ""} placeholder="Options, one per line (2-6)" className="rounded-lg border p-3" />
        <input name="correct_answer" required defaultValue={editing?.correct_answer} placeholder="Correct answer (exact option text)" className="rounded-lg border p-3" />
        <select name="difficulty" defaultValue={editing?.difficulty ?? "medium"} className="rounded-lg border p-3">
          <option>easy</option><option>medium</option><option>hard</option>
        </select>
        <input name="image" type="file" accept="image/*" className="rounded-lg border p-3" />
        <textarea name="explanation" defaultValue={editing?.explanation} placeholder="Explanation shown after submission" className="rounded-lg border p-3" />
        <button className="rounded-lg bg-teal-700 p-3 text-white">{editing ? "Save question" : "Add question"}</button>
        {editing && <button type="button" onClick={() => setEditing(null)} className="rounded-lg border p-3">Cancel edit</button>}
      </form>
      <section className="mt-5 rounded-2xl bg-white p-5">
        <h2 className="font-semibold">Bulk import</h2>
        <p className="mt-1 text-sm text-slate-500">
          CSV or XLSX with text, options (pipe-separated), correct_answer, explanation, difficulty, category, and type columns.
        </p>
        <input className="mt-3" type="file" accept=".csv,.xlsx" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void parseFile(file);
        }} />
        {preview.length > 0 && (
          <>
            <p className="mt-3 text-sm">Previewing {Math.min(preview.length, 5)} of {preview.length} rows</p>
            <ul className="mt-2 list-inside list-disc text-sm">
              {preview.slice(0, 5).map((row, index) => (
                <li key={index}>{row.text} &middot; {row.options.join(" / ")}</li>
              ))}
            </ul>
            <button onClick={() => void bulk()} className="mt-3 rounded-lg bg-teal-700 px-4 py-2 text-white">
              Import {preview.length} questions
            </button>
          </>
        )}
      </section>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-5 space-y-2">
        {items.map((question) => (
          <article key={question.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4">
            <div>
              <p className="font-medium">{question.text}</p>
              <p className="text-xs text-slate-500">
                {question.category} &middot; {question.difficulty} &middot; {question.options.length} options
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditing(question)} className="text-sm text-teal-700">Edit</button>
              <button onClick={() => void remove(question)} className="text-sm text-red-700">Delete</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function StudentManager() {
  const [rows, setRows] = useState<StudentProfile[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [updating, setUpdating] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error: loadError } = await db()
      .from("profiles")
      .select("id,email,full_name,is_active,created_at")
      .eq("role", "student")
      .order("created_at", { ascending: false });
    if (loadError) setLoadError(loadError, setError);
    else {
      setRows(data ?? []);
      setError("");
    }
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    void db()
      .from("profiles")
      .select("id,email,full_name,is_active,created_at")
      .eq("role", "student")
      .order("created_at", { ascending: false })
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError) setLoadError(loadError, setError);
        else setRows(data ?? []);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function flip(student: StudentProfile) {
    setUpdating(student.id);
    setError("");
    const { error: updateError } = await db()
      .from("profiles")
      .update({ is_active: !student.is_active })
      .eq("id", student.id);
    if (updateError) setLoadError(updateError, setError);
    else await load();
    setUpdating(null);
  }

  const normalized = query.trim().toLowerCase();
  const shown = rows.filter(
    (student) =>
      (status === "all" ||
        (status === "active" && student.is_active) ||
        (status === "inactive" && !student.is_active)) &&
      (!normalized ||
        `${student.full_name ?? ""} ${student.email ?? ""}`.toLowerCase().includes(normalized)),
  );
  const active = rows.filter((student) => student.is_active).length;

  return (
    <div>
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-white p-5"><p className="text-sm text-slate-500">All students</p><p className="mt-1 text-2xl font-semibold">{rows.length}</p></div>
        <div className="rounded-2xl bg-white p-5"><p className="text-sm text-slate-500">Active</p><p className="mt-1 text-2xl font-semibold text-emerald-700">{active}</p></div>
        <div className="rounded-2xl bg-white p-5"><p className="text-sm text-slate-500">Inactive</p><p className="mt-1 text-2xl font-semibold text-slate-600">{rows.length - active}</p></div>
      </section>
      <section className="mt-5 flex flex-col gap-3 rounded-2xl bg-white p-4 sm:flex-row">
        <label className="sr-only" htmlFor="student-search">Search students</label>
        <input id="student-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or email" className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2" />
        <label className="sr-only" htmlFor="student-status">Filter by status</label>
        <select id="student-status" value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2">
          <option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option>
        </select>
        <button onClick={() => void load()} disabled={loading} className="rounded-lg border border-slate-200 px-4 py-2 disabled:opacity-50">Refresh</button>
      </section>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="mt-3 space-y-3">
        {loading ? (
          <p className="rounded-2xl bg-white p-6 text-sm text-slate-500">Loading students...</p>
        ) : shown.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center">
            <p className="font-medium">{rows.length ? "No students match these filters" : "No student accounts yet"}</p>
            <p className="mt-1 text-sm text-slate-500">{rows.length ? "Try a different name, email, or status." : "Student accounts will appear here after registration."}</p>
          </div>
        ) : shown.map((student) => (
          <article key={student.id} className="flex flex-col gap-4 rounded-2xl bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">{student.full_name || "Student"}</h2>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${student.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                  {student.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="mt-1 truncate text-sm text-slate-500">{student.email || "No email address"}</p>
              <p className="mt-1 text-xs text-slate-400">Joined {new Date(student.created_at).toLocaleDateString()}</p>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <a className="text-sm font-medium text-teal-700 hover:text-teal-900" href={`/admin/results?student=${student.id}`}>View results</a>
              <button onClick={() => void flip(student)} disabled={updating === student.id} className={`rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 ${student.is_active ? "border border-slate-200 text-slate-700" : "bg-teal-700 text-white"}`}>
                {updating === student.id ? "Saving..." : student.is_active ? "Deactivate" : "Activate"}
              </button>
            </div>
          </article>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">Showing {shown.length} of {rows.length} students</p>
    </div>
  );
}

export function ResultsManager() {
  const [rows, setRows] = useState<AdminResult[]>([]);
  const [quizzes, setQuizzes] = useState<QuizOption[]>([]);
  const [filter, setFilter] = useState("");
  const [student, setStudent] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [outcome, setOutcome] = useState<"all" | "passed" | "failed" | "pending">("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    const client = db();
    const [attempts, quizOptions] = await Promise.all([
      client
        .from("attempts")
        .select("id,student_id,quiz_id,score,passed,started_at,submitted_at,status,profiles(full_name,email),quizzes(title)")
        .order("started_at", { ascending: false }),
      client.from("quizzes").select("id,title"),
    ]);
    if (attempts.error || quizOptions.error) {
      setLoadError(attempts.error ?? quizOptions.error, setError);
    } else {
      setRows(
        (attempts.data ?? []).map((attempt) => ({
          ...attempt,
          profiles: Array.isArray(attempt.profiles) ? attempt.profiles[0] ?? null : attempt.profiles,
        })),
      );
      setQuizzes(quizOptions.data ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    let active = true;
    const client = db();
    const initialStudent = new URLSearchParams(window.location.search).get("student");
    void Promise.all([
      client
        .from("attempts")
        .select("id,student_id,quiz_id,score,passed,started_at,submitted_at,status,profiles(full_name,email),quizzes(title)")
        .order("started_at", { ascending: false }),
      client.from("quizzes").select("id,title"),
    ]).then(([attempts, quizOptions]) => {
      if (!active) return;
      if (initialStudent) setStudent(initialStudent);
      if (attempts.error || quizOptions.error) {
        setLoadError(attempts.error ?? quizOptions.error, setError);
      } else {
        setRows(
          (attempts.data ?? []).map((attempt) => ({
            ...attempt,
            profiles: Array.isArray(attempt.profiles) ? attempt.profiles[0] ?? null : attempt.profiles,
          })),
        );
        setQuizzes(quizOptions.data ?? []);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const { shown, average, passRate } = filterAndSummarizeAttempts(rows, {
    quizId: filter,
    student,
    from,
    to,
    outcome,
  });

  function exportCsv() {
    const csv = Papa.unparse(
      shown.map((attempt) => {
        const quiz = Array.isArray(attempt.quizzes) ? attempt.quizzes[0] : attempt.quizzes;
        return {
          quiz: quiz?.title,
          student: attempt.profiles?.full_name || attempt.profiles?.email,
          student_id: attempt.student_id,
          score: attempt.score,
          passed: attempt.passed,
          started_at: attempt.started_at,
          submitted_at: attempt.submitted_at,
          status: attempt.status,
        };
      }),
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "quiz-results.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl bg-white p-5"><p className="text-sm text-slate-500">Matching attempts</p><p className="mt-1 text-2xl font-semibold">{shown.length}</p></article>
        <article className="rounded-2xl bg-white p-5"><p className="text-sm text-slate-500">Average score</p><p className="mt-1 text-2xl font-semibold">{average}{average !== "—" ? "%" : ""}</p></article>
        <article className="rounded-2xl bg-white p-5"><p className="text-sm text-slate-500">Pass rate</p><p className="mt-1 text-2xl font-semibold">{passRate}</p></article>
      </section>
      <section className="mt-5 grid gap-3 rounded-2xl bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="sr-only" htmlFor="results-quiz">Filter by quiz</label>
        <select id="results-quiz" value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-lg border border-slate-200 p-2">
          <option value="">All quizzes</option>{quizzes.map((quiz) => <option key={quiz.id} value={quiz.id}>{quiz.title}</option>)}
        </select>
        <label className="sr-only" htmlFor="results-student">Search student</label>
        <input id="results-student" value={student} onChange={(event) => setStudent(event.target.value)} placeholder="Student name, email, or ID" className="rounded-lg border border-slate-200 p-2" />
        <label className="sr-only" htmlFor="results-outcome">Filter by outcome</label>
        <select id="results-outcome" value={outcome} onChange={(event) => setOutcome(event.target.value as typeof outcome)} className="rounded-lg border border-slate-200 p-2">
          <option value="all">All outcomes</option><option value="passed">Passed</option><option value="failed">Not passed</option><option value="pending">In progress</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">From <input aria-label="From date" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="min-w-0 rounded-lg border border-slate-200 p-2" /></label>
        <label className="flex items-center gap-2 text-sm text-slate-600">To <input aria-label="To date" type="date" value={to} onChange={(event) => setTo(event.target.value)} className="min-w-0 rounded-lg border border-slate-200 p-2" /></label>
        <div className="flex gap-2">
          <button onClick={() => void load()} disabled={loading} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-50">Refresh</button>
          <button onClick={exportCsv} disabled={!shown.length} className="flex-1 rounded-lg bg-teal-700 px-3 py-2 text-white disabled:opacity-50">Export CSV</button>
        </div>
      </section>
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 space-y-2">
        {loading ? (
          <p className="rounded-2xl bg-white p-6 text-sm text-slate-500">Loading results...</p>
        ) : shown.length === 0 ? (
          <p className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">No attempts match these filters.</p>
        ) : shown.map((attempt) => {
          const quiz = Array.isArray(attempt.quizzes) ? attempt.quizzes[0] : attempt.quizzes;
          return (
            <article key={attempt.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4">
              <div className="min-w-0">
                <b>{quiz?.title || "Quiz"}</b>
                <p className="mt-1 text-sm text-slate-600">
                  {attempt.profiles?.full_name || attempt.profiles?.email || "Student"}
                  {attempt.profiles?.full_name && attempt.profiles?.email ? ` · ${attempt.profiles.email}` : ""}
                </p>
                <p className="mt-1 text-xs text-slate-500">Started {new Date(attempt.started_at).toLocaleString()}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm">
                {attempt.score == null
                  ? attempt.status || "In progress"
                  : `${attempt.score}% · ${attempt.passed ? "Passed" : "Not passed"}`}
              </span>
            </article>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-slate-500">Showing {shown.length} of {rows.length} attempts</p>
    </div>
  );
}
