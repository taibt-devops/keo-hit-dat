// Bot trọng tài tự động: nhận webhook từ Cusdis, tự bấm Approve ngay lập tức.
// Chạy trên Deno Deploy (miễn phí): dash.deno.com -> Playground -> dán code này -> Save & Deploy
// Lấy URL https://xxxx.deno.net dán vào Cusdis -> Site settings -> Webhook -> Save.
// Debug: mở https://xxxx.deno.net/last để xem các webhook gần nhất bot nhận được.

const events: unknown[] = [];

function log(ev: Record<string, unknown>) {
  events.unshift({ at: new Date().toISOString(), ...ev });
  if (events.length > 20) events.pop();
  console.log(JSON.stringify(ev));
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname === "/last") {
    return new Response(JSON.stringify(events, null, 2), {
      headers: { "content-type": "application/json" },
    });
  }

  if (req.method === "POST") {
    let raw = "";
    try {
      raw = await req.text();
      const body = JSON.parse(raw);
      const link: string | undefined = body?.data?.approve_link;
      if (link) {
        const token = new URL(link).searchParams.get("token") ?? "";
        const res = await fetch(
          "https://cusdis.com/api/open/approve?token=" + encodeURIComponent(token),
          { headers: { "User-Agent": "Mozilla/5.0 (compatible; AutoApproveBot/1.0)" } },
        );
        const text = await res.text();
        log({ ok: true, nickname: body?.data?.by_nickname, approveStatus: res.status, approveText: text });
      } else {
        log({ ok: false, reason: "no approve_link", raw: raw.slice(0, 500) });
      }
    } catch (e) {
      log({ ok: false, reason: String(e), raw: raw.slice(0, 500) });
    }
  }

  return new Response("ok");
});
