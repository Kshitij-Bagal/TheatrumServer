import Channel from '../models/Channel.js';
import User from '../models/User.js';
import Video from '../models/Video.js';

export const updateRelatedCollections = async (doc, action) => {
    try {
        if (action === 'create') {
            if (doc instanceof Video) {
                await Channel.findByIdAndUpdate(doc.channelId, { $push: { videos: doc._id } });
                const user = await User.findOne({ createdChannels: doc.channelId });
                if (user) {
                    await user.updateOne({ $push: { favoriteVideos: doc._id } });
                }
            }
        } else if (action === 'delete') {
            if (doc instanceof Video) {
                await Channel.findByIdAndUpdate(doc.channelId, { $pull: { videos: doc._id } });
                await User.updateMany({ favoriteVideos: doc._id }, { $pull: { favoriteVideos: doc._id } });
            }
        }
    } catch (error) {
        console.error('Error updating related collections:', error);
    }
};
