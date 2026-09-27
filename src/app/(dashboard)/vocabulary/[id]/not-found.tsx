import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function WordNotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-semibold">Word not found.</h1>
      <p className="mt-3 mb-6 text-sm text-muted-foreground">
        This word isn’t available in your notebook.
      </p>
      <Button asChild>
        <Link href="/vocabulary">Back to vocabulary</Link>
      </Button>
    </div>
  );
}
