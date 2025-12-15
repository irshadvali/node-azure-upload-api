import express from "express";
import multer from "multer";
import dotenv from "dotenv";
import { BlobServiceClient } from "@azure/storage-blob";

dotenv.config();
const app = express();
app.use(express.json());
console.log("ACCOUNT:", process.env.AZURE_STORAGE_ACCOUNT_NAME);
console.log("SAS:", process.env.AZURE_STORAGE_SAS_TOKEN);
console.log("CONTAINER:", process.env.AZURE_CONTAINER_NAME);
// Multer memory storage (no temp files needed)
const upload = multer({ storage: multer.memoryStorage() });

// Load environment variables
const account = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const sasToken = process.env.AZURE_STORAGE_SAS_TOKEN; // starts with ?
const containerName = process.env.AZURE_CONTAINER_NAME;

// Validate required values
if (!account || !sasToken) {
  console.error("❌ ERROR: Missing Azure account or SAS Token");
  process.exit(1);
}

// Initialize Blob Service Client using SAS Token
const blobServiceClient = new BlobServiceClient(
  `https://${account}.blob.core.windows.net${sasToken}`
);

const containerClient = blobServiceClient.getContainerClient(containerName);

// ------------------------------------------------------
// ➤ Upload File API (Memory-based, no temp folder needed)
// ------------------------------------------------------
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;

    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const blobName = file.originalname;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    await blockBlobClient.uploadData(file.buffer, {
      blobHTTPHeaders: { blobContentType: file.mimetype },
    });

    res.json({
      message: "File uploaded successfully",
      blobName,
      url: blockBlobClient.url,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ------------------------------------------------------
// ➤ List Files API
// ------------------------------------------------------
app.get("/files", async (req, res) => {
  try {
    const files = [];
    for await (const blob of containerClient.listBlobsFlat()) {
      files.push(blob.name);
    }
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ------------------------------------------------------
// ➤ Download File API
// ------------------------------------------------------
app.get("/download/:name", async (req, res) => {
  try {
    const blobName = req.params.name;
    const blobClient = containerClient.getBlobClient(blobName);

    const downloadBlock = await blobClient.download();
    res.setHeader("Content-Disposition", `attachment; filename="${blobName}"`);
    
    downloadBlock.readableStreamBody.pipe(res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ------------------------------------------------------
// ➤ Delete File API
// ------------------------------------------------------
app.delete("/delete/:name", async (req, res) => {
  try {
    const blobName = req.params.name;
    const blobClient = containerClient.getBlobClient(blobName);

    await blobClient.delete();
    res.json({ message: `${blobName} deleted successfully` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ------------------------------------------------------
app.listen(process.env.PORT, () => {
  console.log("🚀 Server running on port " + process.env.PORT);
});
