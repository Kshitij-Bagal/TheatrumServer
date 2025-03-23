import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Video from '../models/Video.js';
import Channel from '../models/Channel.js';

const router = express.Router();

// User registration
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create new user
        const newUser = new User({ username, email, password: hashedPassword });
        await newUser.save();

        // Generate JWT token
        const token = jwt.sign({ userId: newUser._id }, 'your_secret_key', { expiresIn: '7d' });

        // Send back the user (excluding password) and token
        res.status(201).json({
            user: { _id: newUser._id, username: newUser.username, email: newUser.email },
            token,
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// User login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if user exists
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) return res.status(401).json({ message: 'Invalid credentials' });

        // Generate JWT token
        const token = jwt.sign({ id: user._id, email: user.email }, 'yourSecretKey', { expiresIn: '1h' });

        res.json({ token, user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all users
router.get('/', async (req, res) => {
    try {
        const users = await User.find().populate('favoriteVideos createdChannels');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get a single user
router.get('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).populate('favoriteVideos createdChannels');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update user details
router.put('/:id', async (req, res) => {
    try {
        const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updatedUser);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a user
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.params.userId;

        // Find user & their channels
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const channels = await Channel.find({ owner: userId });

        // Delete videos in those channels
        for (const channel of channels) {
            await Video.deleteMany({ channelId: channel._id });
        }

        // Delete channels
        await Channel.deleteMany({ owner: userId });

        // Delete user
        await User.findByIdAndDelete(userId);

        res.status(200).json({ message: 'User, channels, and videos deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add a video to favorites
router.post('/:id/favorite/:videoId', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user.favoriteVideos.includes(req.params.videoId)) {
            user.favoriteVideos.push(req.params.videoId);
            await user.save();
        }
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
