const { google } = require("googleapis");
const drive = google.drive("v3");

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
