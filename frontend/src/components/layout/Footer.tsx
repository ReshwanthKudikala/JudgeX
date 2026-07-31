const GITHUB_URL = 'https://github.com/ReshwanthKudikala/JudgeX';

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-app flex-col gap-2 px-4 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
          <span className="font-medium text-foreground">
            Judge<span className="text-primary">X</span>
          </span>
          <span className="hidden text-border sm:inline" aria-hidden>
            ·
          </span>
          <span>Built by Reshwanth Kudikala</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            GitHub
          </a>
          <span className="text-muted/80" aria-label="Version 1.0">
            Version 1.0
          </span>
        </div>
      </div>
    </footer>
  );
}
