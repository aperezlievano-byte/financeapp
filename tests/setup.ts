// Vitest setup file. It deliberately imports nothing from the project: it
// runs before any migration exists and before the Prisma client is generated,
// so importing either would break the very first gate.
//
// Its whole job is to refuse to run the suite against anything but the test
// database. Integration tests truncate tables; pointed at the dev database
// they would delete the user's real ledger.
const url = process.env.DATABASE_URL || "";

if (!url.endsWith("_test")) {
  throw new Error(
    `Refusing to run tests against "${url || "<unset>"}". DATABASE_URL must ` +
      "end with _test. Run the suite with `pnpm test`, which goes through " +
      "scripts/with-test-env.sh.",
  );
}
