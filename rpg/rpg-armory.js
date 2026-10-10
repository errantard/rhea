/* ═══════════════════════════════════════════════════════════════
   RheaOps · 모험가(RPG) 모듈 — 무기고 팝업 UI (= 모험가 수첩)
   17차-5 (2026-10-07): dashboard.html에서 완전히 분리. 업무 기능(dashboard)과 놀이 기능(rpg/)을 나눔.
   - 로드 순서: rpg-data.js → rpg-core.js → rpg-armory.js → (dashboard 본 스크립트)
   - dashboard는 window.RheaRPG 하나로만 이 모듈을 부름. 이 폴더가 없어도 업체관리는 정상 동작
   - 나중에 캐릭터 꾸미기·미니게임은 rpg/ 안에 새 파일로 추가 (예: rpg-avatar.js, rpg-game-xxx.js)
   - 18차: 수첩 아래쪽 [⚔ 던전팡팡] 버튼 → rpgOpenPang (게임 닫으면 수첩 다시 열림, 포인트 바로 반영)
   - 19차: 수첩 = 캐릭터 꾸미기 창 (장비 칸 + 착용 모습). 고르면 미리보기만 바뀜 → [적용]으로 한꺼번에 장착
   - 19차-3 (2026-10-09): 대장님 시안(도트 수첩 + 상점) 그대로 — 그림 위에 글씨·버튼만 % 좌표로 얹음
   - 19차-4: 장비 칸 → [가방](가진 것만) · [상점] 버튼 → 상점. 둘 다 수첩과 같은 쇠 테두리로 새로 짬 (img/nb2_frame·nb2_panel)
           img/nb2_note.webp(수첩 2048² 기준) · img/nb2_shop.webp(상점 1440×2912 기준) — 좌표는 원본 픽셀 기준 숫자
           [상점]을 누르면 수첩은 그대로, 왼쪽에서 상점 창이 미끄러져 나옴 (폰: 수첩 위로 덮음)
   ═══════════════════════════════════════════════════════════════ */
// 17차-7: 고르면 "선택"만 됨 → [적용]을 눌러야 장착. [닫기]/✕/바깥/Esc는 적용 안 하고 닫기
// 19차: 선택을 칸별로 (rpgPend = { weapon, helm, armor, off, deco }) · 상점 탭 기억 (rpgTab)
let rpgPend = null, rpgTab = 'weapon', rpgPanel = null, rpgShopMsg = '', rpgAsk = null; // rpgAsk = 살까 물어보는 중인 물건 키 // 19차-4: rpgPanel = null | 'shop'(상점) | 'inv'(보유 아이템=가진 것만)
function rpgEquipped(slot) { // 지금 실제로 장착한 것
    if (slot === 'weapon') return rpgCurrentIcon();
    const k = (rpgState.eq || {})[slot];
    if (slot === 'armor') return k && rpgOwns(k) ? k : 'ar_base';
    return k && rpgOwns(k) ? k : null;
}
function rpgEqAll() { const o = {}; RPG_SLOTS.forEach(sl => { o[sl.id] = rpgEquipped(sl.id); }); return o; }
function rpgSlotLocked(sl) { return rpgLevel() < (sl.minLv || 0); }
function openArmory() {
    if (isGuestUser() || !currentUserEmail) return;
    rpgPend = rpgEqAll(); rpgPanel = null; rpgShopMsg = ''; rpgAsk = null;
    rpgInjectDefs();
    let el = document.getElementById('rpgArmory');
    if (!el) {
        el = document.createElement('div');
        el.id = 'rpgArmory';
        el.className = 'rpg-dim nb2-dim';
        el.innerHTML = '<div class="nb2-wrap"><div class="nb2-shopbox"><div class="nb2-shop" role="dialog" aria-label="상점 · 가방"></div></div><div class="nb2" role="dialog" aria-modal="true" aria-label="모험가 수첩"></div></div>';
        el.addEventListener('click', (e) => {
            const t = e.target;
            if (t === el || t.classList.contains('nb2-wrap') || t.closest('[data-act=close]')) { closeArmory(); return; }
            const act = t.closest('[data-act]');
            if (act) {
                const a = act.dataset.act;
                if (a === 'apply') rpgApply();
                else if (a === 'nick') { closeArmory(); handleEditNickname(); }
                else if (a === 'shop') rpgSetPanel(rpgPanel === 'shop' ? null : 'shop');
                else if (a === 'toshop') rpgSetPanel('shop');
                else if (a === 'shopclose') rpgSetPanel(null);
                else if (a === 'dungeon') { closeArmory(); rpgOpenPang(() => openArmory()); }
                else if (a === 'buyyes') rpgBuy(rpgAsk);
                else if (a === 'buyno') { rpgAsk = null; rpgShopMsg = '그래, 천천히 생각해 보게.'; renderArmory(); }
                return;
            }
            const tb = t.closest('[data-tab]');
            if (tb) { // 수첩 장비 칸 → 보유 아이템(가진 것만) · 상점/가방 안의 탭 → 탭만 바꿈
                rpgTab = tb.dataset.tab; rpgShopMsg = ''; rpgAsk = null;
                if (tb.classList.contains('nb2-slot')) { if (rpgPanel !== 'inv') { rpgSetPanel('inv'); return; } }
                renderArmory(); return;
            }
            const c = t.closest('[data-rpg]');
            if (c) rpgOnPick(c.dataset.rpg);
        });
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape' || !el.classList.contains('open')) return;
            if (rpgPanel) rpgSetPanel(null); else closeArmory();
        });
        document.body.appendChild(el);
    }
    el.querySelector('.nb2-wrap').classList.remove('shop-on');
    renderArmory();
    el.classList.add('open');
}
function rpgSetPanel(p) {
    rpgPanel = p; rpgShopMsg = ''; rpgAsk = null;
    const w = document.querySelector('#rpgArmory .nb2-wrap');
    renderArmory();
    if (w) w.classList.toggle('shop-on', !!p);
}
function closeArmory() { rpgPend = null; rpgPanel = null; const el = document.getElementById('rpgArmory'); if (el) { el.classList.remove('open'); const w = el.querySelector('.nb2-wrap'); if (w) w.classList.remove('shop-on'); } }
function rpgPendChanged() { if (!rpgPend) return false; const cur = rpgEqAll(); return RPG_SLOTS.some(sl => rpgPend[sl.id] !== cur[sl.id]); }
async function rpgApply() {
    if (!rpgPendChanged()) { closeArmory(); return; }
    const prevI = rpgState.icon, prevE = Object.assign({}, rpgState.eq);
    rpgState.icon = rpgPend.weapon;
    rpgState.eq = { armor: rpgPend.armor || 'ar_base', helm: rpgPend.helm || null, off: rpgPend.off || null, deco: rpgPend.deco || null };
    try { await rpgSave(); applyRolePermissions(); closeArmory(); showSyncStatus('⚔️ 장비 적용 완료'); }
    catch (e) { console.error(e); rpgState.icon = prevI; rpgState.eq = prevE; showSyncStatus('⚠️ 저장 실패 (인터넷 연결을 확인해주세요)', true); }
}
function rpgItemName(key) { if (!key) return ''; if (key === 'master_sword') return RPG_ICONS[key][0]; const it = rpgItem(key); return it ? it.name : key; }

/* 캐릭터 착용 모습 — 1칸(u) = 도트 1개. 인물 틀 96×100칸, 몸(64×96)은 (16,2)에
   19차-7: 무기는 "등에 멤" — 몸 뒤에 비스듬히, 64×96 도트에선 손에 쥔 모양이 안 나와서 (대장님 결정 2026-10-09)
   - 19차-8: 모든 무기 = 날이 아래, 손잡이가 반대쪽 어깨 위로 (현실처럼, 대장님 2026-10-10). 예외만 RPG_BACK_UP
   - 19차-8: 짧은 무기(낫·뼈단검·쿠크리) = 허리춤(보는 사람 왼쪽 골반, 손잡이 벨트에 꽂고 날 늘어뜨림, 몸 앞) — 오른쪽은 왼손(방패) 자리
   - 무기는 SVG를 도트 크기로 그려 반투명 없애고 1칸 외곽선 (캐릭터와 같은 도트 느낌)
   - 왼손(방패 등)은 오른쪽 주먹 가운데, 몸 앞
   - 미니게임(액션)에서 손에 쥐는 건 게임용 옆모습 캐릭터를 따로 만들 예정 */
const RPG_BACK_C = [43, 29], RPG_HAND_O = [66, 58], RPG_OFF_U = 30;
const RPG_BACK_TIP = [12, 70], RPG_BACK_ADD = 16; // 19차-8: 등 무기 날 끝 위치 (보는 사람 왼쪽 골반 옆)
const RPG_BACK_UP = []; // 머리(날)가 위로 가야 어울리는 예외 무기 (없으면 전부 날 아래)
const RPG_HIP = { sickle: 30, bone_knife: 28, kukri: 30 }, RPG_HIP_C = [27, 62], RPG_HIP_ROT = 155; // 허리춤 무기: 키 → 도트 크기
const RPG_BACK_SIZE = { bone_knife: 40, kukri: 42, sickle: 44, wood_sword: 48, rapier: 54, greatsword: 58, master_sword: 58, halberd: 60, war_scythe: 60, guandao: 60, glaive: 58, iron_spear: 58, stone_spear: 56, trident: 58, pitchfork: 56, chakram: 36, sling: 40 }; // 기본 52칸
const rpgPix = {}; // 도트로 바꾼 그림 (키|칸|각도 → dataURL). 1 = 만드는 중
function rpgPixUrl(key, dots, rot) {
    const id = `${key}|${dots}|${rot}`;
    if (rpgPix[id]) return { id, url: rpgPix[id] === 1 ? '' : rpgPix[id] };
    rpgPix[id] = 1;
    const ic = RPG_ICONS[key];
    const body = (ic ? ic[1] : '').replace(/<g class="rb-aura"[\s\S]*?<\/g>/g, ''); // 19차-7: 룬 흑검 빛무리는 수첩 도트에서 뺌
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="256" height="256"><defs>${typeof RPG_DEFS !== 'undefined' ? RPG_DEFS : ''}</defs>${body}</svg>`;
    const img = new Image();
    img.onload = () => {
        const P = 1, W = dots + 2 * P, c = document.createElement('canvas'); c.width = c.height = W;
        const x = c.getContext('2d');
        x.translate(W / 2, W / 2); x.rotate(rot * Math.PI / 180); x.drawImage(img, -dots / 2, -dots / 2, dots, dots); x.setTransform(1, 0, 0, 1, 0, 0);
        let url;
        try {
            const d = x.getImageData(0, 0, W, W), a = d.data, solid = new Uint8Array(W * W);
            for (let i = 0; i < W * W; i++) { if (a[i * 4 + 3] >= 110) { solid[i] = 1; a[i * 4 + 3] = 255; } else a[i * 4 + 3] = 0; }
            for (let y = 0; y < W; y++) for (let xx = 0; xx < W; xx++) {
                const i = y * W + xx; if (solid[i]) continue;
                if ((xx > 0 && solid[i - 1]) || (xx < W - 1 && solid[i + 1]) || (y > 0 && solid[i - W]) || (y < W - 1 && solid[i + W])) { a[i * 4] = 22; a[i * 4 + 1] = 16; a[i * 4 + 2] = 14; a[i * 4 + 3] = 255; }
            }
            x.putImageData(d, 0, 0); url = c.toDataURL();
        } catch (e) { url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); } // 그림판 못 쓰는 브라우저 = 매끈한 그림 그대로
        rpgPix[id] = url;
        document.querySelectorAll(`[data-pix="${id}"]`).forEach(el => { el.style.backgroundImage = `url("${url}")`; });
    };
    img.onerror = () => { delete rpgPix[id]; };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return { id, url: '' };
}
function rpgFigHtml(eq) {
    const sp = (RPG_ARMORS[eq.armor] || RPG_ARMORS.ar_base)[1];
    let wpn = '', off = '';
    const wk = eq.weapon;
    if (wk && RPG_ICONS[wk]) {
        const hip = RPG_HIP[wk], D = hip || (RPG_BACK_SIZE[wk] || 52) + RPG_BACK_ADD, up = RPG_BACK_UP.includes(wk);
        const C = hip ? RPG_HIP_C : up ? RPG_BACK_C : [RPG_BACK_TIP[0] + D / 2, RPG_BACK_TIP[1] - D / 2]; // 날 끝을 왼쪽 골반 옆에 맞춤 → 무기가 길수록 손잡이가 오른쪽 어깨 위로 더 올라옴
        const rot = hip ? RPG_HIP_ROT : up ? -90 : 180; // 아이콘 기본 = 손잡이 왼쪽 아래 → 날 오른쪽 위. 180 = 손잡이 오른쪽 위, 날 왼쪽 아래
        const px = rpgPixUrl(wk, D, rot);
        wpn = `<span class="rpg-lay ${hip ? 'rpg-hip' : 'rpg-wpn'} pix" data-pix="${px.id}" style="left:calc(var(--u)*${(C[0] - D / 2 - 1).toFixed(1)});top:calc(var(--u)*${(C[1] - D / 2 - 1).toFixed(1)});width:calc(var(--u)*${D + 2});height:calc(var(--u)*${D + 2});${px.url ? `background-image:url('${px.url}')` : ''}"></span>`;
    }
    if (eq.off && RPG_ICONS[eq.off]) {
        const D = RPG_OFF_U, px = rpgPixUrl(eq.off, D, 0);
        off = `<span class="rpg-lay rpg-off pix" data-pix="${px.id}" style="left:calc(var(--u)*${RPG_HAND_O[0] - D / 2 - 1});top:calc(var(--u)*${RPG_HAND_O[1] - D / 2 - 1});width:calc(var(--u)*${D + 2});height:calc(var(--u)*${D + 2});${px.url ? `background-image:url('${px.url}')` : ''}"></span>`;
    }
    return `<div class="rpg-fig">${wpn}<span class="rpg-lay rpg-body-sp rpg-spr" style="--sp:${sp}"></span>${off}</div>`;
}

/* 수첩 그림 위 자리 (원본 2048×2048 픽셀 좌표 → %) */
const NB2 = 2048, NB2_SLOT_ORDER = ['helm', 'weapon', 'armor', 'off', 'deco']; // 그림 속 아이콘 순서 (투구·무기·갑옷·방패·반지)
const NB2_ROWS = [255, 439, 623, 807, 991];
const nbPos = (x0, y0, x1, y1, W = NB2, H = NB2) => `left:${(x0 / W * 100).toFixed(2)}%;top:${(y0 / H * 100).toFixed(2)}%;width:${((x1 - x0) / W * 100).toFixed(2)}%;height:${((y1 - y0) / H * 100).toFixed(2)}%`;

const RPG_SHOP_HELLO = ['어서 오시게!<br>쓸만한 장비가 많다네.', '천천히 둘러보게나.<br>입어보는 건 공짜라네.', '오늘은 뭘 찾으러 왔나?<br>좋은 물건 들어왔다네.'];

function renderArmory() {
    const el = document.getElementById('rpgArmory');
    if (!el) return;
    const admin = isAdminUser(), lv = rpgLevel(), pts = rpgPoints(), days = rpgState.days || 0, exp = rpgExp();
    const cur = rpgEqAll(), pend = rpgPend || cur, changed = rpgPendChanged();
    const inLv = exp % RPG_EXP.perLv;
    // ── 수첩 ──
    const slot = (id, i) => {
        const sl = RPG_SLOTS.find(x => x.id === id), k = pend[id], lock = rpgSlotLocked(sl), y0 = NB2_ROWS[i];
        const val = lock ? `<i class="lk">🔒 Lv.${sl.minLv}부터</i>` : k ? escapeHtml(rpgItemName(k)) : `<i>${sl.tiers.length ? sl.none : '준비중'}</i>`;
        // 19차-5: 칸 아이콘 = 지금 고른 물건 그림 (없으면 빈 칸)
        const ic = lock ? '<span class="rpg-none">🔒</span>' : !k ? '' : id === 'armor' ? `<span class="rpg-spr rpg-arm-mini" style="--sp:${RPG_ARMORS[k][1]}"></span>` : (RPG_ICONS[k] ? rpgIconSvg(k) : '');
        return `<button type="button" class="nb2-slot${pend[id] !== cur[id] ? ' chg' : ''}${rpgPanel && rpgTab === id ? ' on' : ''}" data-tab="${id}" style="${nbPos(132, y0 - 8, 970, y0 + 132)}" title="${sl.name} — 눌러서 보유 아이템 보기">
            <span class="nb2-si" style="left:${(12 / 838 * 100).toFixed(2)}%;top:${(9 / 140 * 100).toFixed(2)}%;width:${(124 / 838 * 100).toFixed(2)}%;height:${(124 / 140 * 100).toFixed(2)}%">${ic}</span>
            <span class="nb2-sl" style="left:${((299 - 132) / (970 - 132) * 100).toFixed(2)}%"><b>${sl.name}</b><em>|</em><span>${val}</span></span></button>`;
    };
    const pdone = (() => { const d = rpgPangDaily(); return d.cleared || d.tries <= 0; })();
    el.querySelector('.nb2').innerHTML = `
        <div class="nb2-name" style="${nbPos(130, 34, 1040, 108)}"><b>${escapeHtml(currentUserDisplayName())}</b> · ${admin ? '<span class="ms">마스터</span> · ' : ''}${rpgTitle(lv)} Lv.${lv}</div>
        <div class="nb2-bar" style="${nbPos(148, 118, 1023, 143)}" title="${exp} EXP · 다음 레벨까지 ${RPG_EXP.perLv - inLv} EXP · 출석 ${days}일"><i style="width:${inLv / RPG_EXP.perLv * 100}%"></i><span>경험치 ${inLv}/${RPG_EXP.perLv}</span></div>
        <div class="nb2-pt" style="${nbPos(1300, 36, 1890, 112)}"><b class="${pts < 0 ? 'neg' : ''}">${pts}P</b> 보유 포인트</div>
        <button type="button" class="nb2-hit" data-act="close" aria-label="닫기" style="${nbPos(1902, 40, 1992, 138)}"></button>
        ${NB2_SLOT_ORDER.map(slot).join('')}
        <div class="nb2-stage" style="${nbPos(1097, 231, 1943, 1150)}">${rpgFigHtml(pend)}</div>
        <button type="button" class="nb2-hit btn" data-act="shop" aria-label="상점" style="${nbPos(366, 1742, 688, 1850)}"></button>
        <button type="button" class="nb2-hit btn${pdone ? ' done' : ''}" data-act="dungeon" aria-label="던전탐험" title="${pdone ? '오늘 던전팡팡 끝 · 내일 다시' : '던전팡팡 하러 가기'}" style="${nbPos(1358, 1742, 1680, 1850)}"></button>
        <button type="button" class="nb2-hit btn" data-act="nick" aria-label="닉네임 바꾸기" style="${nbPos(78, 1902, 494, 2004)}"></button>
        <div class="nb2-note" style="${nbPos(520, 1915, 1350, 1990)}">${changed ? '바뀐 장비가 있어요 → [적용]' : `출석 +${RPG_EXP.day} · 던전 +${RPG_EXP.pang} EXP`}</div>
        <button type="button" class="nb2-hit btn" data-act="close" aria-label="닫기" style="${nbPos(1368, 1902, 1656, 2004)}"></button>
        <button type="button" class="nb2-hit btn${changed ? ' glow' : ' off'}" data-act="apply" aria-label="적용" ${changed ? '' : 'disabled'} style="${nbPos(1684, 1902, 1972, 2004)}"></button>`;
    // ── 상점 / 가방 (수첩 왼쪽에서 나옴) — 19차-4: 수첩과 같은 쇠 테두리(nb2_frame) · 나무 칸 테두리(nb2_panel)로 다시 짬 ──
    const shop = el.querySelector('.nb2-shop');
    if (!rpgPanel) { return; } // 닫힐 때 내용은 그대로 두고 미끄러져 들어감
    const inv = rpgPanel === 'inv';
    const sl = RPG_SLOTS.find(x => x.id === rpgTab) || RPG_SLOTS[0];
    const cell = (key, t) => {
        const isNone = key.startsWith('none:');
        const it = isNone ? null : key === 'master_sword' ? { needLv: 0 } : rpgItem(key);
        const needLv = it ? it.needLv : 0, cost = t ? t.cost : 0;
        const val = isNone ? null : key, isCur = cur[sl.id] === val, isSel = pend[sl.id] === val;
        let st, btn, name = isNone ? sl.none : rpgItemName(key);
        if (isNone || rpgOwns(key)) { st = 'own'; btn = isSel ? (isCur ? '장착중' : '선택됨') : '고르기'; }
        else if (lv < needLv) { st = 'lock'; btn = `Lv.${needLv}`; }
        else if (pts >= cost) { st = 'buy'; btn = '구매'; }
        else { st = 'poor'; btn = '구매'; }
        const price = inv ? '' : `<span class="sh-pr">${isNone ? '&nbsp;' : (st === 'own' ? (isCur ? '착용 중' : '보유') : `${cost}P`)}</span>`;
        const pic = isNone ? '<span class="rpg-none">—</span>' : sl.id === 'armor' ? `<span class="rpg-spr rpg-arm" style="--sp:${RPG_ARMORS[key][1]}"></span>` : rpgFxIcon(key);
        return `<button type="button" class="rpg-cell sh-cell ${st}${isSel ? ' sel' : ''}${sl.id === 'armor' ? ' arm' : ''}" data-rpg="${key}" title="${escapeHtml(st === 'lock' ? `Lv.${needLv} ${rpgTitle(needLv)}부터` : name)}">
            <span class="sh-box">${pic}</span><span class="sh-nm">${escapeHtml(name)}</span>${price}<span class="sh-bt">${btn}</span></button>`;
    };
    let list = '';
    if (inv) { // 가방 = 가진 것만 (등급 구분 없이 한 판)
        const keys = [];
        if (sl.none && sl.tiers.length) keys.push('none:' + sl.id);
        if (sl.id === 'weapon' && admin) keys.push('master_sword');
        sl.tiers.forEach(t => t.keys.forEach(k => { if (rpgOwns(k)) keys.push(k); }));
        const tierOf = (k) => (k === 'master_sword' || k.startsWith('none:')) ? null : rpgItem(k).tier;
        list = keys.length ? `<div class="sh-grid">${keys.map(k => cell(k, tierOf(k))).join('')}</div>` : '';
        const owned = keys.filter(k => !k.startsWith('none:')).length;
        if (!sl.tiers.length) list += `<div class="sh-soon">🛠 ${sl.name}은(는) 아직 준비중이에요</div>`;
        else if (!owned) list += `<div class="sh-soon">아직 가진 ${sl.name}이(가) 없어요<br><small>아래 [상점]에서 사 올 수 있어요</small></div>`;
    } else {
        if (sl.id === 'weapon' && admin) list += `<div class="sh-tier"><b style="color:#F2C94C">마스터 전용</b><span>공짜</span></div><div class="sh-grid">${cell('master_sword', { cost: 0 })}</div>`;
        sl.tiers.forEach(t => {
            const nLv = Math.max(t.needLv, sl.minLv || 0), locked = lv < nLv;
            list += `<div class="sh-tier"><b style="color:${t.color}">${t.name}</b><span>${t.cost}P · ${locked ? `<em>🔒 Lv.${nLv} ${rpgTitle(nLv)}부터</em>` : `Lv.${nLv} ✓`}</span></div><div class="sh-grid">${t.keys.map(k => cell(k, t)).join('')}</div>`;
        });
        if (!sl.tiers.length) list += `<div class="sh-soon">🛠 ${sl.name} 그림 준비중이라네<br><small>${sl.id === 'helm' ? '투구 · 후드 · 두건 — 일반모험가(Lv.5)부터' : '헤어 · 선글라스 같은 꾸미기 물건'}</small></div>`;
        if (sl.id === 'off') list += `<div class="sh-soon sm">🏮 초롱불 · 📖 지도책도 곧 들여올 거라네</div>`;
    }
    const msg = rpgShopMsg || RPG_SHOP_HELLO[(new Date().getDate()) % RPG_SHOP_HELLO.length];
    const sc = shop.querySelector('.sh-list'), keep = sc && sc.dataset.lt === rpgPanel + rpgTab ? sc.scrollTop : 0;
    shop.className = 'nb2-shop' + (inv ? ' inv' : '');
    shop.innerHTML = `
        <div class="sh-head"><b class="sh-title">${inv ? '보유 아이템' : '상점'}</b><div class="sh-pt"><b class="${pts < 0 ? 'neg' : ''}">${pts}P</b><span>보유 포인트</span></div>
            <button type="button" class="sh-x" data-act="shopclose" aria-label="닫기"></button></div>
        <div class="sh-tabs" role="tablist">${NB2_SLOT_ORDER.map(id => RPG_SLOTS.find(s => s.id === id)).map(x => `<button type="button" role="tab" class="sh-tab${x.id === rpgTab ? ' on' : ''}" data-tab="${x.id}" aria-selected="${x.id === rpgTab}"><i class="ti ti-${x.id}"></i>${x.name}${rpgSlotLocked(x) ? '<em>🔒</em>' : ''}</button>`).join('')}</div>
        <div class="sh-pnl sh-listp"><div class="sh-list" data-lt="${rpgPanel + rpgTab}">${list}</div></div>
        ${inv ? '' : `<div class="sh-pnl sh-scene"><div class="sh-say${rpgAsk ? ' ask' : ''}"><span>${msg}</span>${rpgAsk ? '<span class="sh-ask"><button type="button" data-act="buyyes">산다</button><button type="button" data-act="buyno" class="no">그만두지</button></span>' : ''}</div></div>`}
        <div class="sh-foot">${inv ? '<button type="button" class="sh-img sh-toshop" data-act="toshop" aria-label="상점 가기"></button>' : ''}<button type="button" class="sh-img sh-close" data-act="shopclose" aria-label="닫기"></button></div>`;
    const sc2 = shop.querySelector('.sh-list'); if (sc2) sc2.scrollTop = keep;
}

async function rpgOnPick(key) {
    if (isGuestUser() || !rpgPend) return;
    rpgAsk = null;
    const say = (m) => { rpgShopMsg = m; renderArmory(); };
    if (key.startsWith('none:')) { rpgPend[key.slice(5)] = null; say('맨몸이 편할 때도 있지.<br>[적용]을 눌러야 바뀐다네.'); return; }
    if (key === 'master_sword') { if (isAdminUser()) { rpgPend.weapon = key; say('오오… 그 검은…!<br>마스터의 룬 흑검이로군.'); } return; }
    const it = rpgItem(key);
    if (!it) return;
    const slot = it.slot.id, lv = rpgLevel();
    if (rpgOwns(key)) { rpgPend[slot] = key; say(`${it.name}, 잘 어울리는군!<br>수첩의 [적용]을 누르면 장착이라네.`); return; } // 선택만 (적용 눌러야 장착)
    if (lv < it.needLv) { say(`그건 아직 이르다네.<br>Lv.${it.needLv} ${rpgTitle(it.needLv)}가 되면 오게.`); return; }
    const pts = rpgPoints(), cost = it.tier.cost;
    if (pts < cost) { say(`${cost}P가 필요하다네.<br>지금은 ${pts}P뿐이로군…`); return; }
    rpgAsk = key; say(`${it.name}, ${cost}P라네.<br>사겠나? (남는 건 ${pts - cost}P)`); // 19차-5: 확인창 대신 대장장이가 물어봄
}
async function rpgBuy(key) {
    const it = key && rpgItem(key);
    rpgAsk = null;
    if (!it || rpgOwns(key)) { renderArmory(); return; }
    const pts = rpgPoints(), cost = it.tier.cost, slot = it.slot.id;
    if (rpgLevel() < it.needLv || pts < cost) { rpgShopMsg = '음… 지금은 안 되겠군.'; renderArmory(); return; }
    const prevO = rpgState.owned.slice();
    rpgState.owned.push(key); // 사는 건 바로 저장 (포인트를 쓴 거라 창을 닫아도 유지)
    try { await rpgSave(); rpgPend[slot] = key; rpgShopMsg = `좋은 거래였네! ${it.name}!<br>수첩의 [적용]을 누르면 장착이라네.`; renderArmory(); showSyncStatus(`✨ ${it.name} 획득!`); }
    catch (e) { console.error(e); rpgState.owned = prevO; rpgShopMsg = '어라, 장부에 안 적혔네…<br>인터넷을 확인해 보게.'; renderArmory(); showSyncStatus('⚠️ 저장 실패 (인터넷 연결을 확인해주세요)', true); }
}
