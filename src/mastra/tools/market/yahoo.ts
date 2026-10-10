const YAHOO_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

let cachedCrumb: { value: string; cookie: string; expiresAt: number } | null = null;

export async function yahooCrumb(): Promise<{ crumb: string; cookie: string }> {
  if (cachedCrumb && cachedCrumb.expiresAt > Date.now()) {
    return { crumb: cachedCrumb.value, cookie: cachedCrumb.cookie };
  }
  const cookieRes = await fetch('https://fc.yahoo.com', {
    headers: { 'User-Agent': YAHOO_UA },
    redirect: 'follow',
    signal: AbortSignal.timeout(15_000),
  });
  const setCookie = cookieRes.headers.getSetCookie?.() ?? [];
  const cookie = setCookie.map(c => c.split(';')[0]).join('; ');

  const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': YAHOO_UA, Cookie: cookie },
    signal: AbortSignal.timeout(15_000),
  });
  const crumb = (await crumbRes.text()).trim();
  if (!crumb || crumb.length > 30) throw new Error('No se pudo obtener el crumb de Yahoo Finance');
  cachedCrumb = { value: crumb, cookie, expiresAt: Date.now() + 60 * 60 * 1000 };
  return { crumb, cookie };
}

export async function yahooJson(path: string, opts: { crumb?: boolean } = {}): Promise<any> {
  const headers: Record<string, string> = { 'User-Agent': YAHOO_UA, Accept: 'application/json' };
  let url = path.startsWith('http') ? path : `https://query2.finance.yahoo.com${path}`;
  if (opts.crumb) {
    const { crumb, cookie } = await yahooCrumb();
    headers.Cookie = cookie;
    url += (url.includes('?') ? '&' : '?') + `crumb=${encodeURIComponent(crumb)}`;
  }
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Yahoo Finance HTTP ${res.status} en ${url.replace(/\?.*/, '')}: ${body.slice(0, 150)}`);
  }
  return res.json();
}

export function unwrapYahoo(json: any, context: string): any {
  const result = json?.chart?.result?.[0] ?? json?.quoteSummary?.result?.[0] ?? json?.quotes ?? null;
  if (result === null || result === undefined) {
    const err = json?.chart?.error?.description ?? json?.quoteSummary?.error?.description ?? 'respuesta vacía';
    throw new Error(`Yahoo Finance no devolvió datos para ${context}: ${err}`);
  }
  return result;
}
