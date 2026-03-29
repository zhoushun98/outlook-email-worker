import { Env, AccountRow } from "./types";
import { authenticate, corsPreflightResponse, jsonOk, jsonError } from "./auth";
import { getAccessToken } from "./graph";
import { handleGroups } from "./routes/groups";
import { handleAccounts } from "./routes/accounts";
import { handleEmails } from "./routes/emails";
import FRONTEND_HTML from "./frontend.html";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // CORS preflight
    if (request.method === "OPTIONS") {
      return corsPreflightResponse();
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // 健康检查（无需认证）
    if (path === "/api/health") {
      return jsonOk({ status: "ok", timestamp: new Date().toISOString() });
    }

    // API 路由需要认证
    if (path.startsWith("/api/")) {
      const authError = authenticate(request, env);
      if (authError) return authError;

      const parts = path.split("/").filter(Boolean); // ["api", "groups", ...]

      if (parts[1] === "groups") {
        return handleGroups(request, env, parts);
      }

      if (parts[1] === "accounts") {
        return handleAccounts(request, env, parts);
      }

      if (parts[1] === "emails") {
        return handleEmails(request, env, parts);
      }

      return jsonError("Not found", 404);
    }

    // 根路径 - 返回前端页面
    if (path === "/" || path === "/index.html") {
      const html = FRONTEND_HTML;
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return jsonError("Not found", 404);
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    // 定时检查账号健康状态
    const { results: accounts } = await env.DB.prepare(
      "SELECT id, email, client_id, refresh_token FROM accounts WHERE status = 'active'"
    ).all<AccountRow>();

    for (const account of accounts) {
      const result = await getAccessToken(account.client_id, account.refresh_token);

      if (!result.accessToken) {
        // Token 失效，标记账号状态
        await env.DB.prepare(
          "UPDATE accounts SET status = 'error', updated_at = datetime('now') WHERE id = ?"
        )
          .bind(account.id)
          .run();
        console.log(`Account ${account.email}: token refresh failed - ${result.error}`);
      } else {
        // Token 有效，如果有新的 refresh_token 则更新
        if (result.newRefreshToken) {
          await env.DB.prepare(
            "UPDATE accounts SET refresh_token = ?, updated_at = datetime('now') WHERE id = ?"
          )
            .bind(result.newRefreshToken, account.id)
            .run();
        }
        console.log(`Account ${account.email}: healthy`);
      }
    }

    console.log(`Scheduled check completed: ${accounts.length} accounts processed`);
  },
} satisfies ExportedHandler<Env>;
