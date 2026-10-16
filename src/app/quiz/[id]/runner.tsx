"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Flag, Timer } from "lucide-react";

type Question = {
  id: string;
  text: string;
  options: string[];
  type: string;
  image_path: string | null;
};

type QuizData = {
  quiz: { id: string; title: string; time_limit_minutes: number };
  questions: Question[];
};

type SavedState = {
  attemptId: string;
  startedAt: string;
  answers: Record<string, string>;
  flags: Record<string, boolean>;
};

async function readResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "The request failed.");
  return body;
}

export default function Runner({ id }: { id: string }) {
  const [data, setData] = useState<QuizData | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [attempt, setAttempt] = useState("");
  const [index, setIndex] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const saveQueue = useRef(Promise.resolve());
  const submitRef = useRef<() => void>(() => {});
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const quizResponse = await fetch(`/api/quiz/${id}`);
        const quizData = await readResponse<QuizData>(quizResponse);
        if (!active) return;

        const storageKey = `quiz-${id}`;
        const savedText = localStorage.getItem(storageKey);
        let saved: Partial<SavedState> = {};
        if (savedText) {
          try {
            saved = JSON.parse(savedText) as Partial<SavedState>;
          } catch {
            localStorage.removeItem(storageKey);
          }
        }

        let attemptId = saved.attemptId ?? "";
        let startedAt = saved.startedAt ?? "";
        if (!attemptId || !startedAt) {
          const startResponse = await fetch("/api/attempt/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ quizId: id }),
          });
          const started = await readResponse<{ id: string; started_at: string }>(startResponse);
          attemptId = started.id;
          startedAt = started.started_at;
        }

        if (!active) return;
        const answers = saved.answers ?? {};
        const flags = saved.flags ?? {};
        setData(quizData);
        setAttempt(attemptId);
        setAnswers(answers);
        setFlags(flags);
        localStorage.setItem(
          storageKey,
          JSON.stringify({ attemptId, startedAt, answers, flags } satisfies SavedState),
        );
        setSeconds(
          Math.max(
            0,
            Math.ceil(
              (new Date(startedAt).getTime() + quizData.quiz.time_limit_minutes * 60_000 - Date.now()) /
                1000,
            ),
          ),
        );
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Could not load the quiz.");
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [id]);

  const saveAnswer = useCallback(
    async (
      questionId: string,
      answer: string | null,
      flagged: boolean,
      nextAnswers: Record<string, string>,
      nextFlags: Record<string, boolean>,
    ) => {
      if (!attempt) return false;

      const storageKey = `quiz-${id}`;
      const saved = JSON.parse(localStorage.getItem(storageKey) || "{}") as Partial<SavedState>;
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          attemptId: attempt,
          startedAt: saved.startedAt ?? "",
          answers: nextAnswers,
          flags: nextFlags,
        } satisfies SavedState),
      );

      const save = saveQueue.current.then(async () => {
        const response = await fetch("/api/attempt/answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId: attempt, questionId, answer, flagged }),
        });
        await readResponse<{ saved: boolean }>(response);
      });
      saveQueue.current = save.then(
        () => undefined,
        () => undefined,
      );

      try {
        await save;
        setError("");
        return true;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not save your answer.");
        return false;
      }
    },
    [attempt, id],
  );

  const submit = useCallback(async () => {
    if (!attempt || !data || busy) return;
    setBusy(true);
    setError("");

    try {
      await saveQueue.current;
      if (seconds > 0) {
        for (const question of data.questions) {
          const response = await fetch("/api/attempt/answer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              attemptId: attempt,
              questionId: question.id,
              answer: answers[question.id] ?? null,
              flagged: Boolean(flags[question.id]),
            }),
          });
          if (response.status === 409) break;
          await readResponse<{ saved: boolean }>(response);
        }
      }

      const response = await fetch("/api/attempt/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: attempt }),
      });
      await readResponse(response);
      localStorage.removeItem(`quiz-${id}`);
      router.replace(`/result/${attempt}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit the quiz.");
      setBusy(false);
    }
  }, [answers, attempt, busy, data, flags, id, router, seconds]);

  useEffect(() => {
    submitRef.current = () => {
      void submit();
    };
  }, [submit]);

  useEffect(() => {
    if (!attempt || !data) return;
    const timer = window.setInterval(() => {
      setSeconds((remaining) => {
        if (remaining <= 1) {
          window.clearInterval(timer);
          submitRef.current();
          return 0;
        }
        return remaining - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [attempt, data]);

  if (error && !data) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <p role="alert" className="text-red-700">{error}</p>
        <Link href="/quizzes" className="text-teal-700">&larr; Back to quizzes</Link>
      </main>
    );
  }
  if (!data || !attempt) {
    return <main className="mx-auto max-w-2xl p-10 text-slate-500">Loading your quiz...</main>;
  }
  const question = data.questions[index];
  if (!question) {
    return <main className="p-10">This quiz has no questions.</main>;
  }

  const choose = (answer: string) => {
    const nextAnswers = { ...answers, [question.id]: answer };
    setAnswers(nextAnswers);
    void saveAnswer(question.id, answer, Boolean(flags[question.id]), nextAnswers, flags);
  };
  const toggleFlag = () => {
    const nextFlags = { ...flags, [question.id]: !flags[question.id] };
    setFlags(nextFlags);
    void saveAnswer(
      question.id,
      answers[question.id] ?? null,
      nextFlags[question.id],
      answers,
      nextFlags,
    );
  };
  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const remainingSeconds = String(seconds % 60).padStart(2, "0");

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between">
          <Link href="/quizzes" className="font-semibold">Quizwise</Link>
          <span className={`flex items-center gap-2 rounded-full px-4 py-2 font-mono ${seconds < 60 ? "bg-red-100 text-red-700" : "bg-white"}`}>
            <Timer aria-hidden="true" size={16} />
            {minutes}:{remainingSeconds}
          </span>
        </header>
        <div className="mt-8 h-2 overflow-hidden rounded bg-slate-200">
          <div
            className="h-full rounded bg-teal-600"
            style={{ width: `${((index + 1) / data.questions.length) * 100}%` }}
          />
        </div>
        <p className="mt-4 text-sm text-slate-500">
          QUESTION {index + 1} OF {data.questions.length}
        </p>
        <section className="mt-4 rounded-3xl bg-white p-6 shadow-sm md:p-10">
          <div className="flex justify-between gap-4">
            <h1 className="text-2xl font-semibold">{question.text}</h1>
            <button
              type="button"
              onClick={toggleFlag}
              aria-label={flags[question.id] ? "Remove review flag" : "Flag for review"}
              aria-pressed={Boolean(flags[question.id])}
              className={flags[question.id] ? "text-amber-600" : "text-slate-400"}
            >
              <Flag aria-hidden="true" />
            </button>
          </div>
          {question.image_path && (
            <Image
              src={question.image_path}
              alt="Question"
              width={960}
              height={640}
              unoptimized
              className="mt-5 max-h-64 rounded-xl object-contain"
            />
          )}
          <div className="mt-8 space-y-3">
            {question.options.map((option, optionIndex) => (
              <button
                key={optionIndex}
                type="button"
                onClick={() => choose(option)}
                aria-pressed={answers[question.id] === option}
                className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left ${
                  answers[question.id] === option
                    ? "border-teal-600 bg-teal-50"
                    : "border-slate-200 hover:border-teal-300"
                }`}
              >
                <span className="grid size-8 place-items-center rounded-full bg-slate-100 text-sm">
                  {String.fromCharCode(65 + optionIndex)}
                </span>
                {option}
              </button>
            ))}
          </div>
          {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
          <div className="mt-8 flex justify-between">
            <button
              type="button"
              disabled={!index || busy}
              onClick={() => setIndex((current) => current - 1)}
              className="flex items-center gap-2 rounded-xl border px-5 py-3 disabled:opacity-40"
            >
              <ChevronLeft aria-hidden="true" size={16} /> Previous
            </button>
            {index < data.questions.length - 1 ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setIndex((current) => current + 1)}
                className="flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-white disabled:opacity-50"
              >
                Next <ChevronRight aria-hidden="true" size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Submit this quiz now?")) void submit();
                }}
                disabled={busy}
                className="rounded-xl bg-teal-700 px-5 py-3 text-white disabled:opacity-50"
              >
                {busy ? "Submitting..." : "Submit quiz"}
              </button>
            )}
          </div>
        </section>
        <div className="mt-5 flex flex-wrap gap-2">
          {data.questions.map((item, itemIndex) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setIndex(itemIndex)}
              aria-label={`Go to question ${itemIndex + 1}${flags[item.id] ? ", flagged for review" : ""}`}
              aria-current={itemIndex === index ? "step" : undefined}
              className={`size-9 rounded-lg text-sm ${
                itemIndex === index
                  ? "bg-teal-700 text-white"
                  : answers[item.id]
                    ? "bg-teal-100 text-teal-800"
                    : "bg-white"
              }`}
            >
              {itemIndex + 1}{flags[item.id] ? " *" : ""}
            </button>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">
          Your answers save as you go. You can return to this page after a refresh.
        </p>
      </div>
    </main>
  );
}
