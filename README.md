# Ferienkasse

Gemeinsame Reisekasse als Web-App: Ausgaben erfassen, zum Tageskurs in die Hauptwährung umrechnen und am Schluss mit möglichst wenigen Zahlungen quitt sein. Die App läuft im Browser, lässt sich aufs Handy legen und startet auch ohne Netz.

Sie nimmt sich dabei nicht zu ernst: Jede Person wählt ein Emoji als Avatar (in der Reise oben rechts auf das eigene Bild tippen), die Abrechnung zeigt eine Meme-Karte passend zum Saldo, und wenn alle quitt sind, regnet es Konfetti.

Dieses README führt zuerst durch drei Schritte und dient danach zum Nachschlagen.

1. [Veröffentlichen auf GitHub](#1-veröffentlichen-auf-github): 5 Minuten. Danach läuft die App, vorerst für ein einzelnes Gerät.
2. [Gruppen-Sync einrichten](#2-gruppen-sync-einrichten): 10 Minuten. Danach tragen alle auf dem eigenen Handy ein.
3. [Probelauf vor den Ferien](#3-probelauf-vor-den-ferien): 5 Minuten zu zweit.

Zum Nachschlagen: [Tageskurse](#tageskurse) · [Wer sieht was?](#wer-sieht-was-sicherheit-und-daten) · [Sicherung](#sicherung) · [iPhone](#besonderheiten-auf-dem-iphone) · [Anpassen](#anpassen-und-aktualisieren) · [Was geprüft ist](#was-geprüft-ist-und-was-nicht) · [Lizenzen](#lizenzen)

## 1. Veröffentlichen auf GitHub

Du brauchst ein kostenloses GitHub-Konto. Am Computer geht es am einfachsten.

1. Auf github.com oben rechts auf «+» klicken, dann «New repository». Name zum Beispiel `ferienkasse`, Sichtbarkeit «Public» (mit einem kostenlosen Konto veröffentlicht GitHub Pages nur öffentliche Repositories). «Create repository».
2. Das ZIP entpacken. Auf der Seite des neuen Repositories auf «uploading an existing file» klicken (später heisst der Weg «Add file», dann «Upload files»). Alle Dateien aus dem entpackten Ordner ins Fenster ziehen: die Dateien selbst, nicht den Ordner und nicht das ZIP. Unten «Commit changes».
3. «Settings» öffnen, links «Pages». Unter «Build and deployment» bei «Source» den Eintrag «Deploy from a branch» wählen, darunter den Branch `main` und den Ordner `/ (root)`, dann «Save».
4. Nach ein bis zwei Minuten (beim ersten Mal können es zehn sein) zeigt dieselbe Seite oben die Adresse, in der Form `https://DEIN-NAME.github.io/ferienkasse/`. Das ist die App.

Öffentlich wird dabei nur der Programmcode aus diesem Ordner. Reisen und Buchungen liegen nie im Repository.

**Aufs Handy legen**

Die App weist selbst darauf hin: Auf der Startseite und in der Reise steht «Als App installieren», solange sie im Browser läuft. Installiert startet sie im Vollbild, ohne Browser-Leisten.

- Android (Chrome): Adresse öffnen und im Hinweis auf «Installieren» tippen, oder im Menü «App installieren» wählen.
- iPhone (Safari): Adresse öffnen, «Teilen», dann «Zum Home-Bildschirm». Dazu gibt es [Besonderheiten](#besonderheiten-auf-dem-iphone).

## 2. Gruppen-Sync einrichten

Ohne diesen Schritt liegt jede Reise nur auf dem Gerät, auf dem sie angelegt wurde. Mit ihm tragen alle auf dem eigenen Handy ein, sehen die Einträge der anderen sofort und können auch ohne Netz buchen; gesendet wird, sobald wieder Netz da ist.

Der Sync läuft über Firebase von Google im kostenlosen Tarif «Spark», ohne Kreditkarte. Du brauchst ein Google-Konto. Die Bezeichnungen in der Firebase-Konsole können je nach Sprache und Stand leicht von den hier genannten abweichen.

Dieselben Schritte stehen auch in der App: auf der Startseite «Gruppen-Sync einrichten». Dort kopiert ein Knopf die Regeln, und ein Link führt direkt zur Datei `config.js` auf GitHub.

1. **Projekt anlegen.** [console.firebase.google.com](https://console.firebase.google.com) öffnen und ein neues Projekt erstellen, Name zum Beispiel «ferienkasse». Google Analytics wird nicht gebraucht: ausschalten.
2. **Datenbank anlegen.** Im Menü links «Databases & Storage» öffnen (deutsch «Datenbanken und Speicher»), dann «Firestore», und «Create database» wählen. Direkt dorthin: [console.firebase.google.com/project/_/firestore](https://console.firebase.google.com/project/_/firestore). Standort zum Beispiel `europe-west6 (Zürich)`; er lässt sich später nicht mehr ändern. Start im «Production mode». Fragt die Konsole nach Edition und Kennung: «Standard», und die Kennung unverändert auf `(default)`.
3. **Regeln einsetzen.** Auf der Seite «Firestore» steht über der Datenansicht eine Reihe von Reitern, darunter «Rules» (deutsch «Regeln»); auf dem Handy lässt sich die Reihe seitlich schieben. Direkt dorthin: [console.firebase.google.com/project/_/firestore/rules](https://console.firebase.google.com/project/_/firestore/rules). Den vorhandenen Text löschen, den ganzen Inhalt der Datei [`firestore.rules`](firestore.rules) einfügen und «Publish» wählen. Fehlen die Reiter, gibt es die Datenbank noch nicht (Schritt 2).
4. **Web-App registrieren.** Unter dem Zahnrad «Project settings» öffnen, direkt: [console.firebase.google.com/project/_/settings/general](https://console.firebase.google.com/project/_/settings/general). Unten bei «Your apps» das Symbol `</>` (Web) wählen. Einen Spitznamen eingeben, «Firebase Hosting» nicht ankreuzen, «Register app». Firebase zeigt jetzt einen Block, der mit `const firebaseConfig = {` beginnt und mit `};` endet. Diesen Block kopieren. Später findest du ihn an derselben Stelle bei «Your apps», Auswahl «Config».
5. **Block in `config.js` einsetzen.** Auf GitHub die Datei `config.js` öffnen, auf den Stift klicken und die eine Zeile `const firebaseConfig = null;` durch den kopierten Block ersetzen. Sonst nichts ändern. «Commit changes». Danach steht dort zum Beispiel:

   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "ferienkasse-1234.firebaseapp.com",
     projectId: "ferienkasse-1234",
     storageBucket: "ferienkasse-1234.firebasestorage.app",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abcdef0123456789"
   };
   ```

6. **Prüfen.** Ein bis zwei Minuten warten und die App neu laden. Auf der Startseite oben rechts die Einstellungen öffnen (Regler-Symbol) und auf «Verbindung prüfen» tippen. Steht dort «Die Verbindung steht», ist alles bereit. Sonst sagt die Meldung, was fehlt:

   | Meldung in der App | Was zu tun ist |
   |---|---|
   | «… noch keine Firestore-Datenbank» | Schritt 2 |
   | «… lehnt den Zugriff aber ab. Es fehlen die Sicherheitsregeln» | Schritt 3 |
   | «… lehnt die Angaben aus config.js ab» | Schritt 4 und 5 wiederholen |
   | «Keine Antwort von Firebase» | Netz prüfen, dann die Werte aus Schritt 5 |
   | Unter «Gruppen-Sync» steht «Nicht eingeschaltet: Die Datei config.js lässt sich nicht lesen» | In `config.js` darf nur der Block stehen, keine Zeilen mit `import` oder `initializeApp` |

7. **Reise teilen.** Eine Reise anlegen, oben auf «Einladen» tippen und den Link oder den QR-Code an die Gruppe geben. Wer den Link öffnet, ist dabei. Eine Reise, die schon vorher auf deinem Gerät lag, gibst du ebenfalls über «Einladen» frei: Es erscheint zuerst «Für die Gruppe freigeben», danach der Link. Ab dann steht in der Reise «Automatisch für die ganze Gruppe gespeichert».

**Kontingent.** Der kostenlose Tarif erlaubt pro Tag 50'000 Lesevorgänge, 20'000 Schreibvorgänge und 20'000 Löschungen, dazu 1 GiB Daten (Stand Oktober 2026). Eine Feriengruppe braucht davon einen Bruchteil. Ist es doch einmal aufgebraucht, bleiben neue Einträge auf den Geräten und werden nachgereicht. Das Kontingent wird täglich um Mitternacht kalifornischer Zeit frei, in der Schweiz also gegen 9 Uhr morgens. Kosten entstehen im Tarif «Spark» keine.

## 3. Probelauf vor den Ferien

Die App ist ausführlich automatisch geprüft, aber nicht mit deinem Firebase-Projekt und nicht auf euren Handys (siehe [Was geprüft ist](#was-geprüft-ist-und-was-nicht)). Deshalb einmal zu zweit durchspielen:

1. Einstellungen, «Verbindung prüfen»: Es erscheint «Die Verbindung steht».
2. Reise anlegen, «Einladen», das zweite Handy öffnet den Link. Beide tragen je eine Ausgabe ein. Sie erscheint auf dem anderen Handy, ohne dass jemand neu lädt.
3. Ein Handy in den Flugmodus, eine Ausgabe eintragen, Flugmodus wieder aus. Die Ausgabe erscheint auf dem anderen Handy.
4. Eine Ausgabe in Euro eintragen. Unter dem Kurs steht «Tageskurs vom …, Referenzkurs der EZB».
5. iPhone: App auf den Home-Bildschirm legen und dort die Reise über «Mit Link beitreten» holen.
6. Die Probe-Reise wieder löschen: in der Reise das Regler-Symbol, dann «Reise für alle löschen».

Klappt etwas davon nicht, hilft meist die Meldung in der App. Sonst lohnt ein Blick in die Abschnitte unten.

## Tageskurse

- Einzustellen ist nichts. Bei einer Ausgabe in fremder Währung holt die App den Kurs für das Datum der Ausgabe. Für Euro, Dollar und die übrigen gängigen Währungen ist es der Referenzkurs der Europäischen Zentralbank. Er erscheint an Bankwerktagen gegen 16 Uhr. Davor und am Wochenende gilt der zuletzt veröffentlichte Kurs; unter dem Feld stehen immer Datum und Quelle.
- Der Kurs wird mit der Buchung gespeichert. Alte Buchungen ändern sich also nicht, wenn der Kurs später schwankt, und alle Geräte rechnen mit denselben Zahlen.
- Der Kurs lässt sich jederzeit von Hand überschreiben, zum Beispiel mit dem Kurs der Kartenabrechnung. «Tageskurs einsetzen» holt den Tageskurs zurück.
- Ohne Netz setzt die App den letzten bekannten Kurs ein und sagt das dazu.
- Quellen: [Frankfurter](https://frankfurter.dev) (Kurse der EZB, für seltene Währungen das Mittel mehrerer Zentralbanken). Ist Frankfurter nicht erreichbar, springt die freie «currency-api» über jsDelivr ein. Beide brauchen kein Konto und keinen Schlüssel. Übermittelt werden nur Währungspaar und Datum.

## Wer sieht was? Sicherheit und Daten

- **Der Einladungslink ist der Schlüssel.** Wer ihn hat, kann die Reise lesen und ändern. Es gibt kein Konto und kein Passwort. Gib den Link nur an eure Gruppe.
- Der Link enthält eine zufällige Kennung aus 22 Zeichen. Sie lässt sich nicht erraten, und die Regeln in `firestore.rules` verbieten es, Reisen aufzulisten oder zu durchsuchen. Die Kennung steht hinter dem `#` der Adresse und wird deshalb nicht an GitHub übertragen.
- Weil es kein Login gibt, kann jede Person mit dem Link alles ändern und löschen. «Erfasst von» ist eine Angabe, kein Beweis. Für eine Runde, die sich vertraut, passt das; für mehr ist die App nicht gedacht.
- **Die Werte in `config.js` sind keine Passwörter.** Sie sagen dem Browser nur, welches Firebase-Projekt gemeint ist, und sind bei jeder Firebase-Web-App öffentlich. Meldet GitHub per E-Mail einen «gefundenen Schlüssel», ist das hier erwartet. Geschützt werden die Daten durch die Regeln.
- Was Fremde tun könnten: Wer deine Seite findet, könnte eigene Reisen anlegen und so das kostenlose Tageskontingent aufbrauchen. Dann pausiert der Sync bis zum nächsten Morgen. Eure Reisen lesen können Fremde ohne Link nicht, und Kosten entstehen keine. Die Seite bittet Suchmaschinen, sie nicht aufzunehmen.
- Wo die Daten liegen: im Speicher des Browsers auf jedem Gerät und, mit Gruppen-Sync, in deiner Firestore-Datenbank am gewählten Standort. Programm, Schriften und Bibliotheken kommen aus deinem Repository, nicht von fremden Servern.
- Alle Seiten, die du unter demselben GitHub-Namen veröffentlichst, teilen sich im Browser denselben Speicher. Veröffentliche dort also nur Seiten, denen du traust.
- Nach den Ferien: Sicherung herunterladen, dann «Reise für alle löschen». Wer ganz aufräumen will, löscht das Firebase-Projekt.

## Sicherung

- Herunterladen: in der Reise das Regler-Symbol, dann «Sicherung herunterladen». Es entsteht eine Datei wie `ferienkasse-sardinien-2026-2026-10-05.json`.
- Einlesen: Startseite, Einstellungen, «Sicherung einlesen». Die Sicherung wird als neue Reise auf diesem Gerät angelegt.
- Für Reisen, die nur auf einem Gerät liegen, ist die Sicherung der einzige Schutz. Löscht der Browser seinen Speicher, ist die Reise sonst weg.

## Besonderheiten auf dem iPhone

- Die App vom Home-Bildschirm hat einen eigenen Speicher, getrennt von Safari. Sie beginnt deshalb leer.
- Geteilte Reisen holst du mit dem Einladungslink hinein: Link kopieren, in der App «Mit Link beitreten», einfügen.
- Eine Reise, die nur auf diesem Gerät liegt, nimmst du als Sicherung mit: in Safari herunterladen, in der App einlesen. Einfacher ist es, solche Reisen gleich in der App vom Home-Bildschirm anzulegen.
- Links aus dem Gruppenchat öffnet das iPhone in Safari, nicht in der App. Beides funktioniert und zeigt dieselben geteilten Reisen.

## Anpassen und aktualisieren

- Eine Datei ändern: auf GitHub öffnen, Stift, ändern, «Commit changes». Nach etwa einer Minute ist die neue Fassung veröffentlicht. Die App fragt bei jedem Start mit Netz nach der neusten Fassung.
- Eine neue Fassung der App einspielen: nur die geänderten Dateien hochladen («Add file», «Upload files»); gleichnamige Dateien werden ersetzt. Die Datei `config.js` dabei nicht ersetzen, sonst ist der Gruppen-Sync wieder ausgeschaltet.
- Aus früheren Fassungen werden einige Dateien nicht mehr gebraucht: `scan.js` (der Beleg-Scan mit KI ist entfernt) und die Schriften `barlow-*.woff2` und `barlow-condensed-*.woff2`. Sie stören nicht, lassen sich auf GitHub aber löschen: Datei öffnen, Menü mit den drei Punkten, «Delete file».
- Name und Farben: `manifest.webmanifest` (Name und Farbe der installierten App), `index.html` (Titel) und der Anfang von `style.css` (Farben als Variablen).
- Währungen in der Auswahl, Kategorien, die Liste der Avatare und die Sprüche der Meme-Karten: in `logic.js`.
- Die Meme-Karten zeigen bekannte Sprüche als Text und ein Emoji. Bilder der Original-Memes sind nicht enthalten, weil sie urheberrechtlich geschützt sind.

| Datei | Aufgabe |
|---|---|
| `index.html`, `style.css` | Seite und Aussehen |
| `config.js` | Einstellungen dieser Installation (Gruppen-Sync) |
| `app.js` | Oberfläche |
| `logic.js` | Rechnen: Aufteilen, Umrechnen, Ausgleich, Statistik |
| `store.js` | Speichern auf dem Gerät und im Gruppen-Sync |
| `rates.js` | Tageskurse |
| `sw.js`, `manifest.webmanifest`, `icon-*.png`, `apple-touch-icon.png`, `favicon.svg` | Installierbare App, Start ohne Netz |
| `firestore.rules` | Sicherheitsregeln für die Firebase-Konsole (die Anleitung in der App kopiert sie von hier) |
| `vendor-*.js`, `*.woff2` | Mitgelieferte Bibliotheken und Schriften, siehe `LICENSES.txt` |

## Was geprüft ist und was nicht

Geprüft, automatisch und wiederholbar:

- Die Rechenlogik mit rund 27'000 Einzelprüfungen: Aufteilen auf den Rappen genau, Umrechnen, Ausgleich mit möglichst wenigen Zahlungen, Lesen von Beträgen («1'234.50», «12,5», «1.500»), Umgang mit unsinnigen oder manipulierten Daten.
- Die Tageskurse mit einer stellbaren Uhr und einem nachgestellten Netz: Wochenenden, Kurs vor und nach 16 Uhr, Ausfall einer Quelle, hängende Antworten.
- Die ganze App in einem echten Browser (Chromium) mit rund 200 Prüfungen: Reisen, Buchungen, Kurse, Sicherung, Start ohne Netz, Zurück-Taste, die Leiste am unteren Rand, die Hinweise zum Installieren, die Anleitung zum Gruppen-Sync, Avatare, Meme-Karten und Konfetti. Der Gruppen-Sync wurde auf zwei Arten geprüft: mit der echten Firebase-Bibliothek ohne erreichbaren Server und mit einem nachgebauten Sync-Server und mehreren Geräten (beitreten, gleichzeitig ändern, ohne Netz buchen, freigeben, löschen, fehlende Datenbank, fehlende Regeln).

Nicht geprüft, weil es von hier aus nicht möglich war:

- der Betrieb mit einem echten Firebase-Projekt, einschliesslich der Regeln aus `firestore.rules`,
- die Kursdienste im echten Betrieb aus dem Browser,
- echte iPhones und Android-Handys (Installieren, Teilen-Menü, das Aussehen der Emojis auf dem jeweiligen Gerät),
- die Veröffentlichung auf GitHub Pages selbst.

Dafür ist der [Probelauf](#3-probelauf-vor-den-ferien) da.

## Lizenzen

Die mitgelieferten Bibliotheken und Schriften stehen unter freien Lizenzen: Firebase JavaScript SDK und htm (Apache 2.0), Preact und qrcode-generator (MIT), die Schriften Fredoka, Anton und IBM Plex Mono (SIL Open Font License 1.1). Die Emojis zeichnet jedes Gerät mit seiner eigenen Emoji-Schrift. Die vollständigen Angaben und Texte stehen in [`LICENSES.txt`](LICENSES.txt).
