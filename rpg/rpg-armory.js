/* ═══════════════════════════════════════════════════════════════
   RheaOps · 모험가(RPG) 모듈 — 무기고 팝업 UI
   17차-5 (2026-10-07): dashboard.html에서 완전히 분리. 업무 기능(dashboard)과 놀이 기능(rpg/)을 나눔.
   - 로드 순서: rpg-data.js → rpg-core.js → rpg-armory.js → (dashboard 본 스크립트)
   - dashboard는 window.RheaRPG 하나로만 이 모듈을 부름. 이 폴더가 없어도 업체관리는 정상 동작
   - 나중에 캐릭터 꾸미기·미니게임은 rpg/ 안에 새 파일로 추가 (예: rpg-avatar.js, rpg-game-xxx.js)
   ═══════════════════════════════════════════════════════════════ */
// 17차-7: 무기를 누르면 "선택"만 됨 → [적용]을 눌러야 장착. [닫기]/✕/바깥/Esc는 적용 안 하고 닫기
let rpgPending = null;
function openArmory() {
    if (isGuestUser() || !currentUserEmail) return;
    rpgPending = rpgCurrentIcon();
    rpgInjectDefs();
    let el = document.getElementById('rpgArmory');
    if (!el) {
        el = document.createElement('div');
        el.id = 'rpgArmory';
        el.className = 'rpg-dim';
        el.addEventListener('click', (e) => {
            if (e.target === el || e.target.closest('.rpg-x') || e.target.closest('.rpg-btn.no')) { closeArmory(); return; }
            if (e.target.closest('.rpg-btn.ok')) { rpgApply(); return; }
            const c = e.target.closest('[data-rpg]');
            if (c) rpgOnPick(c.dataset.rpg);
        });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && el.classList.contains('open')) closeArmory(); });
        document.body.appendChild(el);
    }
    renderArmory();
    el.classList.add('open');
}
function closeArmory() { rpgPending = null; const el = document.getElementById('rpgArmory'); if (el) el.classList.remove('open'); }
async function rpgApply() {
    const key = rpgPending;
    if (!key || key === rpgCurrentIcon()) { closeArmory(); return; }
    const prev = rpgState.icon;
    rpgState.icon = key;
    try { await rpgSave(); applyRolePermissions(); closeArmory(); showSyncStatus(`⚔️ ${RPG_ICONS[key][0]} 장착 완료`); }
    catch (e) { console.error(e); rpgState.icon = prev; showSyncStatus('⚠️ 저장 실패 (인터넷 연결을 확인해주세요)', true); }
}

function renderArmory() {
    const el = document.getElementById('rpgArmory');
    if (!el) return;
    const admin = isAdminUser(), lv = rpgLevel(), pts = rpgPoints(), days = rpgState.days || 0, cur = rpgCurrentIcon(), sel = rpgPending || cur;
    const left = RPG_DAYS_PER_LV - (days % RPG_DAYS_PER_LV);
    const cell = (key, t) => {
        const ic = RPG_ICONS[key];
        let st, lab, name = ic[0];
        if (rpgOwns(key) || (key === 'master_sword' && admin)) { st = 'own'; lab = key === sel && sel !== cur ? '선택' : (key === cur ? '장착중' : '보유'); }
        else if (lv < t.needLv) { st = 'lock'; lab = ''; name = '???'; }
        else if (pts >= t.cost) { st = 'buy'; lab = `${t.cost}P`; }
        else { st = 'poor'; lab = `${t.cost}P`; }
        const tip = st === 'lock' ? `Lv.${t.needLv} ${rpgTitle(t.needLv)}부터` : st === 'buy' ? `${t.cost}P로 열기` : st === 'poor' ? `${t.cost}P 필요` : (key === cur ? '장착중' : '눌러서 선택 → 적용');
        return `<button type="button" class="rpg-cell ${st}${key === cur ? ' cur' : ''}${key === sel && sel !== cur ? ' sel' : ''}" data-rpg="${key}" title="${escapeHtml(name + ' · ' + tip)}">
            <span class="rpg-cb">${rpgFxIcon(key)}${key === cur ? '<i>✓</i>' : ''}</span><span class="rpg-nm">${escapeHtml(name)}</span><span class="rpg-lb">${lab}</span></button>`;
    };
    const masterRow = admin ? `<div class="rpg-sec"><div class="rpg-sh"><span class="rpg-gt" style="color:#F2C94C;border-color:#F2C94C">마스터</span><span class="rpg-gs">마스터 전용</span></div><div class="rpg-grid">${cell('master_sword', { cost: 0, needLv: 0 })}</div></div>` : '';
    const secs = RPG_TIERS.map(t => {
        const locked = !admin && lv < t.needLv;
        return `<div class="rpg-sec"><div class="rpg-sh"><span class="rpg-gt" style="color:${t.color};border-color:${t.color}">${t.name}</span>
            <span class="rpg-gs">${admin ? '' : t.cost + 'P · '}${locked ? `<b class="rpg-lk">🔒 Lv.${t.needLv} ${rpgTitle(t.needLv)}부터</b>` : (admin ? '전부 사용 가능' : `Lv.${t.needLv} ${rpgTitle(t.needLv)} ✓`)}</span></div>
            <div class="rpg-grid">${t.keys.map(k => cell(k, t)).join('')}</div></div>`;
    }).join('');
    const who = admin ? `<span class="rpg-role" style="color:#F2C94C">· ${ROLE_LABELS.admin}</span><div class="rpg-sub">모든 무기를 공짜로 쓸 수 있어요 👑 (출석 ${days}일)</div>${sel !== cur ? `<div class="rpg-sel-note">선택: ${escapeHtml(RPG_ICONS[sel][0])} — [적용]을 눌러야 장착돼요</div>` : ''}`
        : `<span class="rpg-role">· ${rpgTitle(lv)} Lv.${lv}</span><div class="rpg-sub">출석 ${days}일 · 다음 레벨까지 ${left}일</div>${sel !== cur ? `<div class="rpg-sel-note">선택: ${escapeHtml(RPG_ICONS[sel][0])} — [적용]을 눌러야 장착돼요</div>` : ''}<div class="rpg-bar"><i style="width:${((days % RPG_DAYS_PER_LV) / RPG_DAYS_PER_LV) * 100}%"></i></div>`;
    el.innerHTML = `<div class="rpg-modal" role="dialog" aria-modal="true" aria-label="무기고">
        <div class="rpg-top"><div class="rpg-av" style="--tc:${rpgTierColor(sel)}">${rpgFxIcon(sel)}</div>
            <div class="rpg-who"><b>${escapeHtml(currentUserDisplayName())}</b> ${who}</div>
            ${admin ? '' : `<div class="rpg-pt"><b>${pts}P</b><div>보유 포인트</div></div>`}<button type="button" class="rpg-x" aria-label="닫기">✕</button></div>
        <div class="rpg-body">${masterRow}${secs}</div>
        <div class="rpg-foot"><button type="button" class="rpg-nick" onclick="closeArmory(); handleEditNickname();">닉네임 바꾸기</button>
            <span>무기를 골라 [적용] · 그림자 무기는 포인트로 열기 · ${RPG_DAYS_PER_LV}출석마다 Lv+1, +${RPG_PTS_PER_LV}P</span>
            <div class="rpg-btns"><button type="button" class="rpg-btn no">닫기</button><button type="button" class="rpg-btn ok"${sel === cur ? ' disabled' : ''}>적용</button></div></div></div>`;
}

async function rpgOnPick(key) {
    if (isGuestUser() || !RPG_ICONS[key]) return;
    const t = rpgTierOf(key), lv = rpgLevel();
    if (rpgOwns(key) || (key === 'master_sword' && isAdminUser())) { rpgPending = key; renderArmory(); return; } // 선택만 (적용 눌러야 장착)
    if (!t) return;
    if (lv < t.needLv) { showSyncStatus(`🔒 Lv.${t.needLv} ${rpgTitle(t.needLv)}부터 열 수 있어요`, true); return; }
    const pts = rpgPoints();
    if (pts < t.cost) { showSyncStatus(`💰 ${t.cost}P 필요 (지금 ${pts}P)`, true); return; }
    if (!confirm(`${t.cost}P로 '${RPG_ICONS[key][0]}'을(를) 열까요? (남는 포인트 ${pts - t.cost}P)\n열고 나서 [적용]을 누르면 장착돼요.`)) return;
    const prevO = rpgState.owned.slice();
    rpgState.owned.push(key); // 구매는 확인창에서 바로 저장 (포인트를 쓴 거라 창을 닫아도 유지)
    try { await rpgSave(); rpgPending = key; renderArmory(); showSyncStatus(`✨ ${RPG_ICONS[key][0]} 획득! [적용]을 누르면 장착`); }
    catch (e) { console.error(e); rpgState.owned = prevO; showSyncStatus('⚠️ 저장 실패 (인터넷 연결을 확인해주세요)', true); }
}
