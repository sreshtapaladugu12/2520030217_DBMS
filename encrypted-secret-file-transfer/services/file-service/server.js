const { loadEnv } = require('../../shared/env');
loadEnv();
const { startService } = require('../../shared/service-kit');
const { ensureStorage } = require('./utils/storage');

ensureStorage();
startService({
  name: 'file-service',
  port: Number(process.env.FILE_SERVICE_PORT || 4102),
  routes(app) {
    app.use('/files', require('./routes/files'));
    app.use('/internal', require('./routes/internal'));
  }
});
