# SmartBear Product Coach

AI-powered adaptive learning platform for **QMetry**, **Reflect**, and **Swagger Studio**.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/smartbear-coach)

---

## 🚀 Quick Start (5 minutes)

### 1. Set up Supabase Backend

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project (name: `smartbear-coach`)
3. Go to **SQL Editor** → **New query**
4. Copy and paste the contents of `backend/supabase/migrations/001_schema.sql`
5. Click **Run**
6. Create another new query
7. Copy and paste the contents of `backend/supabase/migrations/002_functions.sql`
8. Click **Run**

### 2. Configure Frontend

1. Go to Supabase dashboard → **Settings → API**
2. Copy your **Project URL** and **anon public key**
3. Open `frontend/supabase.js`
4. Replace lines 11-12:
   ```javascript
   const SUPABASE_URL  = 'https://YOUR_PROJECT_REF.supabase.co';
   const SUPABASE_ANON = 'YOUR_ANON_PUBLIC_KEY';
   ```
5. Save the file

### 3. Deploy Frontend

**Option A: Vercel (Recommended)**
```bash
cd frontend/
npx vercel --prod
```

**Option B: Netlify**
- Drag and drop the `frontend/` folder to [app.netlify.com](https://app.netlify.com)

**Option C: GitHub Pages**
- Push this repo to GitHub
- Enable Pages in repo Settings → Pages → Deploy from main branch

### 4. Activate Auth

Open `frontend/index.html` and add these lines before `</body>`:
```html
<script type="module" src="supabase.js"></script>
<script type="module" src="auth.js"></script>
```

**Done!** Visit your deployed site and start learning.

---

## 📚 Features

### 🎓 Three Products
- **QMetry** - Test management & QA lifecycle (10 modules)
- **Reflect** - AI-powered no-code test automation (10 modules)
- **Swagger Studio** - OpenAPI design-first platform (10 modules)

### 🧠 Adaptive Learning
- **3-tier content** per module: Basics → Intermediate → Advanced
- **Adaptive quiz mode** - recommends tier based on performance
- **Progress tracking** - module completion, quiz scores, tier mastery
- **AI chat coach** - context-aware Q&A powered by Claude API

### 📊 Analytics Dashboard
- Access at `/admin.html`
- Learner progress tracking
- Quiz performance metrics
- Activity feed
- Module completion leaderboard

### 🔒 Authentication & Security
- Supabase Auth with email/password
- Row Level Security (RLS) - users only see their own data
- Optional email confirmation
- Session management

---

## 📁 Project Structure

```
smartbear-coach/
├── frontend/
│   ├── index.html       ← Main coach app
│   ├── admin.html       ← Analytics dashboard
│   ├── supabase.js      ← Supabase client + all DB operations
│   └── auth.js          ← Auth integration layer
│
└── backend/
    └── supabase/
        └── migrations/
            ├── 001_schema.sql      ← Tables, RLS, triggers
            └── 002_functions.sql   ← RPC helper functions
```

---

## 🔧 Configuration

### Disable Email Confirmation (Optional)

For internal tools, you can skip email verification:

1. Supabase dashboard → **Authentication → Settings**
2. Toggle OFF **Enable email confirmations**
3. Click **Save**

Now users can sign up and sign in immediately.

### Customize Email Templates

1. **Authentication → Email Templates**
2. Edit confirmation email, password reset, etc.

### Add Admin Users

To restrict admin dashboard access:

```sql
-- Add admin flag to profiles
alter table public.profiles add column is_admin boolean default false;

-- Make yourself admin
update public.profiles 
set is_admin = true 
where email = 'your-email@example.com';
```

---

## 🎨 Customization

### Change Brand Colors

Edit CSS variables in `frontend/index.html`:

```css
:root {
  --sb-orange: #E8581A;   /* SmartBear brand */
  --qm:        #00A87A;   /* QMetry teal */
  --rf:        #3B6EF5;   /* Reflect blue */
  --sw:        #85EA2D;   /* Swagger lime */
}
```

### Add New Modules

In `frontend/index.html`, find the `PRODUCTS` constant and add to the relevant product:

```javascript
modules: [
  { id:'new_module', icon:'🎯', name:'New Module', section:'Advanced' },
],
content: {
  new_module: {
    basics: `<h3>Content here</h3>...`,
    intermediate: `...`,
    advanced: `...`,
  },
},
flashcards: {
  new_module: [
    {q:"Question?", a:"Answer"},
  ],
},
```

### Change Quiz Pass Threshold

Search for `>= 50` in `index.html` and change the percentage.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla HTML/CSS/JS |
| Auth + DB | Supabase (Postgres + GoTrue) |
| AI Chat | Anthropic Claude API |
| Fonts | Google Fonts (Inter, Sora, JetBrains Mono) |
| Hosting | Vercel / Netlify / GitHub Pages |

---

## 📊 Database Schema

**Tables:**
- `profiles` - User accounts with product preferences
- `module_progress` - Tracks module completion per user/product
- `quiz_attempts` - Every quiz attempt with score/pass/fail
- `chat_history` - AI coach conversation history
- `events` - Audit log for analytics

**RPC Functions:**
- `upsert_module_progress()` - Save module view/completion
- `record_quiz_attempt()` - Save quiz + auto-complete module
- `get_my_progress()` - Get all progress for current user
- `get_admin_summary()` - Admin dashboard stats
- `save_chat_message()` / `get_chat_history()` - Chat persistence
- `log_event()` - Activity logging

---

## 🔐 Security

- ✅ Row Level Security (RLS) enabled on all tables
- ✅ Users can only access their own data
- ✅ Automatic profile creation on signup
- ✅ SQL injection prevention via parameterized queries
- ✅ Auth tokens handled by Supabase
- ✅ CORS configured automatically

---

## 🐛 Troubleshooting

### "Invalid API key" error
- Verify `SUPABASE_URL` and `SUPABASE_ANON` in `supabase.js` match your dashboard
- Use the **anon public** key, not the service role key

### Progress not saving
- Check browser console for errors
- Verify migrations ran successfully (check Tables in Supabase dashboard)

### Can't sign in
- If email confirmation is enabled, check your inbox
- Or disable email confirmation in Auth settings

### CORS errors
- Supabase handles CORS automatically for the anon key
- Verify you're using the correct project URL

---

## 📝 License

MIT License - feel free to use for your organization's training needs.

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/new-product`)
3. Commit changes (`git commit -m 'Add new product'`)
4. Push to branch (`git push origin feature/new-product`)
5. Open a Pull Request

---

## 💡 Support

- **Issues**: [GitHub Issues](https://github.com/YOUR_USERNAME/smartbear-coach/issues)
- **Supabase Docs**: [docs.supabase.com](https://docs.supabase.com)
- **Claude API**: [docs.anthropic.com](https://docs.anthropic.com)

---

Built with ❤️ for SmartBear teams
