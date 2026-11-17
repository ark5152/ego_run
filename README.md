# EGO 러닝크루 앱

크루 출석·일정·월간 거리 인증·대회 기록을 관리하는 모바일 웹앱(PWA)입니다.
Next.js 15 + Supabase(Postgres·로그인·사진 저장소)로 만들었습니다.

## 화면

| 탭 | 내용 |
| --- | --- |
| 홈 | 이번 달 참석/최소 참석, 거리 인증/목표, 거리 제출, 누적 출석·거리, 최근 3개월, 풀·하프 최고기록 |
| 출석부 | 회원별(모임 수·거리 인증·참석 부족 집계, 검색·정렬) / 날짜별(일정별 참석자 수 → 출석 체크) |
| 일정 | 달력 + 날짜별 일정 / 참석 랭킹(이번 달 참석 → 올해 누적 거리 순) |
| 대회 | 연도·성별별 풀/하프/10K 순위(회원별 최고기록), 내 기록 등록 |
| 더보기 | 내 정보, 로그아웃, (관리자) 승인 대기·회원 관리·일정 작성·크루 설정 |

규칙
- **최소 참석 횟수**(기본 1회)보다 적으면 ‘참석 부족’. 초과 참석은 횟수에만 반영됩니다.
- **거리 인증**: 회원이 km와 사진을 제출하고, 관리자가 인정해야 반영됩니다. 출석부의 ‘거리 인증 N명’은 이번 달 인정 거리가 목표(기본 30km) 이상인 인원입니다.
- **가입**: 관리자가 명단에 이름을 등록 → 회원이 이메일로 로그인해 자기 이름 선택 → 관리자 승인.
- 일정 작성·출석 체크·승인은 관리자만 할 수 있습니다(DB 권한 정책으로 강제).

## 바로 실행해 보기 (데모 모드)

Supabase 설정 없이 실행하면 예시 데이터로 동작합니다(‘김서준’ 관리자로 로그인된 상태, 데이터는 브라우저에만 저장).

```bash
npm install
```

```bash
npm run dev
```

http://localhost:3000 을 휴대폰 화면 크기로 열어 보세요.

## Supabase 연결

1. https://supabase.com 에서 새 프로젝트를 만듭니다(리전: Northeast Asia (Seoul) 추천).
2. **SQL Editor**에 `supabase/schema.sql` 전체를 붙여넣고 실행합니다. 테이블, 권한(RLS), 사진 저장소가 만들어집니다.
3. **Authentication → Emails → Magic Link** 템플릿 본문에 `{{ .Token }}`을 넣어 메일에 6자리 코드가 나오게 합니다(링크도 그대로 둬도 됩니다).
4. **Authentication → URL Configuration**의 Site URL을 배포 주소로 설정합니다.
5. `.env.example`을 `.env.local`로 복사하고 **Project Settings → API**의 URL과 anon key를 넣습니다.

### 첫 관리자 만들기

1. SQL Editor에서 명단을 등록합니다.
   ```sql
   insert into members (name, gender) values ('김서준','M'), ('박지호','M'), ('이하윤','F');
   ```
2. 앱에서 본인 이메일로 로그인 → 내 이름 선택 → 승인 요청.
3. SQL Editor에서 본인을 관리자로 승인합니다.
   ```sql
   update members set status = 'active', role = 'admin', is_leader = true where name = '김서준';
   ```

이후 명단 추가와 승인은 앱의 **더보기 → 회원 관리 / 승인 대기**에서 하면 됩니다.

## 배포

Vercel에 저장소를 연결하고 환경변수 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 넣으면 됩니다.
휴대폰에서 주소를 열고 ‘홈 화면에 추가’하면 앱처럼 설치됩니다.

## 구조

```
app/                 화면(라우트)
components/          앱 셸·탭바·로그인·가입·공통 상태(crew.tsx)
lib/types.ts         데이터 타입과 Api 인터페이스
lib/api/supabase.ts  Supabase 구현
lib/api/mock.ts      데모 모드 구현(예시 데이터)
supabase/schema.sql  DB 스키마·권한·저장소
```
