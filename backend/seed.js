const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('./models/User');
const Post = require('./models/Post');
const Comment = require('./models/Comment');

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/social_media_db';

const seedData = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB for seeding...');

    // Clear existing data
    await User.deleteMany({});
    await Post.deleteMany({});
    await Comment.deleteMany({});

    console.log('Cleared existing users, posts, and comments.');

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);

    // Create Demo Users
    const createdUsers = await User.create([
      {
        name: 'Sophia Vance',
        username: 'sophia_v',
        email: 'sophia@example.com',
        password: hashedPassword,
        profilePicture: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
        bio: 'Product Designer & Visual Artist 🎨✨ | Exploring modern web UI and minimal aesthetics.'
      },
      {
        name: 'Alex Rivera',
        username: 'alex_rivera',
        email: 'alex@example.com',
        password: hashedPassword,
        profilePicture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
        bio: 'Full Stack Engineer 🚀 | Open Source Enthusiast & Coffee Lover ☕'
      },
      {
        name: 'Elena Rostova',
        username: 'elena_r',
        email: 'elena@example.com',
        password: hashedPassword,
        profilePicture: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
        bio: 'Travel Photographer 📸 | Capturing golden hours around the globe.'
      },
      {
        name: 'Marcus Chen',
        username: 'marcus_c',
        email: 'marcus@example.com',
        password: hashedPassword,
        profilePicture: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=400&q=80',
        bio: 'Tech Writer & AI Researcher 🤖 | Building future-proof web apps.'
      }
    ]);

    const [sophia, alex, elena, marcus] = createdUsers;

    // Setup Follow Connections
    sophia.following.push(alex._id, elena._id);
    alex.followers.push(sophia._id);
    elena.followers.push(sophia._id);

    alex.following.push(sophia._id, marcus._id);
    sophia.followers.push(alex._id);
    marcus.followers.push(alex._id);

    await Promise.all([sophia.save(), alex.save(), elena.save(), marcus.save()]);

    console.log('Created 4 demo users with follow relationships.');

    // Create Demo Posts
    const createdPosts = await Post.create([
      {
        author: sophia._id,
        content: 'Just launched a new minimal design project! Exploring glassmorphism and subtle CSS animations for modern web interfaces. What do you think of this aesthetic? ✨',
        image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
        likes: [alex._id, elena._id, marcus._id]
      },
      {
        author: alex._id,
        content: 'Building full-stack web applications with Express and Vanilla JS is so refreshing. Clean architecture, zero bloat, pure speed! ⚡💻',
        image: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80',
        likes: [sophia._id, marcus._id]
      },
      {
        author: elena._id,
        content: 'Golden hour sunset views over the coastal mountains today. Nature never fails to amaze. 🌅⛰️',
        image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
        likes: [sophia._id, alex._id]
      },
      {
        author: marcus._id,
        content: 'Late night coding session with a warm cup of dark roast coffee. Ready to ship this new feature! ☕🚀',
        image: '',
        likes: [alex._id]
      }
    ]);

    const [post1, post2, post3] = createdPosts;

    // Create Demo Comments
    await Comment.create([
      {
        post: post1._id,
        author: alex._id,
        text: 'This UI design looks incredible Sophia! The contrast and gradients are super clean.'
      },
      {
        post: post1._id,
        author: elena._id,
        text: 'Love the minimalist vibes! Definitely taking inspiration for my next portfolio page.'
      },
      {
        post: post2._id,
        author: sophia._id,
        text: 'Couldn’t agree more Alex! Express + Mongoose makes API development so smooth.'
      },
      {
        post: post3._id,
        author: marcus._id,
        text: 'Stunning photo Elena! Which lens did you use for this shot?'
      }
    ]);

    console.log('Seeded demo posts and comments successfully!');
    console.log('\nDefault Test Accounts:');
    console.log('1. Username: sophia_v | Email: sophia@example.com | Password: password123');
    console.log('2. Username: alex_rivera | Email: alex@example.com | Password: password123');
    console.log('3. Username: elena_r | Email: elena@example.com | Password: password123');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
};

seedData();
