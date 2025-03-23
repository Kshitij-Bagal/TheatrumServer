import mongoose from 'mongoose';
import Channel from './Channel.js'; // Ensure correct path


const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePic: { type: String, default: '' },
    favoriteVideos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Video' }],
    likedVideos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Video' }],
    createdChannels: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Channel' }],
    comments: [{
        videoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Video' },
        text: { type: String },
        timestamp: { type: Date, default: Date.now }
    }],
}, { timestamps: true });

// Post-save and post-remove hooks to sync related collections
userSchema.post('save', async function (doc) {
    if (doc.createdChannels && doc.createdChannels.length > 0) {
        for (const channelId of doc.createdChannels) {
            const channel = await Channel.findById(channelId);
            if (channel) {
                await updateRelatedCollections(channel, 'create');
            }
        }
    }
});

userSchema.post('remove', async function (doc) {
    if (doc.createdChannels && doc.createdChannels.length > 0) {
        for (const channelId of doc.createdChannels) {
            const channel = await Channel.findById(channelId);
            if (channel) {
                await updateRelatedCollections(channel, 'delete');
            }
        }
    }
});


const User = mongoose.model('User', userSchema);
export default User;
