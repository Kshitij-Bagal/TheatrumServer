// const bcrypt = require('bcryptjs');

// const plainPassword = '123456789'; // The actual password you want to test
// bcrypt.hash(plainPassword, 10).then((hashedPassword) => {
//     console.log('New hashed password:', hashedPassword);
// });



// const axios = require('axios');
// const fs = require('fs');

// async function uploadImageToGitHub(imagePath, fileName) {
//     try {
//         const imageData = fs.readFileSync(imagePath, { encoding: 'base64' }); // ✅ Convert to Base64

//         const response = await axios.put(
//             `https://api.github.com/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/contents/${fileName}`,
//             {
//                 message: `Add ${fileName}`,
//                 content: imageData, // ✅ Base64 encoded content
//                 branch: "main",
//             },
//             {
//                 headers: {
//                     Authorization: `token ${process.env.GITHUB_PAT}`,
//                     Accept: "application/vnd.github.v3+json",
//                 },
//             }
//         );

//         return response.data.content.download_url;
//     } catch (error) {
//         console.error("Error uploading image to GitHub:", error.message);
//         throw error;
//     }
// }

// const ImagePath = "uploads/thumbnails/67d860a17351efe5caa0d33d.jpg";
// const FileName = "67d860a17351efe5caa0d33d.jpg";

// uploadImageToGitHub(ImagePath, FileName);




















const fs = require('fs');
const path = require('path');
const util = require('util');
const { Octokit } = require("@octokit/rest");
const dotenv = require('dotenv');
dotenv.config();

const readFilePromise = util.promisify(fs.readFile);

const token = process.env.GITHUB_PAT;
console.log(token);

if (!token) {
  console.error("Expected GITHUB_TOKEN environment variable to create repository. Exiting...");
  process.exit(-1);
}

async function run() {
  const octokit = new Octokit({
    auth: token,
  });



  // Change these values
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const filePath = "uploads/thumbnails/67d860a17351efe5caa0d33d.jpg";
  try {
    // 1️⃣ Create the repository
    await octokit.rest.repos.createForAuthenticatedUser({
      name: repo,
      description: "Testing uploading an image through the GitHub API",
    });

    console.log(`✅ Repository ${repo} created successfully.`);

  } catch (err) {
    if (err.status === 422) {
      console.log(`⚠️ Repository ${repo} already exists. Proceeding...`);
    } else {
      throw err;
    }
  }

  // 2️⃣ Read the file from disk as binary
  const imagePath = path.join(__dirname, filePath);
  const bytes = await readFilePromise(imagePath, "binary");
  const buffer = Buffer.from(bytes, "binary");
  const content = buffer.toString("base64");

  // 3️⃣ Fetch file details (if it exists) to get SHA
  let sha = null;
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: filePath,
    });
    sha = data.sha;
    console.log(`🔄 File ${filePath} already exists. Updating...`);
  } catch (err) {
    if (err.status === 404) {
      console.log(`🆕 File ${filePath} does not exist. Creating...`);
    } else {
      throw err;
    }
  }

  // 4️⃣ Create or update the file in the repository
  const result = await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: filePath,
    message: "Adding an image to the repository",
    content,
    sha, // If sha is null, it creates a new file; otherwise, it updates the existing file
  });

  console.log(`✅ Created commit at ${result.data.commit.html_url}`);
}

run().catch((err) => {
  console.error("❌ Error:", err.message);
});
