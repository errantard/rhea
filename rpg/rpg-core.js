/* ═══════════════════════════════════════════════════════════════
   RheaOps · 모험가(RPG) 모듈 — 코어 (출석 · 레벨 · 포인트 · 저장 · 아이콘)
   17차-5 (2026-10-07): dashboard.html에서 완전히 분리. 업무 기능(dashboard)과 놀이 기능(rpg/)을 나눔.
   - 로드 순서: rpg-data.js → rpg-core.js → rpg-armory.js → (dashboard 본 스크립트)
   - dashboard는 window.RheaRPG 하나로만 이 모듈을 부름. 이 폴더가 없어도 업체관리는 정상 동작
   - 나중에 캐릭터 꾸미기·미니게임은 rpg/ 안에 새 파일로 추가 (예: rpg-avatar.js, rpg-game-xxx.js)
   ═══════════════════════════════════════════════════════════════ */
/* 17차-4: 모험가 무기고 (출석 · 레벨 · 칭호 · 포인트 · 아이콘) =====================
   - 하루 첫 접속(한국 시간 자정 기준) = 출석 1일. 5출석마다 Lv+1, 레벨업 보상 +5P
   - 레벨 = 무기를 "살 자격"(등급별 needLv), 포인트 = "돈"(등급별 cost). 몽둥이는 기본 지급
   - 남은 포인트는 저장 안 하고 (Lv × 5 − 산 무기 값 합)으로 계산 → 숫자가 꼬일 일 없음
   - 저장 위치: 각자 계정 user_metadata.rpg = { days, last, owned[], icon } (닉네임과 같은 곳, 새 테이블 없음)
   - 마스터(관리자)는 모든 아이콘 무료 + 왕관, 게스트는 목동 지팡이 고정(무기고 안 열림)
   - 등급 추가(정예·전설): RPG_ICONS에 그림 넣고 RPG_TIERS에 한 줄 추가하면 무기고에 줄이 자동으로 생김 */
const RPG_DAYS_PER_LV = 5, RPG_PTS_PER_LV = 5, RPG_DEFAULT_ICON = 'club';
let rpgState = { days: 0, last: null, owned: [], icon: null, bonus: 0 };

function rpgInjectDefs() {
    if (document.getElementById('rpgDefs')) return;
    const box = document.createElement('div');
    box.innerHTML = `<svg id="rpgDefs" width="0" height="0" style="position:absolute;width:0;height:0" aria-hidden="true"><defs>${RPG_DEFS}</defs></svg>`;
    document.body.appendChild(box.firstChild);
}
function rpgIconSvg(key, cls) {
    const ic = RPG_ICONS[key] || RPG_ICONS[RPG_DEFAULT_ICON];
    return `<svg class="${cls || 'rpg-ic'}" viewBox="0 0 64 64" aria-hidden="true">${ic[1]}</svg>`;
}
// 17차-6: 무기별 효과를 줄 수 있게 아이콘을 <span class="w fx-종류">로 감쌈 (마우스 올리면 rpg.css 애니메이션)
function rpgFxIcon(key, cls) {
    const fx = (typeof RPG_FX !== 'undefined' && RPG_FX[key]) || 'swing';
    return `<span class="w fx-${fx}">${rpgIconSvg(key, cls)}</span>`;
}
// 메달 테두리 색 = 등급 색 (왕관 금, 지팡이 나무색)
function rpgTierColor(key) {
    if (key === 'crown') return '#F2C94C';
    if (key === 'crook') return '#C08A55';
    const t = rpgTierOf(key); return t ? t.color : '#F2C94C';
}
// 이름표 메달 (A안 + 롤오버: 테두리 빛 + 무기 효과)
function rpgBadgeIcon() {
    const k = rpgCurrentIcon();
    return `<span class="up-ic" style="--tc:${rpgTierColor(k)}">${rpgFxIcon(k)}</span>`;
}
function rpgLevel() { return Math.floor((rpgState.days || 0) / RPG_DAYS_PER_LV); }
function rpgTitle(lv) { let t = RPG_TITLES[0].name; RPG_TITLES.forEach(x => { if (lv >= x.lv) t = x.name; }); return t; }
function rpgTierOf(key) { return RPG_TIERS.find(t => t.keys.includes(key)); }
function rpgSpent() {
    return (rpgState.owned || []).reduce((s, k) => { const t = rpgTierOf(k); return s + (t && k !== RPG_DEFAULT_ICON ? t.cost : 0); }, 0);
}
function rpgPoints() { return rpgLevel() * RPG_PTS_PER_LV + (rpgState.bonus || 0) - rpgSpent(); } // bonus = 나중에 미니게임 등 보상용
function rpgOwns(key) { return isAdminUser() || key === RPG_DEFAULT_ICON || (rpgState.owned || []).includes(key); }
function rpgCurrentIcon() {
    if (isGuestUser()) return 'crook';
    const k = rpgState.icon;
    if (k && RPG_ICONS[k] && (k !== 'crown' || isAdminUser()) && (k === 'crown' || rpgOwns(k))) return k;
    return isAdminUser() ? 'crown' : RPG_DEFAULT_ICON;
}
function rpgTodayKST() { return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); }
function rpgLoad(user) {
    const m = (user && user.user_metadata && user.user_metadata.rpg) || {};
    rpgState = { days: Math.max(0, parseInt(m.days, 10) || 0), last: m.last || null,
        owned: Array.isArray(m.owned) ? m.owned.filter(k => RPG_ICONS[k]) : [], icon: m.icon || null, bonus: Math.max(0, parseInt(m.bonus, 10) || 0) };
}
async function rpgSave() {
    const { error } = await sb.auth.updateUser({ data: { rpg: rpgState } });
    if (error) throw error;
}
function rpgToast(msg) {
    let el = document.getElementById('rpgToast');
    if (!el) { el = document.createElement('div'); el.id = 'rpgToast'; el.className = 'rpg-toast'; document.body.appendChild(el); }
    el.innerHTML = msg;
    el.classList.add('show');
    clearTimeout(rpgToast._t);
    rpgToast._t = setTimeout(() => el.classList.remove('show'), 4200);
}
// 하루 첫 접속 = 출석 +1 (하루 한 번만 서버에 저장). 레벨업이면 알림
async function rpgDailyCheckIn() {
    if (isGuestUser() || !currentUserEmail) return;
    const today = rpgTodayKST();
    if (rpgState.last === today) return;
    const backup = Object.assign({}, rpgState);
    const before = rpgLevel();
    rpgState.days = (rpgState.days || 0) + 1;
    rpgState.last = today;
    try { await rpgSave(); } catch (e) { console.error(e); rpgState = backup; return; }
    const after = rpgLevel();
    applyRolePermissions();
    if (after > before && !isAdminUser()) {
        const opened = RPG_TIERS.filter(t => t.needLv === after);
        const newTitle = RPG_TITLES.find(t => t.lv === after);
        rpgToast(`🎉 <b>Lv.${after} 달성!</b> +${RPG_PTS_PER_LV}P` + (newTitle ? `<br>🏅 칭호: ${newTitle.name}` : '') +
            (opened.length ? `<br>⚔️ ${opened.map(t => t.name).join('·')} 무기가 열렸어요!` : '') + `<br><small>이름표를 눌러 무기고로</small>`);
    }
}


/* dashboard가 부르는 창구 (이것만 바꾸지 않으면 안쪽은 자유롭게 고쳐도 됨) */
window.RheaRPG = {
    load: rpgLoad,                                   // 로그인 직후: 계정 정보에서 출석·무기 불러오기
    checkIn: rpgDailyCheckIn,                        // 데이터 로딩 후: 하루 첫 접속이면 출석 +1
    iconSvg: (key, cls) => (RPG_ICONS[key] ? rpgIconSvg(key, cls) : ''),
    badgeIcon: rpgBadgeIcon,                         // 17차-6: 이름표 메달 html
    currentIcon: rpgCurrentIcon,                     // 지금 장착한 아이콘 키 (AS메모에 같이 저장)
    roleText: () => `${rpgTitle(rpgLevel())} Lv.${rpgLevel()}`, // 이름표 "칭호 Lv.N"
    ensureDefs: rpgInjectDefs,
    openArmory: () => (typeof openArmory === 'function' ? openArmory() : null)
};
