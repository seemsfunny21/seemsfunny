PEGASUS 237

Code-only package. No bundled images or videos.

Main fixes:
- The morning PEGASUS report now attaches a daily full user-data backup inside the email.
- Manual JSON export now uses the same complete user-data collector, not only the older manifest list.
- Backup avoids recursive old backups/logs and does not include PIN/master/API/vault secrets.
- Permanent local cache bumped to v237.

After upload:
1. Open PEGASUS once and let the local storage loader reach 100% for v237.
2. The next morning report will include the backup JSON section under the existing nutrition/advice field.
3. Keep avoiding manual JSONBin overwrite scripts; this version protects future recovery better.


PEGASUS 300: During rest, a small top-left video preview shows the next exercise.
