# Run Nilayam on your computer

1. Install **Docker Desktop** (Windows/Mac) and start it.
2. Open a terminal in this folder and run:

   ```
   docker compose up --build
   ```

3. Open **http://localhost:5173** (first start takes a few minutes).
4. Optional — add sample listings (in a second terminal):

   ```
   docker compose exec api python -m scripts.seed_demo
   ```

Stop with `Ctrl+C`. Data is kept between runs; `docker compose down -v` wipes it.

Admin (`http://localhost:5173/admin`) needs a Supabase project: put its URL and anon key in
`frontend/.env.local` (see `frontend/.env.example`) and create the founder user there.
