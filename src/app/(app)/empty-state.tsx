export function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center text-fg-muted">
      <span className="text-4xl" aria-hidden="true">
        {icon}
      </span>
      <p className="text-sm">{text}</p>
    </div>
  );
}
