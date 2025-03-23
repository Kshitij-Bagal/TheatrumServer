import mongoose from 'mongoose';
import { updateRelatedCollections } from '../middleware/updateCollections.js'; // Import the helper function
const channelSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    logo: { type: String },
    banner: { type: String },
    subscribers: { type: Number, default: 0 },
    videos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Video' }],
    createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

// Post-save and post-remove hooks to sync related collections
channelSchema.post('save', function (doc) {
    updateRelatedCollections(doc, 'create');
});

channelSchema.post('remove', function (doc) {
    updateRelatedCollections(doc, 'delete');
});

const Channel = mongoose.model('Channel', channelSchema);
export default Channel;
