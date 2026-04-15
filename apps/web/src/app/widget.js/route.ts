import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 300;

// Hosted lead-capture widget. Drop <script src="{origin}/widget.js"> on any site,
// add <div data-cateros-form data-org="..."></div>, and it will render a form.
const WIDGET = String.raw`
(function(){
  var LOG = '[CaterOS]';
  try { console.log(LOG, 'widget loaded', new Date().toISOString()); } catch(e){}

  if (window.__caterosWidget) {
    try { console.log(LOG, 'already initialized; rescanning'); } catch(e){}
    if (window.__caterosScan) window.__caterosScan();
    return;
  }
  window.__caterosWidget = true;

  // Resolve API base from the <script> src.
  var API_BASE;
  try {
    var myScript =
      document.currentScript ||
      document.querySelector('script[src*="/widget.js"]') ||
      (function(){ var s = document.getElementsByTagName('script'); return s[s.length - 1]; })();
    API_BASE = new URL(myScript.src).origin;
  } catch (e) {
    API_BASE = location.origin;
    try { console.warn(LOG, 'could not determine API base from script src, falling back to', API_BASE); } catch(e){}
  }
  try { console.log(LOG, 'API base:', API_BASE); } catch(e){}

  var ALL_FIELDS = [
    'last_name','phone','company',
    'event_date','event_time','service_type','location',
    'guest_count','message'
  ];

  var STYLE_ID = 'cateros-widget-style';
  function injectStyles(){
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '.cateros-form{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#18181b;text-align:left}',
      '.cateros-form *{box-sizing:border-box}',
      '.cateros-form .cx-row{display:grid;gap:12px;margin-bottom:12px}',
      '.cateros-form .cx-2col{grid-template-columns:1fr 1fr}',
      '@media (max-width:480px){.cateros-form .cx-2col{grid-template-columns:1fr}}',
      '.cateros-form label{display:block;font-size:13px;font-weight:500;margin-bottom:4px;color:#52525b;font-family:inherit}',
      '.cateros-form .cx-req{color:#ef4444;margin-left:2px}',
      '.cateros-form input,.cateros-form textarea,.cateros-form select{width:100%;padding:10px 12px;border:1px solid #d4d4d8;border-radius:8px;font-size:14px;font-family:inherit;background:#fff;color:#18181b;transition:border-color .15s,box-shadow .15s;line-height:1.4}',
      '.cateros-form input:focus,.cateros-form textarea:focus,.cateros-form select:focus{outline:none;border-color:var(--cx-accent,#ea580c);box-shadow:0 0 0 3px rgba(234,88,12,.18)}',
      '.cateros-form textarea{min-height:100px;resize:vertical}',
      '.cateros-form .cx-seg{display:flex;gap:8px;flex-wrap:wrap}',
      '.cateros-form .cx-seg > label{flex:1;min-width:120px;display:flex;align-items:center;justify-content:center;padding:10px 12px;border:1px solid #d4d4d8;border-radius:8px;cursor:pointer;font-size:14px;font-weight:500;background:#fff;transition:all .15s;margin-bottom:0;color:#18181b}',
      '.cateros-form .cx-seg > label:hover{border-color:var(--cx-accent,#ea580c)}',
      '.cateros-form .cx-seg input{position:absolute;opacity:0;pointer-events:none}',
      '.cateros-form .cx-seg input:checked ~ span{pointer-events:none}',
      '.cateros-form .cx-seg .cx-seg-active{border-color:var(--cx-accent,#ea580c)!important;background:var(--cx-accent,#ea580c)!important;color:#fff!important}',
      '.cateros-form .cx-btn{width:100%;padding:12px 16px;border:none;border-radius:8px;font-size:15px;font-weight:600;font-family:inherit;cursor:pointer;background:var(--cx-accent,#ea580c);color:#fff;transition:filter .15s}',
      '.cateros-form .cx-btn:hover{filter:brightness(.95)}',
      '.cateros-form .cx-btn:disabled{opacity:.6;cursor:wait}',
      '.cateros-form .cx-hp{position:absolute!important;left:-9999px!important;width:1px!important;height:1px!important;overflow:hidden!important}',
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

  function parseFieldList(attr){
    if (!attr) return null;
    return attr.split(',').map(function(s){ return s.trim(); }).filter(Boolean);
  }

  function errorMsg(host, msg){
    try { console.error(LOG, msg); } catch(e){}
    host.innerHTML = '<div style="padding:16px;border:1px solid #fecaca;background:#fee2e2;color:#991b1b;border-radius:8px;font:14px system-ui,sans-serif">' +
      '<strong>CaterOS form didn\u2019t render:</strong> ' + esc(msg) +
      '</div>';
  }

  function buildForm(host, opts){
    var fields = opts.fields;
    var requiredSet = {};
    (opts.required || []).forEach(function(k){ requiredSet[k] = true; });
    var labels = opts.labels || {};

    function reqMark(k){ return requiredSet[k] ? '<span class="cx-req">*</span>' : ''; }
    function lbl(k, fallback){ return esc(labels[k] || fallback); }
    function show(k){ return fields.indexOf(k) !== -1; }

    var html = '';
    html += '<input class="cx-hp" type="text" name="website" autocomplete="off" tabindex="-1" aria-hidden="true"/>';

    html += '<div class="cx-row ' + (show('last_name') ? 'cx-2col' : '') + '">';
    html += '<div><label>' + lbl('first_name','First name') + '<span class="cx-req">*</span></label><input name="first_name" required/></div>';
    if (show('last_name')) html += '<div><label>' + lbl('last_name','Last name') + reqMark('last_name') + '</label><input name="last_name"' + (requiredSet.last_name?' required':'') + '/></div>';
    html += '</div>';

    html += '<div class="cx-row ' + (show('phone') ? 'cx-2col' : '') + '">';
    html += '<div><label>' + lbl('email','Email') + '<span class="cx-req">*</span></label><input name="email" type="email" required/></div>';
    if (show('phone')) html += '<div><label>' + lbl('phone','Phone') + reqMark('phone') + '</label><input name="phone" type="tel"' + (requiredSet.phone?' required':'') + '/></div>';
    html += '</div>';

    if (show('company')) {
      html += '<div class="cx-row"><div><label>' + lbl('company','Company') + reqMark('company') + '</label><input name="company"' + (requiredSet.company?' required':'') + '/></div></div>';
    }

    if (show('event_date') || show('event_time')) {
      html += '<div class="cx-row ' + (show('event_date') && show('event_time') ? 'cx-2col' : '') + '">';
      if (show('event_date')) html += '<div><label>' + lbl('event_date','Event date') + reqMark('event_date') + '</label><input name="event_date" type="date"' + (requiredSet.event_date?' required':'') + '/></div>';
      if (show('event_time')) html += '<div><label>' + lbl('event_time','Event time') + reqMark('event_time') + '</label><input name="event_time" type="time"' + (requiredSet.event_time?' required':'') + '/></div>';
      html += '</div>';
    }

    if (show('service_type')) {
      html += '<div class="cx-row"><div><label>' + lbl('service_type','Service type') + reqMark('service_type') + '</label>';
      html += '<div class="cx-seg">';
      html += '<label><input type="radio" name="service_type" value="on_premise"' + (requiredSet.service_type?' required':'') + '/><span>On-premise</span></label>';
      html += '<label><input type="radio" name="service_type" value="off_premise"/><span>Off-premise</span></label>';
      html += '</div></div></div>';
    }

    if (show('location')) {
      var locOpts = '<option value="">—</option>';
      (opts.locations || []).forEach(function(l){
        locOpts += '<option value="' + esc(l.id) + '">' + esc(l.name) + '</option>';
      });
      html += '<div class="cx-row"><div><label>' + lbl('location','Location') + reqMark('location') + '</label>';
      html += '<select name="location_id"' + (requiredSet.location?' required':'') + '>' + locOpts + '</select></div></div>';
    }

    if (show('guest_count')) {
      html += '<div class="cx-row"><div><label>' + lbl('guest_count','Number of guests') + reqMark('guest_count') + '</label><input name="guest_count" type="number" min="0" placeholder="e.g. 50"' + (requiredSet.guest_count?' required':'') + '/></div></div>';
    }

    if (show('message')) {
      html += '<div class="cx-row"><div><label>' + lbl('message','Tell us about your event') + reqMark('message') + '</label><textarea name="message" rows="4"' + (requiredSet.message?' required':'') + '></textarea></div></div>';
    }

    html += '<button type="submit" class="cx-btn">' + esc(opts.buttonText || 'Request a quote') + '</button>';
    html += '<div class="cx-msg cx-ok" style="display:none">' + esc(opts.thanks || "Thanks! We\u0027ll be in touch shortly.") + '</div>';
    html += '<div class="cx-msg cx-err" style="display:none">Something went wrong. Please try again.</div>';
    if (!opts.hideBranding) html += '<div class="cx-powered">Powered by <a href="https://cater-os.com" target="_blank" rel="noopener">CaterOS</a></div>';

    var accentStyle = opts.accent ? ' style="--cx-accent:' + esc(opts.accent) + '"' : '';
    host.innerHTML = '<form class="cateros-form"' + accentStyle + ' novalidate>' + html + '</form>';

    // Segmented radio visual state (workaround for :has() support)
    Array.prototype.forEach.call(host.querySelectorAll('.cx-seg input[type=radio]'), function(r){
      r.addEventListener('change', function(){
        Array.prototype.forEach.call(host.querySelectorAll('.cx-seg > label'), function(l){ l.classList.remove('cx-seg-active'); });
        var parent = r.parentElement;
        if (parent) parent.classList.add('cx-seg-active');
      });
    });
  }

  function wireSubmit(host, slug){
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
        if (el.type === 'radio' && !el.checked) return;
        data[el.name] = el.value;
      });
      if (!data.source) data.source = 'squarespace';

      fetch(API_BASE + '/api/public/leads/' + encodeURIComponent(slug), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      .then(function(r){ return r.json().then(function(j){ return {ok: r.ok, j: j}; }).catch(function(){ return {ok: r.ok, j: {}}; }); })
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
            ? 'Form not configured — check your data-org value.'
            : 'Something went wrong. Please try again.';
        }
      })
      .catch(function(e){
        btn.disabled = false;
        btn.textContent = originalLabel;
        err.style.display = 'block';
        try { console.error(LOG, 'submit failed', e); } catch(_){}
      });
    });
  }

  function render(host){
    var slug = host.getAttribute('data-org');
    if (!slug){ errorMsg(host, 'Missing data-org attribute on <div data-cateros-form>. Copy a fresh snippet from CaterOS → Marketing → Web forms.'); return; }

    var fieldAttr = host.getAttribute('data-fields');
    var requiredAttr = host.getAttribute('data-required');
    var fields = parseFieldList(fieldAttr) || ALL_FIELDS.slice();
    var required = parseFieldList(requiredAttr) || [];

    var labels = {};
    Array.prototype.forEach.call(host.attributes, function(a){
      if (a.name.indexOf('data-label-') === 0) {
        labels[a.name.slice('data-label-'.length).replace(/-/g,'_')] = a.value;
      }
    });

    var opts = {
      fields: fields,
      required: required,
      labels: labels,
      accent: host.getAttribute('data-accent') || '',
      thanks: host.getAttribute('data-thanks') || '',
      buttonText: host.getAttribute('data-button') || '',
      hideBranding: host.getAttribute('data-hide-branding') === 'true',
      locations: [],
    };

    function doRender(){
      try {
        buildForm(host, opts);
        wireSubmit(host, slug);
        try { console.log(LOG, 'rendered form for org', slug); } catch(e){}
      } catch(e){
        errorMsg(host, 'Render failed: ' + (e && e.message ? e.message : String(e)));
      }
    }

    if (fields.indexOf('location') !== -1) {
      fetch(API_BASE + '/api/public/form-meta/' + encodeURIComponent(slug))
        .then(function(r){
          if (!r.ok) {
            if (r.status === 404) throw new Error('org_not_found');
            throw new Error('meta_failed_' + r.status);
          }
          return r.json();
        })
        .then(function(meta){
          if (meta && meta.locations) opts.locations = meta.locations;
          doRender();
        })
        .catch(function(e){
          if (e && e.message === 'org_not_found') {
            errorMsg(host, 'Form not configured — the org "' + slug + '" was not found on ' + API_BASE + '.');
          } else {
            try { console.warn(LOG, 'meta fetch failed, rendering without location options:', e); } catch(_){}
            doRender();
          }
        });
    } else {
      doRender();
    }
  }

  var scanCount = 0;
  function scan(){
    injectStyles();
    var hosts = document.querySelectorAll('[data-cateros-form]:not([data-cateros-ready])');
    if (hosts.length > 0) {
      try { console.log(LOG, 'scan found', hosts.length, 'form host(s)'); } catch(e){}
    }
    Array.prototype.forEach.call(hosts, function(h){
      h.setAttribute('data-cateros-ready', '1');
      render(h);
    });
  }
  window.__caterosScan = scan;

  function init(){
    scan();
    // Retry scans to catch hosts added after our script runs (Squarespace
    // Code Blocks sometimes render after initial parse).
    var attempts = 0;
    var iv = setInterval(function(){
      attempts++;
      scan();
      if (attempts >= 10) clearInterval(iv); // up to ~5 seconds
    }, 500);

    // Observe DOM for future additions (SPA soft nav, lazy sections)
    try {
      var mo = new MutationObserver(function(muts){
        for (var i = 0; i < muts.length; i++) {
          if (muts[i].addedNodes && muts[i].addedNodes.length) { scan(); return; }
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    } catch(e){}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
`;

export function GET() {
  return new NextResponse(WIDGET, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=86400',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
