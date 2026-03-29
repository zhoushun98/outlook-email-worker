import { Env, AccountWithGroup } from "../types";
import { jsonOk, jsonError } from "../auth";

export async function handleAccounts(
  request: Request,
  env: Env,
  pathParts: string[]
): Promise<Response> {
  // GET /api/accounts
  if (request.method === "GET" && pathParts.length === 2) {
    return listAccounts(request, env);
  }

  // GET /api/accounts/:id
  if (request.method === "GET" && pathParts.length === 3) {
    return getAccount(env, Number(pathParts[2]));
  }

  // POST /api/accounts
  if (request.method === "POST" && pathParts.length === 2) {
    return addAccounts(request, env);
  }

  // PUT /api/accounts/:id
  if (request.method === "PUT" && pathParts.length === 3) {
    return updateAccount(request, env, Number(pathParts[2]));
  }

  // DELETE /api/accounts/:id
  if (request.method === "DELETE" && pathParts.length === 3) {
    return deleteAccount(env, Number(pathParts[2]));
  }

  return jsonError("Not found", 404);
}

async function listAccounts(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const groupId = url.searchParams.get("group_id");

  let query = `
    SELECT a.*, g.name as group_name, g.color as group_color
    FROM accounts a
    LEFT JOIN groups g ON a.group_id = g.id
  `;
  const binds: unknown[] = [];

  if (groupId) {
    query += " WHERE a.group_id = ?";
    binds.push(Number(groupId));
  }

  query += " ORDER BY a.created_at DESC";

  const stmt = env.DB.prepare(query);
  const { results } = binds.length
    ? await stmt.bind(...binds).all<AccountWithGroup>()
    : await stmt.all<AccountWithGroup>();

  // 隐藏敏感信息
  const accounts = results.map((a) => ({
    ...a,
    refresh_token: a.refresh_token.slice(0, 20) + "...",
  }));

  return jsonOk({ accounts });
}

async function getAccount(env: Env, id: number): Promise<Response> {
  const account = await env.DB.prepare(`
    SELECT a.*, g.name as group_name, g.color as group_color
    FROM accounts a
    LEFT JOIN groups g ON a.group_id = g.id
    WHERE a.id = ?
  `)
    .bind(id)
    .first<AccountWithGroup>();

  if (!account) {
    return jsonError("账号不存在", 404);
  }

  return jsonOk({ account });
}

interface AddAccountBody {
  email?: string;
  password?: string;
  client_id?: string;
  refresh_token?: string;
  group_id?: number;
  remark?: string;
  account_string?: string;
}

function parseAccountString(
  line: string
): { email: string; password: string; client_id: string; refresh_token: string } | null {
  const parts = line.split("----");
  if (parts.length >= 4) {
    return {
      email: parts[0].trim(),
      password: parts[1].trim(),
      client_id: parts[2].trim(),
      refresh_token: parts[3].trim(),
    };
  }
  return null;
}

async function addAccounts(request: Request, env: Env): Promise<Response> {
  const body = await request.json<AddAccountBody>();

  // 批量导入模式
  if (body.account_string) {
    const lines = body.account_string
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    let added = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const line of lines) {
      const parsed = parseAccountString(line);
      if (!parsed) {
        failed++;
        errors.push(`格式错误: ${line.slice(0, 30)}...`);
        continue;
      }

      try {
        await env.DB.prepare(
          "INSERT INTO accounts (email, password, client_id, refresh_token, group_id, remark) VALUES (?, ?, ?, ?, ?, ?)"
        )
          .bind(
            parsed.email,
            parsed.password,
            parsed.client_id,
            parsed.refresh_token,
            body.group_id ?? 1,
            body.remark ?? ""
          )
          .run();
        added++;
      } catch {
        failed++;
        errors.push(`已存在或失败: ${parsed.email}`);
      }
    }

    return jsonOk({ message: `导入完成: 成功 ${added}, 失败 ${failed}`, added, failed, errors });
  }

  // 单个添加模式
  if (!body.email || !body.client_id || !body.refresh_token) {
    return jsonError("email, client_id, refresh_token 为必填字段");
  }

  try {
    const result = await env.DB.prepare(
      "INSERT INTO accounts (email, password, client_id, refresh_token, group_id, remark) VALUES (?, ?, ?, ?, ?, ?)"
    )
      .bind(
        body.email.trim(),
        body.password ?? "",
        body.client_id.trim(),
        body.refresh_token.trim(),
        body.group_id ?? 1,
        body.remark ?? ""
      )
      .run();

    return jsonOk({ id: result.meta.last_row_id, message: "账号添加成功" });
  } catch {
    return jsonError("邮箱已存在");
  }
}

async function updateAccount(
  request: Request,
  env: Env,
  id: number
): Promise<Response> {
  const body = await request.json<Partial<AddAccountBody> & { status?: string }>();

  const existing = await env.DB.prepare("SELECT * FROM accounts WHERE id = ?")
    .bind(id)
    .first();
  if (!existing) {
    return jsonError("账号不存在", 404);
  }

  await env.DB.prepare(`
    UPDATE accounts
    SET email = ?, password = ?, client_id = ?, refresh_token = ?,
        group_id = ?, remark = ?, status = ?, updated_at = datetime('now')
    WHERE id = ?
  `)
    .bind(
      body.email ?? existing.email,
      body.password ?? existing.password,
      body.client_id ?? existing.client_id,
      body.refresh_token ?? existing.refresh_token,
      body.group_id ?? existing.group_id,
      body.remark ?? existing.remark,
      body.status ?? existing.status,
      id
    )
    .run();

  return jsonOk({ message: "账号更新成功" });
}

async function deleteAccount(env: Env, id: number): Promise<Response> {
  const existing = await env.DB.prepare("SELECT * FROM accounts WHERE id = ?")
    .bind(id)
    .first();
  if (!existing) {
    return jsonError("账号不存在", 404);
  }

  await env.DB.prepare("DELETE FROM accounts WHERE id = ?").bind(id).run();
  return jsonOk({ message: "账号删除成功" });
}
