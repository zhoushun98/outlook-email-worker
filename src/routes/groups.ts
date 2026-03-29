import { Env, GroupWithCount } from "../types";
import { jsonOk, jsonError } from "../auth";

export async function handleGroups(
  request: Request,
  env: Env,
  pathParts: string[]
): Promise<Response> {
  // GET /api/groups
  if (request.method === "GET" && pathParts.length === 2) {
    return listGroups(env);
  }

  // POST /api/groups
  if (request.method === "POST" && pathParts.length === 2) {
    return createGroup(request, env);
  }

  // PUT /api/groups/:id
  if (request.method === "PUT" && pathParts.length === 3) {
    return updateGroup(request, env, Number(pathParts[2]));
  }

  // DELETE /api/groups/:id
  if (request.method === "DELETE" && pathParts.length === 3) {
    return deleteGroup(env, Number(pathParts[2]));
  }

  return jsonError("Not found", 404);
}

async function listGroups(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(`
    SELECT g.*, COUNT(a.id) as account_count
    FROM groups g
    LEFT JOIN accounts a ON g.id = a.group_id
    GROUP BY g.id
    ORDER BY g.id
  `).all<GroupWithCount>();

  return jsonOk({ groups: results });
}

async function createGroup(request: Request, env: Env): Promise<Response> {
  const body = await request.json<{ name?: string; description?: string; color?: string }>();
  if (!body.name?.trim()) {
    return jsonError("分组名称不能为空");
  }

  try {
    const result = await env.DB.prepare(
      "INSERT INTO groups (name, description, color) VALUES (?, ?, ?)"
    )
      .bind(body.name.trim(), body.description ?? "", body.color ?? "#1a1a1a")
      .run();

    return jsonOk({ id: result.meta.last_row_id, message: "分组创建成功" });
  } catch {
    return jsonError("分组名称已存在");
  }
}

async function updateGroup(
  request: Request,
  env: Env,
  id: number
): Promise<Response> {
  const body = await request.json<{ name?: string; description?: string; color?: string }>();

  const existing = await env.DB.prepare("SELECT * FROM groups WHERE id = ?")
    .bind(id)
    .first();
  if (!existing) {
    return jsonError("分组不存在", 404);
  }

  try {
    await env.DB.prepare(
      "UPDATE groups SET name = ?, description = ?, color = ? WHERE id = ?"
    )
      .bind(
        body.name ?? existing.name,
        body.description ?? existing.description,
        body.color ?? existing.color,
        id
      )
      .run();

    return jsonOk({ message: "分组更新成功" });
  } catch {
    return jsonError("分组名称已存在");
  }
}

async function deleteGroup(env: Env, id: number): Promise<Response> {
  if (id === 1) {
    return jsonError("不能删除默认分组");
  }

  const existing = await env.DB.prepare("SELECT * FROM groups WHERE id = ?")
    .bind(id)
    .first();
  if (!existing) {
    return jsonError("分组不存在", 404);
  }

  // 将该分组下的账号移到默认分组
  await env.DB.prepare("UPDATE accounts SET group_id = 1 WHERE group_id = ?")
    .bind(id)
    .run();

  await env.DB.prepare("DELETE FROM groups WHERE id = ?").bind(id).run();

  return jsonOk({ message: "分组删除成功" });
}
