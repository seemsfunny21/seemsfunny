# PEGASUS 307 — Maintenance / Regression audit

## Βάση

Το RAR που ανέβασε ο χρήστης περιέχει ακριβώς τα ίδια 97 αρχεία (SHA-256 ανά αρχείο) με το προηγούμενο `PEGASUS_306` που είχε δοθεί. Η 306 αναφέρεται από τον χρήστη ως πλήρως λειτουργική.

## Αλλαγές στον κώδικα παραγωγής

- `sw.js`: μόνο αλλαγή `PEGASUS_STORAGE_VERSION` από 306 σε 307. Νέα cache namespace χωρίς διαγραφή παλιών μόνιμων caches/βίντεο.
- `index.html`: SW registration URL `?v=3.36.307` αντί `?v=3.36.303`.
- `app.js`: SW registration URL `?v=3.36.307` αντί `?v=3.36.304`.
- `mobile/mobile.html`: SW registration URL από `?v=304.0.0` σε `?v=3.36.307`, και ενοποίηση έκδοσης σε ήδη υπάρχοντα query strings `.js/.css` από 301/305 σε 307. **Δεν άλλαξε άλλο HTML ή λειτουργικό JS.**
- `README.md`, `RELEASE_NOTES.txt`, `docs/MAINTENANCE.md`: επικαιροποίηση τεκμηρίωσης.
- `tests/regression.test.js`: επαναλαμβανόμενοι στατικοί/behavior έλεγχοι.

## Δεν άλλαξαν

- `style.css` και `mobile/style.css`, όλα τα στοιχεία εμφάνισης, το πρόγραμμα ασκήσεων, τους στόχους/σετ, το `dynamic.js`, το `pegasusBrain.js`, το `manifest.js`, το `i18n.js`, τα αρχεία media ή δεδομένα browser.
- Ο τοπικός χαρακτήρας της εφαρμογής (χωρίς cloud sync), η συμπεριφορά backup, οι ρυθμίσεις, οι τρόποι λειτουργίας.

## Έλεγχοι

- `node tests/regression.test.js`: **9 / 9 ομάδες PASS** (μηδενισμός και DST, παλιά δεδομένα, weekday upgrade, Σάββατο, delayed optimizer, GR/EN, SW URLs, assets, syntax).
- Browser component check (Chromium, μεμονωμένο DOM και `i18n.js`): εναλλαγή ελληνικών/αγγλικών με αμετάβλητα `data-name` → PASS.
- **Περιορισμός:** η πλοήγηση στοπική/localhost μέσω Chromium αποκλείστηκε από τον διαχειριστή του περιβάλλοντος (`ERR_BLOCKED_BY_ADMINISTRATOR`). Συνεπώς δεν έγινε πλήρες end-to-end browser run. Χρειάζεται ανθρώπινη δοκιμή σε desktop/mobile πριν τη βεβαιότητα για όλες τις λειτουργίες.

## Αξιολόγηση ρίσκου

Χαμηλό, επειδή διατηρούνται byte-for-byte τα runtime modules πέρα από παραμέτρους cache και version. Η αλλαγή cache μπορεί να επηρεάσει την πρώτη offline εγκατάσταση αν διακοπεί το δίκτυο πριν ολοκληρωθεί. Κρατήστε τα παλιά caches και videos ως fallback.
