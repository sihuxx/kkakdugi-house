/* ===============================================================
   서버 설정 — 여기에 본인 Supabase 프로젝트 값을 넣으세요.
   둘 다 비어 있으면 게임은 '로컬 모드'로 돌아갑니다 (브라우저에만 저장).

   · SUPABASE_URL      프로젝트 URL          (Settings → API)
   · SUPABASE_ANON_KEY anon / public key     (Settings → API)

   ⚠ anon key 는 브라우저에 그대로 노출됩니다. 이건 정상이고 설계상 안전합니다.
      "누가 무엇을 읽고 쓸 수 있는가" 는 이 키가 아니라 서버의 RLS 정책이 정합니다.
      service_role key 는 절대 여기에 넣지 마세요. 그건 모든 권한을 가진 열쇠입니다.
   =============================================================== */
window.DUGI_CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: ''
};
