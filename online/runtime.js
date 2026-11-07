/* w2w runtime —— 小程序运行时垫片：真实页面代码原样运行 */
(function () {
  const META = window.W2W_META, BUNDLE = window.W2W_BUNDLE;
  const ROOT = document.getElementById('w2w-root');
  const OVER = document.getElementById('w2w-overlay-root');
  const TABB = document.getElementById('tabbar-host');
  const store = {};
  const compInstances = new Set();

  /* ---------- 模块系统 ---------- */
  const cache = {};
  function norm(base, rel) {
    if (rel[0] !== '.') return rel.replace(/^\//, '');
    const parts = base.split('/'); parts.pop();
    for (const seg of rel.split('/')) {
      if (seg === '.' || seg === '') continue;
      if (seg === '..') parts.pop(); else parts.push(seg);
    }
    return parts.join('/');
  }
  function requireFrom(base) {
    return function (rel) {
      const p = norm(base, rel);
      if (cache[p]) return cache[p].exports;
      const src = BUNDLE[p] || BUNDLE[p + '.js'];
      if (!src) throw new Error('module not found: ' + p);
      const mod = { exports: {} };
      cache[p] = mod;
      new Function('module', 'exports', 'require', 'window', src)(mod, mod.exports, requireFrom(p), window);
      return mod.exports;
    };
  }
  const rootRequire = requireFrom('');

  /* ---------- wx shim ---------- */
  const pagesStack = () => stack.length ? [stack[stack.length - 1]] : (rootPage ? [rootPage] : []);
  let toastTimer = null;
  const wx = {
    getStorageSync: k => (k in store ? store[k] : ''),
    setStorageSync: (k, v) => { store[k] = v; },
    removeStorageSync: k => { delete store[k]; },
    clearStorageSync: () => { for (const k of Object.keys(store)) delete store[k]; },
    showToast(o) { const t = document.getElementById('w2w-toast'); if (!t) return; t.textContent = (o && o.title) || ''; t.style.opacity = '1'; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.style.opacity = '0'; }, (o && o.duration) || 1900); },
    hideToast() { const t = document.getElementById('w2w-toast'); if (t) t.style.opacity = '0'; },
    navigateTo(o) { pushOverlay(o.url); },
    redirectTo(o) { replaceOverlay(o.url); },
    navigateBack() { popOverlay(); },
    switchTab(o) { switchTab(o.url); },
    reLaunch(o) { reLaunch(o.url); },
    makePhoneCall(o) { window.open('tel:' + (o && o.phoneNumber)); },
    pageScrollTo(o) { const p = pagesStack()[0]; if (p) p.el.scrollTop = (o && o.scrollTop) || 0; },
    vibrateShort() {}, setNavigationBarTitle() {}, stopPullDownRefresh() {},
    getSystemInfoSync: () => ({ windowWidth: 390, windowHeight: 800, SDKVersion: '3.0.0', platform: 'devtools' }),
    createSelectorQuery() {
      const q = { in() { return q; }, select() { return q; }, selectAll() { return q; }, boundingClientRect() { return q; }, scrollOffset() { return q; }, fields() { return q; }, exec(cb) { cb && cb([]); } };
      return q;
    },
    request(o) { console.warn('wx.request blocked in web demo', o && o.url); },
    getAccountInfoSync: () => ({ miniProgram: { appId: 'wxacdf79aa2ccf2677' } }),
    getWindowInfo: () => ({ windowWidth: 390, windowHeight: 800, statusBarHeight: 0, safeArea: { top: 0, bottom: 800, height: 800 }, pixelRatio: 2 }),
    getDeviceInfo: () => ({ pixelRatio: 2, windowWidth: 390, windowHeight: 800 }),
    getAppBaseInfo: () => ({ SDKVersion: '3.0.0' }),
    getMenuButtonBoundingClientRect: () => ({ top: 4, bottom: 36, left: 300, right: 380, width: 80, height: 32 }),
    getStorageInfoSync: () => ({ keys: Object.keys(store) }),
    showModal(o) { if (o && o.success) o.success({ confirm: true }); },
    showLoading() {}, hideLoading() {},
    showShareMenu() {}, hideShareMenu() {},
    stopPullDownRefresh() {},
    onThemeChange() {}, offThemeChange() {},
    getUpdateManager: () => ({ onUpdateReady() {}, onUpdateFailed() {}, applyUpdate() {} }),
    canIUse: () => true,
    nextTick: fn => setTimeout(fn, 0)
  };
  window.wx = wx;

  /* ---------- App ---------- */
  let appInstance = null;
  window.App = function (o) { appInstance = o || {}; if (o && typeof o.onLaunch === 'function') o.onLaunch(); return appInstance; };
  window.getApp = () => appInstance || {};
  window.Behavior = o => Object.assign({ __behavior: true }, o);

  /* ---------- 表达式求值 ---------- */
  const evalCache = {};
  function evalExpr(expr0, scope) {
    const expr = expr0.replace(/^\{\{/, '').replace(/\}\}$/, '').trim();
    let f = evalCache[expr];
    if (f === undefined) {
      try { f = new Function('s', 'with(s){return (' + expr + ')}'); }
      catch (e) { f = null; if (!evalCache['__fail_' + expr]) { evalCache['__fail_' + expr] = 1; console.warn('EXPR COMPILE FAIL:', expr.slice(0, 160)); } }
      evalCache[expr] = f;
    }
    if (f === null) return '';
    try { const v = f(scope); return v === undefined || v === null ? '' : v; } catch (e) { if (!evalCache['__fail_' + expr]) { evalCache['__fail_' + expr] = 1; console.warn('EXPR FAIL:', expr.slice(0, 140)); } return ''; }
  }
  function evalText(text, scope) {
    if (text.indexOf('{{') < 0) return text;
    return text.replace(/\{\{([^}]+)\}\}/g, (_, e) => String(evalExpr(e.trim(), scope)));
  }

  /* ---------- 组件注册 ---------- */
  const compDefs = {};
  window.Component = function (o) {
    o.__isComponent = true;
    if (o.is) compDefs[o.is] = o;
    return o;
  };
  /* 页面/组件注册：编译期把源文件包进 registerPage/registerComp 调用 */

  function mergeBehaviors(o) {
    let data = Object.assign({}, o.data || {});
    const methods = Object.assign({}, o.methods || {});
    const lifetimes = Object.assign({}, o.lifetimes || {});
    (o.behaviors || []).forEach(b => {
      if (typeof b === 'function') b = b();
      if (!b) return;
      Object.assign(data, b.data || {});
      Object.assign(methods, b.methods || {});
      Object.assign(lifetimes, b.lifetimes || {});
      (b.behaviors || []).forEach(bb => {/* 一层足够 */});
    });
    return { data, methods, lifetimes };
  }

  /* ---------- 实例工厂 ---------- */
  function makeInstance(kind, options, meta) {
    const merged = mergeBehaviors(options);
    const inst = {
      __kind: kind, __meta: meta, __options: options,
      data: JSON.parse(JSON.stringify(merged.data || {})),
      setData(patch) {
        Object.assign(this.data, patch);
        /* observers */
        const obs = options.observers || {};
        for (const k of Object.keys(patch)) {
          if (obs[k]) try { obs[k].call(this, this.data[k]); } catch (e) {}
          if (obs[k + '.**'] || obs['**']) try { (obs[k + '.**'] || obs['**']).call(this, this.data); } catch (e) {}
        }
        scheduleRender(this);
      },
      ...merged.methods,
      ...Object.keys(options).filter(k => !['data', 'methods', 'behaviors', 'lifetimes', 'options', 'relations', 'observers', 'properties', 'page'].includes(k) && typeof options[k] === 'function').reduce((a, k) => (a[k] = options[k], a), {})
    };
    Object.assign(inst, merged.lifetimes && merged.lifetimes.__pageLifetimes || {});
    return inst;
  }

  /* ---------- 渲染 ---------- */
  let __depth = 0; const __path = [];
  function renderChildren(children, scope, page, hostEl) {
    for (const n of children) renderNode(n, scope, page, hostEl);
  }
  function renderNode(n, scope, page, parent) {
    if (++__depth > 120) { console.error('DEPTH>120 parentAttrs=' + JSON.stringify((function(){ const a = __path.length ? null : null; return null; })() || '').slice(0,50) + ' | DEPTH=' + __depth + ' | TAG=' + n.tag + ' | CLASS=' + ((n.attrs && n.attrs.class) || '') + ' | STYLE=' + ((n.attrs && n.attrs.style) || '').slice(0, 80) + ' | WIF=' + (n.wif || '') + ' | CHILDREN=' + (n.children ? n.children.length : 'cyc?')); __depth--; return; }
    __path.push(n.tag);
    try { return renderNodeInner(n, scope, page, parent); } finally { __depth--; __path.pop(); }
  }
  function renderNodeInner(n, scope, page, parent) {
    if (n.wif !== undefined) {
      let chosen = null;
      if (evalExpr(n.wif, scope)) chosen = n;
      else if (n.chain) for (const c of n.chain) { if (c.cond === null || evalExpr(c.cond, scope)) { chosen = c.node; break; } }
      if (!chosen) return;
      if (chosen !== n) return renderNode(chosen, scope, page, parent);
      /* chosen === n：条件成立，继续走本节点正常渲染（不再自递归） */
    }
    if (n.tag === '#text') { const t = evalText(n.text, scope); if (t !== '') parent.appendChild(document.createTextNode(t)); return; }
    /* 组件？ */
    if (compDefs[n.tag] || (META.compMeta[n.tag])) return renderComponent(n, scope, page, parent);
    let el;
    if (n.tag === 'w2w-slot') {
      const kids = page.__slotChildren;
      if (kids) { const f = document.createDocumentFragment(); for (const c of kids) renderNode(c, page.__slotScope, page, f); parent.appendChild(f); }
      return;
    }
    const tag = ({ view: 'div', text: 'span', block: 'span', image: 'img', 'scroll-view': 'div', swiper: 'div', 'swiper-item': 'div' })[n.tag] || (n.tag === 'button' ? 'button' : n.tag);
    el = document.createElement(tag === 'block' ? 'span' : tag);
    if (n.tag === 'block') el.style.display = 'contents';
    if (n.tag === 'image') { el.loading = 'lazy'; el.style.display = 'block'; el.style.objectFit = 'cover'; }
    if (n.tag === 'scroll-view') { el.style.overflowY = 'auto'; }
    /* 属性 */
    for (const k of Object.keys(n.attrs)) {
      let v = evalText(n.attrs[k], scope);
      if (k === 'src' && /cloud:\/\//.test(v)) { v = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="#E7DFCE"/><circle cx="50%" cy="46%" r="34" fill="#D8CBB0"/></svg>'); }
      if (k === 'src' && v && !/^(https?:|data:|\/)/.test(v) && !v.includes('{{')) { /* 包内相对路径保持 */ }
      if (k === 'style') el.style.cssText += (el.style.cssText ? ';' : '') + v;
      else if (k === 'class') el.setAttribute('class', v);
      else if (k === 'value') { el.value = v; el.setAttribute('value', v); }
      else if (k === 'src' && tag === 'img') { el.src = v || ''; }
      else if (k.startsWith('data-')) el.setAttribute(k, v);
      else if (['placeholder', 'type', 'mode', 'name', 'id', 'maxlength', 'confirm-type', 'disabled'].includes(k)) { if (v !== '') el.setAttribute(k, v); if (k === 'disabled' && v) el.disabled = true; }
    }
    /* 事件 */
    if (n.on) {
      for (const ev of Object.keys(n.on)) {
        const handlerName = evalText(n.on[ev], scope).replace(/\(.*$/, '');
        const domEv = ({ tap: 'click', input: 'input', confirm: 'keydown', change: 'change', longpress: 'contextmenu' })[ev] || ev;
        el.addEventListener(domEv === 'keydown' ? 'keydown' : domEv, e => {
          if (domEv === 'keydown' && !(e.key === 'Enter')) return;
          const dataset = {};
          for (const a of Object.keys(n.attrs)) if (a.startsWith('data-')) dataset[a.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = evalText(n.attrs[a], scope);
          const fn = page[handlerName] || (page.__methods && page.__methods[handlerName]);
          if (typeof fn === 'function') fn.call(page, { currentTarget: { dataset }, detail: { value: el.value != null && (domEv === 'input' || domEv === 'keydown') ? el.value : undefined }, target: { dataset } });
          if (domEv === 'keydown') e.preventDefault && e.preventDefault();
        });
      }
    }
    parent.appendChild(el);
    if (n.children && n.children.length) {
      if (n.tag === 'textarea') { /* textarea 子文本做默认值 */ }
      else renderChildren(n.children, scope, page, el);
    }
  }
  function renderComponent(n, scope, page, parent) {
    const def = compDefs[n.tag];
    if (!def) return;
    const merged = mergeBehaviors(def);
    const data = JSON.parse(JSON.stringify(merged.data || {}));
    /* props：属性求值（page scope）→ properties 定义 */
    const props = {};
    for (const k of Object.keys(n.attrs)) {
      if (/^(bind|catch)/.test(k)) continue;
      props[k] = evalText(n.attrs[k], scope);
    }
    for (const k of Object.keys(def.properties || {})) {
      const pd = def.properties[k];
      if (props[k] === undefined) props[k] = pd && pd.value !== undefined ? pd.value : '';
    }
    Object.assign(data, props);
    const inst = {
      __kind: 'component', __def: def, data, __vnode: n, __parentPage: page, __props: props,
      setData(patch) {
        Object.assign(this.data, patch);
        const obs = def.observers || {};
        for (const k of Object.keys(patch)) if (obs[k]) try { obs[k].call(this, this.data[k]); } catch (e) {}
        rerenderInstance(this);
      },
      triggerEvent(name, detail) {
        const ev = 'bind' + name;
        const handlerName = n.on && n.on[name];
        if (handlerName) { const fn = page[handlerName]; if (typeof fn === 'function') fn.call(page, { detail: detail, currentTarget: { dataset: {} } }); }
      },
      ...merged.methods
    };
    compInstances.add(inst);
    const host = document.createElement('span');
    host.style.display = 'contents';
    inst.__el = host;
    parent.appendChild(host);
    if (def.lifetimes && def.lifetimes.attached) try { def.lifetimes.attached.call(inst); } catch (e) {}
    renderInstance(inst);
    if (def.lifetimes && def.lifetimes.ready) try { def.lifetimes.ready.call(inst); } catch (e) {}
  }
  function renderInstance(inst) {
    const host = inst.__el; if (!host) return;
    host.innerHTML = '';
    const slotChildren = inst.__vnode.children && inst.__vnode.children.length ? inst.__vnode.children : null;
    const page = inst.__parentPage;
    page.__slotChildren = slotChildren; page.__slotScope = page.data;
    const scope = inst.data;
    for (const c of inst.__def && META.compMeta ? findTemplate(inst) : []) renderNode(c, scope, page, host);
    delete page.__slotChildren; delete page.__slotScope;
  }
  function findTemplate(inst) {
    /* 找到该组件的模板：从 compMeta 反查（编译期已按 tag 收录） */
    const tag = inst.__vnode.tag;
    return META.compMeta[tag] ? META.compMeta[tag].tpl : [];
  }
  function rerenderInstance(inst) { if (inst.__el) renderInstance(inst); }

  /* ---------- 页面 ---------- */
  const pageDefs = {};
  window.Page = function (o) {
    /* 编译期包一层：__route 临时变量指向当前页面路径 */
    o.__route = window.__compilingRoute;
    pageDefs[o.__route] = o;
    return o;
  };
  window.registerPageSource = function (route, src) {
    window.__compilingRoute = route;
    try { new Function('Page', 'Component', 'Behavior', 'App', 'getApp', 'wx', 'require', src)(window.Page, window.Component, window.Behavior, window.App, window.getApp, wx, requireFrom(route)); }
    catch (e) { console.error('page load fail', route, e.message); }
    delete window.__compilingRoute;
  };

  const stack = [];
  let rootPage = null;
  let rootRoute = null;

  function createPage(route, isRoot) {
    const def = pageDefs[route];
    if (!def) { ROOT.innerHTML = '<p style="padding:40px;color:#888">page missing: ' + route + '</p>'; return null; }
    const merged = mergeBehaviors(def);
    const inst = {
      __kind: 'page', __route: route, __meta: META.pageMeta[route],
      data: JSON.parse(JSON.stringify(merged.data || {})),
      setData(patch) {
        Object.assign(this.data, patch);
        const obs = def.observers || {};
        for (const k of Object.keys(patch)) if (obs[k]) try { obs[k].call(this, this.data[k]); } catch (e) {}
        scheduleRender(this);
      },
      getTabBar() { return this.__tabbar || null; },
      __methods: merged.methods,
      ...merged.methods
    };
    /* 事件/生命周期绑定 */
    const el = document.createElement('div');
    el.id = 'pg-' + route.replace(/\//g, '-');
    el.className = 'w2w-page';
    inst.__el = el;
    inst.__render = function () {
      const keepScroll = el.scrollTop;
      const active = document.activeElement;
      const focusIdx = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') ? [...document.querySelectorAll('input,textarea')].indexOf(active) : -1;
      el.innerHTML = '';
      for (const n of META.pageMeta[route].tpl) renderNode(n, inst.data, inst, el);
      /* 组件实例属于本页渲染 —— 上面 renderNode 内已创建 */
      if (META.pageMeta[route].isTab && tabbarInst) { TABB.innerHTML = ''; TABB.appendChild(tabbarInst.__el); }
      else TABB.innerHTML = '';
      el.scrollTop = keepScroll;
      if (focusIdx >= 0) { const el2 = [...document.querySelectorAll('input,textarea')][focusIdx]; if (el2) { el2.focus(); try { el2.setSelectionRange(el2.value.length, el2.value.length); } catch (e) {} } }
    };
    /* 顶层函数：生命周期 + 自定义方法（Page 选项全平铺） */
    for (const k of Object.keys(def)) {
      if (k === 'data' || k === 'behaviors' || k === '__route') continue;
      if (typeof def[k] === 'function' && inst[k] === undefined) inst[k] = def[k];
    }
    /* behaviors 生命周期 */
    const lifetimes = merged.lifetimes || {};
    inst.setData = inst.setData.bind(inst);
    /* 绑定渲染调度 */
    inst.__schedule = () => inst.__render();
    /* 拦截 setData 调度 */
    const origSet = inst.setData;
    inst.setData = patch => { origSet(patch); };
    function scheduleRender(i) { Promise.resolve().then(() => i.__render && i.__render()); }
    /* 覆盖：makeInstance 里的 scheduleRender 引用全局 —— 这里重新接 */
    inst.setData = function (patch) {
      Object.assign(this.data, patch);
      const obs = def.observers || {};
      for (const k of Object.keys(patch)) if (obs[k]) try { obs[k].call(this, this.data[k]); } catch (e) {}
      Promise.resolve().then(() => this.__render && this.__render());
    };
    return inst;
  }
  function scheduleRender(inst) { Promise.resolve().then(() => inst.__render && inst.__render()); }

  /* ---------- 自定义 tabbar ---------- */
  let tabbarInst = null;
  function setupTabbar() {
    if (!BUNDLE['custom-tab-bar/index.js']) return;
    /* 用 Component 定义跑出实例 */
    let def = null;
    const saved = window.Component;
    window.Component = o => { def = o; return o; };
    new Function('module', 'exports', 'Component', 'require', BUNDLE['custom-tab-bar/index.js'])({}, {}, window.Component, requireFrom('custom-tab-bar/index.js'));
    window.Component = saved;
    if (!def) return;
    const data = JSON.parse(JSON.stringify(def.data || {}));
    const inst = {
      data,
      setData(patch) { Object.assign(this.data, patch); renderTabbar(this, def); },
      ...def.methods
    };
    tabbarInst = inst;
    window.getApp && (getApp().__tabbar = inst);
    renderTabbar(inst, def);
  }
  function renderTabbar(inst, def) {
    const meta = META.compMeta['custom-tab-bar'] || (META.compMeta['custom-tab-bar/index'] ? META.compMeta['custom-tab-bar/index'] : null);
    /* 编译期把 custom-tab-bar 当组件收录（tag 名取 usingComponents 键，通常 'custom-tab-bar'） */
    const tplKey = Object.keys(META.compMeta).find(k => k.indexOf('custom-tab-bar') >= 0);
    if (!tplKey) { TABB.innerHTML = ''; return; }
    const tpl = META.compMeta[tplKey].tpl;
    inst.__el = document.createElement('div');
    inst.__parentPage = { data: inst.data, __slotChildren: null };
    inst.__vnode = { tag: tplKey, children: [], attrs: {}, on: null };
    TABB.innerHTML = ''; TABB.appendChild(inst.__el);
    /* 直接以 tabbar 自身 data 渲染 */
    inst.__el.innerHTML = '';
    const scope = Object.create(inst.data);
    scope.__tabbarSelf = true;
    for (const n of tpl) renderNodeSelf(n, scope, inst, inst.__el);
  }
  function renderNodeSelf(n, scope, inst, parent) {
    if (n.tag === '#text') { const t = evalText(n.text, scope); if (t) parent.appendChild(document.createTextNode(t)); return; }
    if (n.wif !== undefined && !evalExpr(n.wif, scope)) return;
    let el;
    const tag = ({ view: 'div', text: 'span', image: 'img' })[n.tag] || n.tag;
    el = document.createElement(tag === 'block' ? 'span' : tag);
    if (n.tag === 'block') el.style.display = 'contents';
    for (const k of Object.keys(n.attrs || {})) {
      const v = evalText(n.attrs[k], scope);
      if (k === 'style') el.style.cssText += (el.style.cssText ? ';' : '') + v;
      else if (k === 'class') el.setAttribute('class', v);
      else if (k.startsWith('data-')) el.setAttribute(k, v);
    }
    if (n.on && n.on.tap) {
      el.addEventListener('click', () => {
        const fn = inst[n.on.tap];
        if (typeof fn === 'function') fn.call(inst, { currentTarget: { dataset: (function () { const d = {}; for (const a of Object.keys(n.attrs)) if (a.startsWith('data-')) d[a.slice(5)] = evalText(n.attrs[a], scope); return d; })() } });
      });
    }
    parent.appendChild(el);
    if (n.children) for (const c of n.children) renderNodeSelf(c, scope, inst, el);
  }

  /* ---------- 导航 ---------- */
  function mountRoot(route) {
    rootRoute = route;
    rootPage = createPage(route, true);
    if (!rootPage) return;
    ROOT.innerHTML = ''; ROOT.appendChild(rootPage.__el);
    rootPage.__onLoadExists = typeof rootPage.onLoad === 'function';
    if (typeof rootPage.onLoad === 'function') try { rootPage.onLoad({}); rootPage.__onLoadRan = true; } catch (e) { rootPage.__onLoadErr = String(e && e.message || e); }
    rootPage.__render();
    if (typeof rootPage.onShow === 'function') try { rootPage.onShow(); } catch (e) {}
    /* 页面 onShow 时同步 tabbar selected */
  }
  function pushOverlay(url) {
    const route = url.replace(/^\//, '').split('?')[0];
    const inst = createPage(route);
    if (!inst) return;
    stack.push(inst);
    const wrap = document.createElement('div'); wrap.className = 'w2w-overlay-page'; wrap.style.cssText = 'position:absolute;inset:0;overflow-y:auto;background:#F7F6F4;z-index:' + (20 + stack.length);
    wrap.appendChild(inst.__el); OVER.appendChild(wrap);
    if (typeof inst.onLoad === 'function') try { inst.onLoad({}); } catch (e) {}
    inst.__render();
    if (typeof inst.onShow === 'function') try { inst.onShow(); } catch (e) {}
  }
  function replaceOverlay(url) {
    const route = url.replace(/^\//, '').split('?')[0];
    if (stack.length) {
      const old = stack.pop();
      if (OVER.lastChild) OVER.removeChild(OVER.lastChild);
      if (typeof old.onUnload === 'function') try { old.onUnload(); } catch (e) {}
    }
    pushOverlay(url);
  }
  function popOverlay() {
    const old = stack.pop();
    if (!old) return;
    if (OVER.lastChild) OVER.removeChild(OVER.lastChild);
    if (typeof old.onUnload === 'function') try { old.onUnload(); } catch (e) {}
  }
  function switchTab(url) {
    const route = url.replace(/^\//, '').split('?')[0];
    while (stack.length) popOverlay();
    if (rootRoute === route) { if (typeof rootPage.onShow === 'function') rootPage.onShow(); return; }
    mountRoot(route);
  }
  function reLaunch(url) { switchTab(url); }
  window.__nav = { pushOverlay, switchTab, mountRoot };

  /* ---------- toast host ---------- */
  const tEl = document.createElement('div');
  tEl.id = 'w2w-toast';
  tEl.style.cssText = 'position:absolute;left:50%;bottom:110px;transform:translateX(-50%);background:rgba(46,40,36,.92);color:#F6F1E6;font-size:13px;border-radius:999px;padding:9px 18px;opacity:0;transition:opacity .25s;z-index:99;pointer-events:none;max-width:82%;text-align:center';
  document.getElementById('phone').appendChild(tEl);

  window.__topPage = () => (stack.length ? stack[stack.length - 1] : rootPage);
  window.__dbg = () => ({ defs: Object.keys(pageDefs), root: rootRoute, stackN: stack.length, stackRoutes: stack.map(i => i.__route), rootLen: rootPage ? rootPage.__el.innerHTML.length : -1, data: rootPage ? rootPage.data : null, exists: rootPage ? rootPage.__onLoadExists : null, ran: rootPage ? rootPage.__onLoadRan : null, err: rootPage ? rootPage.__onLoadErr : null });
  /* ---------- 启动 ---------- */
  for (const p of META.pages) window.registerPageSource(p, BUNDLE[p + '.js']);
  window.registerPageSource('app.js', BUNDLE['app.js']);
  setupTabbar();
  mountRoot(META.pages[0]);
  /* app.json 入口一般是 launch —— 若 launch 自动跳转，交给页面逻辑 */
})();
