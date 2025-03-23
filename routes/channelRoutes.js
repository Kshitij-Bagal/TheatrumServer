import express from 'express';
import Channel from '../models/Channel.js';
import mongoose from 'mongoose';
const router = express.Router();

// Create a new channel
router.post("/", async (req, res) => {
    try {
        if (!req.body.owner) {
            return res.status(400).json({ error: "Owner is required" });
        }
        const newChannel = new Channel({ 
            name: req.body.name, 
            description: req.body.description, 
            logo: req.body.logo, 
            banner: req.body.banner, 
            owner: req.body.owner, // Ensure owner is set 
        });

        await newChannel.save();
        res.status(201).json(newChannel);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


router.get("/user/:userId", async (req, res) => {
    try {
        const channel = await Channel.findOne({ owner: req.params.userId })
            .populate("videos"); // Fetch full video details
    
        if (!channel) {
            return res.status(404).json({ message: "Channel not found" });
        }

        res.json(channel);
    } catch (error) {
        console.error("Error fetching channel:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// Get all channels
router.get('/', async (req, res) => {
    try {
        const channels = await Channel.find().populate('owner videos');
        res.json(channels);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get a single channel by ID


router.get('/:id', async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: "Invalid channel ID" });
        }

        const channel = await Channel.findById(req.params.id).populate('owner videos');
        if (!channel) return res.status(404).json({ message: 'Channel not found' });
        res.json(channel);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// Update channel details
router.put('/:id', async (req, res) => {
    try {
        const updatedChannel = await Channel.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updatedChannel);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a channel
router.delete('/:id', async (req, res) => {
    try {
        await Channel.findByIdAndDelete(req.params.id);
        res.json({ message: 'Channel deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Subscribe to a channel
router.post('/:id/subscribe', async (req, res) => {
    try {
        const { userId } = req.body;
        const channel = await Channel.findById(req.params.id);

        if (!channel) return res.status(404).json({ message: "Channel not found" });

        const subIndex = channel.subscribers.indexOf(userId);

        if (subIndex === -1) {
            channel.subscribers.push(userId);
        } else {
            channel.subscribers.splice(subIndex, 1); // Unsubscribe
        }

        await channel.save();
        res.json(channel);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


export default router;
