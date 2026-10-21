const { getAuthorizedAccountId } = require('./admin-activity-route-helpers');

function registerAdminSolarCalendarRoutes({
  app,
  provider,
  logger,
  getAccountIdFromRequest,
  canAccessAccount,
  sendProviderError,
}) {
  const routeContext = { getAccountIdFromRequest, canAccessAccount };

  app.get('/api/solar-calendar', async (req, res) => {
    const accountId = getAuthorizedAccountId(req, res, routeContext);
    if (!accountId) return;
    try {
      const data = await provider.getSolarCalendar(accountId);
      res.json({ ok: true, data });
    } catch (err) {
      if (logger) logger.error('获取节令日历失败', { error: err.message, stack: err.stack });
      sendProviderError(res, err);
    }
  });

  app.post('/api/solar-calendar/:action', async (req, res) => {
    const accountId = getAuthorizedAccountId(req, res, routeContext);
    if (!accountId) return;
    try {
      const data = await provider.operateSolarCalendar(accountId, req.params.action, req.body || {});
      res.json({ ok: true, data });
    } catch (err) {
      if (logger) logger.error('节令日历操作失败', { error: err.message, stack: err.stack, action: req.params.action });
      sendProviderError(res, err);
    }
  });
}

module.exports = { registerAdminSolarCalendarRoutes };