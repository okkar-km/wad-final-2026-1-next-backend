# How to Test the App

Online Course Service built with a Next.js API, a React/Vite frontend, and MongoDB.

## Student Information

- **Student Name:** Okkar Kaung Myat
- **Student ID:** 6632104

## Submission Links


| Item | Link |
| --- | --- |
| Backend source (`next-backend/`) | https://github.com/okkar-km/wad-final-2026-1-next-backend |
| Frontend source (`react-frontend/`) | https://github.com/okkar-km/wad-final-2026-1-react-frontend |
| Deployed backend | https://wad-final-2026-1-next-backend.vercel.app |
| Deployed frontend | https://wad-final-2026-1-react-frontend.vercel.app |

## Test Credentials

Log in using the **email address**. These six accounts are created by the seed script.

| Role | Username | Email | Password |
| --- | --- | --- | --- |
| Student | student1 | student1@example.com | `Exam2026!` |
| Student | student2 | student2@example.com | `Exam2026!` |
| Student | student3 | student3@example.com | `Exam2026!` |
| Teacher | teacher1 | teacher1@example.com | `Exam2026!` |
| Teacher | teacher2 | teacher2@example.com | `Exam2026!` |
| Teacher | teacher3 | teacher3@example.com | `Exam2026!` |

Passwords are stored as bcrypt hashes. Rerunning the seed script preserves existing accounts and their passwords.

## Prerequisites

- Node.js **22.12 or later**, with npm.
- A MongoDB instance reachable from the backend, and a connection string with read/write access.
- Database name: **`Online-Course-Service`** (use this exact spelling).
- Two terminal windows for running the backend and frontend separately.

The seed script creates the `users` collection. The `courses` collection is created when the first course is saved. Enrollment is stored as Student ObjectIds in each course's `enrolledStudentIds` array.

## How to Run & Test

Run the following commands from the repository root unless otherwise stated.

### 1. Backend Setup (`next-backend/`)

Install dependencies:

```bash
npm ci --prefix next-backend
```

Create `next-backend/.env.local`:

```env
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@YOUR_CLUSTER/Online-Course-Service?retryWrites=true&w=majority
JWT_SECRET=REPLACE_WITH_A_RANDOM_SECRET
```

Use your actual MongoDB connection string. Generate a JWT secret with:

```bash
openssl rand -hex 32
```

Paste the generated value into `JWT_SECRET`. Keep `.env.local` out of Git; never put actual database credentials or the JWT secret in this README.

Create the test users:

```bash
node --env-file=next-backend/.env.local next-backend/scripts/seed.mjs
```

Start the API server:

```bash
npm run dev --prefix next-backend
```

The expected backend address is `http://localhost:3000`. Keep this terminal running.

### 2. Frontend Setup (`react-frontend/`)

In a second terminal, install dependencies:

```bash
npm ci --prefix react-frontend
```

Create `react-frontend/.env.local`:

```env
VITE_API_URL=http://localhost:3000
```

The value is the backend origin without `/api`. Use the backend's actual port if it differs from 3000.

Start the frontend:

```bash
npm run dev --prefix react-frontend
```

Open `http://localhost:5173/#/login`, or the frontend address printed by Vite. Local CORS currently allows `http://localhost:5173`, so use that origin for the walkthrough.

Restart the relevant development server after changing environment variables. Browser requests include credentials so the backend's HTTP-only `token` cookie can maintain the session.

### 3. Testing Walkthrough

Sign out before switching accounts in the same browser. Use new test courses so existing data does not affect the capacity tests.

1. **Authentication:** Log in with an incorrect password and check that an error appears. Log in as `teacher1@example.com` with `Exam2026!`. Refresh the page and confirm that the user remains signed in. Sign out and verify that protected frontend pages redirect to login.
2. **Create a course:** As Teacher 1, open **My Teaching Courses > Create Course**. Enter name `Grading Test`, duration `5`, topics `Components` and `Hooks` on separate lines, price `1500`, maximum Students `2`, and status `Open`. Submit and verify the details and success message. Save the course details URL for the ownership test.
3. **Update a course:** Click **Edit Course**. Verify the fields are prefilled, change the duration to `7` and price to `1800`, and save. Refresh the details page and verify the changes persist. Check that blank required fields and invalid numeric values prevent saving.
4. **Teacher ownership:** Sign in as Teacher 2. Teacher 1's course must not appear in Teacher 2's list. Open the saved details URL and then that URL with `/edit` appended; both should report that the course was not found. Teacher 3 can create a separate course to verify that each Teacher has an independent list.
5. **Student catalog and search:** Sign in as Student 1. Open **Browse Courses**. Search using part of a course name, then a Teacher name such as `teacher1`. Confirm that matching results appear and an unmatched search shows an empty result.
6. **Enrollment and duplicates:** Open `Grading Test` as Student 1 and enroll. Confirm that the enrollment count increases, the button changes to **Already enrolled**, and the course appears in **My Enrolled Courses**. A repeated direct enrollment request must return `409`.
7. **Capacity:** Sign in as Student 2 and enroll in the same two-seat course. Sign in as Student 3 and verify that the course is full and enrollment is disabled. A direct enrollment request for Student 3 must return `409`.
8. **Teacher's enrolled Students:** Sign in as Teacher 1 and open the course. Both enrolled Students' usernames and emails should appear. Deletion must be disabled. Attempting to reduce maximum Students below two must fail.
9. **Course statuses:** As Teacher 1, increase capacity to `3` and change status to `Close`. Student 3 should still see the course but cannot enroll. Change status to `Cancel`; the course should disappear from Student lists and reject enrollment. Teacher 1 should still see it. Restore `Open` for further testing.
10. **Delete an empty course:** As Teacher 1, create a separate course named `Delete Test`. Open its details and click **Delete Course**. Cancel the dialog and confirm the course remains. Open the dialog again and confirm deletion. The course should disappear from the list.
11. **Role restrictions:** Students should have no create/edit/delete controls. Visiting `/#/courses/new` or an edit URL as a Student should redirect home. Direct API requests to create, update, or delete courses as a Student must return `403`.
12. **Profile privacy:** After login, request `/api/user` and `/api/auth/me`. Both should return the current user's ID, username, email, and role without a password or password hash. Requesting another user's valid ID through `/api/user/:user_id` must return `403`.

### 4. API Checks

Without a cookie, protected API requests should return `401`:

```bash
curl -i http://localhost:3000/api/course
curl -i http://localhost:3000/api/user
```

Log in and save a Student cookie:

```bash
curl -i -c /tmp/course-student-cookies.txt \
  http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  --data '{"email":"student1@example.com","password":"Exam2026!"}'
```

Check the authenticated profile and enrolled courses:

```bash
curl -i -b /tmp/course-student-cookies.txt http://localhost:3000/api/user
curl -i -b /tmp/course-student-cookies.txt 'http://localhost:3000/api/course?enrolled=true'
```

Course-specific endpoints use the actual MongoDB course `_id` from the list or creation response, not the literal text `COURSE_ID`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/auth/login` | Authenticate using email and password |
| GET | `/api/auth/me` | Restore the current session |
| POST | `/api/auth/logout` | Clear the login cookie |
| GET | `/api/user` | Current user's profile |
| GET | `/api/user/:user_id` | Own profile only |
| GET | `/api/course?q=TEXT` | Role-filtered course list and optional search |
| GET | `/api/course?enrolled=true` | Student's enrolled, non-cancelled courses |
| POST | `/api/course` | Teacher creates a course |
| GET | `/api/course/:course_id` | Permitted course details |
| PUT | `/api/course/:course_id` | Owning Teacher updates all editable course fields |
| DELETE | `/api/course/:course_id` | Owning Teacher deletes an empty course |
| POST | `/api/course/:course_id/enroll` | Student enrolls in an Open course with a remaining seat |

Enrollment checks status, remaining capacity, and duplicate membership within one database update. Updates and deletion also enforce ownership and enrollment restrictions in the database query.

## Lint and Production Builds

```bash
npm run lint --prefix next-backend
npm run lint --prefix react-frontend
npm run build --prefix next-backend
npm run build --prefix react-frontend
```

The backend's starter page uses Google Fonts, so its production build needs access to Google Fonts. The frontend build output is `react-frontend/dist/`.

## Deployment on Vercel

Keep both applications in the same GitHub repository and create two Vercel projects with different Root Directories, as described in the [Vercel monorepo guide](https://vercel.com/docs/monorepos).

| Setting | Backend project | Frontend project |
| --- | --- | --- |
| Root Directory | `next-backend` | `react-frontend` |
| Framework Preset | Next.js | Vite |
| Install Command | `npm ci` | `npm ci` |
| Build Command | `npm run build` | `npm run build` |
| Output Directory | Use the Next.js preset default | `dist` |
| Environment variables | `MONGODB_URI`, `JWT_SECRET` | `VITE_API_URL` |

1. Push the completed code to your own GitHub repository and import that repository into Vercel.
2. Deploy the backend project with its database connection and JWT secret configured. Confirm that MongoDB network access permits the deployed backend to connect. Seed the same database with the test users if it is a new database.
3. Deploy the frontend project with `VITE_API_URL` set to the backend's HTTPS origin, without `/api` or a trailing slash.
4. In `next-backend/src/lib/cors.js`, replace the production placeholder `https://production.app` with the exact deployed frontend origin. Commit that change and redeploy the backend. The origin must match the frontend's scheme and hostname and must not contain a path or trailing slash.
5. After changing environment variables, create a new deployment so the changes take effect. Vite exposes `VITE_` variables to frontend code; keep database credentials and JWT secrets in the backend project only. See [Vercel environment variables](https://vercel.com/docs/environment-variables) and [Vite deployment guidance](https://vercel.com/docs/frameworks/frontend/vite).
6. Test browser login, page refresh, Teacher course management, and Student enrollment against the production URLs. Production cookies use HTTPS and `SameSite=None`; verify the browser accepts and sends the cookie for the chosen frontend/backend origins.
7. Ensure the grader can access both deployment URLs, then replace the submission-link placeholders at the top of this README and add the screen/camera recording link.
