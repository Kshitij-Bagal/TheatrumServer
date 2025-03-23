import Video from './models/Video';
import User from './models/User';
import Channel from './models/Channel';

// Example of creating a video
export const createVideo = async (req, res) => {
    try {
        const { title, description, url, channelId, metadata } = req.body;
        const video = new Video({ title, description, url, channelId, metadata });

        await video.save();
        res.status(201).json({ message: 'Video created successfully', video });

        // Synchronize related collections
        updateRelatedCollections(video, 'create');
    } catch (error) {
        res.status(500).json({ message: 'Error creating video', error });
    }
};

// Example of deleting a video
export const deleteVideo = async (req, res) => {
    try {
        const { videoId } = req.params;
        const video = await Video.findById(videoId);
        if (!video) return res.status(404).json({ message: 'Video not found' });

        await video.remove();
        res.status(200).json({ message: 'Video deleted successfully' });

        // Synchronize related collections
        updateRelatedCollections(video, 'delete');
    } catch (error) {
        res.status(500).json({ message: 'Error deleting video', error });
    }
};
