import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 300; // 5 min CDN cache

// Served at /widget.js — drop this <script> on any site to render a CaterOS lead form
// into <div data-cateros-form data-org="your-slug">.
const WIDGET = String.raw`
(function(){
  if (window.__caterosWidget) return;
  window.__caterosWidget = true;

  // Derive API base from the <script> src so the widget works across envs.
  var scriptEl = document.currentScript || (function(){
    var s = document.getElementsByTagName('script');
    return s[s.length - 1];
  })();
  var srcUrl;
  try { srcUrl = new URL(scriptEl.src); } catch (e) { srcUrl = new URL(location.href); }
  var API_BASE = srcUrl.origin;

  var STYLE_ID = 'cateros-widget-style';
  function injectStyles(){
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '.cateros-form{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#18181b}',
      '.cateros-form *{box-sizing:border-box}',
      '.cateros-form .cx-row{display:grid;gap:12px;margin-bottom:12px}',
      '.cateros-form .cx-2col{grid-template-columns:1fr 1fr}',
      '.cateros-form label{display:block;font-size:13px;font-weight:500;margin-bottom:4px;color:#52525b}',
      '.cateros-form input,.cateros-form textarea,.cateros-form select{width:100%;padding:10px 12px;border:1px solid #d4d4d8;border-radius:8px;font-size:14px;font-family:inherit;background:#fff;color:#18181b;transition:border-color .15s,box-shadow .15s}',
      '.cateros-form input:focus,.cateros-form textarea:focus,.cateros-form select:focus{outline:none;border-color:var(--cx-accent,#ea580c);box-shadow:0 0 0 3px color-mix(in srgb,var(--cx-accent,#ea580c) 18%,transparent)}',
      '.cateros-form textarea{min-height:100px;resize:vertical}',
      '.cateros-form .cx-btn{width:100%;padding:12px 16px;border:none;border-radius:8px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;background:var(--cx-accent,#ea580c);color:#fff;transition:filter .15s}',
      '.cateros-form .cx-btn:hover{filter:brightness(.95)}',
      '.cateros-form .cx-btn:disabled{opacity:.6;cursor:wait}',
      '.cateros-form .cx-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}',
      '.cateros-form .cx-msg{margin-top:12px;padding:12px;border-radius:8px;font-size:14px}',
      '.cateros-form .cx-ok{background:#dcfce7;color:#166534}',
      '.cateros-form .cx-err{background:#fee2e2;color:#991b1b}',
      '.cateros-form .cx-powered{margin-top:10px;text-align:center;font-size:11px;color:#a1a1aa}',
      '.cateros-form .cx-powered a{color:inherit;text-decoration:none}',
      '.cateros-form .cx-powered a:hover{text-decoration:underline}'
    ].join('');
    document.head.appendChild(s);
  }

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

  function render(host){
    var slug = host.getAttribute('data-org');
    if (!slug){ host.innerHTML = '<em style="color:#b91c1c">cateros: missing data-org attribute</em>'; return; }
    var accent = host.getAttribute('data-accent') || '';
    var thanks = host.getAttribute('data-thanks') || "Thanks! We'll be in touch shortly.";
    var btnLabel = host.getAttribute('data-button') || 'Request a quote';
    var hideBranding = host.getAttribute('data-hide-branding') === 'true';

    var style = accent ? ' style="--cx-accent:' + esc(accent) + '"' : '';
    host.innerHTML =
      '<form class="cateros-form"' + style + ' novalidate>' +
        '<input class="cx-hp" type="text" name="website" autocomplete="off" tabindex="-1" aria-hidden="true"/>' +
        '<div class="cx-row cx-2col">' +
          '<div><label>First name</label><input name="first_name" required/></div>' +
          '<div><label>Last name</label><input name="last_name"/></div>' +
        '</div>' +
        '<div class="cx-row cx-2col">' +
          '<div><label>Email</label><input name="email" type="email" required/></div>' +
          '<div><label>Phone</label><input name="phone" type="tel"/></div>' +
        '</div>' +
        '<div class="cx-row"><div><label>Company</label><input name="company"/></div></div>' +
        '<div class="cx-row cx-2col">' +
          '<div><label>Event date</label><input name="event_date" type="date"/></div>' +
          '<div><label>Head count</label><input name="headcount" type="number" min="0"/></div>' +
        '</div>' +
        '<div class="cx-row"><div><label>Tell us about your event</label><textarea name="message" rows="4"></textarea></div></div>' +
        '<button type="submit" class="cx-btn">' + esc(btnLabel) + '</button>' +
        '<div class="cx-msg cx-ok" style="display:none">' + esc(thanks) + '</div>' +
        '<div class="cx-msg cx-err" style="display:none">Something went wrong. Please try again.</div>' +
        (hideBranding ? '' : '<div class="cx-powered">Powered by <a href="https://cater-os.com" target="_blank" rel="noopener">CaterOS</a></div>') +
      '</form>';

    var form = host.querySelector('form');
    var btn = host.querySelector('.cx-btn');
    var ok = host.querySelector('.cx-ok');
    var err = host.querySelector('.cx-err');

    form.addEventListener('submit', function(ev){
      ev.preventDefault();
      ok.style.display = 'none';
      err.style.display = 'none';
      btn.disabled = true;
      var originalLabel = btn.textContent;
      btn.textContent = 'Sending\u2026';

      var data = {};
      Array.prototype.forEach.call(form.elements, function(el){
        if (!el.name) return;
        data[el.name] = el.value;
      });
      data.source = data.source || 'squarespace';

      fetch(API_BASE + '/api/public/leads/' + encodeURIComponent(slug), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      .then(function(r){ return r.ok ? r.json().then(function(j){ return {ok:true,j:j}; }) : r.json().then(function(j){ return {ok:false,j:j}; }).catch(function(){ return {ok:false,j:{}}; }); })
      .then(function(res){
        btn.disabled = false;
        btn.textContent = originalLabel;
        if (res.ok){
          form.reset();
          ok.style.display = 'block';
          try { host.dispatchEvent(new CustomEvent('cateros:submit', { detail: res.j, bubbles: true })); } catch(e){}
        } else {
          err.style.display = 'block';
          err.textContent = (res.j && res.j.error === 'org_not_found')
            ? 'Form not configured — contact the site owner.'
            : 'Something went wrong. Please try again.';
        }
      })
      .catch(function(){
        btn.disabled = false;
        btn.textContent = originalLabel;
        err.style.display = 'block';
      });
    });
  }

  function init(){
    injectStyles();
    var hosts = document.querySelectorAll('[data-cateros-form]:not([data-cateros-ready])');
    Array.prototype.forEach.call(hosts, function(h){
      h.setAttribute('data-cateros-ready', '1');
      render(h);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  // Re-scan on soft navigations (Squarespace AJAX, SPAs)
  var mo = new MutationObserver(function(){ init(); });
  try { mo.observe(document.body, { childList: true, subtree: true }); } catch(e){}
})();
`;

export function GET() {
  return new NextResponse(WIDGET, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
