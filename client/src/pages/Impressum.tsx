import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Impressum() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Button variant="ghost" size="sm" className="mb-8 -ml-2" asChild>
          <Link href="/">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück zur Startseite
          </Link>
        </Button>

        <h1 className="text-3xl font-bold mb-8" style={{ fontFamily: "Lora, Georgia, serif" }}>
          Impressum
        </h1>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Angaben gemäß § 5 TMG</h2>
          <p className="text-foreground/80 leading-relaxed">
            Smart Things Internetkommunikation GmbH<br />
            Wichernstraße 6<br />
            42653 Solingen
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Vertreten durch</h2>
          <p className="text-foreground/80 leading-relaxed">
            Geschäftsführung: Philipp Huberty
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Kontakt</h2>
          <p className="text-foreground/80 leading-relaxed">
            Telefon: +49 212-25 34 042<br />
            E-Mail:{" "}
            <a
              href="mailto:huberty@smartthings.de"
              className="text-primary hover:underline"
            >
              huberty@smartthings.de
            </a>
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Registereintrag</h2>
          <p className="text-foreground/80 leading-relaxed">
            Handelsregister: HRB 23776<br />
            Registergericht: AG Wuppertal
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Umsatzsteuer-Identifikationsnummer</h2>
          <p className="text-foreground/80 leading-relaxed">
            Umsatzsteuer-ID gemäß § 27a Umsatzsteuergesetz:<br />
            DE 196415483
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Inhaltlich verantwortlich gemäß § 55 Abs. 2 RStV</h2>
          <p className="text-foreground/80 leading-relaxed">
            Philipp Huberty<br />
            Wichernstraße 6<br />
            42653 Solingen
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Quellenangaben für die verwendeten Inhalte</h2>
          <p className="text-foreground/80 leading-relaxed">
            Die auf dieser Plattform bereitgestellten Bücher stammen aus dem{" "}
            <a
              href="https://www.gutenberg.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Project Gutenberg
            </a>{" "}
            und stehen unter freier Lizenz (gemeinfrei). Alle Werke sind urheberrechtlich
            nicht mehr geschützt. Die KI-generierten Zusammenfassungen wurden von Smart Things
            Internetkommunikation GmbH erstellt.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Haftungsausschluss</h2>
          <h3 className="font-medium mb-2 text-foreground/90">Haftung für Inhalte</h3>
          <p className="text-foreground/80 leading-relaxed mb-4">
            Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen
            Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir
            als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde
            Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige
            Tätigkeit hinweisen.
          </p>
          <h3 className="font-medium mb-2 text-foreground/90">Haftung für Links</h3>
          <p className="text-foreground/80 leading-relaxed">
            Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen
            Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen.
            Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der
            Seiten verantwortlich.
          </p>
        </section>

        <div className="pt-6 border-t border-border text-sm text-muted-foreground">
          <Link href="/datenschutz" className="hover:text-foreground transition-colors">
            Datenschutzerklärung
          </Link>
        </div>
      </div>
    </div>
  );
}
