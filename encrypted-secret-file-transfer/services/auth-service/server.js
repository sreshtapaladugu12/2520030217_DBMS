const { loadEnv } = require('../../shared/env');
loadEnv();
const { startService } = require('../../shared/service-kit');

startService({
  name: 'auth-service',
  port: Number(process.env.AUTH_SERVICE_PORT || 4101),
  routes(app) {
    app.use('/auth', require('./routes/auth'));
    app.use('/internal', require('./routes/internal'));
    app.use('/admin', require('./routes/admin'));
  }
});
