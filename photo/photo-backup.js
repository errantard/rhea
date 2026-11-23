/* ═══════════════════════════════════════════════════════════════
   [PHOTO-BACKUP] 30차 v291 사진 ZIP 백업 · 정리하기 (⇅ 데이터 → "사진 백업 받기" 누를 때만 불러옴)
   - ZIP 안: 장소명 폴더 / 장소명_AS01_261120.webp · 장소명_기기01.webp (이름 규칙 B)
   - 4장씩 받기 · 실패하면 2번 더 · 그래도 안 되면 받기실패.txt 에 적음
   - 200MB 넘으면 ZIP 여러 개로 나눔 (_1of3) · 압축 안 함(STORE — webp는 이미 압축됨, 빠름)
   - [전체 받기] + 해마다 한 줄(올린 날 기준) = 누르면 그 해 받기 · 누가 언제 받아도 똑같음
   - 정리하기(관리자): 표에 없는 Storage 파일(유령) + 주인 없는 사진 줄(업체·AS 카드 지워짐) 지우기
   ═══════════════════════════════════════════════════════════════ */
(function () {
    'use strict';
    const P = window.RheaPhoto, A = P._api;
    const JSZIP = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    const PART = 200 * 1024 * 1024;
    const PAR = 4;
    const $ = (s) => document.querySelector(s);
    const fmt = (b) => b >= 1024 * 1024 * 1024 ? (b / 1073741824).toFixed(2) + 'GB' : b >= 1048576 ? Math.round(b / 1048576) + 'MB' : Math.round(b / 1024) + 'KB';
    const ymd = (d) => `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    let running = false;

    function loadZip() {
        if (window.JSZip) return Promise.resolve();
        return new Promise((res, rej) => {
            const s = document.createElement('script'); s.src = JSZIP;
            s.onload = res; s.onerror = () => rej(new Error('ZIP 도구를 못 받았어요 (인터넷 확인)'));
            document.head.appendChild(s);
        });
    }

    /* ───────── 창 ───────── */
    const sum = (l) => l.reduce((s, r) => s + (r.bytes || 0), 0);
    // 해 열쇠 = "2026" · 올린 날(created_at) 기준 → 지난 해 ZIP은 나중에 안 바뀜
    function yearOf(r) { return String(new Date(r.created_at || Date.now()).getFullYear()); }
    const yearName = (k) => `${k}년`;
    function years() {
        const map = new Map();
        A.rows().forEach(r => { const k = yearOf(r); if (!map.has(k)) map.set(k, []); map.get(k).push(r); });
        return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    }

    function open() {
        let m = $('#rpBk');
        if (!m) {
            m = document.createElement('div');
            m.id = 'rpBk'; m.className = 'rp-bk';
            m.innerHTML = `<div class="rp-bk-card">
                <div class="rp-bk-head"><b>📷 사진 백업</b><span class="rp-bk-x" title="닫기">✕</span></div>
                <div class="rp-bk-body"></div>
                <div class="rp-bk-msg"></div>
                <div class="rp-bk-bar" hidden><i></i></div>
            </div>`;
            document.body.appendChild(m);
            m.querySelector('.rp-bk-x').onclick = close;
            m.addEventListener('click', (e) => { if (e.target === m) close(); });
        }
        m.hidden = false;
        draw();
    }
    function close() {
        if (running && !confirm('받는 중이에요. 멈출까요?')) return;
        running = false;
        const m = $('#rpBk'); if (m) m.hidden = true;
    }
    function draw() {
        const all = A.rows(), nowK = yearOf({ created_at: new Date().toISOString() });
        const admin = !!(A.cfg().isAdmin && A.cfg().isAdmin());
        const hs = years();
        $('#rpBk .rp-bk-body').innerHTML = `
            <button type="button" class="rp-bk-btn main" data-k="all" ${all.length ? '' : 'disabled'}><span>⬇ 전체 받기</span><small>${all.length}장 · ${fmt(sum(all))}</small></button>
            ${hs.length ? '<div class="rp-bk-sep"></div>' : ''}
            ${hs.map(([k, l]) => `<button type="button" class="rp-bk-btn" data-k="${k}"><span>⬇ ${yearName(k)}${k === nowK ? ' <em>진행 중</em>' : ''}</span><small>${l.length}장 · ${fmt(sum(l))}</small></button>`).join('')}
            ${admin ? `<button type="button" class="rp-bk-btn ghost" data-k="clean"><span>🧹 서버 정리하기</span><small>유령 파일 찾기</small></button>` : ''}
            <p class="rp-bk-tip">해 = 사진 올린 날 기준 · PC에서 받기 추천 · 200MB 넘으면 ZIP 여러 개로 나눠져요</p>`;
        $('#rpBk .rp-bk-body').querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
            if (running) return;
            const k = b.dataset.k;
            if (k === 'clean') clean();
            else if (k === 'all') run(A.rows(), `전체_${ymd(new Date())}`);
            else run(A.rows().filter(r => yearOf(r) === k), yearName(k) + (k === nowK ? `_${ymd(new Date())}까지` : ''));
        });
        msg('');
        bar(null);
    }
    function msg(t, err) { const e = $('#rpBk .rp-bk-msg'); if (e) { e.textContent = t; e.classList.toggle('err', !!err); } }
    function bar(r) { const b = $('#rpBk .rp-bk-bar'); if (!b) return; b.hidden = r == null; if (r != null) b.firstChild.style.width = Math.round(r * 100) + '%'; }
    function lock(on) { running = on; document.querySelectorAll('#rpBk .rp-bk-btn').forEach(b => { if (on) { b.dataset.was = b.disabled ? '1' : ''; b.disabled = true; } else b.disabled = b.dataset.was === '1'; }); }

    /* ───────── ZIP 받기 ───────── */
    async function fetchBlob(url) {
        let last;
        for (let t = 0; t < 3; t++) {
            try { const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status); return await r.blob(); }
            catch (e) { last = e; await sleep(800 * (t + 1)); }
        }
        throw last;
    }
    async function run(list, label) {
        if (!list.length) return;
        lock(true);
        try {
            msg('ZIP 도구 준비 중…'); await loadZip();
            // 장소명 → 파일 이름 순으로 정렬해서 한 장소가 되도록 한 ZIP 안에 들어가게
            const items = list.map(r => ({ r, folder: A.placeOf(r.company_id) || '_업체없음', name: A.fileName(r) }))
                .sort((a, b) => (a.folder + '/' + a.name).localeCompare(b.folder + '/' + b.name, 'ko'));
            const parts = []; let curP = [], curB = 0;
            items.forEach(it => {
                if (curP.length && curB + (it.r.bytes || 0) > PART) { parts.push(curP); curP = []; curB = 0; }
                curP.push(it); curB += it.r.bytes || 0;
            });
            if (curP.length) parts.push(curP);
            let done = 0, failAll = 0;
            for (let pi = 0; pi < parts.length; pi++) {
                if (!running) throw new Error('멈췄어요');
                const part = parts[pi], zip = new window.JSZip(), fails = [];
                // 서명 주소는 100장씩 받기
                for (let i = 0; i < part.length; i += 100) {
                    const chunk = part.slice(i, i + 100);
                    const urls = await A.signed(chunk.map(x => x.r.path));
                    chunk.forEach((x, k) => { x.url = urls[k]; });
                }
                let idx = 0;
                const worker = async () => {
                    while (idx < part.length && running) {
                        const x = part[idx++];
                        try {
                            if (!x.url) throw new Error('주소 없음');
                            zip.file(`${x.folder}/${x.name}`, await fetchBlob(x.url));
                        } catch (e) { fails.push(`${x.folder}/${x.name}  (${e.message || e})`); }
                        done++;
                        bar(done / items.length);
                        msg(`받는 중… ${done}/${items.length}장${parts.length > 1 ? ` · ZIP ${pi + 1}/${parts.length}` : ''}`);
                    }
                };
                await Promise.all(Array.from({ length: PAR }, worker));
                if (!running) throw new Error('멈췄어요');
                if (fails.length) zip.file('받기실패.txt', `받기 실패 ${fails.length}장 (같은 버튼으로 다시 받아 주세요)\r\n\r\n` + fails.join('\r\n'));
                failAll += fails.length;
                msg(`ZIP 묶는 중…${parts.length > 1 ? ` (${pi + 1}/${parts.length})` : ''}`);
                const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `RheaOps_사진_${label}${parts.length > 1 ? `_${pi + 1}of${parts.length}` : ''}.zip`;
                document.body.appendChild(a); a.click(); a.remove();
                setTimeout(() => URL.revokeObjectURL(a.href), 60000);
            }
            draw();
            if (!failAll) msg(`✅ ${items.length}장 받았어요${parts.length > 1 ? ` (ZIP ${parts.length}개)` : ''}`);
            else msg(`⚠️ ${items.length - failAll}장 받음 · ${failAll}장 실패 (ZIP 안 받기실패.txt) — 같은 버튼으로 다시 받아 주세요`, true);
        } catch (e) {
            console.error('[photo-backup]', e);
            draw(); msg('⚠️ ' + (e.message || e), true);
        } finally { lock(false); bar(null); }
    }

    /* ───────── 정리하기 ───────── */
    async function listAll(st, prefix) {
        const out = [];
        for (let off = 0; ; off += 1000) {
            const { data, error } = await st.list(prefix, { limit: 1000, offset: off });
            if (error) throw error;
            (data || []).forEach(d => out.push(d));
            if (!data || data.length < 1000) break;
        }
        return out;
    }
    async function clean() {
        lock(true);
        try {
            const cfg = A.cfg(), st = cfg.sb.storage.from(A.BUCKET);
            msg('Storage 살펴보는 중…'); bar(0);
            const folders = (await listAll(st, '')).filter(d => !d.id).map(d => d.name);   // id 없는 것 = 폴더(업체 id)
            const files = [];
            let k = 0;
            const worker = async () => {
                while (k < folders.length) {
                    const cid = folders[k++];
                    for (const kind of ['as', 'device']) {
                        (await listAll(st, `${cid}/${kind}`)).filter(d => d.id).forEach(d => files.push(`${cid}/${kind}/${d.name}`));
                    }
                    bar(k / Math.max(1, folders.length));
                }
            };
            await Promise.all(Array.from({ length: PAR }, worker));
            const known = new Set();
            A.rows().forEach(r => { known.add(r.path); if (r.thumb_path) known.add(r.thumb_path); });
            const ghost = files.filter(p => !known.has(p));
            const orphanRows = A.rows().filter(r => {
                const it = cfg.getItem(r.company_id);
                if (!it) return true;
                return r.kind === 'as' && !(it.memoList || []).some(m => m.id === r.memo_id);
            });
            bar(null);
            if (!ghost.length && !orphanRows.length) { msg('✨ 깨끗해요 — 지울 게 없어요'); return; }
            const ok = confirm(`정리할 것\n\n· 유령 파일(표에 없는 파일) ${ghost.length}개\n· 주인 없는 사진(업체나 AS 카드가 지워짐) ${orphanRows.length}장\n\n지울까요? (되돌릴 수 없어요)`);
            if (!ok) { msg('정리 안 함'); return; }
            if (orphanRows.length) await A.removeRows(orphanRows);
            for (let i = 0; i < ghost.length; i += 100) {
                const { error } = await st.remove(ghost.slice(i, i + 100));
                if (error) throw error;
            }
            A.refreshUsage(); A.fillBadges();
            draw();
            msg(`🧹 정리 끝 — 파일 ${ghost.length}개 · 사진 ${orphanRows.length}장 지움`);
        } catch (e) {
            console.error('[photo-clean]', e);
            msg('⚠️ 정리 실패: ' + (e.message || e), true);
        } finally { lock(false); bar(null); }
    }

    document.addEventListener('keydown', (e) => { const m = $('#rpBk'); if (e.key === 'Escape' && m && !m.hidden) { e.stopImmediatePropagation(); close(); } }, true);
    window.RheaPhotoBackup = { open };
})();
