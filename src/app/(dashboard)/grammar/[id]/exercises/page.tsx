import { redirect } from "next/navigation";

export default async function ExercisesIndexPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/grammar/${id}`);
}
