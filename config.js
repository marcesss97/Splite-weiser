/* Ferienkasse: Einstellungen dieser Installation.

   GRUPPEN-SYNC
   Solange unten "null" steht, speichert die Ferienkasse jede Reise nur auf dem Gerät, auf dem sie angelegt wurde.
   Damit die ganze Gruppe eintragen kann, ersetzt du die eine Zeile

       const firebaseConfig = null;

   durch den Block aus deinem Firebase-Projekt (Firebase-Konsole: Projekteinstellungen, Abschnitt "Meine Apps",
   Web-App, Auswahl "Config"). Der Block beginnt mit "const firebaseConfig = {" und endet mit "};".
   Die Schritte stehen im README, Abschnitt "Gruppen-Sync einrichten". So sieht es danach aus:

       const firebaseConfig = {
         apiKey: "AIzaSy...",
         authDomain: "mein-projekt.firebaseapp.com",
         projectId: "mein-projekt",
         storageBucket: "mein-projekt.firebasestorage.app",
         messagingSenderId: "123456789012",
         appId: "1:123456789012:web:abcdef0123456789"
       };

   Diese Werte sind keine Passwörter. Sie sagen dem Browser nur, welches Firebase-Projekt gemeint ist.
   Geschützt werden die Daten durch die Regeln aus der Datei firestore.rules. */

const firebaseConfig = {
  apiKey: "AIzaSyBoxXxX0WBFLoK4aDwSsf06fT0W8QTs6Uo",
  authDomain: "splite-weiser-cf091.firebaseapp.com",
  projectId: "splite-weiser-cf091",
  storageBucket: "splite-weiser-cf091.firebasestorage.app",
  messagingSenderId: "18964279601",
  appId: "1:18964279601:web:03099143f60fe0e248c010"
};

/* Ab hier nichts ändern. */
window.FERIENKASSE_CONFIG = { firebase: firebaseConfig };
