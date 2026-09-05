/** 접수 알림 — rfq INSERT 웹훅 → 회사 메일
 *
 *  Supabase Dashboard → Database → Webhooks 에서 rfq INSERT 에 이 함수를 겁니다.
 *  메일 발송은 Resend API 를 씁니다 (도메인 metalbridge.ai 인증 후 quote@ 발신).
 *
 *  필요한 시크릿 (supabase secrets set 으로 등록):
 *    RESEND_API_KEY   Resend 대시보드에서 발급
 *    NOTIFY_TO        받을 주소 (기본 team.metalbridge@gmail.com)
 *    NOTIFY_FROM      보내는 주소 (기본 quote@metalbridge.ai — Resend 도메인 인증 필수)
 *    HOOK_SECRET      웹훅 위조 방지 — Webhook 설정의 HTTP 헤더 x-hook-secret 과 같은 값
 *
 *  배포: supabase functions deploy notify-rfq --no-verify-jwt
 *  (--no-verify-jwt: 웹훅은 사용자 토큰 없이 호출됩니다. 인증은 HOOK_SECRET 이 합니다)
 */
Deno.serve(async (req) => {
  const secret = Deno.env.get('HOOK_SECRET') ?? '';
  if (secret && req.headers.get('x-hook-secret') !== secret) {
    return new Response('forbidden', { status: 403 });
  }

  let payload: { type?: string; table?: string; record?: Record<string, unknown> };
  try { payload = await req.json(); } catch { return new Response('bad request', { status: 400 }); }
  if (payload.type !== 'INSERT' || payload.table !== 'rfq' || !payload.record) {
    return new Response('ignored', { status: 200 });
  }

  const r = payload.record as Record<string, string | number | null>;
  const v = (k: string) => (r[k] == null || r[k] === '' ? '-' : String(r[k]));

  // 문의 내용 요약 — 담당자가 메일만 보고도 무엇이 왔는지 알 수 있게
  const rows: [string, string][] = [
    ['접수번호', v('rfq_no')],
    ['연락처', v('contact')],
    ['품목 수', v('item_count')],
    ['발송 가능', v('sendable')],
    ['희망 납기', v('due')],
    ['인도 장소', v('place')],
    ['용도', v('usage')],
    ['표면·마감', v('finish')],
    ['열처리·조질', v('heat')],
    ['가공 범위', v('fab')],
    ['공차', v('tol')],
    ['성적서', v('mtc')],
    ['원산지', v('origin')],
    ['인도 조건', v('incoterm')],
    ['발주 형태', v('order_type')],
  ];
  const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
  const table = rows.map(([k, val]) =>
    `<tr><td style="padding:6px 14px 6px 0;color:#707072;white-space:nowrap">${k}</td>` +
    `<td style="padding:6px 0;color:#0e0e10">${esc(val)}</td></tr>`).join('');

  const html =
    `<div style="font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:14px;line-height:1.6;color:#0e0e10">` +
    `<p style="font-size:16px;margin:0 0 4px"><b>새 견적 문의가 접수되었습니다</b></p>` +
    `<p style="margin:0 0 16px;color:#707072">${esc(v('rfq_no'))} · ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</p>` +
    `<table style="border-collapse:collapse;font-size:14px">${table}</table>` +
    `<p style="margin:18px 0 0"><a href="https://metalbridge.ai/admin" style="color:#0f62fe">백오피스에서 확인 →</a></p>` +
    `<p style="margin:14px 0 0;font-size:12px;color:#9e9ea0">METAL BRIDGE 접수 알림 · 회신은 이 메일이 아니라 백오피스에서 진행하십시오.</p></div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `METAL BRIDGE <${Deno.env.get('NOTIFY_FROM') ?? 'quote@metalbridge.ai'}>`,
      to: [Deno.env.get('NOTIFY_TO') ?? 'team.metalbridge@gmail.com'],
      subject: `[접수] ${v('rfq_no')} · 품목 ${v('item_count')}건 · ${v('contact')}`,
      html,
    }),
  });

  if (!res.ok) {
    // 알림 실패는 접수 자체와 무관해야 합니다 — 로그만 남기고 200 을 돌려줍니다
    console.error('resend 실패', res.status, await res.text());
  }
  return new Response('ok', { status: 200 });
});
