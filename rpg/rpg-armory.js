/* ═══════════════════════════════════════════════════════════════
   RheaOps · 모험가(RPG) 모듈 — 무기고 팝업 UI (= 모험가 수첩)
   17차-5 (2026-10-07): dashboard.html에서 완전히 분리. 업무 기능(dashboard)과 놀이 기능(rpg/)을 나눔.
   - 로드 순서: rpg-data.js → rpg-core.js → rpg-armory.js → (dashboard 본 스크립트)
   - dashboard는 window.RheaRPG 하나로만 이 모듈을 부름. 이 폴더가 없어도 업체관리는 정상 동작
   - 나중에 캐릭터 꾸미기·미니게임은 rpg/ 안에 새 파일로 추가 (예: rpg-avatar.js, rpg-game-xxx.js)
   - 18차: 수첩 아래쪽 [⚔ 던전팡팡] 버튼 → rpgOpenPang (게임 닫으면 수첩 다시 열림, 포인트 바로 반영)
   - 19차: 첫 화면 = 캐릭터 꾸미기 창 (착용 모습 + 장비 칸) + 아래 탭 (무기·투구·갑옷·왼손·꾸미기)
           고르면 미리보기만 바뀜 → [적용]을 눌러야 한꺼번에 장착. 사는 건 확인창에서 바로 저장
   ═══════════════════════════════════════════════════════════════ */
// 17차-7: 고르면 "선택"만 됨 → [적용]을 눌러야 장착. [닫기]/✕/바깥/Esc는 적용 안 하고 닫기
// 19차: 선택을 칸별로 (rpgPend = { weapon, helm, armor, off, deco }) · 탭 기억 (rpgTab)
let rpgPend = null, rpgTab = 'weapon';
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
    rpgPend = rpgEqAll(); rpgView = 'main';
    rpgInjectDefs();
    if (!document.getElementById('rpgPangBtnCss')) { // 18차: 던전팡팡 버튼 모양 (rpg.css는 안 건드림)
        const st = document.createElement('style'); st.id = 'rpgPangBtnCss';
        st.textContent = `.rpg-pang{display:flex;flex-direction:column;align-items:flex-start;gap:2px;flex-shrink:0;padding:6px 14px;border-radius:10px;cursor:pointer;font-family:inherit;text-align:left;
            border:1px solid #C9A24A;background:linear-gradient(180deg,#5A1E14,#2A0C08);color:#F3E7C8;box-shadow:0 0 0 1px rgba(0,0,0,.5),0 0 12px rgba(255,90,40,.25);transition:filter .15s,transform .1s}
            .rpg-pang b{font-size:13px;letter-spacing:.04em;color:#FFD98A}.rpg-pang small{font-size:10.5px;color:#D8B898}
            .rpg-pang:hover{filter:brightness(1.15)}.rpg-pang:active{transform:translateY(1px)}
            .rpg-pang.done{background:linear-gradient(180deg,#2A2420,#14100E);border-color:rgba(201,162,74,.4);box-shadow:none}.rpg-pang.done b{color:#C9B48A}
            @media(max-width:880px){.rpg-pang{width:100%;align-items:center;text-align:center}}`;
        document.head.appendChild(st);
    }
    let el = document.getElementById('rpgArmory');
    if (!el) {
        el = document.createElement('div');
        el.id = 'rpgArmory';
        el.className = 'rpg-dim';
        el.addEventListener('click', (e) => {
            if (e.target === el || e.target.closest('.rpg-x') || e.target.closest('.rpg-btn.no')) { closeArmory(); return; }
            if (e.target.closest('.rpg-btn.ok')) { rpgApply(); return; }
            if (e.target.closest('.rpg-pang')) { closeArmory(); rpgOpenPang(() => openArmory()); return; }
            const vw = e.target.closest('[data-view]');
            if (vw) { rpgView = vw.dataset.view; renderArmory(); return; }
            const tb = e.target.closest('[data-tab]');
            if (tb) { rpgTab = tb.dataset.tab; rpgView = 'shop'; renderArmory(); return; }
            const c = e.target.closest('[data-rpg]');
            if (c) rpgOnPick(c.dataset.rpg);
        });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && el.classList.contains('open')) closeArmory(); });
        document.body.appendChild(el);
    }
    renderArmory();
    el.classList.add('open');
}
function closeArmory() { rpgPend = null; const el = document.getElementById('rpgArmory'); if (el) el.classList.remove('open'); }
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

/* 19차: 캐릭터 착용 모습 — 1칸(u) = 도트 1개. 인물 틀 96×100칸, 몸(64×96)은 (16,2)에
   무기 = 보는 사람 왼쪽 주먹(29,58)에 손잡이, 좌우 뒤집어 바깥쪽으로 · 몸 뒤에 그려서 주먹이 손잡이를 덮음
   왼손 = 보는 사람 오른쪽 주먹(66,58) 가운데, 몸 앞 */
const RPG_HAND_W = [29, 58], RPG_HAND_O = [66, 58], RPG_WPN_U = 40, RPG_OFF_U = 30;
function rpgFigHtml(eq) {
    const wk = eq.weapon, geo = (typeof RPG_GEO !== 'undefined' && RPG_GEO[wk]) || { pivot: [15.4, 49.9] }, s = RPG_WPN_U / 64;
    const wl = RPG_HAND_W[0] - (64 - geo.pivot[0]) * s, wt = RPG_HAND_W[1] - geo.pivot[1] * s;
    const wpn = wk && RPG_ICONS[wk] ? `<span class="rpg-lay rpg-wpn" style="left:calc(var(--u)*${wl.toFixed(1)});top:calc(var(--u)*${wt.toFixed(1)})">${rpgIconSvg(wk)}</span>` : '';
    const off = eq.off && RPG_ICONS[eq.off] ? `<span class="rpg-lay rpg-off" style="left:calc(var(--u)*${RPG_HAND_O[0] - RPG_OFF_U / 2});top:calc(var(--u)*${RPG_HAND_O[1] - RPG_OFF_U / 2})">${rpgIconSvg(eq.off)}</span>` : '';
    const sp = (RPG_ARMORS[eq.armor] || RPG_ARMORS.ar_base)[1];
    return `<div class="rpg-fig">${wpn}<span class="rpg-lay rpg-body-sp rpg-spr" style="--sp:${sp}"></span>${off}</div>`;
}
function rpgSlotIcon(slot, key) {
    if (!key) return '<span class="rpg-none">—</span>';
    if (slot === 'armor') return `<span class="rpg-spr rpg-arm-mini" style="--sp:${RPG_ARMORS[key][1]}"></span>`;
    return RPG_ICONS[key] ? rpgIconSvg(key) : '';
}

/* 19차-2: 제미나이 시안(다크판타지 돌 프레임) 반영
   - 첫 화면(main): 왼쪽 장비 칸 5개 · 오른쪽 던전 배경 위 캐릭터 · 아래 [상점] 건물 + [미니게임] 불꽃 해골 판
   - 상점(shop): 탭(무기·투구·갑옷·왼손·꾸미기) + 아이템 칸. 왼쪽에 작은 착용 미리보기 · [← 캐릭터]로 돌아감
   - 장비 칸을 누르면 그 탭으로 상점이 열림. 그림: img/nb_*.webp (수첩 열 때만 불러옴) */
let rpgView = 'main';
function renderArmory() {
    const el = document.getElementById('rpgArmory');
    if (!el) return;
    const admin = isAdminUser(), lv = rpgLevel(), pts = rpgPoints(), days = rpgState.days || 0, exp = rpgExp();
    const cur = rpgEqAll(), pend = rpgPend || cur, changed = rpgPendChanged();
    const need = RPG_EXP.perLv - (exp % RPG_EXP.perLv);
    const curSlot = RPG_SLOTS.find(x => x.id === rpgTab) || RPG_SLOTS[0];
    // 아이템 칸 하나
    const cell = (key, t, sl) => {
        const isNone = key.startsWith('none:');
        const it = isNone ? null : key === 'master_sword' ? { needLv: 0, tier: t } : rpgItem(key);
        const needLv = it ? it.needLv : 0, cost = t ? t.cost : 0;
        const val = isNone ? null : key, isCur = cur[sl.id] === val, isSel = pend[sl.id] === val && !isCur;
        let st, lab, name = isNone ? sl.none : rpgItemName(key);
        if (isNone || rpgOwns(key)) { st = 'own'; lab = isSel ? '선택' : (isCur ? '장착중' : (isNone ? '' : '보유')); }
        else if (lv < needLv) { st = 'lock'; lab = ''; name = '???'; }
        else if (pts >= cost) { st = 'buy'; lab = `${cost}P`; }
        else { st = 'poor'; lab = `${cost}P`; }
        const tip = st === 'lock' ? `Lv.${needLv} ${rpgTitle(needLv)}부터` : st === 'buy' ? `${cost}P로 열기` : st === 'poor' ? `${cost}P 필요` : (isCur ? '장착중' : '눌러서 선택 → 적용');
        const pic = isNone ? '<span class="rpg-none">—</span>' : sl.id === 'armor' ? `<span class="rpg-spr rpg-arm" style="--sp:${RPG_ARMORS[key][1]}"></span>` : rpgFxIcon(key);
        return `<button type="button" class="rpg-cell ${st}${isCur ? ' cur' : ''}${isSel ? ' sel' : ''}${sl.id === 'armor' ? ' arm' : ''}" data-rpg="${key}" title="${escapeHtml(name + ' · ' + tip)}">
            <span class="rpg-cb">${pic}${isCur ? '<i>✓</i>' : ''}</span><span class="rpg-nm">${escapeHtml(name)}</span><span class="rpg-lb">${lab}</span></button>`;
    };
    // 장비 칸 — 누르면 그 탭으로 상점
    const slotBtn = (sl) => {
        const k = pend[sl.id], lock = rpgSlotLocked(sl);
        return `<button type="button" class="nb-slot${rpgView === 'shop' && rpgTab === sl.id ? ' on' : ''}${pend[sl.id] !== cur[sl.id] ? ' chg' : ''}" data-tab="${sl.id}">
            <span class="nb-sb">${lock ? '<span class="rpg-none">🔒</span>' : rpgSlotIcon(sl.id, k)}</span>
            <span class="nb-st"><small>${sl.name}</small><b>${lock ? `Lv.${sl.minLv}부터` : (k ? escapeHtml(rpgItemName(k)) : (sl.tiers.length ? sl.none : '준비중'))}</b></span></button>`;
    };
    const slots = `<div class="nb-slots">${RPG_SLOTS.map(slotBtn).join('')}</div>`;
    const pd = rpgPangDaily(), pdone = pd.cleared || pd.tries <= 0;
    let body;
    if (rpgView === 'shop') {
        const tabs = `<div class="rpg-tabs" role="tablist">${RPG_SLOTS.map(sl => `<button type="button" role="tab" class="rpg-tab${sl.id === rpgTab ? ' on' : ''}" data-tab="${sl.id}" aria-selected="${sl.id === rpgTab}">${sl.name}${rpgSlotLocked(sl) ? ' 🔒' : ''}</button>`).join('')}</div>`;
        let list = '';
        const sl = curSlot;
        if (sl.id === 'weapon' && admin) list += `<div class="rpg-sec"><div class="rpg-sh"><span class="rpg-gt" style="color:#F2C94C;border-color:#F2C94C">마스터</span><span class="rpg-gs">마스터 전용 · 공짜</span></div><div class="rpg-grid">${cell('master_sword', { cost: 0, needLv: 0 }, sl)}</div></div>`;
        if (sl.none && sl.tiers.length) list += `<div class="rpg-sec"><div class="rpg-grid">${cell('none:' + sl.id, null, sl)}</div></div>`;
        list += sl.tiers.map(t => {
            const nLv = Math.max(t.needLv, sl.minLv || 0), locked = lv < nLv;
            return `<div class="rpg-sec"><div class="rpg-sh"><span class="rpg-gt" style="color:${t.color};border-color:${t.color}">${t.name}</span>
                <span class="rpg-gs">${t.cost}P · ${locked ? `<b class="rpg-lk">🔒 Lv.${nLv} ${rpgTitle(nLv)}부터</b>` : `Lv.${nLv} ${rpgTitle(nLv)} ✓`}</span></div>
                <div class="rpg-grid${sl.id === 'armor' ? ' g-arm' : ''}">${t.keys.map(k => cell(k, t, sl)).join('')}</div></div>`;
        }).join('');
        if (!sl.tiers.length) list += `<div class="rpg-soon">🛠 ${sl.name} 그림 준비중이에요${sl.id === 'helm' ? '<br><small>투구 · 후드 · 두건 — 일반모험가(Lv.5)부터</small>' : '<br><small>헤어 · 선글라스 같은 꾸미기 아이템</small>'}</div>`;
        if (sl.id === 'off') list += `<div class="rpg-soon sm">🏮 초롱불 · 📖 지도책 같은 왼손 아이템도 곧 들어와요</div>`;
        body = `<div class="nb-shopv"><div class="nb-side"><button type="button" class="nb-back" data-view="main">← 캐릭터</button><div class="nb-stage sm">${rpgFigHtml(pend)}</div></div>
            <div class="nb-shopl"><div class="nb-shoph">⚒ 대장간 상점</div>${tabs}<div class="rpg-list">${list}</div></div></div>`;
    } else {
        body = `<div class="nb-main">${slots}<div class="nb-stage">${rpgFigHtml(pend)}</div></div>
            <div class="nb-row2"><button type="button" class="nb-shop" data-view="shop" aria-label="상점 열기"><span class="nb-shopt">아이템 사기 · 고르기</span></button>
            <div class="nb-mg"><i class="nb-fire"></i><div class="nb-mgp"><b class="nb-mgt">미니게임</b>
                <button type="button" class="nb-game rpg-pang${pdone ? ' done' : ''}"><span class="nb-gi">⚔</span><span><b>던전팡팡</b><small>${pd.cleared ? '오늘 정복 완료 ✓' : pd.tries > 0 ? `오늘 남은 도전 ${pd.tries}/${RPG_PANG.tries} · 성공 +${RPG_PANG.reward}P +${RPG_EXP.pang}EXP` : '오늘 도전 끝 · 내일 다시'}</small></span></button>
                <small class="nb-mgs">새 미니게임 준비중</small></div></div></div>`;
    }
    const sc = el.querySelector('.rpg-body'), keep = sc && el.dataset.nbv === rpgView ? sc.scrollTop : 0;
    el.dataset.nbv = rpgView;
    el.innerHTML = `<div class="rpg-modal nb" role="dialog" aria-modal="true" aria-label="모험가 수첩"><i class="nb-skull"></i>
        <div class="rpg-top nb-top"><div class="rpg-av" style="--tc:${rpgTierColor(pend.weapon)}">${rpgFxIcon(pend.weapon)}</div>
            <div class="rpg-who"><b>${escapeHtml(currentUserDisplayName())}</b> <span class="rpg-role">· ${admin ? ROLE_LABELS.admin + ' · ' : ''}${rpgTitle(lv)} Lv.${lv}</span>
                <div class="rpg-sub">${exp} EXP · 다음 레벨까지 ${need} EXP · 출석 ${days}일</div><div class="rpg-bar"><i style="width:${((exp % RPG_EXP.perLv) / RPG_EXP.perLv) * 100}%"></i></div></div>
            <div class="nb-pt"><b>${pts}P</b><small>보유 포인트</small></div><button type="button" class="rpg-x nb-x" aria-label="닫기">✕</button></div>
        <div class="rpg-body">${body}</div>
        <div class="rpg-foot"><button type="button" class="rpg-nick" onclick="closeArmory(); handleEditNickname();">닉네임 바꾸기</button>
            <span class="nb-note">${changed ? '바뀐 장비가 있어요 — [적용]을 눌러야 장착돼요' : `출석 +${RPG_EXP.day}EXP · ${RPG_EXP.perLv}EXP마다 Lv+1 (+${RPG_PTS_PER_LV}P)`}</span>
            <div class="rpg-btns"><button type="button" class="rpg-btn no">닫기</button><button type="button" class="rpg-btn ok"${changed ? '' : ' disabled'}>적용</button></div></div></div>`;
    const sc2 = el.querySelector('.rpg-body'); if (sc2) sc2.scrollTop = keep;
}

async function rpgOnPick(key) {
    if (isGuestUser() || !rpgPend) return;
    if (key.startsWith('none:')) { rpgPend[key.slice(5)] = null; renderArmory(); return; }
    if (key === 'master_sword') { if (isAdminUser()) { rpgPend.weapon = key; renderArmory(); } return; }
    const it = rpgItem(key);
    if (!it) return;
    const slot = it.slot.id, lv = rpgLevel();
    if (rpgOwns(key)) { rpgPend[slot] = key; renderArmory(); return; } // 선택만 (적용 눌러야 장착)
    if (lv < it.needLv) { showSyncStatus(`🔒 Lv.${it.needLv} ${rpgTitle(it.needLv)}부터 열 수 있어요`, true); return; }
    const pts = rpgPoints(), cost = it.tier.cost;
    if (pts < cost) { showSyncStatus(`💰 ${cost}P 필요 (지금 ${pts}P)`, true); return; }
    if (!confirm(`${cost}P로 '${it.name}'을(를) 열까요? (남는 포인트 ${pts - cost}P)\n열고 나서 [적용]을 누르면 장착돼요.`)) return;
    const prevO = rpgState.owned.slice();
    rpgState.owned.push(key); // 구매는 확인창에서 바로 저장 (포인트를 쓴 거라 창을 닫아도 유지)
    try { await rpgSave(); rpgPend[slot] = key; renderArmory(); showSyncStatus(`✨ ${it.name} 획득! [적용]을 누르면 장착`); }
    catch (e) { console.error(e); rpgState.owned = prevO; showSyncStatus('⚠️ 저장 실패 (인터넷 연결을 확인해주세요)', true); }
}
