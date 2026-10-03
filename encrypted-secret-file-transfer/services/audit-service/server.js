const { loadEnv } = require('../../shared/env');
loadEnv();
const { startService } = require('../../shared/service-kit');

startService({
  name: 'audit-service',
  port: Number(process.env.AUDIT_SERVICE_PORT || 4104),
  routes(app) {
    app.use('/', require('./routes/logs'));
  }
});
