import { Input } from "@/components/ui/input";
export function Field({
  label,
  error,
  hint,
  ...props
}: React.ComponentProps<typeof Input> & {
  label: string;
  error?: string[];
  hint?: string;
}) {
  const id = props.id ?? props.name;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Input
        {...props}
        id={id}
        aria-invalid={!!error}
        aria-describedby={
          error ? `${id}-error` : hint ? `${id}-hint` : undefined
        }
      />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error[0]}
        </p>
      )}
    </div>
  );
}
