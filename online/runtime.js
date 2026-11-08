/* w2w runtime —— 小程序运行时垫片：真实页面代码原样运行 */
(function () {
  const META = window.W2W_META, BUNDLE = window.W2W_BUNDLE;
  /* 绝对路径资源（/images/...）解析到本应用目录（兼容 GitHub Pages 子路径部署） */
  const BASE = new URL('.', location.href).href;
  const CLOUD_PH = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="#E7DFCE"/><circle cx="50%" cy="46%" r="34" fill="#D8CBB0"/></svg>');
  const resolveSrc = v => {
    if (!v) return v;
    if (/^cloud:\/\//.test(v)) return (META.cloudMap && META.cloudMap[v]) ? BASE + META.cloudMap[v] : CLOUD_PH;
    return v && v.charAt(0) === '/' && !/^\/\//.test(v) ? BASE + v.slice(1) : v;
  };
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
    pageScrollTo(o) { const p = pagesStack()[0]; if (p && p.__el) p.__el.scrollTop = (o && o.scrollTop) || 0; },
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
    getRealtimeLogManager: () => ({ info() {}, warn() {}, error() {}, log() {}, setFilterMsg() {}, addFilterMsg() {} }),
    login: o => { try { o && o.success && o.success({ code: 'w2w-demo-code' }); } catch (e) {} },
    checkSession: o => { try { o && o.success && o.success(); } catch (e) {} },
    loadFontFace: o => { try { o && o.success && o.success({ status: 'mock' }); } catch (e) {} },
    onWindowResize() {}, offWindowResize() {},
    createInnerAudioContext: () => ({ play() {}, pause() {}, stop() {}, destroy() {}, seek() {}, src: '', loop: false, volume: 1, obeyMuteSwitch: true, onCanPlay() {}, onPlay() {}, onEnded() {}, onError() {}, onPause() {}, onStop() {} }),
    createAnimation: () => { const a = {}; const chain = () => a; ['translate', 'translateX', 'translateY', 'scale', 'rotate', 'opacity', 'left', 'right', 'top', 'bottom', 'width', 'height'].forEach(k => { a[k] = chain; }); a.step = () => a; a.export = () => ({}); return a; },
    showModal(o) {
      const host = document.getElementById('phone');
      const prev = document.getElementById('w2w-modal'); if (prev) prev.remove();
      const wrap = document.createElement('div'); wrap.id = 'w2w-modal';
      wrap.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,.45);z-index:120;display:flex;align-items:center;justify-content:center';
      const box = document.createElement('div');
      box.style.cssText = 'width:272px;background:#FFF;border-radius:14px;overflow:hidden;text-align:center;font-family:-apple-system,BlinkMacSystemFont,sans-serif';
      box.innerHTML = '<div style="padding:24px 18px 16px"><div style="font-weight:600;font-size:16px;color:#111;letter-spacing:.5px">' + ((o && o.title) || '') + '</div><div style="font-size:13.5px;color:#666;margin-top:8px;line-height:1.55;white-space:pre-line">' + ((o && o.content) || '') + '</div></div>';
      const btns = document.createElement('div'); btns.style.cssText = 'display:flex;border-top:1px solid #EBEBEB';
      const mk = (label, val, bold, sep) => {
        const b = document.createElement('div'); b.textContent = label;
        b.style.cssText = 'flex:1;padding:12px 0;font-size:16px;color:#576B95;cursor:pointer;-webkit-tap-highlight-color:transparent' + (bold ? ';font-weight:600' : '') + (sep ? ';border-right:1px solid #EBEBEB' : '');
        b.onclick = () => { wrap.remove(); const res = { confirm: val, cancel: !val }; try { o && o.success && o.success(res); o && o.complete && o.complete(res); } catch (e) {} };
        btns.appendChild(b);
      };
      const showCancel = !(o && o.showCancel === false);
      if (showCancel) mk((o && o.cancelText) || '取消', false, false, true);
      mk((o && o.confirmText) || '确定', true, true, false);
      box.appendChild(btns); wrap.appendChild(box); host.appendChild(wrap);
    },
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
    if (f === null) return undefined;
    try { return f(scope); } catch (e) { if (!evalCache['__fail_' + expr]) { evalCache['__fail_' + expr] = 1; console.warn('EXPR FAIL:', expr.slice(0, 140)); } return undefined; }
  }
  function evalText(text, scope) {
    if (text.indexOf('{{') < 0) return text;
    return text.replace(/\{\{([^}]+)\}\}/g, (_, e) => { const v = evalExpr(e.trim(), scope); return v == null ? '' : String(v); });
  }
  /* 属性求值：纯表达式（值整体就是一个 {{...}}）保留原始类型（布尔/数字/null），
   * 混合文本才做字符串插值 —— 对齐 WXML 语义（show="{{x}}" 传的是真布尔） */
  function evalAttr(v, scope) {
    if (typeof v !== 'string') return v;
    const m = /^\{\{([\s\S]+)\}\}$/.exec(v.trim());
    if (m && m[1].indexOf('{{') < 0) return evalExpr(m[1], scope);
    return evalText(v, scope);
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
    /* wx:for：逐项克隆渲染（wx:if 每项再判，与 WXML 语义一致） */
    if (n.wfor !== undefined) {
      const list = evalExpr(n.wfor, scope);
      const arr = list == null ? [] : (Array.isArray(list) ? list : Object.keys(list));
      const itemName = n.witem || 'item', idxName = n.windex || 'index';
      const plain = { tag: n.tag, attrs: n.attrs, children: n.children, on: n.on, chain: n.chain, wif: n.wif };
      for (let i = 0; i < arr.length; i++) {
        const cs = Object.create(scope);
        cs[itemName] = arr[i]; cs[idxName] = i;
        renderNode(plain, cs, page, parent);
      }
      return;
    }
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
    if (n.tag === 'slot' || n.tag === 'w2w-slot') {
      const kids = page.__slotChildren;
      if (kids) { const f = document.createDocumentFragment(); for (const c of kids) renderNode(c, page.__slotScope, page.__slotCtx || page, f); parent.appendChild(f); }
      return;
    }
    if (n.tag === 'block') {
      /* block 不产生盒子：直接把子节点铺进父级（display:contents 在部分嵌套下会双重绘制） */
      if (n.children && n.children.length) renderChildren(n.children, scope, page, parent);
      return;
    }
    const tag = ({ view: 'div', text: 'span', block: 'span', image: 'img', 'scroll-view': 'div', swiper: 'div', 'swiper-item': 'div' })[n.tag] || (n.tag === 'button' ? 'button' : n.tag);
    el = document.createElement(tag === 'block' ? 'span' : tag);
    if (n.tag === 'block') el.style.display = 'contents';
    if (n.tag === 'image') { el.loading = 'lazy'; el.style.display = 'block'; el.style.objectFit = 'cover'; }
    if (n.tag === 'scroll-view') { el.style.overflowY = 'auto'; }
    /* 属性 */
    for (const k of Object.keys(n.attrs)) {
      let v = evalAttr(n.attrs[k], scope);
      if (v == null) v = '';
      if (k === 'src' && v && !/^(https?:|data:|blob:)/.test(v)) v = resolveSrc(v);
      if (k === 'style') el.style.cssText += (el.style.cssText ? ';' : '') + v;
      else if (k === 'class') el.setAttribute('class', v);
      else if (k === 'value') { el.value = v; el.setAttribute('value', v); }
      else if (k === 'src' && tag === 'img') { const rs = resolveSrc(v); if (rs) el.src = rs; }
      else if (k.startsWith('data-')) el.setAttribute(k, v);
      else if (['placeholder', 'type', 'mode', 'name', 'id', 'maxlength', 'confirm-type', 'disabled'].includes(k)) { if (v !== '') el.setAttribute(k, v); if (k === 'disabled' && v) el.disabled = true; }
    }
    /* 事件 */
    if (n.on) {
      for (const ev of Object.keys(n.on)) {
        if (ev === 'scroll' || ev === 'scrolltolower' || ev === 'scrolltoupper') continue; /* scroll-view 专属，渲染后统一挂 */
        const handlerName = evalText(n.on[ev], scope).replace(/\(.*$/, '');
        const domEv = ({ tap: 'click', input: 'input', confirm: 'keydown', change: 'change', longpress: 'contextmenu', focus: 'focus', blur: 'blur' })[ev] || ev;
        el.addEventListener(domEv === 'keydown' ? 'keydown' : domEv, e => {
          if (domEv === 'keydown' && !(e.key === 'Enter')) return;
          const dataset = {};
          for (const a of Object.keys(n.attrs)) if (a.startsWith('data-')) dataset[a.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = evalAttr(n.attrs[a], scope);
          const fn = page[handlerName] || (page.__methods && page.__methods[handlerName]);
          if (typeof fn === 'function') fn.call(page, { currentTarget: { dataset }, detail: { value: el.value != null && (domEv === 'input' || domEv === 'keydown') ? el.value : undefined }, target: { dataset } });
          if (domEv === 'keydown') e.preventDefault && e.preventDefault();
        });
      }
    }
    /* 输入法组合期：挂起页面重渲，防止打断拼音/候选词 */
    if (n.tag === 'input' || n.tag === 'textarea') {
      el.addEventListener('compositionstart', () => { el.__composing = true; page.__suspendRender = true; });
      el.addEventListener('compositionend', () => { el.__composing = false; page.__suspendRender = false; Promise.resolve().then(() => page.__render && page.__render()); });
    }
    parent.appendChild(el);
    if (n.children && n.children.length) {
      if (n.tag === 'textarea') { /* textarea 子文本做默认值 */ }
      else renderChildren(n.children, scope, page, el);
    }
    if (n.tag === 'scroll-view' && n.on && (n.on.scroll || n.on.scrolltolower)) {
      let sraf = 0;
      el.addEventListener('scroll', () => {
        if (sraf) return;
        sraf = requestAnimationFrame(() => {
          sraf = 0;
          const d = { scrollTop: el.scrollTop, scrollHeight: el.scrollHeight };
          if (n.on.scroll) { const fn = page[n.on.scroll]; if (typeof fn === 'function') fn.call(page, { detail: d, currentTarget: { dataset: {} } }); }
          if (n.on.scrolltolower && el.scrollTop + el.clientHeight >= el.scrollHeight - 6) { const f2 = page[n.on.scrolltolower]; if (typeof f2 === 'function') f2.call(page, { detail: d, currentTarget: { dataset: {} } }); }
        });
      });
    }
  }
  function renderComponent(n, scope, page, parent) {
    const def = compDefs[n.tag];
    if (!def) return;
    const merged = mergeBehaviors(def);
    const data = JSON.parse(JSON.stringify(merged.data || {}));
    /* props：属性求值（定义方 scope）→ properties 定义 */
    const props = {};
    for (const k of Object.keys(n.attrs)) {
      if (/^(bind|catch)/.test(k)) continue;
      props[k] = evalAttr(n.attrs[k], scope);
    }
    for (const k of Object.keys(def.properties || {})) {
      const pd = def.properties[k];
      if (props[k] === undefined) props[k] = pd && pd.value !== undefined ? pd.value : '';
    }
    Object.assign(data, props);
    const inst = {
      __kind: 'component', __def: def, data, __vnode: n, __parentPage: page, __props: props,
      /* slot 内容归「模板定义方」：children 在定义方模板里写的，事件/求值都用定义方上下文 */
      __slotChildren: n.children && n.children.length ? n.children : null,
      __slotScope: scope,
      __slotCtx: page,
      setData(patch) {
        Object.assign(this.data, patch);
        const obs = def.observers || {};
        for (const k of Object.keys(patch)) if (obs[k]) try { obs[k].call(this, this.data[k]); } catch (e) {}
        rerenderInstance(this);
      },
      triggerEvent(name, detail) {
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
    /* 组件模板的上下文 = 组件实例自己（事件/嵌套组件回调都归组件），slot 节点读 inst.__slotChildren */
    for (const c of findTemplate(inst)) renderNode(c, inst.data, inst, host);
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
      compInstances.clear(); /* 上一轮组件实例随 DOM 一起丢弃 */
      el.innerHTML = '';
      for (const n of META.pageMeta[route].tpl) renderNode(n, inst.data, inst, el);
      /* 组件实例属于本页渲染 —— 上面 renderNode 内已创建 */
      if (META.pageMeta[route].isTab && tabbarInst) { TABB.innerHTML = ''; TABB.appendChild(tabbarInst.__el); }
      else TABB.innerHTML = '';
      el.scrollTop = keepScroll;
      if (focusIdx >= 0) { const el2 = [...document.querySelectorAll('input,textarea')][focusIdx]; if (el2) { el2.focus(); try { el2.setSelectionRange(el2.value.length, el2.value.length); } catch (e) {} } }
      /* scroll-into-view：对齐 scroll-view 锚点 */
      const siv = inst.data.scrollIntoView || inst.data.scrollTo;
      if (siv && typeof siv === 'string') { const tgt = el.querySelector('[id="' + siv + '"]'); if (tgt) try { tgt.scrollIntoView({ behavior: 'smooth', block: 'end' }); } catch (e) {} }
    };
    /* 顶层函数：生命周期 + 自定义方法（Page 选项全平铺） */
    for (const k of Object.keys(def)) {
      if (k === 'data' || k === 'behaviors' || k === '__route') continue;
      if (typeof def[k] === 'function' && inst[k] === undefined) inst[k] = def[k];
    }
    /* behaviors 生命周期 */
    const lifetimes = merged.lifetimes || {};
    inst.setData = function (patch) {
      Object.assign(this.data, patch);
      const obs = def.observers || {};
      for (const k of Object.keys(patch)) if (obs[k]) try { obs[k].call(this, this.data[k]); } catch (e) {}
      if (this.__suspendRender) return; /* IME 组合中：只记账不重渲，避免打断输入法 */
      if (this.__renderPending) return;
      this.__renderPending = true;
      Promise.resolve().then(() => { this.__renderPending = false; this.__render && this.__render(); });
    };
    return inst;
  }
  function scheduleRender(inst) { Promise.resolve().then(() => inst.__render && inst.__render()); }

  /* ---------- 组件 JS 执行（compMeta 收录的全部自定义组件） ---------- */
  function setupComponents() {
    for (const tag of Object.keys(META.compMeta)) {
      const meta = META.compMeta[tag];
      const src = BUNDLE[meta.base + '.js'];
      if (!src) continue;
      let def = null;
      const saved = window.Component;
      window.Component = o => { def = o; return o; };
      try {
        new Function('module', 'exports', 'Component', 'Behavior', 'require', 'getApp', 'wx', src)({}, {}, window.Component, window.Behavior, requireFrom(meta.base), window.getApp, wx);
      } catch (e) { console.error('[w2w] component load fail', tag, e && e.message); }
      window.Component = saved;
      if (def) { def.__tag = tag; compDefs[tag] = def; }
    }
  }

  /* ---------- 自定义 tabbar ---------- */
  let tabbarInst = null;
  function setupTabbar() {
    const def = compDefs['custom-tab-bar'] || null;
    if (!def) return;
    const data = JSON.parse(JSON.stringify(def.data || {}));
    const inst = {
      data,
      setData(patch) { Object.assign(this.data, patch); renderTabbar(this, def); },
      ...def.methods
    };
    tabbarInst = inst;
    if (typeof def.attached === 'function') try { def.attached.call(inst); } catch (e) {}
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
    if (n.wfor !== undefined) {
      const list = evalExpr(n.wfor, scope);
      const arr = list == null ? [] : (Array.isArray(list) ? list : Object.keys(list));
      const itemName = n.witem || 'item', idxName = n.windex || 'index';
      const plain = { tag: n.tag, attrs: n.attrs, children: n.children, on: n.on, wif: n.wif };
      for (let i = 0; i < arr.length; i++) {
        const cs = Object.create(scope);
        cs[itemName] = arr[i]; cs[idxName] = i;
        renderNodeSelf(plain, cs, inst, parent);
      }
      return;
    }
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
  function parseRoute(url) {
    const s = String(url || '').replace(/^\//, '');
    const qi = s.indexOf('?');
    const query = {};
    if (qi >= 0) new URLSearchParams(s.slice(qi + 1)).forEach((v, k) => { query[k] = v; });
    return { route: qi >= 0 ? s.slice(0, qi) : s, query };
  }
  const tabCache = {}; /* 真机 tab 页常驻：缓存实例，切换只挂回 + onShow */
  function mountRoot(route, query) {
    rootRoute = route;
    rootPage = createPage(route, true);
    if (!rootPage) return;
    if (META.pageMeta[route] && META.pageMeta[route].isTab && tabbarInst) rootPage.__tabbar = tabbarInst;
    ROOT.innerHTML = ''; ROOT.appendChild(rootPage.__el);
    rootPage.__onLoadExists = typeof rootPage.onLoad === 'function';
    if (typeof rootPage.onLoad === 'function') try { rootPage.onLoad(query || {}); rootPage.__onLoadRan = true; } catch (e) { rootPage.__onLoadErr = String(e && e.message || e); }
    rootPage.__render();
    if (typeof rootPage.onShow === 'function') try { rootPage.onShow(); } catch (e) {}
    if (META.pageMeta[route] && META.pageMeta[route].isTab) tabCache[route] = rootPage;
  }
  function pushOverlay(url) {
    const { route, query } = parseRoute(url);
    const inst = createPage(route);
    if (!inst) return;
    stack.push(inst);
    const wrap = document.createElement('div'); wrap.className = 'w2w-overlay-page'; wrap.style.cssText = 'position:absolute;inset:0;overflow-y:auto;background:#F7F6F4;z-index:' + (20 + stack.length);
    wrap.appendChild(inst.__el); OVER.appendChild(wrap);
    if (typeof inst.onLoad === 'function') try { inst.onLoad(query || {}); } catch (e) { console.error('[w2w] onLoad fail', route, e && e.message); }
    inst.__render();
    if (typeof inst.onShow === 'function') try { inst.onShow(); } catch (e) {}
  }
  function replaceOverlay(url) {
    const { route, query } = parseRoute(url);
    if (!stack.length) { mountRoot(route, query); return; } /* 根页 redirectTo：换根 */
    const old = stack.pop();
    if (OVER.lastChild) OVER.removeChild(OVER.lastChild);
    if (typeof old.onUnload === 'function') try { old.onUnload(); } catch (e) {}
    pushOverlay(url);
  }
  function popOverlay() {
    const old = stack.pop();
    if (!old) return;
    if (OVER.lastChild) OVER.removeChild(OVER.lastChild);
    if (typeof old.onUnload === 'function') try { old.onUnload(); } catch (e) {}
  }
  function switchTab(url) {
    const { route } = parseRoute(url);
    while (stack.length) popOverlay();
    if (tabCache[route]) {
      if (rootRoute === route) { if (typeof rootPage.onShow === 'function') try { rootPage.onShow(); } catch (e) {} return; }
      if (rootPage && rootPage.__el.parentNode) rootPage.__el.parentNode.removeChild(rootPage.__el);
      rootRoute = route; rootPage = tabCache[route];
      ROOT.appendChild(rootPage.__el);
      rootPage.__render();
      if (typeof rootPage.onShow === 'function') try { rootPage.onShow(); } catch (e) {}
      return;
    }
    mountRoot(route);
  }
  function reLaunch(url) {
    const { route, query } = parseRoute(url);
    while (stack.length) popOverlay();
    for (const k of Object.keys(tabCache)) delete tabCache[k];
    mountRoot(route, query);
  }
  window.__nav = { pushOverlay, replaceOverlay, popOverlay, switchTab, mountRoot, reLaunch };

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
  setupComponents();
  setupTabbar();
  mountRoot(META.pages[0]);
  /* app.json 入口一般是 launch —— 若 launch 自动跳转，交给页面逻辑 */
})();
