# Gruppo Bravo inventory

Men’s wholesale apparel inventory for **Gruppo Bravo**. React (Next.js App Router), Tailwind CSS, and Supabase.

## Setup

1. Create a [Supabase](https://supabase.com) project (free tier is fine).
2. In the SQL editor, run `supabase/migrations/0001_init.sql`, then `supabase/seed.sql`.
3. Copy `.env.local.example` to `.env.local` and set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. In Supabase Authentication, create users (email/password). After signup, set `profiles.role` to `admin`, `warehouse`, `sales_rep`, or `customer`. The first admin can be set in the Table Editor (`profiles.role = admin`). New Auth users get a `profiles` row via trigger (default role `customer` unless `user_metadata.role` is passed).
5. `npm install` then `npm run dev`.

## Deploy (Vercel)

- Push this repo to GitHub and import the project in Vercel.
- Set the same two `NEXT_PUBLIC_SUPABASE_*` environment variables in the Vercel project.

## Domain notes

- A **product** is lot number + model.
- Inventory is a **size × drop** matrix (sizes as columns, drops as rows). Non-standard prices show as `qty^{+upcharge}`.
- **Cutting orders** (from vendors) list products and an arrival date; receiving posts a cutting shipment matrix into stock.
- **Customer shipments** deduct stock when marked **shipped**. Sage **account number** is the optional unique link to Sage Accounting (not generated).
- Excel import uses saved **templates** that map source headers to destination fields and link keys.

Currency for prices is USD in this version.
