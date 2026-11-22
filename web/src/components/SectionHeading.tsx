export interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
}

export function SectionHeading({ eyebrow, title, description }: SectionHeadingProps) {
  return (
    <div className="max-w-2xl">
      {eyebrow !== undefined && (
        <p className="text-sm font-semibold uppercase tracking-wide text-forest-600">{eyebrow}</p>
      )}
      <h2 className="mt-2 font-display text-3xl font-bold leading-tight tracking-tight text-charcoal">{title}</h2>
      {description !== undefined && <p className="mt-3 text-muted">{description}</p>}
    </div>
  );
}
