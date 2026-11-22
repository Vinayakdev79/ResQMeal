# ResQMeal Supabase setup

## 1. Run the schema
1. Open your project in the Supabase dashboard and go to **SQL Editor**.
2. Click **New query**, paste the full contents of `migrations/001_schema.sql`, and click **Run**.
3. The script is idempotent, so it is safe to run again after changes.

## 2. Enable Email auth
Go to **Authentication → Providers → Email** and make sure it is enabled.

## 3. Set URLs for local development
Go to **Authentication → URL Configuration**:
- **Site URL:** `http://localhost:5173`
- **Redirect URLs:** add `http://localhost:5173`

## 4. Create the first admin
1. Sign up through the app (or **Authentication → Users → Add user**) with the email you want as admin.
2. Copy that user's UUID from **Authentication → Users**.
3. In the SQL Editor, run (replacing the placeholder):

```sql
update profiles set role = 'admin' where id = '<uuid>';
```

Admins cannot be created through signup; this step must be done manually.
