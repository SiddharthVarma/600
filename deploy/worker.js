// Serves the game at varmasiddharth.com/sixhundred/ from its Pages project, under the domain's own address.
// Route: varmasiddharth.com/sixhundred*  (Cloudflare dashboard → Workers & Pages → this Worker → Settings → Domains & Routes)
const PAGES = 'sixhundred.pages.dev';

export default {
  async fetch(request) {
    const url = new URL(request.url);
    // the game's paths are relative to its page, so the page needs its trailing slash
    if (url.pathname === '/sixhundred') return Response.redirect(`${url.origin}/sixhundred/${url.search}`, 301);
    const host = url.host;
    url.host = PAGES;
    const response = await fetch(new Request(url, request), { redirect: 'manual' });
    // Pages' own redirects (e.g. react.html → react) must keep the visitor on this domain
    const location = response.headers.get('Location');
    if (!location || !location.includes(PAGES)) return response;
    const out = new Response(response.body, response);
    out.headers.set('Location', location.replace(PAGES, host));
    return out;
  },
};
