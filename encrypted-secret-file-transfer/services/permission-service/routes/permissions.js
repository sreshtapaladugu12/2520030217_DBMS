const router = require('express').Router();
const c = require('../controllers/permissionController');
const { authenticate } = require('../../../shared/auth');

router.use(authenticate);
router.post('/', c.grant);
router.get('/:fileId', c.listForFile);
router.delete('/:id', c.revoke);

module.exports = router;
