// Backend bình luận tự nuôi cho keo-hit-dat — chạy trên Deno Deploy playground + Deno KV (miễn phí).
// Dán toàn bộ file này vào playground (dash.deno.com) -> Save & Deploy. Không cần Cusdis nữa.
//
// API:
//   GET    /comments?page=keo-hit-dat            -> danh sách comment (mới nhất trước)
//   POST   /comments {page, nickname, content}   -> đăng comment, hiện ngay
//   DELETE /comments?page=..&id=..&key=..        -> xóa (chỉ hoạt động khi đặt env ADMIN_KEY)

const kv = await Deno.openKv();

const MAX_NICK = 40;
const MAX_TEXT = 1000;
const LIST_LIMIT = 100;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  if (url.pathname === "/comments" && req.method === "GET") {
    const page = url.searchParams.get("page") ?? "";
    if (!page) return json({ error: "page required" }, 400);
    const items: unknown[] = [];
    for await (const e of kv.list({ prefix: ["c", page] }, { reverse: true, limit: LIST_LIMIT })) {
      items.push(e.value);
    }
    return json({ data: items });
  }

  if (url.pathname === "/comments" && req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "bad json" }, 400);
    }
    const page = String(body?.page ?? "").slice(0, 64);
    const nickname = String(body?.nickname ?? "").trim().slice(0, MAX_NICK);
    const content = String(body?.content ?? "").trim().slice(0, MAX_TEXT);
    if (!page || !nickname || !content) return json({ error: "thiếu tên hoặc nội dung" }, 400);

    // chặn spam thô: mỗi IP tối đa 6 comment / phút
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const bucket = ["rl", ip, Math.floor(Date.now() / 60000)];
    const cur = (await kv.get<number>(bucket)).value ?? 0;
    if (cur >= 6) return json({ error: "chậm thôi chiến hữu, spam quá 😅" }, 429);
    await kv.set(bucket, cur + 1, { expireIn: 120_000 });

    const c = {
      id: crypto.randomUUID(),
      nickname,
      content,
      createdAt: new Date().toISOString(),
    };
    await kv.set(["c", page, Date.now(), c.id], c);
    return json({ data: c });
  }

  if (url.pathname === "/comments" && req.method === "DELETE") {
    const adminKey = Deno.env.get("ADMIN_KEY");
    if (!adminKey || url.searchParams.get("key") !== adminKey) return json({ error: "forbidden" }, 403);
    const page = url.searchParams.get("page") ?? "";
    const id = url.searchParams.get("id") ?? "";
    for await (const e of kv.list({ prefix: ["c", page] })) {
      if ((e.value as { id: string }).id === id) {
        await kv.delete(e.key);
        return json({ ok: true });
      }
    }
    return json({ error: "not found" }, 404);
  }

  return new Response("keo-hit-dat comments API", { headers: CORS });
});
