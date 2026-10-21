const BUY_ALL_DELAY_MS = 200;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

function registerAdminIllustratedPurchaseRoutes({
  app,
  provider,
  adminLogger,
  getAccountIdFromRequest,
  canAccessAccount,
  sendProviderError,
}) {
  const routeContext = {
    getAccountIdFromRequest,
    canAccessAccount,
  };

  app.post("/api/illustrated/buy", async (req, res) => {
    const accountId = getAuthorizedAccountId(req, res, routeContext);
    if (!accountId) return;

    try {
      const { goodsId, price } = req.body || {};
      if (!goodsId) {
        return res.status(400).json({
          ok: false,
          error: "缺少商品ID",
        });
      }

      const result = await provider.buyGoods(accountId, goodsId, 1, price || 0);
      adminLogger.info("图鉴购买种子成功", {
        accountId,
        goodsId,
        price,
      });

      res.json({
        ok: true,
        data: result,
      });
    } catch (err) {
      adminLogger.error("图鉴购买种子失败", {
        error: err.message,
        stack: err.stack,
      });
      sendProviderError(res, err);
    }
  });

  app.post("/api/illustrated/buy-all", async (req, res) => {
    const accountId = getAuthorizedAccountId(req, res, routeContext);
    if (!accountId) return;

    try {
      const illustratedType = Number(req.body?.illustrated_type) || 1;
      const snapshot = await provider.getIllustratedSnapshot(accountId);
      const book = illustratedType === 2 ? snapshot?.mutant : snapshot?.crop;
      const buyableItems = (book?.items || []).filter(
        item => item.shopSeed?.goodsId && !item.shopSeed.locked && !item.shopSeed.soldOut && !item.shopSeed.unknownMeta,
      );

      adminLogger.info("图鉴一键购买开始", {
        accountId,
        count: buyableItems.length,
      });

      const results = [];
      let successCount = 0;
      let failCount = 0;

      for (const item of buyableItems) {
        try {
          await provider.buyGoods(accountId, item.shopSeed.goodsId, 1, item.shopSeed.price || 0);
          results.push({
            seedId: item.seedId,
            name: item.name,
            goodsId: item.shopSeed.goodsId,
            success: true,
          });
          successCount++;
          await delay(BUY_ALL_DELAY_MS);
        } catch (err) {
          results.push({
            seedId: item.seedId,
            name: item.name,
            goodsId: item.shopSeed.goodsId,
            success: false,
            error: err.message,
          });
          failCount++;
        }
      }

      adminLogger.info("图鉴一键购买完成", {
        accountId,
        successCount,
        failCount,
      });

      res.json({
        ok: true,
        data: {
          total: buyableItems.length,
          successCount,
          failCount,
          results,
        },
      });
    } catch (err) {
      adminLogger.error("图鉴一键购买失败", {
        error: err.message,
        stack: err.stack,
      });
      sendProviderError(res, err);
    }
  });
}

module.exports = { registerAdminIllustratedPurchaseRoutes };
