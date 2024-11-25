// utils/driveConfig.js
const multer = require('multer');
const { google } = require('googleapis');
const path = require('path');
const stream = require('stream');
const dotenv = require('dotenv');
dotenv.config();

const getCredentials = () => {
    try {

        const credString = process.env.GOOGLE_CRED;
        const cleanedString = credString.trim().replace(/^{(.*)}$/, '$1');
        const credentials = JSON.parse(`{${cleanedString}}`);
        return credentials;

    } catch (error) {
        console.error('Error parsing Google credentials:', error);
        throw new Error('Invalid Google credentials format in environment variables');
    }
};

// Configure Google Drive API
const auth = new google.auth.GoogleAuth({
    credentials: getCredentials(),
    scopes: ['https://www.googleapis.com/auth/drive']
});

const drive = google.drive({ version: 'v3', auth });

// Configure multer for temporary storage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
        cb(null, true);
    } else {
        cb(new Error('Only images (jpeg, jpg, png, gif) are allowed!'));
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 5
    }
});

// Upload to Google Drive
const uploadToDrive = async (file) => {
    try {
        const bufferStream = new stream.PassThrough();
        bufferStream.end(file.buffer);

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const fileName = `${file.fieldname}-${uniqueSuffix}${ext}`;

        const response = await drive.files.create({
            requestBody: {
                name: fileName,
                parents: ['1WJmTcDAEeoS687Hzp8FflfT9YR5btXn9'],
                mimeType: file.mimetype
            },
            media: {
                mimeType: file.mimetype,
                body: bufferStream
            },
            fields: 'id,webViewLink'
        });

        // Make the file publicly accessible
        await drive.permissions.create({
            fileId: response.data.id,
            requestBody: {
                role: 'writer',
                type: 'anyone'
            }
        });

        return {
            fileId: response.data.id,
            webViewLink: response.data.webViewLink,
            // Direct download link
            downloadLink: `https://drive.google.com/uc?export=view&id=${response.data.id}`
        };
    } catch (error) {
        console.error('Error uploading to Google Drive:', error);
        throw error;
    }
};

// Middleware to handle file upload
const handleFileUpload = async (req, res, next) => {
    try {
        if (!req.file && !req.files) {
            return next();
        }

        if (req.file) {
            // Single file upload
            const result = await uploadToDrive(req.file);
            req.fileData = result;
        } else if (req.files) {
            // Multiple files upload
            req.fileData = await Promise.all(req.files.map(uploadToDrive));
        }
        next();
    } catch (error) {
        next(error);
    }
};

// Error handler
const handleMulterError = (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: 'File size limit exceeded. Maximum size is 5MB.'
            });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                error: 'Too many files. Maximum is 5 files per request.'
            });
        }
        return res.status(400).json({ error: error.message });
    }
    if (error) {
        return res.status(400).json({ error: error.message });
    }
    next();
};

// Delete file from Google Drive
const removeUploadedFile = async (fileId) => {
    try {
        await drive.files.delete({
            fileId: fileId
        });
    } catch (err) {
        console.error('Error removing file from Google Drive:', err);
    }
};

module.exports = {
    upload,
    handleFileUpload,
    handleMulterError,
    removeUploadedFile
};