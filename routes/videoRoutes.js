import express from 'express';
import Video from '../models/Video.js';
import mongoose from 'mongoose';

const router = express.Router();

const validateUserId = (req, res, next) => {
    if (!mongoose.Types.ObjectId.isValid(req.body.userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
    }
    next();
};

// Upload a new video
router.post('/', async (req, res) => {
    try {
        const newVideo = new Video(req.body);
        await newVideo.save();
        res.status(201).json(newVideo);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/', async (req, res) => {
    try {
        const videos = await Video.find()
            .populate({
                path: 'channelId',
                select: 'name logo banner' // Select only necessary fields
            })
            .populate({
                path: 'comments.userId',
                select: 'username' // Select only necessary fields
            });

        res.json(videos);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Get a single video
router.get('/:id', async (req, res) => {
    try {
        const video = await Video.findById(req.params.id).populate('channelId comments.userId');
        if (!video) return res.status(404).json({ message: 'Video not found' });
        await Video.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
                res.json(video);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update video details
router.put('/:id', async (req, res) => {
    try {
        const updatedVideo = await Video.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedVideo) {
            return res.status(404).json({ error: "Video not found" });
        }
        res.json(updatedVideo);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a video
router.delete('/:id', async (req, res) => {
    try {
        await Video.findByIdAndDelete(req.params.id);
        res.json({ message: 'Video deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Like a video
router.post('/:id/like',validateUserId, async (req, res) => {
    const { userId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
    }

    try {
        const video = await Video.findById(req.params.id);
        if (!video) return res.status(404).json({ message: 'Video not found' });

        // Ensure likedBy and dislikedBy arrays exist
        video.likedBy = video.likedBy || [];
        video.dislikedBy = video.dislikedBy || [];

        // Convert userId to string for consistency
        const userStr = userId.toString();

        // Remove dislike if the user had disliked before
        if (video.dislikedBy.includes(userStr)) {
            video.dislikedBy = video.dislikedBy.filter(id => id.toString() !== userStr);
            video.dislikes = Math.max(0, video.dislikes - 1); // Prevent negative values
        }

        // Toggle like status
        if (video.likedBy.includes(userStr)) {
            video.likedBy = video.likedBy.filter(id => id.toString() !== userStr);
            video.likes = Math.max(0, video.likes - 1); // Prevent negative values
        } else {
            video.likedBy.push(userStr);
            video.likes += 1;
        }

        await video.save();
        res.json(video);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


router.post('/:id/dislike',validateUserId, async (req, res) => {
    const { userId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
    }

    try {
        const video = await Video.findById(req.params.id);
        if (!video) return res.status(404).json({ message: 'Video not found' });

        // Ensure likedBy and dislikedBy arrays exist
        video.likedBy = video.likedBy || [];
        video.dislikedBy = video.dislikedBy || [];

        // Convert userId to string for consistency
        const userStr = userId.toString();

        // Remove like if the user had liked before
        if (video.likedBy.includes(userStr)) {
            video.likedBy = video.likedBy.filter(id => id.toString() !== userStr);
            video.likes = Math.max(0, video.likes - 1); // Prevent negative values
        }

        // Toggle dislike status
        if (video.dislikedBy.includes(userStr)) {
            video.dislikedBy = video.dislikedBy.filter(id => id.toString() !== userStr);
            video.dislikes = Math.max(0, video.dislikes - 1); // Prevent negative values
        } else {
            video.dislikedBy.push(userStr);
            video.dislikes += 1;
        }

        await video.save();
        res.json(video);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});



// Get comments for a video
router.get('/:id/comments', async (req, res) => {
    const { id } = req.params;
    try {
        const video = await Video.findById(id).populate('comments');
        if (!video) return res.status(404).json({ message: 'Video not found' });
        res.json(video.comments);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add a top-level comment to a video
router.post('/:id/comment', async (req, res) => {
    const { id } = req.params;
    const { userId, username, text } = req.body;

    try {
        const video = await Video.findById(id);
        if (!video) return res.status(404).json({ message: 'Video not found' });

        const newComment = {
            userId,
            username,
            text,
            timestamp: new Date(),
            replies: [] // Initialize replies array
        };

        video.comments.push(newComment);
        await video.save();

        res.json({ message: 'Comment added successfully', comments: video.comments });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Recursive function to find and append a reply to the correct comment
const addReplyRecursive = (comments, parentId, reply) => {
    for (let comment of comments) {
        if (comment._id.toString() === parentId) {
            comment.replies.push(reply);
            return true;
        }
        if (comment.replies.length > 0) {
            const found = addReplyRecursive(comment.replies, parentId, reply);
            if (found) return true;
        }
    }
    return false;
};

// Add a reply to a comment or another reply
router.post('/:videoId/comment/:commentId/reply', async (req, res) => {
    const { videoId, commentId } = req.params;
    const { userId, username, text } = req.body;

    try {
        const video = await Video.findById(videoId);
        if (!video) return res.status(404).json({ message: 'Video not found' });

        const reply = {
            userId,
            username,
            text,
            timestamp: new Date(),
            replies: [] // Allow further nesting
        };

        const added = addReplyRecursive(video.comments, commentId, reply);
        if (!added) return res.status(404).json({ message: 'Parent comment not found' });

        await video.save();
        res.json({ message: 'Reply added successfully', video });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/get/types', async (req, res) => {
    try {
        const types = await Video.distinct('type'); // Fetch unique video types
        res.json(types);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all unique video types that have at least one video
router.get('/types/:type', async (req, res) => { 
    try {
        const { type } = req.params;
        const videos = await Video.find({ type: new RegExp(`^${type}$`, 'i') });
        res.json(videos);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


export default router;
