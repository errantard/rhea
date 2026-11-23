/* ═══════════════════════════════════════════════════════════════
   [PHOTO] RheaOps 사진 모듈 (30차 · v288 1단계 = AS 사진)
   - 저장: Supabase Storage 'photos' 버킷(비공개) · 경로는 영어/아이디만
       {companyId}/as/{photoId}.webp  +  {photoId}_t.webp (작은 그림)
   - 기록: public.photos 표 (company_id · kind · memo_id · path · thumb_path · bytes · taken_at)
   - 올리기 전 자동 줄이기: AS 긴 변 1280px · 작은 그림 320px · WebP (안 되면 JPEG)
   - 보기: 상세창 옆 패널(B) · 패널 위 [🖥 보조 모니터로] = photo/viewer.html 새 창(C)
           + 창 자리 잡기(D)는 placeWindowFeatures() 한 곳에만 있음 (빼려면 이 함수만 고치면 됨)
   - 폰(≤880px) = 화면 가득 보기
   - dashboard.html 은 RheaPhoto.init / entryHtml / fillThread / 입력칸 hook 만 부름
   ═══════════════════════════════════════════════════════════════ */
(function () {
    'use strict';

    const BUCKET = 'photos';
    const LIMIT = { as: 5, device: 3 };            // 카드(메모)당 / 기기당 최대 장수
    const EDGE = { as: 1280, device: 1600 };       // 긴 변 px
    const THUMB_EDGE = 320;
    const QUALITY = 0.8, THUMB_Q = 0.7;
    const FREE_BYTES = 1024 * 1024 * 1024;         // Supabase 무료 1GB
    const URL_TTL = 3600;                          // 서명 주소 1시간 (50분 지나면 새로 받음)
    const MOBILE_MAX = 880;

    let cfg = null;              // { sb, getItem(id), userName(), isGuest() }
    let rows = [];               // photos 표 전체 (작아서 한 번에 받음)
    let loaded = false;
    const urlCache = new Map();  // path → { url, until }
    let staged = [];             // 등록 전 고른 사진 { file, url }
    let busy = false;

    /* ───────── 작은 도우미 ───────── */
    const $ = (s, r) => (r || document).querySelector(s);
    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const toast = (m, err) => (typeof window.showSyncStatus === 'function' ? window.showSyncStatus(m, err) : console.log(m));
    const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
    const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const isMobile = () => window.innerWidth <= MOBILE_MAX;
    const fmtMB = (b) => b >= 1024 * 1024 * 1024 ? (b / 1024 / 1024 / 1024).toFixed(2) + 'GB' : b >= 1024 * 1024 ? Math.round(b / 1024 / 1024) + 'MB' : Math.round(b / 1024) + 'KB';
    const ofMemo = (cid, mid) => rows.filter(r => r.company_id === cid && r.kind === 'as' && r.memo_id === mid)
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    const ofCompany = (cid) => rows.filter(r => r.company_id === cid);

    /* ───────── 1. 시작 · 목록 ───────── */
    async function init(options) {
        cfg = options;
        try {
            const { data, error } = await cfg.sb.from('photos')
                .select('id,company_id,kind,memo_id,device_pid,path,thumb_path,bytes,taken_at,created_at');
            if (error) throw error;
            rows = data || [];
            loaded = true;
        } catch (e) {
            console.warn('[photo] 목록 못 받음', e);
            rows = []; loaded = false;
        }
        refreshUsage(true);
        fillBadges();
        // 상세창이 이미 열려 있으면 사진 칸 다시 채우기
        const open = $('#detailModal');
        if (open && open.style.display !== 'none' && typeof window.renderDetailMemoThread === 'function') {
            const it = cfg.getItem($('#detailTargetId').value);
            if (it) window.renderDetailMemoThread(it.memoList || []);
        }
    }

    function usage() {
        const bytes = rows.reduce((s, r) => s + (r.bytes || 0), 0);
        return { count: rows.length, bytes, ratio: bytes / FREE_BYTES };
    }
    let warned = false;
    function refreshUsage(first) {
        const u = usage();
        const el = $('#photoUsage');
        if (el) {
            el.innerHTML = `<span class="rp-u-txt">📷 사진 ${u.count}장 · ${fmtMB(u.bytes)} / 1GB</span>` +
                `<span class="rp-u-bar"><i style="width:${Math.min(100, u.ratio * 100).toFixed(1)}%"></i></span>`;
            el.classList.toggle('warn', u.ratio >= 0.8);
        }
        if (u.ratio >= 0.8 && !warned && first) {
            warned = true;
            setTimeout(() => toast(`📷 사진 저장 공간 ${Math.round(u.ratio * 100)}% 찼어요 — ZIP 백업 후 정리해 주세요`, true), 1500);
        }
    }

    // 폰 카드 메모 줄 옆 📷N (목록 받기 전에 그려진 카드도 나중에 채움)
    function badge(cid) {
        const n = loaded ? ofCompany(cid).filter(r => r.kind === 'as').length : 0;
        return `<i class="rp-badge" data-ph-cid="${esc(cid)}">${n ? '📷' + n : ''}</i>`;
    }
    function fillBadges() {
        document.querySelectorAll('[data-ph-cid]').forEach(el => {
            const n = ofCompany(el.dataset.phCid).filter(r => r.kind === 'as').length;
            el.textContent = n ? '📷' + n : '';
        });
    }

    /* ───────── 2. 줄이기 (canvas) ───────── */
    let webpOK = null;
    function canWebp() {
        if (webpOK === null) {
            try { const c = document.createElement('canvas'); c.width = c.height = 1; webpOK = c.toDataURL('image/webp').startsWith('data:image/webp'); }
            catch (e) { webpOK = false; }
        }
        return webpOK;
    }
    function toBlob(canvas, q) {
        const type = canWebp() ? 'image/webp' : 'image/jpeg';
        return new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('그림 만들기 실패')), type, q));
    }
    async function decode(file) {
        if (window.createImageBitmap) {
            try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* 아래 img 방식 */ }
        }
        const url = URL.createObjectURL(file);
        try {
            const img = new Image();
            img.decoding = 'async';
            await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('읽을 수 없는 사진')); img.src = url; });
            return img;
        } finally { setTimeout(() => URL.revokeObjectURL(url), 2000); }
    }
    function draw(src, edge) {
        const w0 = src.width || src.naturalWidth, h0 = src.height || src.naturalHeight;
        const s = Math.min(1, edge / Math.max(w0, h0));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w0 * s)); c.height = Math.max(1, Math.round(h0 * s));
        const g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(src, 0, 0, c.width, c.height);
        return c;
    }
    async function compress(file, kind) {
        let src;
        try { src = await decode(file); }
        catch (e) {
            const heic = /heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name || '');
            throw new Error(heic ? 'HEIC 사진은 못 읽어요 (폰 카메라 설정 → "호환성 우선"/JPEG로)' : `"${file.name}" 은(는) 읽을 수 없는 사진이에요`);
        }
        const full = await toBlob(draw(src, EDGE[kind]), QUALITY);
        const thumb = await toBlob(draw(src, THUMB_EDGE), THUMB_Q);
        if (src.close) src.close();
        return { full, thumb, ext: full.type === 'image/webp' ? 'webp' : 'jpg' };
    }

    /* ───────── 3. 올리기 · 지우기 ───────── */
    async function uploadOne(file, cid, kind, ref) {
        const { full, thumb, ext } = await compress(file, kind);
        const id = uuid();
        const path = `${cid}/${kind}/${id}.${ext}`;
        const tpath = `${cid}/${kind}/${id}_t.${ext}`;
        const st = cfg.sb.storage.from(BUCKET);
        const up1 = await st.upload(path, full, { contentType: full.type, upsert: false });
        if (up1.error) throw up1.error;
        const up2 = await st.upload(tpath, thumb, { contentType: thumb.type, upsert: false });
        if (up2.error) { await st.remove([path]); throw up2.error; }
        const row = {
            id, company_id: cid, kind, path, thumb_path: tpath,
            memo_id: kind === 'as' ? ref : null, device_pid: kind === 'device' ? ref : null,
            bytes: full.size + thumb.size, taken_at: takenDate(cid, kind, ref), created_by: cfg.userName()
        };
        const ins = await cfg.sb.from('photos').insert(row).select().single();
        if (ins.error) { await st.remove([path, tpath]); throw ins.error; }
        rows.push(ins.data || Object.assign({ created_at: new Date().toISOString() }, row));
        return row;
    }

    // AS 사진 날짜 = 그 AS 카드 날짜 (지난 날짜로 등록해도 받는 이름이 카드 날짜로 맞게) · 기기 = 오늘
    function takenDate(cid, kind, ref) {
        if (kind !== 'as') return today();
        const it = cfg.getItem(cid) || {};
        const m = (it.memoList || []).find(x => x.id === ref);
        const d = m && String(m.date || '').slice(0, 10);
        return /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : today();
    }

    // 여러 장 차례로 올리기 (실패한 건 이름 모아서 한 번에 알림)
    async function uploadMany(files, cid, kind, ref) {
        const fails = [];
        let ok = 0;
        for (let i = 0; i < files.length; i++) {
            toast(`📷 사진 올리는 중… ${i + 1}/${files.length}`);
            try { await uploadOne(files[i], cid, kind, ref); ok++; }
            catch (e) { console.error('[photo] 올리기 실패', e); fails.push((files[i].name || `${i + 1}번째`) + ' — ' + (e.message || e)); }
        }
        refreshUsage(); fillBadges();
        if (fails.length) alert('사진 ' + fails.length + '장 못 올렸어요\n\n' + fails.join('\n'));
        else if (ok) toast(`📷 사진 ${ok}장 올림`);
        return ok;
    }

    async function removeRows(list) {
        if (!list.length) return;
        const paths = [];
        list.forEach(r => { paths.push(r.path); if (r.thumb_path) paths.push(r.thumb_path); });
        const del = await cfg.sb.from('photos').delete().in('id', list.map(r => r.id));
        if (del.error) throw del.error;
        const rm = await cfg.sb.storage.from(BUCKET).remove(paths);
        if (rm.error) console.warn('[photo] 파일 지우기 실패 (나중에 정리하기)', rm.error);
        const ids = new Set(list.map(r => r.id));
        rows = rows.filter(r => !ids.has(r.id));
        paths.forEach(p => urlCache.delete(p));
        refreshUsage(); fillBadges();
    }

    /* ───────── 4. 서명 주소 (비공개 버킷) ───────── */
    async function signed(paths) {
        const now = Date.now();
        const need = [...new Set(paths)].filter(p => { const c = urlCache.get(p); return !c || c.until < now; });
        if (need.length) {
            const { data, error } = await cfg.sb.storage.from(BUCKET).createSignedUrls(need, URL_TTL);
            if (error) throw error;
            (data || []).forEach(d => { if (d.signedUrl) urlCache.set(d.path, { url: d.signedUrl, until: now + (URL_TTL - 600) * 1000 }); });
        }
        return paths.map(p => (urlCache.get(p) || {}).url || '');
    }

    /* ───────── 5. AS 카드 안 사진 줄 ───────── */
    // renderDetailMemoThread 가 카드마다 부름 → 빈 칸만 그리고, fillThread 가 그림을 채움
    function entryHtml(cid, mid) {
        if (!mid) return '';
        const list = loaded ? ofMemo(cid, mid) : [];
        const add = (list.length < LIMIT.as) ? `<span class="rp-add" title="사진 넣기 (${list.length}/${LIMIT.as})" onclick="RheaPhoto.addTo('${esc(mid)}')">📷</span>` : '';
        const thumbs = list.map((r, i) =>
            `<button type="button" class="rp-th" data-tp="${esc(r.thumb_path)}" onclick="RheaPhoto.open('${esc(cid)}','${esc(mid)}',${i})" title="사진 크게 보기"></button>`).join('');
        return `${add}<div class="rp-strip"${list.length ? '' : ' hidden'}>${thumbs}</div>`;
    }
    async function fillThread() {
        const box = $('#detailMemoList');
        if (!box) return;
        const els = [...box.querySelectorAll('.rp-th[data-tp]')];
        if (!els.length) return;
        try {
            const urls = await signed(els.map(e => e.dataset.tp));
            els.forEach((e, i) => { if (urls[i]) e.style.backgroundImage = `url("${urls[i]}")`; });
        } catch (e) { console.warn('[photo] 작은 그림 주소 실패', e); }
    }

    // 이미 등록된 카드에 사진 더 넣기
    function addTo(mid) {
        if (window.guestBlocked && window.guestBlocked()) return;
        if (busy) return;
        const cid = $('#detailTargetId').value;
        const left = LIMIT.as - ofMemo(cid, mid).length;
        if (left <= 0) { toast(`📷 한 카드에 ${LIMIT.as}장까지예요`, true); return; }
        pickFiles(async (files) => {
            if (files.length > left) { toast(`📷 ${left}장만 더 넣을 수 있어서 앞의 ${left}장만 올려요`, true); files = files.slice(0, left); }
            busy = true;
            try { await uploadMany(files, cid, 'as', mid); }
            finally { busy = false; rerender(cid); }
        });
    }
    function rerender(cid) {
        const it = cfg.getItem(cid);
        if (it && $('#detailTargetId').value === cid && typeof window.renderDetailMemoThread === 'function') {
            const keep = $('#detailMemoList') ? $('#detailMemoList').scrollTop : 0;
            window.renderDetailMemoThread(it.memoList || []);
            requestAnimationFrame(() => requestAnimationFrame(() => { const b = $('#detailMemoList'); if (b) b.scrollTop = keep; }));
        }
        if (panelState) refreshPanel();
    }

    function pickFiles(cb) {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
        inp.style.display = 'none';
        inp.onchange = () => { const f = [...(inp.files || [])]; inp.remove(); if (f.length) cb(f); };
        document.body.appendChild(inp);
        inp.click();
    }

    /* ───────── 6. 새 AS 입력칸 (등록 전 고른 사진) ───────── */
    function stagePick() {
        if (window.guestBlocked && window.guestBlocked()) return;
        const left = LIMIT.as - staged.length;
        if (left <= 0) { toast(`📷 한 카드에 ${LIMIT.as}장까지예요`, true); return; }
        pickFiles((files) => {
            if (files.length > left) { toast(`📷 ${left}장만 더 넣을 수 있어서 앞의 ${left}장만 골랐어요`, true); files = files.slice(0, left); }
            files.forEach(f => staged.push({ file: f, url: URL.createObjectURL(f) }));
            renderStaged();
        });
    }
    function unstage(i) {
        const s = staged.splice(i, 1)[0];
        if (s) URL.revokeObjectURL(s.url);
        renderStaged();
    }
    function clearStaged() {
        staged.forEach(s => URL.revokeObjectURL(s.url));
        staged = [];
        renderStaged();
    }
    function renderStaged() {
        const box = $('#rpStaged');
        const btn = $('#rpStageBtn');
        if (btn) { btn.textContent = `📷 ${staged.length}/${LIMIT.as}`; btn.classList.toggle('on', staged.length > 0); }
        if (!box) return;
        box.hidden = !staged.length;
        box.innerHTML = staged.map((s, i) =>
            `<span class="rp-st" style="background-image:url('${s.url}')"><b onclick="RheaPhoto.unstage(${i})" title="빼기">✕</b></span>`).join('');
    }
    function hasStaged() { return staged.length > 0; }
    // addDetailMemoItem 이 메모 저장 성공 뒤 부름
    async function commitStaged(cid, mid) {
        if (!staged.length) return;
        const files = staged.map(s => s.file);
        clearStaged();
        busy = true;
        try { await uploadMany(files, cid, 'as', mid); }
        finally { busy = false; rerender(cid); }
    }

    // AS 카드 지울 때 (deleteDetailMemoItem 에서 부름)
    async function removeMemo(cid, mid) {
        const list = ofMemo(cid, mid);
        if (!list.length) return;
        try { await removeRows(list); } catch (e) { console.error(e); toast('📷 사진 지우기 실패 — 나중에 정리하기', true); }
        if (panelState && panelState.cid === cid && panelState.mid === mid) closePanel();
    }
    // 업체 지울 때 (deleteDetailItem 에서 부름)
    async function removeCompany(cid) {
        const list = ofCompany(cid);
        if (!list.length) return;
        try { await removeRows(list); } catch (e) { console.error(e); toast('📷 사진 지우기 실패 — 나중에 정리하기', true); }
    }

    /* ───────── 7. 받을 때 이름 (규칙 B) ─────────
       장소명_AS01_251120.webp (같은 날 사진은 01·02… 차례) / 장소명_기기01.webp */
    function fileName(r) {
        const it = cfg.getItem(r.company_id) || {};
        const place = String(it.placeName || '장소').replace(/[\\/:*?"<>|]+/g, '_').trim();
        const ext = (r.path.match(/\.(\w+)$/) || [, 'webp'])[1];
        if (r.kind === 'device') {
            const n = rows.filter(x => x.company_id === r.company_id && x.kind === 'device')
                .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))).indexOf(r) + 1;
            return `${place}_기기${String(n).padStart(2, '0')}.${ext}`;
        }
        // 날짜 = 지금 AS 카드 날짜 (카드 날짜를 나중에 고쳐도 따라감) · 카드가 없으면 올린 날
        const dOf = (x) => { const m = (it.memoList || []).find(mm => mm.id === x.memo_id); return String((m && m.date) || x.taken_at || '').slice(0, 10); };
        const day = dOf(r), d = day.replace(/-/g, '');
        const same = rows.filter(x => x.company_id === r.company_id && x.kind === 'as' && dOf(x) === day)
            .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
        const n = same.indexOf(r) + 1;
        return `${place}_AS${String(n).padStart(2, '0')}_${d.slice(2)}.${ext}`;
    }
    async function download(r) {
        try {
            const [url] = await signed([r.path]);
            const blob = await (await fetch(url)).blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob); a.download = fileName(r);
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        } catch (e) { console.error(e); toast('📷 사진 받기 실패', true); }
    }

    /* ───────── 8. 보기 패널 (B) · 폰 = 화면 가득 ───────── */
    let panelState = null;   // { cid, mid, idx }
    let followRaf = 0;
    let lastRect = '';
    let shifted = false;     // 자리 내려고 상세창을 왼쪽으로 민 상태
    const MIN_W = 320;

    function ensurePanel() {
        let p = $('#rpPanel');
        if (p) return p;
        p = document.createElement('div');
        p.id = 'rpPanel';
        p.className = 'rp-panel';
        p.hidden = true;
        p.innerHTML = `
            <div class="rp-head">
                <span class="rp-title"></span>
                <span class="rp-tools">
                    <button type="button" class="rp-ext" title="보조 모니터에 크게 띄우기" hidden>🖥 보조 모니터로</button>
                    <button type="button" class="rp-dl" title="이 사진 받기">⬇</button>
                    <button type="button" class="rp-del" title="이 사진 지우기">🗑</button>
                    <button type="button" class="rp-x" title="닫기 (Esc)">✕</button>
                </span>
            </div>
            <div class="rp-stage">
                <img class="rp-img" alt="">
                <button type="button" class="rp-nav prev" title="이전 (←)">‹</button>
                <button type="button" class="rp-nav next" title="다음 (→)">›</button>
                <span class="rp-load">불러오는 중…</span>
            </div>
            <div class="rp-foot"><span class="rp-cap"></span><span class="rp-dots"></span></div>`;
        document.body.appendChild(p);
        p.querySelector('.rp-x').onclick = closePanel;
        p.querySelector('.prev').onclick = () => step(-1);
        p.querySelector('.next').onclick = () => step(1);
        p.querySelector('.rp-dl').onclick = () => { const r = cur(); if (r) download(r); };
        p.querySelector('.rp-del').onclick = delCurrent;
        p.querySelector('.rp-ext').onclick = () => openExternal();
        // 폰: 옆으로 밀어 넘기기
        let sx = null;
        const st = p.querySelector('.rp-stage');
        st.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
        st.addEventListener('touchend', e => {
            if (sx === null) return;
            const dx = e.changedTouches[0].clientX - sx; sx = null;
            if (Math.abs(dx) > 45) step(dx < 0 ? 1 : -1);
        });
        return p;
    }
    function list() { return panelState ? ofMemo(panelState.cid, panelState.mid) : []; }
    function cur() { const l = list(); return l[panelState ? panelState.idx : 0]; }

    function open(cid, mid, idx) {
        panelState = { cid, mid, idx: idx || 0 };
        if (extAlive()) { sendExternal(); return; }   // 보조 창이 열려 있으면 거기로
        const p = ensurePanel();
        p.hidden = false;
        p.classList.toggle('full', isMobile());
        const ext = p.querySelector('.rp-ext');
        ext.hidden = isMobile() || !(window.screen && screen.isExtended);
        p.querySelector('.rp-del').hidden = !!(window.isGuestUser && window.isGuestUser());
        refreshPanel();
        startFollow();
    }
    async function refreshPanel() {
        const p = $('#rpPanel');
        if (!p || p.hidden || !panelState) return;
        const l = list();
        if (!l.length) { closePanel(); return; }
        if (panelState.idx >= l.length) panelState.idx = l.length - 1;
        if (panelState.idx < 0) panelState.idx = 0;
        const r = l[panelState.idx];
        const it = cfg.getItem(panelState.cid) || {};
        const memo = (it.memoList || []).find(m => m.id === panelState.mid) || {};
        p.querySelector('.rp-title').textContent = it.placeName || '';
        p.querySelector('.rp-cap').textContent = `AS ${String(memo.date || r.taken_at || '').slice(0, 10)} · ${panelState.idx + 1}/${l.length}`;
        p.querySelector('.rp-dots').innerHTML = l.map((_, i) => `<i class="${i === panelState.idx ? 'on' : ''}"></i>`).join('');
        p.querySelector('.prev').hidden = p.querySelector('.next').hidden = l.length < 2;
        const img = p.querySelector('.rp-img');
        const load = p.querySelector('.rp-load');
        load.hidden = false; load.textContent = '불러오는 중…';
        try {
            const [tu, fu] = await signed([r.thumb_path, r.path]);
            if (cur() !== r) return;           // 그 사이 넘겼으면 무시
            if (img.dataset.pid !== r.id) { img.src = tu; img.dataset.pid = r.id; }   // 작은 그림 먼저 → 큰 그림으로 바꿈
            const big = new Image();
            big.onload = () => { if (cur() === r) { img.src = fu; load.hidden = true; } };
            big.onerror = () => { load.textContent = '못 불러왔어요'; };
            big.src = fu;
        } catch (e) { load.textContent = '못 불러왔어요'; console.warn(e); }
    }
    function step(d) {
        if (!panelState) return;
        const n = list().length;
        if (n < 2) return;
        panelState.idx = (panelState.idx + d + n) % n;
        if (extAlive()) sendExternal(); else refreshPanel();
    }
    async function delCurrent() {
        if (window.guestBlocked && window.guestBlocked()) return;
        const r = cur();
        if (!r || !confirm('이 사진을 지울까요?\n(되돌릴 수 없어요)')) return;
        try { await removeRows([r]); } catch (e) { console.error(e); alert('사진 지우기 실패: ' + (e.message || e)); return; }
        const cid = panelState.cid;
        rerender(cid);
    }
    function closePanel() {
        const p = $('#rpPanel');
        if (p) { p.hidden = true; const img = p.querySelector('.rp-img'); img.removeAttribute('src'); img.dataset.pid = ''; }
        panelState = null;
        cancelAnimationFrame(followRaf); followRaf = 0;
        unshift();
    }

    // 상세창 옆 자리: 오른쪽 → 왼쪽 → (좁으면) 화면 오른쪽 위에 겹치기. 상세창 끌면 따라감
    function place() {
        const p = $('#rpPanel');
        if (!p || p.hidden) return;
        if (isMobile()) { p.classList.add('full'); p.style.cssText = ''; return; }
        p.classList.remove('full');
        const m = $('#detailModal .detail-modal-content');
        const vw = window.innerWidth, vh = window.innerHeight, gap = 12, pad = 10;
        if (!m || $('#detailModal').style.display === 'none') { closePanel(); return; }
        let r = m.getBoundingClientRect();
        // 양옆 다 좁은데 상세창을 왼쪽으로 붙이면 자리가 나면 → 상세창을 왼쪽으로 살짝 밀기 (닫을 때 원래대로)
        if (!shifted && m.style.position !== 'fixed' && vw - r.right - gap - pad < MIN_W && r.left - gap - pad < MIN_W
            && vw - r.width - pad * 2 - gap >= MIN_W) {
            const md = $('#detailModal');
            md.style.justifyContent = 'flex-start'; m.style.marginLeft = pad + 'px';
            shifted = true;
            r = m.getBoundingClientRect();
        }
        const key = [r.left, r.top, r.width, r.height, vw, vh].map(Math.round).join(',');
        if (key === lastRect) return;
        lastRect = key;
        const right = vw - r.right - gap - pad, left = r.left - gap - pad;
        let w, x, cls = '';
        if (right >= MIN_W) { w = Math.min(760, right); x = r.right + gap; }
        else if (left >= MIN_W) { w = Math.min(760, left); x = r.left - gap - w; }
        else { w = Math.min(560, vw - pad * 2); x = vw - w - pad; cls = 'over'; }
        const h = Math.min(vh - pad * 2, Math.max(420, r.height));
        const y = Math.max(pad, Math.min(cls ? pad + 40 : r.top, vh - h - pad));
        p.classList.toggle('over', !!cls);
        p.style.left = x + 'px'; p.style.top = y + 'px';
        p.style.width = w + 'px'; p.style.height = h + 'px';
    }
    function unshift() {
        if (!shifted) return;
        shifted = false;
        const m = $('#detailModal .detail-modal-content'), md = $('#detailModal');
        if (m) m.style.marginLeft = '';
        if (md && (!m || m.style.position !== 'fixed')) md.style.justifyContent = 'center';
    }
    function startFollow() {
        cancelAnimationFrame(followRaf);
        lastRect = '';
        const tick = () => { place(); if (panelState && !extAlive()) followRaf = requestAnimationFrame(tick); };
        tick();
    }

    /* ───────── 9. 보조 모니터 창 (C + D) ───────── */
    let extWin = null;
    function extAlive() { return !!(extWin && !extWin.closed); }

    // ⭐ D = 보조 모니터 자리 잡기 (Window Management API). 이 함수만 있으면 됨 — 빼려면 '' 돌려주기
    async function placeWindowFeatures() {
        const plain = 'popup=yes,width=1100,height=800';
        try {
            if (!window.getScreenDetails || !(window.screen && screen.isExtended)) return plain;
            const d = await window.getScreenDetails();          // 처음 한 번 "창 관리" 허락 물어봄
            const other = d.screens.find(s => s !== d.currentScreen);
            if (!other) return plain;
            return `popup=yes,left=${other.availLeft},top=${other.availTop},width=${other.availWidth},height=${other.availHeight}`;
        } catch (e) { return plain; }                            // 거절·미지원 → 그냥 새 창 (한 번 끌어다 두면 됨)
    }
    async function openExternal() {
        if (!panelState) return;
        if (!extAlive()) {
            const feat = await placeWindowFeatures();
            extWin = window.open('photo/viewer.html?v=288', 'rheaPhotoWin', feat);
            if (!extWin) { toast('🖥 팝업이 막혔어요 — 주소창 오른쪽에서 팝업 허용해 주세요', true); return; }
        } else extWin.focus();
        const p = $('#rpPanel');
        if (p) { p.hidden = true; } unshift();
        cancelAnimationFrame(followRaf);
        sendExternal();
    }
    async function sendExternal() {
        if (!panelState) return;
        const l = list();
        if (!l.length) return;
        const it = cfg.getItem(panelState.cid) || {};
        const memo = (it.memoList || []).find(m => m.id === panelState.mid) || {};
        let urls = [];
        try { urls = await signed(l.map(r => r.path)); } catch (e) { console.warn(e); }
        const msg = {
            type: 'show', title: it.placeName || '', sub: `AS ${String(memo.date || '').slice(0, 10)}`,
            idx: panelState.idx, items: l.map((r, i) => ({ url: urls[i], name: fileName(r) }))
        };
        try { extWin.postMessage(msg, location.origin); } catch (e) { /* 아직 로딩 중이면 ready 때 다시 */ }
        lastMsg = msg;
    }
    let lastMsg = null;
    window.addEventListener('message', (e) => {
        if (e.origin !== location.origin || !e.data) return;
        if (e.data.type === 'rp-ready' && lastMsg && extAlive()) extWin.postMessage(lastMsg, location.origin);
        if (e.data.type === 'rp-idx' && panelState) panelState.idx = e.data.idx;
    });

    /* ───────── 10. 키보드 · 화면 크기 ───────── */
    document.addEventListener('keydown', (e) => {
        const p = $('#rpPanel');
        if (!p || p.hidden) return;
        if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
        if (e.key === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); closePanel(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    }, true);
    window.addEventListener('resize', () => { lastRect = ''; place(); });

    window.RheaPhoto = {
        init, entryHtml, fillThread, addTo, open, closePanel, badge,
        stagePick, unstage, clearStaged, hasStaged, commitStaged,
        removeMemo, removeCompany, usage, fileName,
        _rows: () => rows
    };
})();
