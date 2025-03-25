import mongoose from 'mongoose';
import Channel from './Channel.js';
import User from './User.js';
import { updateRelatedCollections } from '../middleware/updateCollections.js'; // Import the helper function

const videoSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    url: { type: String, required: true },
    thumbnailUrl: { type: String },
    channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel' },
    uploaderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    views: { type: Number, default: 0 },
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    dislikedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    uploadDate: { type: Date, default: Date.now },
    tags: [{ type: String }],
    type: {
        type: String,
        enum: [
            'Sci-Fi', 'Adventure', 'Sports', 'Healthcare', 'Anime', 'Cartoon', 
            'Politics', 'News', 'Entertainment', 'Knowledge', 'Gaming', 'Movies', 
            'TV Shows', 'Vlogs', 'Podcasts', 'Tech', 'Music', 'Education', 'Fashion',
            'Lifestyle', 'Fitness', 'Cooking', 'DIY', 'Business', 'Finance', 'Science',
            'Nature', 'History', 'Religion', 'Culture', 'Travel', 'Food', 'Documentary',
            'Comedy', 'Drama', 'Action', 'Fantasy',"Calm",
            'Horror', 'Thriller', 'Romance', 'Mystery', 'Biography', 'Crime', 'Western',
            'Musical', 'War', 'Supernatural', 'Family', 'Animation', 'Superhero', 'Spy',
        ],
        required: true
    },
    comments: [{
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true }, // <-- Explicitly define _id
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        username: { type: String },
        text: { type: String },
        timestamp: { type: Date, default: Date.now },
        replies: [{
            _id: { type: mongoose.Schema.Types.ObjectId, auto: true }, // <-- Replies also get _id
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            username: { type: String },
            text: { type: String },
            timestamp: { type: Date, default: Date.now },
            replies: [{
                _id: { type: mongoose.Schema.Types.ObjectId, auto: true }, // <-- Replies also get _id
                userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                username: { type: String },
                text: { type: String },
                timestamp: { type: Date, default: Date.now },
                replies:[]
            }]
        }]
    }],
    metadata: {
        duration: { type: Number },
        resolution: { type: String },
        codec: { type: String },
    }
}, { timestamps: true });

// Post-save and post-remove hooks to sync related collections
videoSchema.post('save', async function (doc) {
    await updateRelatedCollections(doc, 'create');
});

videoSchema.post('remove', async function (doc) {
    await updateRelatedCollections(doc, 'delete');
});

const Video = mongoose.model('Video', videoSchema);
export default Video;

