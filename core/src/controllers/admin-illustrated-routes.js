const {
  registerAdminIllustratedPurchaseRoutes,
} = require("./admin-illustrated-purchase-routes");

function getAuthorizedAccountId(req, res, { getAccountIdFromRequest, canAccessAccount }) {
  const accountId = getAccountIdFromRequest(req);
  if (!accountId) {
    res.status(400).json({
      ok: false,
      error: "Missing x-account-id",
    });
    return null;
  }

  if (!canAccessAccount(req, accountId)) {
    res.status(403).json({
      ok: false,
      error: "无权访问此账号",
    });
    return null;
  }

  return accountId;
}

function registerAdminIllustratedRoutes({
  app,
  provider,
  adminLogger,
  getAccountIdFromRequest,
  canAccessAccount,
  sendProviderError,
}) {
  const routeContext = {
    provider,
    adminLogger,
    getAccountIdFromRequest,
    canAccessAccount,
    sendProviderError,
  };

  registerAdminIllustratedPurchaseRoutes({
    app,
    ...routeContext,
  });

  app.get("/api/illustrated", async (req, res) => {
    const accountId = getAuthorizedAccountId(req, res, routeContext);
    if (!accountId) return;

    try {
      const data = await provider.getIllustratedSnapshot(accountId);
      res.json({ ok: true, data });
    } catch (err) {
      adminLogger.error("获取图鉴快照失败", {
        error: err.message,
        stack: err.stack,
      });
      sendProviderError(res, err);
    }
  });

  app.post("/api/illustrated/claim", async (req, res) => {
    const accountId = getAuthorizedAccountId(req, res, routeContext);
    if (!accountId) return;

    try {
      const data = await provider.claimIllustratedRewards(accountId, Number(req.body && req.body.type));
      res.json({ ok: true, data });
    } catch (err) {
      adminLogger.error("领取图鉴奖励失败", {
        error: err.message,
        stack: err.stack,
      });
      sendProviderError(res, err);
    }
  });
}

module.exports = { registerAdminIllustratedRoutes };
