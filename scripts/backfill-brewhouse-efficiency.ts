/* eslint-disable no-console -- CLI script: console output is the intended UX */
/**
 * One-time backfill: equipment.mashEfficiencyPercent → equipment.brewhouseEfficiencyPercent
 *
 * The field was renamed June 2026 (it was always brewhouse efficiency — OG is
 * referenced to post-boil/fermenter volume). The deployed app already WRITES the
 * new key and READS both (via normalizeRecipe), so nothing breaks without this.
 * Run this AFTER deploying the renamed code to tidy existing documents, so the
 * read-shim can eventually be removed.
 *
 * Scope: the `recipes` collection only (user + public recipes share it). Custom
 * equipment *profiles* use a different shape (mashEfficiency / brewhouseEfficiency,
 * no "...Percent") and are unaffected. Version snapshots live in per-device
 * localStorage and are handled by the read-shim, not here.
 *
 * SAFETY: dry-run by default. Take a Firestore backup/export before --apply.
 *
 * Usage:
 *   FIREBASE_ADMIN_KEY='<service-account-json>' npx tsx scripts/backfill-brewhouse-efficiency.ts           # dry run
 *   FIREBASE_ADMIN_KEY='<service-account-json>' npx tsx scripts/backfill-brewhouse-efficiency.ts --apply   # write changes
 */
import {
  initializeApp,
  getApps,
  cert,
  type ServiceAccount,
} from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const APPLY = process.argv.includes("--apply");

function getDb() {
  if (getApps().length === 0) {
    const key = process.env.FIREBASE_ADMIN_KEY;
    if (!key) throw new Error("FIREBASE_ADMIN_KEY environment variable is not set");
    initializeApp({ credential: cert(JSON.parse(key) as ServiceAccount) });
  }
  return getFirestore();
}

async function main() {
  const db = getDb();
  const snap = await db.collection("recipes").get();

  const toMigrate: Array<{ id: string; value: number }> = [];
  let scanned = 0;

  snap.forEach((doc) => {
    scanned++;
    const eq = (doc.data().equipment ?? {}) as Record<string, unknown>;
    const legacy = eq.mashEfficiencyPercent;
    const current = eq.brewhouseEfficiencyPercent;
    if (typeof legacy === "number" && current == null) {
      toMigrate.push({ id: doc.id, value: legacy });
    }
  });

  console.log(
    `Scanned ${scanned} recipes — ${toMigrate.length} need migration, ${scanned - toMigrate.length} already current.`,
  );

  if (!APPLY) {
    console.log("\nDRY RUN — no writes. Re-run with --apply to migrate.");
    toMigrate.slice(0, 10).forEach((u) =>
      console.log(`  would set ${u.id}: brewhouseEfficiencyPercent = ${u.value} (delete mashEfficiencyPercent)`),
    );
    if (toMigrate.length > 10) console.log(`  …and ${toMigrate.length - 10} more`);
    return;
  }

  // Firestore caps a batch at 500 writes; stay well under.
  let written = 0;
  for (let i = 0; i < toMigrate.length; i += 400) {
    const batch = db.batch();
    for (const u of toMigrate.slice(i, i + 400)) {
      batch.update(db.collection("recipes").doc(u.id), {
        "equipment.brewhouseEfficiencyPercent": u.value,
        "equipment.mashEfficiencyPercent": FieldValue.delete(),
      });
    }
    await batch.commit();
    written += Math.min(400, toMigrate.length - i);
    console.log(`  committed ${written}/${toMigrate.length}`);
  }

  console.log(`\nDone. Migrated ${written} recipes.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
