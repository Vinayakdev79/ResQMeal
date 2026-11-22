# ResQMeal Web

Frontend for ResQMeal, a smart food rescue and impact platform for the Mathura pilot.
Built with React, TypeScript, Vite and Tailwind CSS.

**All data in this project is synthetic.** ResQMeal coordinates food donations and does not
certify food safety or guarantee that food is safe to consume.

## Run locally (Windows PowerShell)

```powershell
cd ResQMeal\web
npm install
npm run dev
```

Build for production:

```powershell
npm run build
```

Output is written to `dist`.

## Deploy to Vercel

1. Import the repository in Vercel.
2. Set the framework preset to **Vite**.
3. Set the output directory to `dist`.
4. Deploy. `vercel.json` rewrites all routes to `index.html`.

## Deploy to Netlify

1. Create a new site from the repository.
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Deploy. `public/_redirects` handles client-side routing.
