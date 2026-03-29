import { Env, AccountRow } from "../types";
import { jsonOk, jsonError } from "../auth";
import { getInboxMessages, getMessageDetail } from "../graph";

export async function handleEmails(
  request: Request,
  env: Env,
  pathParts: string[]
): Promise<Response> {
  if (request.method !== "GET") {
    return jsonError("Method not allowed", 405);
  }

  // GET /api/emails/:email
  if (pathParts.length === 3) {
    return listEmails(request, env, decodeURIComponent(pathParts[2]));
  }

  // GET /api/emails/:email/:messageId
  if (pathParts.length === 4) {
    return getEmailDetail(env, decodeURIComponent(pathParts[2]), pathParts[3]);
  }

  return jsonError("Not found", 404);
}

async function listEmails(
  request: Request,
  env: Env,
  email: string
): Promise<Response> {
  const account = await env.DB.prepare("SELECT * FROM accounts WHERE email = ?")
    .bind(email)
    .first<AccountRow>();

  if (!account) {
    return jsonError("账号不存在", 404);
  }

  if (account.status !== "active") {
    return jsonError("账号已停用");
  }

  const url = new URL(request.url);
  const top = Number(url.searchParams.get("top") ?? 20);

  const result = await getInboxMessages(account.client_id, account.refresh_token, top);

  if (!result.emails) {
    return jsonError(result.error ?? "获取邮件失败");
  }

  const emails = result.emails.map((msg) => ({
    id: msg.id,
    subject: msg.subject,
    from: msg.from?.emailAddress?.address ?? "未知",
    from_name: msg.from?.emailAddress?.name ?? "",
    date: msg.receivedDateTime,
    is_read: msg.isRead,
    has_attachments: msg.hasAttachments,
    body_preview: msg.bodyPreview,
  }));

  return jsonOk({ email: account.email, count: emails.length, emails });
}

async function getEmailDetail(
  env: Env,
  email: string,
  messageId: string
): Promise<Response> {
  const account = await env.DB.prepare("SELECT * FROM accounts WHERE email = ?")
    .bind(email)
    .first<AccountRow>();

  if (!account) {
    return jsonError("账号不存在", 404);
  }

  const result = await getMessageDetail(account.client_id, account.refresh_token, messageId);

  if (!result.email) {
    return jsonError(result.error ?? "获取邮件详情失败");
  }

  const msg = result.email;
  return jsonOk({
    email: {
      id: msg.id,
      subject: msg.subject,
      from: msg.from?.emailAddress?.address ?? "未知",
      from_name: msg.from?.emailAddress?.name ?? "",
      to: msg.toRecipients?.map((r) => r.emailAddress.address) ?? [],
      cc: msg.ccRecipients?.map((r) => r.emailAddress.address) ?? [],
      date: msg.receivedDateTime,
      is_read: msg.isRead,
      has_attachments: msg.hasAttachments,
      body_preview: msg.bodyPreview,
      body: msg.body?.content ?? "",
      body_type: msg.body?.contentType ?? "text",
    },
  });
}
