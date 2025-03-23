import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import connectDB from './config/db.js';
import userRoutes from './routes/userRoutes.js';
import videoRoutes from './routes/videoRoutes.js';
import channelRoutes from './routes/channelRoutes.js';
import { google } from 'googleapis';
import multer from 'multer';
import fs from 'fs';
import mongoose from 'mongoose';
import Video from './models/Video.js';
import Channel from './models/Channel.js';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import User from './models/User.js'; // Adjust path based on your structure
import uploadThumbnailToGitHub from './middleware/githubUpload.js';

dotenv.config();
connectDB();

const app = express();
const port = process.env.PORT || 8000;

app.use(express.json());
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));

const folderId = process.env.DRIVE_FOLDER_ID;
if (!folderId) {
    console.error('DRIVE_FOLDER_ID is missing in environment variables.');
    process.exit(1);
}

// ✅ Google Drive Authentication
const auth = new google.auth.GoogleAuth({
    credentials: {
        type: process.env.GOOGLE_TYPE,
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID,
        auth_uri: process.env.GOOGLE_AUTH_URI,
        token_uri: process.env.GOOGLE_TOKEN_URI,
        auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_X509_CERT_URL,
        client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL,
        universe_domain: process.env.GOOGLE_UNIVERSAL_DOMAIN,
    },
    scopes: ['https://www.googleapis.com/auth/drive.file'],
});

// GitHub Repo Config
const GITHUB_USERNAME = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_PAT = process.env.GITHUB_PAT;
const drive = google.drive({ version: 'v3', auth });

// ✅ Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'uploads/videos/';
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, `${new mongoose.Types.ObjectId()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({ storage });

app.get("/stream-video/:fileName", async (req, res) => {
    const fileName = req.params.fileName;
    const range = req.headers.range;

    if (!range) {
        return res.status(416).send("Requires Range header");
    }

    try {
        const fileId = await getFileIdByName(auth, fileName);
        if (!fileId) {
            return res.status(404).json({ error: "File not found" });
        }

        // Get file metadata to determine its size
        const metadata = await drive.files.get({ fileId, fields: "size" });
        const fileSize = parseInt(metadata.data.size, 10);

        // Parse the Range header
        const CHUNK_SIZE = 10 ** 6; // 1MB chunks
        const start = Number(range.replace(/\D/g, ""));
        const end = Math.min(start + CHUNK_SIZE, fileSize - 1);
        const contentLength = end - start + 1;

        // Set headers for partial content streaming
        const headers = {
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": contentLength,
            "Content-Type": "video/mp4",
        };

        res.writeHead(206, headers);

        // Stream only the requested range from Google Drive
        const fileStream = await drive.files.get(
            { fileId, alt: "media" },
            { responseType: "stream", headers: { Range: `bytes=${start}-${end}` } }
        );

        fileStream.data.pipe(res);
    } catch (error) {
        console.error("Error streaming video:", error.message);
        res.status(500).json({ error: "Failed to stream video" });
    }
});


async function getFileIdByName(auth, fileName) {
    try {
      const response = await drive.files.list({
        q: `name='${fileName}'`,
        fields: "files(id, name)",
        auth,
      });
  
      if (response.data.files.length === 0) {
        console.log("No file found with the given name.");
        return null;
      }
  
      const fileId = response.data.files[0].id;
      console.log("File ID:", fileId);
      return fileId;
    } catch (error) {
      console.error("Error fetching file ID:", error.message);
      return null;
    }
  }

// ✅ Upload Video to Google Drive & Update Channel and User Collections
app.post('/upload', upload.single('video'), async (req, res) => {
    try {
        const { title, description, channelId, tags, uploaderId, type } = req.body;
        if (!title || !description || !channelId || !uploaderId || !type) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // ✅ Validate if channel exists
    const channelExists = await Channel.findById(channelId);
    if (!channelExists) {
        return res.status(400).json({ error: 'Invalid channel ID: Channel does not exist' });
    }

    const uploaderExists = await User.findById(uploaderId);
    if (!uploaderExists) {
        return res.status(400).json({ error: 'Invalid uploader ID: User does not exist' });
    }

    const { file } = req;
    if (!file) return res.status(400).send('No file uploaded.');

        // ✅ Create a MongoDB video document with only essential fields (without url)
        const newVideo = new Video({
            title,
            description,
            channelId,
            uploaderId,
            tags,
            type,
        });

        // ✅ Rename video file with MongoDB _id
        const newFilePath = path.join('uploads/videos/', `${newVideo._id}${path.extname(file.originalname)}`);
        fs.promises.rename(file.path, newFilePath);

        // ✅ Upload renamed video to Google Drive
        const fileMetadata = { name: `${newVideo._id}${path.extname(file.originalname)}`, parents: [folderId] };
        const media = { mimeType: file.mimetype, body: fs.createReadStream(newFilePath) };
        const response = await drive.files.create({ resource: fileMetadata, media, fields: 'id' });

        const videoId = response.data.id;
        const url = `https://www.googleapis.com/drive/v3/files/${videoId}?alt=media&key=${process.env.GOOGLE_API_KEY}`;
        const thumbnailPath = `uploads/thumbnails/${newVideo._id}.jpg`;

        if (!fs.existsSync('uploads/thumbnails')) {
            fs.mkdirSync('uploads/thumbnails', { recursive: true });
        }

        // ✅ Extract Video Metadata using FFmpeg
        ffmpeg.ffprobe(newFilePath, async (err, metadata) => {
            if (err) {
                console.error('Error extracting metadata:', err);
                return res.status(500).json({ error: 'Failed to extract metadata' });
            }

            const videoStream = metadata.streams.find((s) => s.codec_type === 'video');
            const duration = Math.round(metadata.format.duration);
            const resolution = `${videoStream.width}x${videoStream.height}`;
            const codec = videoStream.codec_name;

            // ✅ Generate Thumbnail
            ffmpeg(newFilePath)
            .screenshots({
                timestamps: ['00:00:01'],
                filename: path.basename(thumbnailPath),
                folder: 'uploads/thumbnails',
                size: '320x180',
            })
            .on('end', async () => {
                try {
                    // ✅ Construct thumbnail URL
                    const thumbnailUrl = await uploadThumbnailToGitHub( `${newVideo._id}.jpg`,thumbnailPath);
        
                    // ✅ Update video metadata before saving to MongoDB
                    newVideo.url = url;
                    newVideo.thumbnailUrl = thumbnailUrl;
                    newVideo.metadata = { duration, resolution, codec };
        
                    await newVideo.save(); // ✅ Save video after setting the URL
        
                    // ✅ Update the corresponding channel with the new video ID
                    const channel = await Channel.findByIdAndUpdate(
                        channelId,
                        { $push: { videos: newVideo._id } },
                        { new: true }
                    );
        
                    if (!channel) {
                        console.error('Channel not found');
                        return res.status(404).json({ error: 'Channel not found' });
                    }
        
                    // ✅ Update the user who owns this channel to include the video in their channel list
                            
                    const user = await User.findByIdAndUpdate(uploaderId, { $push: { uploadedVideos: newVideo._id } });
                    if (!user) {
                        console.error(`User not found for this channel: ${channelId}`);
                        return res.status(400).json({ error: 'User not found for this channel' });
                    }
                    
                    console.log(`User found:`, user);
                    console.log(`Updating createdChannels for user ${user._id} with video ${newVideo._id}`);
                    
                    const updatedUser = await User.findByIdAndUpdate(
                        user._id,
                        { $push: { createdChannels: channelId } },
                        { new: true }
                    );                    
                            
                    // ✅ Delete local uploaded files
                    fs.unlinkSync(newFilePath);
                    fs.unlinkSync(thumbnailPath);
        
                    res.status(201).json({ video: newVideo });
                } catch (saveError) {
                    console.error('Error saving video:', saveError);
                    res.status(500).json({ error: 'Failed to save video' });
                }
            });
        
        });
    } catch (err) {
        console.error('Error processing video upload:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.status(400).json({ error: 'Query parameter "q" is required' });
        }

        const searchRegex = new RegExp(query, 'i');

        // Search for videos and channels
        const videos = await Video.find({ title: searchRegex });
        const channels = await Channel.find({ name: searchRegex });

        res.json({ videos, channels });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// ✅ API Routes
app.use('/api/users', userRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/channels', channelRoutes);

app.listen(port, () => console.log(`Server running on http://localhost:${port}`));


