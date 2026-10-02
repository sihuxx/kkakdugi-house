# 보안 설계 — 꺅두기 하우스

이 게임은 **정적 웹페이지 + 인증 서버(Supabase)** 구조입니다.
서버 코드를 직접 돌리지 않기 때문에, 지킬 곳이 (1) 브라우저 안 (2) 데이터베이스 권한
두 군데로 좁혀집니다. 아래는 어디를 어떻게 막았는지입니다.

---

## 1. 비밀번호

**우리는 비밀번호를 저장하지 않습니다.** 입력값은 변수에 잠깐 담겼다가 HTTPS로
인증 서버에 그대로 넘어가고, 서버가 bcrypt 계열로 해시해서 보관합니다.
브라우저 코드 어디에도 비밀번호가 남지 않고, 로그인이 끝나면 입력칸도 비웁니다.

직접 해시를 만들어 저장하는 방식은 쓰지 않았습니다. 솔트·반복횟수·타이밍 공격까지
전부 직접 책임져야 하고, 한 번 틀리면 통째로 털리기 때문입니다.

**비밀번호 규칙** (`js/auth.js` `checkPw`)

- 10자 이상 200자 이하
- 대문자 · 소문자 · 숫자 · 기호 중 **3종류 이상**
- 흔한 비밀번호 목록에 있으면 거부
- 같은 글자 반복만으로는 불가

## 2. 계정이 있는지 알려주지 않기 (User enumeration)

로그인 실패는 원인이 무엇이든 **항상 같은 문구**입니다.

> 이메일 또는 비밀번호가 맞지 않아요

비밀번호 재설정도 마찬가지로, 가입된 주소든 아니든 같은 안내를 보여줍니다.
"그런 계정 없음"과 "비밀번호 틀림"을 구분해 보여주면 공격자가 **가입된 이메일 목록**을
만들 수 있습니다.

## 3. 토큰을 어디에 두는가

| 토큰 | 보관 위치 | 이유 |
| --- | --- | --- |
| access token | **메모리 변수만** | 새로고침하면 사라짐. 저장소를 뒤져도 없음 |
| refresh token | 기본 **sessionStorage** | 탭을 닫으면 사라짐 |
| refresh token | "로그인 유지" 체크 시에만 localStorage | 사용자가 명시적으로 고른 경우만 |

정적 사이트라 `HttpOnly` 쿠키를 쓸 수 없습니다. 그래서 **기본값을 가장 짧게 사는 쪽**으로
두고, 오래 유지하는 건 사용자가 직접 선택하게 했습니다.
XSS가 뚫리면 어느 쪽이든 위험하므로, 4번이 실질적인 방어선입니다.

## 4. XSS — 가장 현실적인 위협

**개발 중 실제로 발견하고 고친 취약점입니다.**

두기 이름이 `innerHTML`로 화면에 들어가고 있어서, 이름을
`<img src=x onerror=...>`로 바꾸면 임의 코드가 실행됐습니다. 지금은 혼자 쓰는 저장소라
자기 자신만 당하지만, **이름이 서버에 저장되고 다른 사람에게 보이는 순간
저장형 XSS(stored XSS)** 가 됩니다.

막은 방법 — 3중으로:

1. **출력 이스케이프** — `esc()` / `escAttr()` (`js/boot.js`). 사람이 넣은 글자가
   `innerHTML`에 닿는 모든 지점에서 `& < > " ' \`` 를 엔티티로 바꿉니다.
   서버에서 받은 값은 아예 `textContent`로만 넣습니다.
2. **입력 화이트리스트** — `cleanName()`. 한글·영문·숫자와 `. _ -` 만 남기고
   제어문자·보이지 않는 유니코드(`U+200B`, `U+2028` 등)를 제거, 8자로 자릅니다.
3. **서버 검증** — DB 트리거가 길이와 금지문자(`< > & " ' \` \`)를 한 번 더 막습니다.
   브라우저 코드는 우회할 수 있어도 DB는 못 지나갑니다.

## 5. CSP (Content Security Policy)

`index.html`의 메타 태그로 선언합니다.

```
default-src 'none';  script-src 'self';  object-src 'none';
style-src 'self' https://fonts.googleapis.com 'unsafe-inline';
font-src https://fonts.gstatic.com;  img-src 'self' data: blob:;
connect-src 'self' https://*.supabase.co;
form-action 'none';  base-uri 'none';  frame-ancestors 'none';
```

- `script-src 'self'` — **인라인 스크립트와 외부 스크립트가 전부 차단됩니다.**
  XSS로 태그를 밀어 넣는 데 성공해도 실행되지 않습니다.
- **클릭재킹** — `frame-ancestors` 는 `<meta>` 로는 적용되지 않습니다(브라우저가 무시).
  그래서 `js/boot.js` 첫 줄에서 `window.top !== window.self` 를 확인하고,
  iframe 안이면 문서를 비우고 게임을 아예 시작하지 않습니다.
  응답 헤더를 설정할 수 있는 호스팅이라면 `frame-ancestors 'none'` 도 같이 거세요.
- `base-uri 'none'` — `<base>` 태그로 모든 상대경로를 탈취하는 공격 차단
- `object-src 'none'` — 플러그인 차단
- `connect-src` — 내 서버 외에는 통신 불가. **데이터 유출 경로를 막습니다.**

**파일 하나로 묶은 버전**(`dist/ggakdugi-house.html`)은 스크립트가 인라인이 되는데,
`'unsafe-inline'` 으로 푸는 대신 **그 스크립트의 SHA-256 해시만 허용**합니다.
빌드할 때 해시를 계산해 CSP에 박아 넣으므로, 코드가 한 글자라도 바뀌면 실행되지 않습니다.

> `style-src`에 `'unsafe-inline'`이 남아 있습니다. 게임이 `style="..."` 속성을 많이 써서
> 지금은 필요합니다. CSS만으로 하는 공격은 영향이 제한적이지만, 남은 숙제로 적어둡니다.

**외부 라이브러리를 하나도 쓰지 않았습니다.** Supabase SDK 대신 HTTPS API를 직접
호출합니다(`js/auth.js`). CDN이 털리면 우리 사이트도 같이 털리는
**공급망 공격(supply chain attack)** 경로를 아예 없앴습니다.

## 6. 접근 제어 — 진짜 방어선은 DB에 있습니다

브라우저에 박힌 `anon key`는 **공개되는 게 정상**입니다. 이건 비밀번호가 아니라
"어느 프로젝트인지" 알려주는 이름표에 가깝습니다.
누가 무엇을 읽고 쓸 수 있는지는 전부 **RLS(Row Level Security)** 가 정합니다.

```sql
alter table public.saves enable row level security;
alter table public.saves force row level security;

create policy "본인 것만 읽기" on public.saves
  for select to authenticated
  using ( (select auth.uid()) = user_id );
```

- `enable` + **`force`** — 테이블 주인도 정책을 우회하지 못합니다
- `to authenticated` + `revoke all ... from anon` — 로그인 안 한 사람은 아무것도 못 합니다
- 트리거가 `new.user_id := auth.uid()` 로 **덮어씁니다.** 남의 `user_id`를 실어 보내도
  자기 것으로 바뀌거나 거부됩니다

> **RLS를 켜지 않는 것이 Supabase 프로젝트에서 가장 흔한 사고입니다.**
> 그 경우 anon key 하나로 전체 테이블을 덤프할 수 있습니다.
> 배포 전 `select relname, relrowsecurity, relforcerowsecurity from pg_class
> where relname = 'saves';` 로 반드시 확인하세요.

## 7. 서버는 브라우저를 믿지 않습니다

세이브는 사용자가 마음대로 고칠 수 있는 값입니다. 그래서 양쪽에서 검사합니다.

**브라우저** (`Auth.sanitizeSave`) — 서버에서 내려온 세이브도 남이 조작했을 수 있다고
보고 한 겹 거릅니다.

- 알고 있는 키만 새 객체에 옮겨 담음 (모르는 키는 전부 버림)
- 숫자는 전부 범위로 자름 (스탯 0~100, 클로버 0~99,999,999)
- 캐릭터·가구·벽지 id는 **실제 목록에 있는 것만** 통과
- 사진은 `data:image/...;base64,` 형식만, 12장·60KB 제한
  (외부 주소를 심어 열람 추적을 하는 걸 막음)
- **프로토타입 오염 차단** — `__proto__` / `constructor` / `prototype` 키 거부,
  `Object.keys`로 자기 키만 순회, `Object.create(null)` 로 시작

**서버** (`supabase/schema.sql` 트리거)

- `pg_column_size(data) <= 500000` — 저장소 고갈 방지
- 클로버·마음 상한, 스탯 0~100 범위 검사
- 이름 길이·금지문자 검사
- **분당 30회 저장 제한** — 쓰기 폭주 방지

> 싱글플레이 게임이라 "클라이언트가 보낸 숫자"를 100% 검증할 수는 없습니다.
> 서버가 막는 것은 *말도 안 되는 값*과 *다른 사람에게 피해를 주는 행위*이고,
> 자기 세이브를 부풀리는 건 자기 손해입니다. 랭킹을 넣는다면 점수는
> 반드시 서버에서 다시 계산해야 합니다.

## 8. 그 밖에

- **HTTPS 전용** — GitHub Pages는 기본 HTTPS. Supabase 주소도 `https://`만 허용(`OK_URL`)
- **요청 타임아웃 15초** + `AbortController` — 느린 응답으로 매달리게 하는 공격 차단
- `credentials: 'omit'`, `referrer: no-referrer` — 요청에 쿠키·유입 경로를 싣지 않음
- **service_role key는 절대 브라우저에 두지 않습니다.** 그 키는 RLS를 전부 무시합니다
- 로그아웃 시 access·refresh 토큰을 양쪽 저장소에서 모두 지우고 서버 세션도 폐기

---

## 키가 노출됐을 때 (사고 대응)

키는 종류에 따라 대응이 다릅니다.

| 키 | 노출되면 | 대응 |
| --- | --- | --- |
| `sb_publishable_...` | **문제 없음** | 원래 브라우저에 실려 배포되는 값. RLS가 막아줍니다 |
| `sb_secret_...` (구 service_role) | **치명적** — RLS를 전부 무시하고 모든 사용자 데이터 열람·삭제 가능 | **즉시 폐기** |
| Database Password | DB 직접 접속 가능 | 즉시 변경 |

**secret key가 노출된 경우** (개발 중 실제로 한 번 겪었고, 아래 절차로 처리했습니다)

1. Project Settings → API Keys → Secret keys → 해당 키 **Revoke**
2. **Create new secret key** 로 재발급
3. 그 키를 쓰던 곳(서버·CI·환경변수)을 새 키로 교체
4. Logs & Analytics → API 로그에서 노출 기간 동안 이상한 접근이 있었는지 확인

> 이 게임은 secret key를 **어디에서도 쓰지 않습니다.** 브라우저만으로 돌아가기 때문에
> 애초에 필요가 없고, 그래서 노출돼도 폐기만 하면 끝납니다.
> "쓰지 않는 권한은 아예 만들지 않는다"가 제일 싼 방어입니다.

## 설정하는 법

1. [supabase.com](https://supabase.com) 에서 프로젝트를 만듭니다 (무료)
2. **SQL Editor** 에 `supabase/schema.sql` 을 통째로 붙여넣고 실행
3. **Authentication → Providers → Email** 에서 *Confirm email* 을 **켭니다**
   (끄면 아무 메일로나 가입할 수 있습니다)
4. **Authentication → URL Configuration** 에서 Site URL을 실제 배포 주소로 지정
5. **Settings → API Keys** 의 `Project URL`과 **publishable** 키를 `js/config.js` 에 넣습니다
   (`sb_secret_` 로 시작하는 키는 절대 넣지 않습니다)
6. `index.html` 의 CSP에서 `connect-src` 를 본인 프로젝트 주소 하나로 좁힙니다
7. Authentication → Sign In / Providers → Email 에서
   **Minimum password length 10**, **Secure password change**,
   **Require current password when updating** 를 켭니다
   (브라우저 코드의 비밀번호 규칙과 서버 기준을 맞춥니다)

설정하지 않으면 게임은 **로컬 모드**로 돌아갑니다 — 로그인 없이 브라우저에만 저장됩니다.

## 남은 숙제 (정직하게)

- `style-src 'unsafe-inline'` 제거 (인라인 style 속성을 전부 클래스로 옮겨야 함)
- 2단계 인증(MFA)
- 랭킹을 넣는다면 점수 서버 검증
- CSP를 메타 태그가 아니라 응답 헤더로 (GitHub Pages는 헤더 설정 불가 → Cloudflare Pages 등 필요).
  헤더로 옮기면 `frame-ancestors`, `X-Content-Type-Options: nosniff`,
  `Strict-Transport-Security`, `Permissions-Policy` 까지 같이 걸 수 있습니다
