// Bot trọng tài tự động: nhận webhook từ Cusdis, tự bấm Approve ngay lập tức.
// Chạy trên Deno Deploy (miễn phí): dash.deno.com -> New Playground -> dán code này -> Save & Deploy
// Lấy URL https://xxxx.deno.dev dán vào Cusdis -> Site settings -> Webhook.

Deno.serve(async (req: Request) => {
  if (req.method === "POST") {
    try {
      const body = await req.json();
      const link: string | undefined = body?.data?.approve_link;
      if (link) {
        const token = new URL(link).searchParams.get("token");
        if (token) {
          // GET /api/open/approve?token=... -> Cusdis duyệt comment ngay
          const res = await fetch(
            "https://cusdis.com/api/open/approve?token=" + encodeURIComponent(token),
          );
          console.log("approve:", res.status, await res.text());
        }
      }
    } catch (e) {
      console.error("bad payload", e);
    }
  }
  return new Response("ok");
});
