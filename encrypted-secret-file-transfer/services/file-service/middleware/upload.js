// multipart/form-data handling. Files are held in memory (size-limited), encrypted, then written
// once to protected storage - so no plaintext temp file ever touches the disk.
const path = require('path');
const multer = require('multer');
const { HttpError } = require('../../../shared/http');
const { ALLOWED_EXTENSIONS } = require('../../../shared/constants');

const maxMb = Number(process.env.MAX_FILE_SIZE_MB || 10);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxMb * 1024 * 1024, files: 1, fields: 5 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new HttpError(415, `File type "${ext || 'none'}" is not allowed`));
    }
    cb(null, true);
  }
});

module.exports = upload.single('file');
