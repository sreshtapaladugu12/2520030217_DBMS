const router = require('express').Router();
const c = require('../controllers/fileController');
const uploadMiddleware = require('../middleware/upload');
const { authenticate } = require('../../../shared/auth');

router.use(authenticate); // every file route requires a valid JWT
router.post('/upload', uploadMiddleware, c.upload);
router.get('/', c.list);
router.get('/:id', c.details);
router.get('/:id/download', c.download);
router.delete('/:id', c.remove);

module.exports = router;
