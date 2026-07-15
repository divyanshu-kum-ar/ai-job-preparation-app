# Production Deployment Guide - Render

This guide outlines the steps and configurations required to deploy this Job Preparation App to Render.

---

## 1. Deployment Architecture

The application is split into two services:
- **Backend**: Express API Web Service (containerized/Node.js environment).
- **Frontend**: Vite Single Page Application (Static Site environment).

---

## 2. Backend Render Settings

Create a new **Web Service** on Render with the following configuration:

- **Name**: `job-prep-api`
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Instance Type**: `Web Service` (Free or higher; note that Puppeteer runs more reliably on paid instances with more memory, minimum Starter tier).

### Backend Environment Variables
Add these in the **Environment** tab of your Render Web Service:

| Variable Name | Example/Description |
| :--- | :--- |
| `PORT` | `3000` (Render will override this automatically, which is normal) |
| `NODE_ENV` | `production` |
| `MONGO_URI` | `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<dbname>` |
| `JWT_SECRET` | `your-high-entropy-jwt-secret-key` |
| `GOOGLE_GENAI_API_KEY` | `your-google-gemini-api-key` |
| `CLIENT_URL` | `https://your-frontend-site.onrender.com` (Vite static URL on Render) |

---

## 3. Frontend Render Settings

Create a new **Static Site** on Render with the following configuration:

- **Name**: `job-prep-app`
- **Build Command**: `npm install && npm run build`
- **Publish Directory**: `dist`

### SPA Routing Rule (Rewrites)
To support client-side routing (React Router) without showing 404 errors on reload:
1. Go to your Static Site's settings on Render.
2. Under **Redirects/Rewrites**, click **Add Rule**.
3. Configure the rule as:
   - **Source**: `/*`
   - **Destination**: `/index.html`
   - **Action**: `Rewrite`

### Frontend Environment Variables
Add this in the **Environment** tab of your Render Static Site:

| Variable Name | Value |
| :--- | :--- |
| `VITE_API_URL` | `https://your-backend-api.onrender.com` (Your deployed Render Backend URL) |

---

## 4. Puppeteer Linux Setup on Render

Because this application dynamically prints ATS Resume PDFs using Puppeteer, you need to ensure the system dependencies of Chrome/Chromium are installed on Render's Linux host.

### Adding Native Chrome Buildpack
Under your Render Web Service **Settings** page:
1. Scroll down to the **Buildpacks** section.
2. Add the following buildpack URL:
   - `https://github.com/jontewks/puppeteer-heroku-buildpack`
   *Or* build the backend using a custom Dockerfile to ensure all dependencies for headless Chromium are present.

### Sandbox Settings
The Puppeteer launch script in `Backend/src/services/ai.service.js` is already configured with flags suitable for container execution:
```javascript
const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
})
```

---

## 5. MongoDB Atlas Settings
1. Go to your MongoDB Atlas dashboard.
2. In the **Network Access** tab, add `0.0.0.0/0` (Allow access from anywhere) so that Render servers can connect to your cluster.
3. Obtain the connection string and set it in `MONGO_URI`.

---

## 6. Gemini API Setup
1. Go to Google AI Studio.
2. Create and copy your API key.
3. Configure it in `GOOGLE_GENAI_API_KEY` on Render.

---

## 7. Render Deployment Order
1. Deploy the **Backend Web Service** first. Copy the generated URL (e.g., `https://job-prep-api.onrender.com`).
2. Deploy the **Frontend Static Site**. Provide the `VITE_API_URL` environment variable using the Backend's URL.
3. Copy the Frontend static site URL (e.g., `https://job-prep-app.onrender.com`).
4. Update the **Backend** environment variables to set `CLIENT_URL` to this Frontend URL. This enables production-safe CORS.

---

## 8. Common Deployment Issues
- **Backend Cold Start**: On Render's Free tier, the backend spins down after 15 minutes of inactivity. The initial call to `/api/health` or `/api/auth/get-me` might take ~50 seconds to respond as the instance wakes up.
- **Puppeteer Memory Crashes**: Headless PDF printing requires significant RAM. If PDF generation fails or hangs, check Render metrics for memory crashes and upgrade the instance tier if needed.
- **CORS Errors**: Ensure that `CLIENT_URL` in the backend matches the frontend URL exactly (no trailing slash).

---

## 9. Post-Deployment Testing Checklist
- [ ] Verify homepage loads at `https://<frontend-subdomain>.onrender.com`
- [ ] Register a new user
- [ ] Log out and log back in
- [ ] Start an interview and submit resume (Verify mammoth parsing works)
- [ ] Review Gemini-generated interview strategy & questions
- [ ] Download generated ATS resume PDF (Verify Puppeteer rendering works)
- [ ] Delete interview report
