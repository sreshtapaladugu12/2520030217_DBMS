const { loadEnv } = require('../../shared/env');
loadEnv();
const { startService } = require('../../shared/service-kit');

startService({
  name: 'permission-service',
  port: Number(process.env.PERMISSION_SERVICE_PORT || 4103),
  routes(app) {
    app.use('/permissions', require('./routes/permissions'));
    app.use('/internal', require('./routes/internal'));
  }
});
