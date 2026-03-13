import { Link } from "wouter";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Eine{" "}
          <a
            href="https://smartthings.de"
            target="_blank"
            rel="noopener"
            title="Smart Things Internetkommunikation GmbH – Webagentur in Solingen"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            smarte Website von Smart Things Internetkommunikation GmbH in Solingen
          </a>
          {" "}erstellt mit{" "}
          <a
            href="https://manus.im"
            target="_blank"
            rel="noopener"
            className="hover:text-foreground transition-colors"
          >
            Manus.im
          </a>
        </span>
        <nav className="flex items-center gap-4">
          <Link href="/impressum" className="hover:text-foreground transition-colors">
            Impressum
          </Link>
          <Link href="/datenschutz" className="hover:text-foreground transition-colors">
            Datenschutz
          </Link>
          <a
            href="https://www.gutenberg.org"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Project Gutenberg
          </a>
        </nav>
      </div>
    </footer>
  );
}
