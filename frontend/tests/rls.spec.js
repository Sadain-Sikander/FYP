import { test, expect } from "@playwright/test";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

test("PostgreSQL policies isolate users for every saved-data table", async () => {
  // Real PostgreSQL policy execution in WASM. Only the Supabase identity function
  // is simulated; this does not test hosted JWT validation or email delivery.
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated;
      grant usage on schema public to authenticated, anon;
      insert into auth.users values
        ('11111111-1111-4111-8111-111111111111'),
        ('22222222-2222-4222-8222-222222222222');
    `);
    await db.exec(
      await readFile(
        "../supabase/migrations/202610200001_user_data.sql",
        "utf8",
      ),
    );
    const userA = "11111111-1111-4111-8111-111111111111";
    const userB = "22222222-2222-4222-8222-222222222222";
    for (const table of ["profiles", "saved_careers", "saved_roadmaps"]) {
      await db.exec(
        `reset role; set role authenticated; set request.jwt.claim.sub = '${userA}';`,
      );
      const columns =
        table === "profiles" ? "user_id,data" : "user_id,data,career_id";
      const extra = table === "profiles" ? "" : ",'example-career'";
      await db.exec(
        `insert into public.${table} (${columns}) values ('${userA}', '{"owner":"A"}'${extra});`,
      );
      await expect(
        db.exec(
          `insert into public.${table} (${columns}) values ('${userB}', '{}'${extra});`,
        ),
      ).rejects.toThrow(/row-level security/);
      await db.exec(`set request.jwt.claim.sub = '${userB}';`);
      expect(
        (await db.query(`select * from public.${table}`)).rows,
      ).toHaveLength(0);
      expect(
        (await db.query(`update public.${table} set data='{}' returning *`))
          .rows,
      ).toHaveLength(0);
      expect(
        (await db.query(`delete from public.${table} returning *`)).rows,
      ).toHaveLength(0);
      await db.exec(
        `insert into public.${table} (${columns}) values ('${userB}', '{"owner":"B"}'${extra});`,
      );
      await expect(
        db.exec(`update public.${table} set user_id = '${userA}'`),
      ).rejects.toThrow();
      await db.exec(`set request.jwt.claim.sub = '${userA}';`);
      expect((await db.query(`select data from public.${table}`)).rows).toEqual(
        [{ data: { owner: "A" } }],
      );
      expect(
        (
          await db.query(
            `update public.${table} set data='{"updated":true}' returning data`,
          )
        ).rows,
      ).toEqual([{ data: { updated: true } }]);
      await expect(
        db.exec(`update public.${table} set data='[]'`),
      ).rejects.toThrow(/check constraint/);
      await db.exec(`reset role; set role anon;`);
      await expect(db.query(`select * from public.${table}`)).rejects.toThrow(
        /permission denied/,
      );
    }
    await db.exec(`reset role; delete from auth.users where id='${userA}';`);
    for (const table of ["profiles", "saved_careers", "saved_roadmaps"]) {
      const rows = (await db.query(`select user_id from public.${table}`)).rows;
      expect(rows).toEqual([{ user_id: userB }]); // Account deletion cascades only its data.
    }
  } finally {
    await db.close();
  }
});
