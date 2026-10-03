// 📱 14차-3: 홈 화면 앱 설치용 최소 서비스워커 — 아무것도 저장(캐시)하지 않고 그대로 인터넷에서 받아옴.
// (일부 브라우저는 서비스워커가 있어야 "앱 설치"로 인정해서 주소창 없는 전체화면으로 열어줌)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
