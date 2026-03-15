# 🪷 Vidya Mandir — Class 10 Learning Platform

A complete, self-contained Class 10 CBSE/NCERT learning platform.  
**No server required** — runs 100% as static files from any host.

## 🚀 Deploy to GitHub Pages

### Step 1 — Create Repository
```
git init
git add .
git commit -m "Initial release"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/vidyamandir.git
git push -u origin main
```

### Step 2 — Enable GitHub Pages
1. Go to your repository → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / `/ (root)`
4. Click **Save**

### Step 3 — Access your site
```
https://YOUR_USERNAME.github.io/vidyamandir/
```

> **Note:** The `.nojekyll` file is included to prevent GitHub Pages from ignoring folders starting with `_`.

---

## 📁 Project Structure

```
vidyamandir/
├── index.html          # Landing page with theme switcher
├── dashboard.html      # Student dashboard
├── subject.html        # Subject overview & chapter list
├── chapter.html        # Video player, notes, quiz, PDFs
├── todo.html           # Study planner
├── admin.html          # Admin CMS panel
├── 404.html            # GitHub Pages SPA redirect
├── .nojekyll           # Prevents Jekyll processing
│
├── css/
│   └── style.css       # Full design system (4 themes)
│
├── js/
│   ├── app.js          # Core engine, data, progress, nav
│   ├── security.js     # Auth, hashing, rate limiting, XSS
│   ├── theme_todo.js   # Theme engine + Todo system
│   └── admin.js        # Full CMS admin panel
│
├── data/
│   └── subjects.json   # All built-in NCERT content
│
└── assets/
    ├── bg-pattern.png        # Rajasthani painting
    ├── theme-mandala.png     # Red mandala
    ├── theme-kalamkari.png   # Kalamkari peacock
    └── theme-tanjore.png     # Tanjore temple art
```

---

## 🔐 Security Features

| Feature | Implementation |
|---|---|
| Admin password | SHA-256 hashed, never stored in plain text |
| Rate limiting | 5 attempts → 30s lockout with countdown |
| Session tokens | `crypto.randomUUID()` with 8-hour TTL |
| XSS protection | All user inputs sanitised via `VidyaSec.sanitize()` |
| DevTools deterrence | F12/Ctrl+Shift+I blocked on admin page |
| Session expiry | Auto-logout after 8h background |

**Admin password: contact your administrator**

---

## 🎨 Heritage Themes

| Theme | Artwork |
|---|---|
| 🌼 Rajasthani | Floral painting from Jaipur City Palace |
| 🔴 Mandala | Red Mehndi mandala |
| 🦚 Kalamkari | Andhra Pradesh peacock painting |
| 🏛 Tanjore | Tamil Nadu temple art |

---

## ✨ Key Features

- **4 Subjects**: Mathematics, Science, Social Science, English
- **18 Built-in Chapters** with NCERT content
- **Video Lessons** — YouTube embed, admin-editable per chapter
- **Chapter Notes** — structured NCERT notes with formulas
- **NCERT Important Topics** — with marks weightage
- **Chapter Quizzes** — MCQ with instant feedback
- **PDF Library** — upload or link any PDF per chapter
- **Study Planner** — tasks with priorities, due dates, marks
- **Progress Tracking** — chapters done, quiz scores, streak
- **Bookmarks** — save chapters for later
- **Global Search** — chapters, topics, lessons
- **Admin CMS** — full control over all content
- **4 Heritage Themes** — or extract colours from any photo
- **Dark/Light mode**
- **Responsive** — works on mobile, tablet, desktop

---

## 🛠 Admin Panel

Navigate to `/admin.html` on your deployed site.

Admin capabilities:
- Edit all 18 built-in chapters (change YouTube videos, add teacher notes)
- Add custom subjects and chapters
- Upload PDFs or link external PDFs
- Add NCERT important topics with marks weightage
- Add quiz questions per chapter
- Manage teacher profiles
- Post announcements (shown on dashboard)
- Clear student progress
- Export/import full backup
- Change platform name and daily quote

---

## 📝 Editing Content

All content is stored in `localStorage` — no server, no database.

To pre-load content:
1. Go to Admin → export backup
2. Edit the JSON file
3. Import backup on the new deployment

---

## 📋 Browser Support

Chrome 80+ · Firefox 78+ · Safari 14+ · Edge 80+

*(Requires `crypto.subtle` for password hashing)*
