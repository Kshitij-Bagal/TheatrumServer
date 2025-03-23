import fs from 'fs';
import path from 'path';
import { Octokit } from "@octokit/rest";
import dotenv from 'dotenv';
dotenv.config();

const octokit = new Octokit({ auth: process.env.GITHUB_PAT });

async function uploadThumbnailToGitHub(videoId, thumbnailPath) {
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main'; // Ensure correct branch
    const newFileName = `${videoId}`;
    const filePath = `thumbnails/${newFileName}`;

    try {
        // Read file as base64
        const content = fs.readFileSync(thumbnailPath).toString('base64');

        // Check if the file exists
        let sha = null;
        try {
            const { data } = await octokit.rest.repos.getContent({
                owner,
                repo,
                path: filePath,
                ref: branch,
            });
            sha = data.sha;
            console.log(`Updating existing file: ${filePath}`);
        } catch (error) {
            if (error.status === 404) {
                console.log(`Creating new file: ${filePath}`);
            } else {
                console.error("GitHub API Error:", error);
                throw error;
            }
        }

        // Upload or update the file
        const { data } = await octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: filePath,
            message: `Upload thumbnail for video ${videoId}`,
            content,
            sha, // Update if exists
            branch,
        });

        const githubImageUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
        return githubImageUrl;
    } catch (error) {
        console.error("Error uploading thumbnail to GitHub:", error.message);
        return null;
    }
}

export default uploadThumbnailToGitHub;
