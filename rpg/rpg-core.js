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
   - 남은 포인트는 저장 안 하고 (기본 0P + Lv × 5 + bonus − 산 무기 값 합)으로 계산 → 숫자가 꼬일 일 없음
   - 저장 위치: 각자 계정 user_metadata.rpg = { days, last, owned[], icon, bonus, pang } (닉네임과 같은 곳, 새 테이블 없음)
   - 마스터(관리자)는 모든 아이콘 무료 + 룬 흑검(마스터 전용 연출), 게스트는 목동 지팡이 고정(무기고 안 열림)
   - 등급 추가(정예·전설): RPG_ICONS에 그림 넣고 RPG_TIERS에 한 줄 추가하면 무기고에 줄이 자동으로 생김 */
const RPG_DAYS_PER_LV = 5, RPG_PTS_PER_LV = 5, RPG_DEFAULT_ICON = 'club', RPG_START_PTS = 0; // 18차: 처음 기본 5P 없앰 (17차-7에서 5P였음)
/* 19차: 경험치(EXP)와 포인트(P) 분리
   - EXP = 레벨용, 쌓이기만 함: 출석 +10 · 던전팡팡 클리어 +5 (미니게임 늘면 여기 추가) → 50EXP마다 Lv+1 (레벨업 +5P)
   - P = 지갑: Lv×5 + bonus − 산 물건 값 합 (계속 계산, 저장 안 함)
   - 예전 기록은 처음 불러올 때 exp = 출석일×10 + 던전 클리어(bonus)×5 로 바꿔서 이어붙임
   - 마스터도 매일 EXP·P를 얻음 (테스트용). 시작값 +1000EXP(= Lv20) + 900P → 1000P. 마스터 전용 아이템(룬 흑검)만 공짜 */
const RPG_EXP = { day: 10, pang: 5, perLv: 50, masterBase: 1000, masterPts: 900 }; // 19차-3: 마스터 테스트용 +900P (Lv20 100P + 900 = 1000P)
let rpgState = { days: 0, last: null, owned: [], icon: null, bonus: 0, pang: null, exp: 0, g: 'm', eq: { armor: 'ar_base', helm: null, off: null, deco: null } };

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
// 17차-8: 희귀 = 모션 따라 바람(풍압) 자국. 무기는 돌아도 바람 자국은 제자리에 남게 .w 바깥(형제)에 그림
// 17차-10: 바람 자국 = 칼끝이 실제로 지나가는 호를 무기마다 계산 (RPG_GEO 축·끝 + 모션 각도). 시작→끝 = 휘두르는 방향
const RPG_MOTION_ANG = { swing: [-38, 26], chop: [-48, 22], slash: [-55, 40], reap: [35, -50] }; // rpg.css 키프레임의 "들어올림 → 내려침" 각도와 같게
function rpgArcPath(pivot, tip, a0, a1, scale) {
    const T = (u) => (u / 64 + 0.16) / 1.32 * 100; // 아이콘 64칸 → 바람 그림 0~100칸 (바람 그림은 아이콘보다 16%씩 큼)
    const dx = tip[0] - pivot[0], dy = tip[1] - pivot[1], r = Math.hypot(dx, dy) * scale, base = Math.atan2(dy, dx) * 180 / Math.PI;
    const pt = (a) => { const rad = (base + a) * Math.PI / 180; return [T(pivot[0] + r * Math.cos(rad)).toFixed(1), T(pivot[1] + r * Math.sin(rad)).toFixed(1)]; };
    const [x0, y0] = pt(a0), [x1, y1] = pt(a1), R = (r / 64 / 1.32 * 100).toFixed(1);
    return `M${x0} ${y0} A${R} ${R} 0 0 ${a1 > a0 ? 1 : 0} ${x1} ${y1}`;
}
const RPG_TRAILS = {
    stab:  '<path class="t1" d="M62 40 L98 4"/><path class="t2" d="M56 34 L84 6"/><path class="t2" d="M70 48 L96 22"/>',
    shot:  '<path class="t1" d="M60 50 L104 50"/><path class="t2" d="M62 43 L94 43"/><path class="t2" d="M62 57 L94 57"/>',
    twin:  '<path class="t1" d="M42.1 7.4 A63.9 63.9 0 0 1 89.6 47.2"/><path class="t1" d="M57.9 7.4 A63.9 63.9 0 0 0 10.4 47.2"/>',
    swirl: '<ellipse class="s1" cx="50" cy="40" rx="26" ry="7"/><ellipse class="s1 s2" cx="50" cy="60" rx="20" ry="6"/>',
    ring:  '<circle class="t1" cx="50" cy="50" r="36"/>'
};
const RPG_TRAIL_OF = { swing: 'arc', chop: 'chop', slash: 'h', reap: 'h', twin: 'twin', stab: 'stab', screw: 'swirl', throw: 'ring', spin: 'ring', flail: 'ring', whirl: 'ring', pluck: 'shot', pluckY: 'stab' };
function rpgFxIcon(key, cls) {
    // 17차-11: 마스터 룬 흑검 = 전용 연출 (내려베기·충격파 → 360° 횡베기·빛무리 → 룬 점등) + 평소 10초마다 흑색 오오라가 피어오름
    if (key === 'master_sword' && typeof RPG_RUNEBLADE !== 'undefined') {
        return `<span class="fxb rb-frame"><span class="rb-quake"><span class="rb-ringwrap">${RPG_RUNEBLADE.ring}</span><span class="rb-rig"><svg viewBox="0 0 200 200" aria-hidden="true">${RPG_RUNEBLADE.sword}</svg></span>${RPG_RUNEBLADE.fx1}</span></span>`;
    }
    const [fx, arg] = String((typeof RPG_FX !== 'undefined' && RPG_FX[key]) || 'swing').split(':');
    const t = rpgTierOf(key);
    const glow = (t && t.glow) || ''; // 빛무리 = 정예부터
    const geo = (typeof RPG_GEO !== 'undefined' && RPG_GEO[key]) || { pivot: [15.4, 49.9], tip: [61, 7] };
    const ang = RPG_MOTION_ANG[fx];
    let style = (arg !== undefined ? `--ax:${arg};` : '') + (glow ? `--gl:${glow};` : '');
    if (ang) style += `transform-origin:${(geo.pivot[0] / 64 * 100).toFixed(1)}% ${(geo.pivot[1] / 64 * 100).toFixed(1)}%;`;
    const tr = t && t.trail && RPG_TRAIL_OF[fx];
    let trailSvg = '';
    if (tr) {
        const inner = ang ? `<path class="t1" d="${rpgArcPath(geo.pivot, geo.tip, ang[0], ang[1], 1)}"/><path class="t2" d="${rpgArcPath(geo.pivot, geo.tip, ang[0] + 8 * Math.sign(ang[1] - ang[0]), ang[1] - 4 * Math.sign(ang[1] - ang[0]), 0.82)}"/>` : RPG_TRAILS[tr];
        trailSvg = `<svg class="rpg-trail tr-${tr}" viewBox="0 0 100 100" aria-hidden="true"><g filter="url(#ri-blur)">${inner}</g></svg>`;
    }
    return `<span class="fxb"><span class="w fx-${fx}${glow ? ' fx-glow' : ''}"${style ? ` style="${style}"` : ''}>${rpgIconSvg(key, cls)}</span>${trailSvg}</span>`;
}
// 메달 테두리 색 = 등급 색 (왕관 금, 지팡이 나무색)
function rpgTierColor(key) {
    if (key === 'master_sword' || key === 'crown') return '#F2C94C';
    if (key === 'crook') return '#C08A55';
    const t = rpgTierOf(key); return t ? t.color : '#F2C94C';
}
// 이름표 메달 (A안 + 롤오버: 테두리 빛 + 무기 효과)
function rpgBadgeIcon() {
    const k = rpgCurrentIcon();
    return `<span class="up-ic" style="--tc:${rpgTierColor(k)}">${rpgFxIcon(k)}</span>`;
}
function rpgExp() { return (rpgState.exp || 0) + (isAdminUser() ? RPG_EXP.masterBase : 0); }
function rpgLevel() { return Math.floor(rpgExp() / RPG_EXP.perLv); }
/* 19차: 모든 장비(무기·갑옷·왼손…) 한 곳에서 찾기 → { slot, tier, name } */
let rpgItemMap = null;
function rpgItem(key) {
    if (!rpgItemMap) {
        rpgItemMap = {};
        RPG_SLOTS.forEach(sl => sl.tiers.forEach(t => t.keys.forEach(k => {
            const name = sl.id === 'armor' ? (RPG_ARMORS[k] || [k])[0] : (RPG_ICONS[k] || [k])[0];
            rpgItemMap[k] = { slot: sl, tier: t, name, needLv: Math.max(t.needLv, sl.minLv || 0) };
        })));
    }
    return rpgItemMap[key] || null;
}
function rpgIsWeapon(key) { const it = rpgItem(key); return !!(it && it.slot.id === 'weapon'); }
function rpgTitle(lv) { let t = RPG_TITLES[0].name; RPG_TITLES.forEach(x => { if (lv >= x.lv) t = x.name; }); return t; }
function rpgTierOf(key) { const it = rpgItem(key); return it ? it.tier : undefined; }
function rpgIsFree(key) { return RPG_SLOTS.some(sl => sl.def === key); } // 몽둥이 · 평민옷 = 기본 지급
function rpgSpent() {
    return (rpgState.owned || []).reduce((s, k) => { const t = rpgTierOf(k); return s + (t && !rpgIsFree(k) ? t.cost : 0); }, 0);
}
function rpgPoints() { return RPG_START_PTS + (isAdminUser() ? RPG_EXP.masterPts : 0) + rpgLevel() * RPG_PTS_PER_LV + (rpgState.bonus || 0) - rpgSpent(); } // bonus = 미니게임(던전팡팡) 보상
function rpgOwns(key) { return key === 'master_sword' ? isAdminUser() : (rpgIsFree(key) || (rpgState.owned || []).includes(key)); } // 19차: 마스터도 사야 함 (룬 흑검만 공짜)
function rpgCurrentIcon() {
    if (isGuestUser()) return 'crook';
    const k = rpgState.icon;
    // 17차-10: 마스터 기본 = 마검 (예전 왕관 장착값도 마검으로)
    if (isAdminUser() && (!k || k === 'crown' || !RPG_ICONS[k])) return 'master_sword';
    if (k && rpgIsWeapon(k) && rpgOwns(k)) return k;
    if (k === 'master_sword' && isAdminUser()) return k;
    return isAdminUser() ? 'master_sword' : RPG_DEFAULT_ICON;
}
function rpgTodayKST() { return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); }
function rpgLoad(user) {
    const m = (user && user.user_metadata && user.user_metadata.rpg) || {};
    const pg = m.pang && typeof m.pang === 'object' ? { d: String(m.pang.d || ''), n: Math.max(0, parseInt(m.pang.n, 10) || 0), ok: !!m.pang.ok } : null;
    const days = Math.max(0, parseInt(m.days, 10) || 0), bonus = Math.max(0, parseInt(m.bonus, 10) || 0);
    const eq = m.eq && typeof m.eq === 'object' ? m.eq : {};
    const ok = (k, slot) => { const it = k && rpgItem(k); return it && it.slot.id === slot ? k : null; };
    rpgState = { days, last: m.last || null,
        owned: Array.isArray(m.owned) ? m.owned.filter(k => rpgItem(k)) : [], icon: m.icon || null, bonus, pang: pg,
        exp: m.exp != null ? Math.max(0, parseInt(m.exp, 10) || 0) : days * RPG_EXP.day + bonus * RPG_EXP.pang, // 19차: 예전 기록 → EXP
        g: m.g === 'f' ? 'f' : 'm',
        eq: { armor: ok(eq.armor, 'armor') || 'ar_base', helm: ok(eq.helm, 'helm'), off: ok(eq.off, 'off'), deco: ok(eq.deco, 'deco') } };
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
    rpgState.exp = (rpgState.exp || 0) + RPG_EXP.day;
    rpgState.last = today;
    try { await rpgSave(); } catch (e) { console.error(e); rpgState = backup; return; }
    const after = rpgLevel();
    applyRolePermissions();
    if (after > before) {
        const opened = RPG_SLOTS.flatMap(sl => sl.tiers.filter(t => Math.max(t.needLv, sl.minLv || 0) === after).map(t => t.name + ' ' + sl.name));
        const newTitle = RPG_TITLES.find(t => t.lv === after);
        rpgToast(`🎉 <b>Lv.${after} 달성!</b> +${RPG_PTS_PER_LV}P` + (newTitle ? `<br>🏅 칭호: ${newTitle.name}` : '') +
            (opened.length ? `<br>⚔️ ${opened.join(' · ')}이(가) 열렸어요!` : '') + `<br><small>이름표를 눌러 모험가 수첩으로</small>`);
    }
}

/* 18차: 미니게임 "던전팡팡" ===========================================================
   - 게임 파일(rpg-pangpang.js/css · img/)은 수첩에서 버튼을 누를 때만 불러옴 → 업무 화면 무게 0
   - 하루 도전 3번(시작할 때 1번 차감), 성공하면 그날은 끝. 성공 보상 = bonus +1P
   - 저장: rpgState.pang = { d: 날짜(한국), n: 오늘 쓴 횟수, ok: 오늘 성공 } — 날짜가 바뀌면 자동으로 새 하루 */
const RPG_PANG = { tries: 3, reward: 1 };
const RPG_SELF = (() => { // 이 파일 위치·버전(?v=) → 게임 파일도 같은 곳·같은 버전으로
    const s = document.currentScript && document.currentScript.src;
    return s ? { dir: s.replace(/[?#].*$/, '').replace(/[^/]*$/, ''), q: (s.split('?')[1] || '').split('#')[0] } : { dir: 'rpg/', q: '' };
})();
function rpgPangToday() {
    const t = rpgTodayKST(), p = rpgState.pang;
    return p && p.d === t ? p : { d: t, n: 0, ok: false };
}
function rpgPangDaily() { const p = rpgPangToday(); return { tries: Math.max(0, RPG_PANG.tries - p.n), cleared: !!p.ok }; }
async function rpgPangStart() {
    const p = rpgPangToday();
    if (p.ok || p.n >= RPG_PANG.tries) return false;
    const prev = rpgState.pang;
    rpgState.pang = { d: p.d, n: p.n + 1, ok: false };
    try { await rpgSave(); return true; }
    catch (e) { console.error(e); rpgState.pang = prev; alert('⚠️ 저장 실패 (인터넷 연결을 확인해주세요)'); return false; }
}
async function rpgPangClear() {
    const prevP = rpgState.pang, prevB = rpgState.bonus, prevE = rpgState.exp, lv0 = rpgLevel();
    rpgState.pang = Object.assign({}, rpgPangToday(), { ok: true });
    rpgState.bonus = (rpgState.bonus || 0) + RPG_PANG.reward;
    rpgState.exp = (rpgState.exp || 0) + RPG_EXP.pang; // 19차: 던전 클리어 = +1P · +5EXP
    try { await rpgSave(); if (rpgLevel() > lv0) applyRolePermissions(); return { reward: RPG_PANG.reward }; }
    catch (e) { console.error(e); rpgState.pang = prevP; rpgState.bonus = prevB; rpgState.exp = prevE; alert('⚠️ 보상 저장 실패 (인터넷 연결을 확인해주세요)'); return { reward: 0 }; }
}
// 들고 갈 무기 = 내가 가진 무기 (마스터는 룬 흑검 + 전부)
function rpgMyWeapons() {
    const keys = [...(isAdminUser() ? ['master_sword'] : []), RPG_DEFAULT_ICON, ...RPG_TIERS.flatMap(t => t.keys).filter(k => k !== RPG_DEFAULT_ICON && (rpgState.owned || []).includes(k))];
    return keys.filter(k => RPG_ICONS[k]).map(k => ({ key: k, name: RPG_ICONS[k][0], html: rpgIconSvg(k), color: rpgTierColor(k) }));
}
function rpgLoadPang(cb) {
    if (window.RheaPangpang) return cb();
    const v = RPG_SELF.q ? '?' + RPG_SELF.q : '';
    if (!document.getElementById('rpgPangCss')) {
        const l = document.createElement('link'); l.id = 'rpgPangCss'; l.rel = 'stylesheet'; l.href = RPG_SELF.dir + 'rpg-pangpang.css' + v; document.head.appendChild(l);
    }
    const s = document.createElement('script');
    s.src = RPG_SELF.dir + 'rpg-pangpang.js' + v;
    s.onload = () => (window.RheaPangpang ? cb() : null);
    s.onerror = () => { s.remove(); alert('⚠️ 던전팡팡을 불러오지 못했어요 (rpg 폴더의 rpg-pangpang.js 확인)'); };
    document.head.appendChild(s);
}
function rpgOpenPang(onClose) {
    if (isGuestUser() || !currentUserEmail) return;
    rpgInjectDefs();
    rpgLoadPang(() => RheaPangpang.open({
        weapons: rpgMyWeapons(), current: rpgCurrentIcon(),
        getDaily: rpgPangDaily, onStart: rpgPangStart, onClear: rpgPangClear, onClose
    }));
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
    openArmory: () => (typeof openArmory === 'function' ? openArmory() : null),
    openPang: rpgOpenPang                            // 18차: 던전팡팡 (보통은 수첩 버튼에서 열림)
};
