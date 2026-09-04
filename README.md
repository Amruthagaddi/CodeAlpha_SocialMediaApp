# Mitra — Indian Social Networking Web Platform

**Mitra** (companion/friend) is a complete, responsive mini social media platform built with Node.js, Express, MongoDB, Mongoose, JWT authentication, and **MinIO S3-compatible image storage**.

---

## 🌟 Key Principles & Features

- **🚫 Zero Fake Data Policy**:
  - The database starts 100% empty. No fake users, fake posts, fake comments, or fake followers are ever created.
  - Neutral avatar badges for missing profile pictures (no random person default photos).
- **📦 MinIO S3-Compatible Image Storage**:
  - User uploaded profile pictures & post images are uploaded to a MinIO bucket (`mitra-media`).
  - MongoDB stores only object keys/URLs (e.g., `profiles/:userId/profile.jpg`, `posts/:postId/image.jpg`).
  - No binary image data is stored directly in MongoDB.
- **🔐 Registration with Optional Profile Setup & Skip**:
  - Required fields: Full Name, Username, Email, Password, Confirm Password.
  - Optional fields: Profile Picture upload (MinIO) & Bio.
  - Includes a clear **"Skip Profile Setup"** option so users can start exploring Mitra immediately and update their profile later.
- **❤️ Like System**:
  - Prevent duplicate likes per user.
- **💬 Comments System**:
  - Add comments and delete own comments.
- **🤝 Follow System**:
  - Follow and unfollow registered users (cannot follow self).
- **🔍 User Search**:
  - Real-time search for registered users by name or username with empty state handling.

---

## 📁 Project Structure

```
Social_media_prj/
├── backend/
│   ├── config/
│   │   ├── db.js               # MongoDB connection logic
│   │   └── minio.js            # MinIO S3 client & bucket initialization
│   ├── controllers/
│   │   ├── authController.js   # Registration (with MinIO avatar/skip) & login
│   │   ├── userController.js   # User profiles & follow system
│   │   ├── postController.js   # Post CRUD & MinIO post image upload
│   │   └── commentController.js# Comments logic
│   ├── middleware/
│   │   ├── authMiddleware.js   # JWT authentication
│   │   └── uploadMiddleware.js # Multer file validation (JPG/PNG/WEBP, 5MB)
│   ├── models/
│   │   ├── User.js             # Mongoose User model
│   │   ├── Post.js             # Mongoose Post model
│   │   └── Comment.js          # Mongoose Comment model
│   ├── routes/
│   │   ├── authRoutes.js       # Auth API routes
│   │   ├── userRoutes.js       # User API routes
│   │   ├── postRoutes.js       # Post API routes
│   │   ├── commentRoutes.js    # Comment API routes
│   │   └── uploadRoutes.js     # MinIO upload endpoints
│   └── server.js               # Express application entry point
│
├── frontend/
│   ├── css/
│   │   └── style.css           # Mitra theme & responsive design system
│   ├── js/
│   │   ├── auth.js             # Auth token helper, neutral avatar renderer
│   │   ├── feed.js             # Home feed loader & post actions
│   │   ├── posts.js            # Post creation & MinIO file upload
│   │   ├── profile.js          # User profile & edit modal
│   │   └── search.js           # User search logic
│   ├── login.html              # Login page
│   ├── register.html           # Mitra Registration page
│   ├── index.html              # Home Feed page
│   ├── create-post.html        # Post creation page
│   ├── profile.html            # User profile page
│   └── search.html             # User search page
│
├── .env                        # Environment configuration
├── .env.example                # Example environment template
├── package.json                # Dependencies & scripts
└── README.md                   # Project documentation
```

---

## ⚙️ MinIO & Environment Setup

### 1. MinIO Server Setup
MinIO is running on default port `9000`:
```bash
minio server ./minio_data --address :9000
```

### 2. Environment Variables (.env)
```env
PORT=5050
MONGODB_URI=mongodb://127.0.0.1:27017/mitra_db
JWT_SECRET=mitra_jwt_secret_key_2026
MINIO_ENDPOINT=127.0.0.1
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_NAME=mitra-media
MINIO_USE_SSL=false
```

---

## 🚀 How to Run Mitra

1. Start Express Server:
   ```bash
   npm start
   ```

2. Access Application:
   Open **`http://localhost:5050`** in your browser.

---

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` — Register account (supports optional profile picture upload to MinIO or skip)
- `POST /api/auth/login` — Authenticate user and receive JWT
- `GET /api/auth/me` — Get current logged-in user

### Uploads
- `POST /api/upload/profile` — Upload profile picture to MinIO bucket
- `POST /api/upload/post` — Upload post image to MinIO bucket

### Users
- `GET /api/users/:id` — Get user profile details
- `PUT /api/users/:id` — Update user profile (name, username, bio, avatar file)
- `GET /api/users/search/:query` — Search registered users
- `POST /api/users/:id/follow` — Follow a user
- `DELETE /api/users/:id/follow` — Unfollow a user

### Posts & Comments
- `GET /api/posts` — Get home feed posts
- `POST /api/posts` — Create post with optional MinIO image upload
- `DELETE /api/posts/:id` — Delete post
- `POST /api/posts/:id/like` — Like post
- `DELETE /api/posts/:id/like` — Unlike post
- `GET /api/posts/:id/comments` — Get post comments
- `POST /api/posts/:id/comments` — Add comment to post
- `DELETE /api/comments/:id` — Delete comment
