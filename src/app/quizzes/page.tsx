import ExploreQuizzes from "./explore";

export const dynamic = "force-dynamic";

export default async function Quizzes({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string;
    category?: string;
    difficulty?: string;
    sort?: string;
  }>;
}) {
  const filters = await searchParams;

  return (
    <ExploreQuizzes
      initialSearch={filters.search ?? ""}
      initialCategory={filters.category ?? ""}
      initialDifficulty={filters.difficulty ?? ""}
      initialSort={filters.sort === "popular" ? "popular" : "newest"}
    />
  );
}
