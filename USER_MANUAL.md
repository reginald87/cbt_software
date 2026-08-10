# BMU CBT System — User Manual

**Bayelsa Medical University — Computer Based Testing System**

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Getting Started — First-Time Setup](#2-getting-started--first-time-setup)
3. [Admin Guide](#3-admin-guide)
4. [Student Guide](#4-student-guide)
5. [Exam Lifecycle](#5-exam-lifecycle)
6. [Grading System](#6-grading-system)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. System Overview

The BMU CBT System is a web-based examination platform that allows administrators to create, manage, and monitor exams while students take timed tests from any device with a web browser on the campus network.

### Key Features

- **Timed Exams** — Auto-submits when time expires
- **Question Shuffling** — Randomised question and answer order per student
- **Per-Student Papers** — If a "Questions per Student" limit is set, each student gets a random subset of the question bank, drawn when they start
- **Multiple Question Types** — Multiple Choice, True/False, Fill-in-the-Blank, Short Answer, Math, Chemistry, Physics, Biology, Comprehension
- **Auto-Grading** — MCQ, True/False, and Fill-in-the-Blank are graded automatically
- **Security Monitoring** — Auto-submits the exam on the first tab switch, IP lock, session tracking
- **CSV Import/Export** — Bulk student and question upload via CSV files
- **Live Monitoring** — Admins can watch active exam sessions in real time

### User Roles

| Role | Access Level |
|------|-------------|
| **Administrator** | Full access — create exams, manage users, view all results, monitor sessions |
| **Staff** | Limited admin access (if enabled) |
| **Matriculated Student** | Takes exams, views own results |
| **100-Level Student** | Takes exams, views own results |
| **Intending Student** | Takes exams, views own results |

---

## 2. Getting Started — First-Time Setup

### 2.1 Installing on the Server Laptop

1. Clone the repository from GitHub:
   ```
   git clone https://github.com/reginald87/cbt_software.git
   ```

2. Run the one-time setup script:
   - Double-click **`setup_lan.bat`**
   - This installs all dependencies and builds the frontend for production
   - Wait until you see "Build complete!"

### 2.2 Starting the System (Each Exam Day)

1. In **Windows File Explorer** (not inside VSCode's file tree), double-click **`start_lan.bat`**
2. The script automatically detects the server's IP address and rewrites `.env`
3. Two windows will open:
   - **Backend** — Django under **Waitress** (production server) on port 8000
   - **Frontend** — Next.js production build on port 3000
4. Students can now access the system at: `http://<server-IP>:3000`
5. The IP address will be displayed in the startup window

> **Note:** If `start_lan.bat` opens as code inside VSCode, you double-clicked it in VSCode's file explorer panel — that panel always opens files as text. Double-click it in **Windows Explorer** instead, or run it from a terminal with `.\start_lan.bat`.

### 2.3 Updating the System (After a Git Pull)

Whenever new code is pushed to GitHub, the server laptop must be updated before students can use the new features:

1. Open a terminal in the repo folder and pull the latest code:
   ```
   git pull
   ```
2. Install the latest backend dependencies:
   ```
   bmu_cbt\venv\Scripts\python.exe -m pip install -r bmu_cbt\requirements_new.txt
   ```
   This upgrades packages such as `django-jazzmin` (fixes the admin panel pagination error with many users).
3. Apply any database migrations:
   ```
   bmu_cbt\venv\Scripts\python.exe bmu_cbt\manage.py migrate
   ```
4. Rebuild the frontend so the new code is compiled into the production build:
   - Run **`setup_lan.bat`** (installs frontend dependencies and builds), **or** run manually:
     ```
     cd bmu_cbt\frontend
     npm install
     npm run build
     ```
5. Start the system with **`start_lan.bat`** — it auto-detects the server's IP, updates `.env`, and launches both servers.

**Important**
- The backend must run under **Waitress** (this is what `start_lan.bat` does). **Do not use `manage.py runserver`** on exam day — it is the development server and cannot handle many concurrent students.
- Always use the production frontend: `npm run build` followed by `next start` (which is what `start_lan.bat` runs). **Do not use `npm run dev`** — it is only for development and is not suited to serving students.
- Ensure Windows Firewall allows inbound connections on ports **3000** (frontend) and **8000** (backend), otherwise students cannot reach the system.
- The frontend detects the API address automatically from the browser address bar, so no URL configuration is needed after changing the laptop's IP — only `.env` (updated automatically by `start_lan.bat`) and the firewall rules matter.

### 2.4 Accessing the Admin Panel

- **URL:** `http://<server-IP>:8000/admin/`
- Login with the admin superuser credentials
- Default admin accounts: `BMU-0519`, `BMU-2748`, `BMU-7694`

### 2.5 Installing on a New Machine (XAMPP + MariaDB)

Git does **not** contain the virtual environment, Node packages, the built frontend, `.env`, uploaded media, or the database — all of these are recreated on each machine. To set up a second server or replace the exam laptop:

1. **Install prerequisites:**
   - Python 3.13
   - Node.js (LTS)
   - XAMPP — MariaDB is included; start **MySQL** in the XAMPP Control Panel (it listens on port 3306)

2. **Clone the repository** and open a terminal in it:
   ```
   git clone https://github.com/reginald87/cbt_software.git
   cd cbt_software
   ```

3. **Backend dependencies** (create the venv where the startup script expects it):
   ```
   python -m venv bmu_cbt\venv
   bmu_cbt\venv\Scripts\python.exe -m pip install -r bmu_cbt\requirements_new.txt
   ```

4. **Frontend dependencies and build** (`.next` is not stored in git, so it must be built):
   ```
   cd bmu_cbt\frontend
   npm install
   npm run build
   ```

5. **Create the database and user in XAMPP's MariaDB.** The credentials below must match `start_lan.bat`, because the script rewrites `.env` with them on every start. Run this via phpMyAdmin or the MariaDB shell:
   ```sql
   CREATE DATABASE cbt CHARACTER SET utf8mb4;
   CREATE USER 'cbt_user'@'localhost' IDENTIFIED BY 'BMUcbt@2026';
   CREATE USER 'cbt_user'@'127.0.0.1' IDENTIFIED BY 'BMUcbt@2026';
   GRANT ALL PRIVILEGES ON cbt.* TO 'cbt_user'@'localhost';
   GRANT ALL PRIVILEGES ON cbt.* TO 'cbt_user'@'127.0.0.1';
   FLUSH PRIVILEGES;
   ```
   To use different credentials, edit the `DB_*` lines near the top of `start_lan.bat`.

6. **Create the tables** (the new database starts empty):
   ```
   bmu_cbt\venv\Scripts\python.exe bmu_cbt\manage.py migrate
   ```

7. **Copy your data from the existing server.** On the old server, export:
   ```
   bmu_cbt\venv\Scripts\python.exe bmu_cbt\manage.py dumpdata --exclude contenttypes --exclude auth.Permission --exclude admin.logentry > data.json
   ```
   Copy `data.json` to the new machine and import it:
   ```
   bmu_cbt\venv\Scripts\python.exe bmu_cbt\manage.py loaddata data.json
   ```

8. **Copy the `bmu_cbt\media` folder** from the existing server (uploaded question images, screen and webcam recordings) — it is not in git.

9. **Open the Windows Firewall** for inbound ports **3000** and **8000** (Windows Firewall → Advanced Settings → Inbound Rules). `start_lan.bat` does not create the rules itself.

10. Double-click **`start_lan.bat`** (from Windows Explorer) to start the system.

---

## 3. Admin Guide

### 3.1 Creating an Exam

1. Log in to the CBT dashboard at `http://<server-IP>:3000`
2. Navigate to **Exams** → **Create Exam**
3. Fill in the exam details:

| Field | Description |
|-------|-------------|
| **Title** | Name of the exam (e.g., "BIO101 - General Biology") |
| **Category** | Select or create a subject category |
| **Duration** | Time limit in minutes (5–480) |
| **Passing Score** | Minimum percentage to pass (e.g., 50) |
| **Start Date** | When students can begin the exam |
| **End Date** | When the exam closes (no new starts after this) |
| **Total Questions** | Number of questions in the exam |
| **Questions per Student** | Random subset drawn for each student's paper (leave blank to give every student all questions) |

4. Configure exam settings:

| Setting | Default | Description |
|---------|---------|-------------|
| **Shuffle Questions** | On | Randomise question order per student |
| **Shuffle Options** | On | Randomise answer option order per student |
| **Show Answers** | Off | Show correct answers after submission |
| **Show Score** | On | Show score/grade after submission |
| **Allow Review** | On | Allow students to review before submitting |

5. Click **Create Exam**
6. The exam starts in **Draft** status — students cannot see it yet

### 3.2 Adding Questions

#### Adding Questions One by One

1. Open the exam from the Exams list
2. Click **Add Question**
3. For each question, provide:
   - **Question Text** — The question content
   - **Question Type** — Select from the dropdown (see Question Types below)
   - **Marks** — Points awarded for correct answer (default: 1)
   - **Order** — Display position in the exam
   - **Answer Options** — For MCQ and True/False questions, add answer choices and mark the correct one

4. Click **Save Question**

#### Importing Questions via CSV

1. Download the CSV template: **Exams** → **Download Questions Template**
2. Fill in the template with your questions (see format below)
3. Upload: **Exams** → **Import Questions** → Select your CSV file

**CSV Format for Questions:**

| Column | Description | Example |
|--------|-------------|---------|
| `exam_id` | Exam ID (optional, or use `exam_title`) | `3` |
| `exam_title` | Title of the exam the question belongs to | `BIO101 - General Biology` |
| `question_text` | The question | "What is the powerhouse of the cell?" |
| `question_type` | Type of question | `multiple`, `true_false`, `fill_blank`, `short`, `math`, `chemistry`, `physics`, `biology`, `comprehension` |
| `marks` | Points | `1` |
| `answer_options` | Answer choices separated by `\|` (for multiple) — options can contain LaTeX formulas | `Nucleus\|Mitochondria\|Ribosome` |
| `correct_answer` | Correct answer (for fill_blank, exact text). For multiple, must match one option exactly — can contain LaTeX | `Mitochondria` |
| `latex_content` | LaTeX equation (for math/chemistry) — displayed instead of `question_text` when present | `$x^2 + 5x + 6 = 0$` |
| `diagram_image` | Image filename (must be in the server's `media/question_diagrams/` folder) | `plant_cell.png` |
| `equation_type` | Equation type for math/science | `algebraic`, `chemical`, `physics`, `statistical` |
| `explanation` | Explanation (optional) | "Mitochondria generates ATP" |

**Using LaTeX Formulas (Equations & Chemical Formulas)**

Questions and answer options containing equations or chemical formulas are
written in **LaTeX** and wrapped in dollar signs so the system renders them as
proper formulas:

- **Inline math** — wrap in a single `$...$`, e.g. `$x^2 - 5x + 6 = 0$`
- **Display math** — wrap in double `$$...$$`, e.g. `$$\int_{0}^{1} x^2\,dx$$`

LaTeX works everywhere the system renders text: `question_text`,
`latex_content`, `answer_options`, and `correct_answer`. Here is a complete
algebraic multiple-choice question ready for the template (the file
`bmu_cbt/questions_template_latex_sample.csv` in the repo contains this example
plus the chemistry ones below — import it to see the formulas render):

```csv
exam_id,exam_title,question_text,question_type,marks,answer_options,correct_answer,latex_content,diagram_image,equation_type,explanation
,"Algebra Sample","Solve for x: $x^2 - 5x + 6 = 0$",multiple,2,"$x = 2$ or $x = 3$|$x = -2$ or $x = -3$|$x = 1$ or $x = 6$|$x = 6$ or $x = -1$","$x = 2$ or $x = 3$","$$x^2 - 5x + 6 = 0$$",,algebraic,"Factorize x^2 - 5x + 6 = (x-2)(x-3), so x = 2 or x = 3"
,"Chemistry Sample","Which equation correctly represents the combustion of methane?",multiple,2,"$CH_4 + 2O_2 \rightarrow CO_2 + 2H_2O$|$CH_4 + O_2 \rightarrow CO + H_2O$|$2CH_4 + O_2 \rightarrow 2CO + 2H_2O$|$CH_4 + 2O_2 \rightarrow CO_2 + 2H_2$","$CH_4 + 2O_2 \rightarrow CO_2 + 2H_2O$","$$CH_4 + 2O_2 \rightarrow CO_2 + 2H_2O$$",,chemical,"Methane combustion produces carbon dioxide and water"
,"Chemistry Sample","What is the chemical formula for water?",multiple,1,"$H_2O$|$CO_2$|$O_2$|$H_2O_2$","$H_2O$","$$H_2O$$",,chemical,"Water is made of two hydrogen atoms and one oxygen atom"
```

For **formulas inside answer options** (or anywhere a math/science MCQ is rendered) you
must write the formula as LaTeX wrapped in `$...$` — subscripts, superscripts and
arrows are not added automatically in that mode (e.g. `$H_2O$`, `$CH_4 + 2O_2
\rightarrow CO_2 + 2H_2O$`).

**Question prompt vs. equation (important):** put the plain-English prompt in
`question_text` (e.g. `Solve for $x$ in the equation below.`) and the equation in
`latex_content` (e.g. `$$x^2 - 5x + 6 = 0$$`). The system now shows BOTH — the
prompt on top and the rendered equation beneath it. Do not paste the same
equation into `question_text` as well, or it will appear twice. If a question
has no separate equation, just fill `question_text` and leave `latex_content`
empty.

For **chemistry questions** (the `chemistry` question type, where the student
types an answer) enter plain notation and the system formats it for you —
subscripts (e.g. the `2` in `H2O` → H₂O) and arrow symbols are added
automatically (use `-->` for `→` and `<-->` for `⇌`).

**CSV rules that matter when using LaTeX:**

- A formula that contains a **comma** (e.g. `f(x, y)`) must be wrapped in double
  quotes (`"..."`) so the comma is not read as a column separator.
- A literal double quote inside a quoted field is written as two quotes (`""`).
- `answer_options` uses `|` as the separator between options. A literal pipe
  inside an option (e.g. an absolute value like `$|x|$`) must be escaped as
  `\|`.
- Backslashes (e.g. `\frac`, `\rightarrow`) are fine in CSV, but author the file
  in a plain text editor and save as **UTF-8 CSV** — Excel can silently alter
  text and quotes.
- For **chemistry questions** (the `chemistry` type) use the plain arrow `-->`
  for `→` and `<-->` for `⇌` — these are converted to proper arrow symbols when
  the question is shown.

**Using Images in Bulk Import**

1. Copy the image file (jpg, jpeg, png, gif, webp, bmp, or svg) into the **`media/question_diagrams/`** folder on the server laptop.
2. In the CSV, enter only the **filename** (e.g., `plant_cell.png`) in the `diagram_image` column — not a full path.
3. The image is then shown automatically on the student's exam screen for that question.
4. If the filename is missing from the folder or has an invalid extension, that row is rejected with an error message naming the problem.

#### Question Types

| Type | Input Method | Auto-Graded? |
|------|-------------|-------------|
| **Multiple Choice** | Select one option from A–F | Yes |
| **True/False** | Select True or False | Yes |
| **Fill in the Blank** | Type exact answer | Yes (case-insensitive) |
| **Short Answer** | Type free-form response | No (manual grading) |
| **Math** | LaTeX equation display + text/MCQ | Yes (if MCQ) |
| **Chemistry** | Chemical equation display + text/MCQ | Yes (if MCQ) |
| **Physics** | Diagram + text/MCQ | Yes (if MCQ) |
| **Biology** | Diagram + text/MCQ | Yes (if MCQ) |
| **Comprehension** | Shared passage + MCQ sub-questions | Yes |

#### Comprehension Questions

1. Create the first question with the **Comprehension** type
2. Paste the passage in the **Comprehension Passage** field
3. Set a **Comprehension Group** name (e.g., "passage_1")
4. For follow-up questions, use the same **Comprehension Group** name
5. The passage will be shared across all questions in the same group

### 3.3 Publishing an Exam

1. Open the exam from the Exams list
2. Review the exam details and question count
4. Click **Publish** (or change status from Draft → Active)
5. The exam is now visible to students and they can start it within the date window

> **How the window and timer work:** the start/end dates only control **when a student may begin**. Once a student clicks Start, the full exam duration runs from *their* start time — a student who begins near the end of the window still gets the entire duration.

### 3.4 Managing Students

#### Creating Individual Students

1. Go to **Users** → **Add User**
2. Fill in: first name, last name, email, user type, department
3. The system auto-generates a username (e.g., `BMU-1234`) and password
4. Print or share the credentials with the student

#### Bulk Uploading Students via CSV

1. Download the template: **Users** → **Download Bulk Upload Template**
2. Fill in the CSV with student data
3. Upload: **Users** → **Bulk Upload** → Select your CSV file
4. The system creates all accounts and generates credentials
5. Export credentials: **Users** → **Export Credentials** → Downloads a CSV with usernames and passwords

**CSV Format for Students:**

| Column | Description | Example |
|--------|-------------|---------|
| `first_name` | First name | `John` |
| `last_name` | Last name | `Doe` |
| `email` | Email address (optional) | `john.doe@example.com` |
| `user_type` | Student type | `matriculated`, `100level`, `intending` |
| `matric_number` | Matric number (for matriculated) | `UG/21/1234` |
| `jamb_number` | JAMB number (for 100level/intending) | `202331138700AB` |
| `department` | Department | `Medicine` |
| `course` | Course of study | `MBBS` |
| `year_of_entry` | Year of entry | `2021` |

### 3.5 Monitoring Live Exams

1. Go to **Dashboard** → **Live Monitoring**
2. View real-time information:
   - Active exams and number of students taking each
   - Individual student progress (questions answered vs. total)
   - Time remaining for each student
   - Tab-switch counts and security alerts
3. Click on a student to view their session details

### 3.6 Viewing Results

1. Go to **Results** → **Exam Results**
2. Select an exam to view all attempts
3. See: student name, score, grade, pass/fail status, time taken
4. Export results to CSV: **Results** → **Export**

### 3.7 Managing Exam Status

| Status | Student Sees | Can Start? | Can Resume? |
|--------|-------------|-----------|------------|
| **Draft** | Not visible | No | No |
| **Published** | Visible | Yes (within dates) | Yes (if in-progress) |
| **Closed** | Not visible | No | Auto-submitted |

---

## 4. Student Guide

### 4.1 Logging In

1. Open your web browser (Chrome, Firefox, or Edge recommended)
2. Enter the URL: `http://<server-IP>:3000`
3. Enter your **Username** (e.g., `BMU-1234`) and **Password**
4. Click **Login**
5. **First-time users:** You will be prompted to change your password. Choose a strong password you can remember.

### 4.2 Viewing Available Exams

After login, you'll see the **Student Dashboard** showing:
- **Available Exams** — Exams you can start (within the date window)
- **Your Attempts** — Exams you've already taken with results
- **Countdown Timer** — If an exam is currently active

### 4.3 Taking an Exam

#### Starting an Exam

1. Click **Start Exam** on the exam card
2. Read the exam instructions carefully
3. Click **Begin Exam** when ready
4. **Important:** Once started, the timer begins and cannot be paused. It always runs for the full exam duration from your start time — starting late within the exam window does not shorten your time

#### Answering Questions

- **Multiple Choice:** Click on the answer option you want to select
- **True/False:** Click "True" or "False"
- **Fill in the Blank:** Type your answer in the text box
- **Short Answer:** Type your response in the text area
- **Math/Science:** Use the equation display and answer via MCQ or text

#### Navigating Between Questions

- Use the **question map** at the top to jump to any question
- Questions are color-coded:
  - **Green** — Answered
  - **Gray** — Not yet answered
  - **Blue** — Currently viewing
- Use **Previous** and **Next** buttons to move sequentially

#### Auto-Save

- Your answers are saved automatically as you select/type them
- You'll see a confirmation message when an answer is saved

#### Submitting the Exam

1. When you've answered all questions (or want to submit early), click **Submit Exam**
2. Confirm the submission in the dialog
3. You'll see your results if the exam is configured to show scores

#### If Time Runs Out

- The exam auto-submits when the timer reaches zero
- All saved answers are submitted for grading
- You'll see your results immediately (if enabled)

### 4.4 Viewing Results

1. After submitting, results appear on your dashboard
2. You can see:
   - **Score** — Total marks obtained
   - **Percentage** — Your score as a percentage
   - **Grade** — Letter grade (A, B, C, D, E, F)
   - **Pass/Fail** — Whether you passed

### 4.5 Changing Your Password

1. Click **Settings** or your profile icon
2. Select **Change Password**
3. Enter your current password
4. Enter and confirm your new password (minimum 8 characters)
5. Click **Save**

### 4.6 Rules During the Exam

| Rule | What Happens |
|------|-------------|
| **Switching tabs** | The exam is submitted immediately and your attempt ends |
| **Opening new windows** | The exam is submitted immediately and your attempt ends |
| **IP address change** | Session may be invalidated |
| **Browser close** | Resume from where you left off (if within time limit) |
| **Internet disconnection** | Reconnect and resume — answers are saved server-side |

---

## 5. Exam Lifecycle

```
┌─────────┐     ┌───────────┐     ┌──────────┐     ┌──────────┐
│  Draft   │ ──→ │ Published │ ──→ │ In-Prog  │ ──→ │ Submitted│
│          │     │  (Active) │     │  (Exam)  │     │          │
└─────────┘     └───────────┘     └──────────┘     └──────────┘
                       │                                    │
                       │                                    │
                       ▼                                    ▼
                 ┌──────────┐                        ┌──────────┐
                 │  Closed  │                        │  Graded  │
                 └──────────┘                        └──────────┘
```

### What Happens at Each Stage

| Stage | Description |
|-------|-------------|
| **Draft** | Exam created but not visible to students. Admin can edit questions. |
| **Published** | Visible to students. They can start the exam within the date window. |
| **In Progress** | Student has started. Timer is running. Answers are being saved. |
| **Submitted** | Student submitted or time expired. Grading is performed automatically. |
| **Graded** | Final score calculated. Results available (if show_score is enabled). |
| **Closed** | Exam period ended. No new attempts allowed. In-progress attempts auto-submitted. |

---

## 6. Grading System

### Letter Grades

| Grade | Minimum Percentage |
|-------|-------------------|
| **A** | 70% and above |
| **B** | 60% – 69% |
| **C** | 50% – 59% |
| **D** | 45% – 49% |
| **E** | 40% – 44% |
| **F** | Below 40% |

### Scoring Formula

```
Percentage = (Total Marks Obtained / Total Paper Marks) × 100
```

- **Total Paper Marks** = Sum of marks for all questions on the student's paper (the random subset drawn at start, or all questions in the exam if no subset is set)
- **Total Marks Obtained** = Sum of marks for correctly answered questions only
- Unanswered or incorrect questions contribute 0 marks

### Auto-Graded Question Types

| Type | How It's Graded |
|------|----------------|
| Multiple Choice | Compared against marked correct answer |
| True/False | Compared against correct boolean value |
| Fill in the Blank | Case-insensitive text match |
| Comprehension (MCQ) | Same as Multiple Choice |
| Math/Science (MCQ) | Same as Multiple Choice |

### Manually Graded

| Type | Notes |
|------|-------|
| Short Answer | Requires admin to grade manually |
| Essay | Requires admin to grade manually |

---

## 7. Troubleshooting

### Common Issues

| Problem | Solution |
|---------|----------|
| **Can't access the system** | Ensure you're connected to the campus network. Try `http://<server-IP>:3000` |
| **Page shows "Connection Error"** | The server may not be running. Ask the admin to run `start_lan.bat` |
| **Login fails** | Double-check your username and password. Contact admin if locked out |
| **Exam won't start** | The exam may not be published yet, or the date window hasn't started |
| **Answers not saving** | Check your internet connection. Try refreshing the page — your answers are saved. |
| **Timer seems wrong** | The timer is based on the server clock. Close other browser tabs to reduce lag |
| **Can't submit exam** | Make sure you're still within the time limit. If time expired, it auto-submits |
| **Lost password** | Contact your administrator for a password reset |

### For Administrators

| Problem | Solution |
|---------|----------|
| **Students can't see exams** | Check that the exam is Published and within the date window |
| **Wrong scores** | Go to Results → select the attempt → click "Regrade" |
| **Student locked out** | Check Sessions for IP conflicts. Clear active sessions if needed |
| **Server IP changed** | Just run `start_lan.bat` again — it auto-detects the new IP |
| **`start_lan.bat` opens as code in VSCode** | You double-clicked it in VSCode's file explorer. Double-click it in **Windows Explorer** instead, or run `.\start_lan.bat` in a terminal |

### Server Requirements

| Component | Requirement |
|-----------|------------|
| **OS** | Windows 10/11 |
| **Network** | Ethernet or Wi-Fi connection (same LAN as students) |
| **Browser** | Chrome, Firefox, or Microsoft Edge — **Chromium-based** (Edge 80+, Chrome 64+, Firefox 63+, Safari 12+). Legacy Microsoft Edge (EdgeHTML, e.g. v44) is **not supported** — update those machines to Chromium Edge or Chrome |
| **Disk Space** | At least 1 GB free for recordings and media |
| **RAM** | 4 GB minimum, 8 GB recommended |

### Support

- **Email:** exams@bmu.edu.ng
- **Technical Support:** Contact the ICT department

---

*BMU CBT System v1.0 — Bayelsa Medical University © 2026*
