import multer from 'multer';

// Memory storage allows us to upload directly to Cloudinary
const storage = multer.memoryStorage();
export const upload = multer({ storage });
