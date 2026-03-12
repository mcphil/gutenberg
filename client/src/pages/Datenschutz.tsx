import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Datenschutz() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Button variant="ghost" size="sm" className="mb-8 -ml-2" asChild>
          <Link href="/">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück zur Startseite
          </Link>
        </Button>

        <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "Lora, Georgia, serif" }}>
          Datenschutzerklärung
        </h1>
        <p className="text-sm text-muted-foreground mb-8">Stand: März 2026</p>

        {/* 1. Verantwortlicher */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">1. Verantwortlicher</h2>
          <p className="text-foreground/80 leading-relaxed">
            Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:
          </p>
          <p className="text-foreground/80 leading-relaxed mt-3">
            Smart Things Internetkommunikation GmbH<br />
            Wichernstraße 6<br />
            42653 Solingen<br />
            E-Mail:{" "}
            <a href="mailto:huberty@smartthings.de" className="text-primary hover:underline">
              huberty@smartthings.de
            </a><br />
            Telefon: +49 212-25 34 042
          </p>
        </section>

        {/* 2. Allgemeines */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">2. Allgemeines zur Datenverarbeitung</h2>
          <p className="text-foreground/80 leading-relaxed">
            Wir verarbeiten personenbezogene Daten unserer Nutzer grundsätzlich nur, soweit dies
            zur Bereitstellung einer funktionsfähigen Website sowie unserer Inhalte und Leistungen
            erforderlich ist. Die Verarbeitung personenbezogener Daten erfolgt regelmäßig nur nach
            Einwilligung des Nutzers. Eine Ausnahme gilt in solchen Fällen, in denen eine vorherige
            Einholung einer Einwilligung aus tatsächlichen Gründen nicht möglich ist und die
            Verarbeitung der Daten durch gesetzliche Vorschriften gestattet ist.
          </p>
        </section>

        {/* 3. Hosting */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">3. Hosting und Server-Logfiles</h2>
          <p className="text-foreground/80 leading-relaxed mb-3">
            Diese Website wird auf der Infrastruktur von Manus (Butterfly Effect Technology Co., Ltd.)
            gehostet. Beim Aufruf unserer Website werden durch den Hosting-Anbieter automatisch
            Informationen in sogenannten Server-Log-Dateien gespeichert, die Ihr Browser automatisch
            übermittelt. Dies sind:
          </p>
          <ul className="list-disc pl-6 text-foreground/80 space-y-1 mb-3">
            <li>Browsertyp und Browserversion</li>
            <li>Verwendetes Betriebssystem</li>
            <li>Referrer URL</li>
            <li>Hostname des zugreifenden Rechners</li>
            <li>Uhrzeit der Serveranfrage</li>
            <li>IP-Adresse</li>
          </ul>
          <p className="text-foreground/80 leading-relaxed">
            Diese Daten sind nicht bestimmten Personen zuordenbar und werden nicht mit anderen
            Datenquellen zusammengeführt. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO
            (berechtigtes Interesse an der sicheren und fehlerfreien Bereitstellung des Dienstes).
          </p>
        </section>

        {/* 4. Cookies */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">4. Cookies</h2>
          <p className="text-foreground/80 leading-relaxed mb-4">
            Unsere Website verwendet ausschließlich technisch notwendige Cookies. Diese Cookies
            sind für den Betrieb der Website unbedingt erforderlich und können in unseren Systemen
            nicht deaktiviert werden. Sie werden in der Regel nur als Reaktion auf von Ihnen
            durchgeführte Aktionen gesetzt, die einer Dienstanforderung entsprechen.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left p-3 font-medium border-b border-border">Cookie-Name</th>
                  <th className="text-left p-3 font-medium border-b border-border">Zweck</th>
                  <th className="text-left p-3 font-medium border-b border-border">Laufzeit</th>
                  <th className="text-left p-3 font-medium border-b border-border">Rechtsgrundlage</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">app_session_id</td>
                  <td className="p-3 text-foreground/80">Authentifizierungs-Session (JWT) — ermöglicht das Einloggen und Wiedererkennen angemeldeter Nutzer</td>
                  <td className="p-3 text-foreground/80">1 Jahr</td>
                  <td className="p-3 text-foreground/80">Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-foreground/80 leading-relaxed mt-4">
            Tracking-Cookies oder Cookies zu Werbezwecken werden nicht eingesetzt.
          </p>
        </section>

        {/* 5. Lokaler Speicher */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">5. Lokaler Browserspeicher (localStorage)</h2>
          <p className="text-foreground/80 leading-relaxed mb-4">
            Zur Verbesserung Ihrer Nutzererfahrung speichern wir bestimmte Daten lokal in Ihrem
            Browser (localStorage). Diese Daten verlassen Ihren Browser nicht und werden nicht
            an unsere Server übertragen.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left p-3 font-medium border-b border-border">Schlüssel</th>
                  <th className="text-left p-3 font-medium border-b border-border">Inhalt</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">gl_reading_progress</td>
                  <td className="p-3 text-foreground/80">Lesefortschritt (CFI-Position) je Buch</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">gl_bookmarks</td>
                  <td className="p-3 text-foreground/80">Persönliche Lesezeichen</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">gl_reader_prefs</td>
                  <td className="p-3 text-foreground/80">Leser-Einstellungen (Schriftgröße, Theme etc.)</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="p-3 font-mono text-xs">gl_recent_books</td>
                  <td className="p-3 text-foreground/80">Zuletzt angesehene Bücher</td>
                </tr>
                <tr>
                  <td className="p-3 font-mono text-xs">gl_app_prefs</td>
                  <td className="p-3 text-foreground/80">App-Einstellungen (Standardansicht, Theme)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-foreground/80 leading-relaxed mt-4">
            Sie können diese Daten jederzeit über die Entwicklertools Ihres Browsers löschen.
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der
            Bereitstellung einer personalisierten Nutzererfahrung ohne Server-Speicherung).
          </p>
        </section>

        {/* 6. Nutzerkonten und Authentifizierung */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">6. Nutzerkonten und Authentifizierung</h2>
          <p className="text-foreground/80 leading-relaxed mb-3">
            Die Anmeldung auf dieser Plattform erfolgt über den OAuth-Dienst der Manus-Plattform
            (Butterfly Effect Technology Co., Ltd.). Bei der Anmeldung werden folgende Daten
            verarbeitet:
          </p>
          <ul className="list-disc pl-6 text-foreground/80 space-y-1 mb-3">
            <li>Manus-Benutzerkennung (OpenID)</li>
            <li>Anzeigename (optional, sofern vom Nutzer angegeben)</li>
          </ul>
          <p className="text-foreground/80 leading-relaxed">
            Diese Daten werden in unserer Datenbank gespeichert, um die Nutzung der Plattform
            zu ermöglichen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).
            Weitere Informationen zur Datenverarbeitung durch Manus finden Sie in der
            Datenschutzerklärung von Manus.
          </p>
        </section>

        {/* 7. Webanalyse */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">7. Webanalyse (Umami)</h2>
          <p className="text-foreground/80 leading-relaxed mb-3">
            Diese Website verwendet Umami, ein datenschutzfreundliches Webanalyse-Tool. Umami
            setzt keine Cookies und speichert keine personenbezogenen Daten. Es werden ausschließlich
            anonymisierte, aggregierte Nutzungsstatistiken erhoben (z.B. Seitenaufrufe,
            Besucheranzahl). Eine Identifizierung einzelner Nutzer ist nicht möglich.
          </p>
          <p className="text-foreground/80 leading-relaxed">
            Die Analyse erfolgt auf Servern der Manus-Infrastruktur. Es findet keine Übertragung
            von Daten an Dritte statt. Da keine personenbezogenen Daten verarbeitet werden, ist
            für diese Analyse keine Einwilligung erforderlich.
          </p>
        </section>

        {/* 8. Externe Inhalte */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">8. Externe Inhalte (Project Gutenberg)</h2>
          <p className="text-foreground/80 leading-relaxed">
            Buchcover und Buchinhalte werden von den Servern des Project Gutenberg
            (gutenberg.org) geladen. Dabei wird Ihre IP-Adresse an die Server des Project
            Gutenberg übertragen. Wir haben keinen Einfluss auf die Datenverarbeitung durch
            Project Gutenberg. Weitere Informationen finden Sie in der{" "}
            <a
              href="https://www.gutenberg.org/policy/privacy_policy.html"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Datenschutzerklärung von Project Gutenberg
            </a>.
          </p>
        </section>

        {/* 9. Betroffenenrechte */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">9. Ihre Rechte als betroffene Person</h2>
          <p className="text-foreground/80 leading-relaxed mb-3">
            Sie haben gegenüber uns folgende Rechte hinsichtlich der Sie betreffenden
            personenbezogenen Daten:
          </p>
          <ul className="list-disc pl-6 text-foreground/80 space-y-2">
            <li><strong>Recht auf Auskunft</strong> (Art. 15 DSGVO)</li>
            <li><strong>Recht auf Berichtigung</strong> (Art. 16 DSGVO)</li>
            <li><strong>Recht auf Löschung</strong> (Art. 17 DSGVO)</li>
            <li><strong>Recht auf Einschränkung der Verarbeitung</strong> (Art. 18 DSGVO)</li>
            <li><strong>Recht auf Datenübertragbarkeit</strong> (Art. 20 DSGVO)</li>
            <li><strong>Recht auf Widerspruch</strong> (Art. 21 DSGVO)</li>
          </ul>
          <p className="text-foreground/80 leading-relaxed mt-4">
            Zur Ausübung Ihrer Rechte wenden Sie sich bitte an:{" "}
            <a href="mailto:huberty@smartthings.de" className="text-primary hover:underline">
              huberty@smartthings.de
            </a>
          </p>
          <p className="text-foreground/80 leading-relaxed mt-3">
            Außerdem haben Sie das Recht, sich bei einer Datenschutz-Aufsichtsbehörde über die
            Verarbeitung Ihrer personenbezogenen Daten durch uns zu beschweren. Die zuständige
            Aufsichtsbehörde für Nordrhein-Westfalen ist der Landesbeauftragte für Datenschutz
            und Informationsfreiheit NRW (LDI NRW), Kavalleriestraße 2–4, 40213 Düsseldorf.
          </p>
        </section>

        {/* 10. Datensicherheit */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">10. Datensicherheit</h2>
          <p className="text-foreground/80 leading-relaxed">
            Wir verwenden innerhalb des Website-Besuchs das verbreitete SSL-Verfahren (Secure
            Socket Layer) in Verbindung mit der jeweils höchsten Verschlüsselungsstufe, die von
            Ihrem Browser unterstützt wird. In der Regel handelt es sich dabei um eine
            256-Bit-Verschlüsselung. Ob eine einzelne Seite unseres Internetauftrittes
            verschlüsselt übertragen wird, erkennen Sie an der geschlossenen Darstellung des
            Schlüssel- beziehungsweise Schloss-Symbols in der unteren Statusleiste Ihres Browsers.
          </p>
        </section>

        <div className="pt-6 border-t border-border text-sm text-muted-foreground">
          <Link href="/impressum" className="hover:text-foreground transition-colors">
            Impressum
          </Link>
        </div>
      </div>
    </div>
  );
}
