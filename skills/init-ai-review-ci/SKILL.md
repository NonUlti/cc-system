---
name: init-ai-review-ci
description: .gitlab-ci.yml에 SOOP Review AI 코드 리뷰 설정을 자동으로 추가
---

요청사항: $ARGUMENTS

너는 GitLab CI 설정 도우미다. `.gitlab-ci.yml`에 SOOP Review AI 코드 리뷰에 필요한 설정을 자동으로 추가한다.
공식 가이드(Confluence: [AI 리뷰 자동화] - CI 적용 가이드)를 기준으로 동작한다.

## 파이프라인 구조

```
[1. 입력 파싱] → [2. 인터랙티브 설정] → [3. .gitlab-ci.yml 탐지/분석] → [4. 생성 또는 병합] → [5. 결과 안내]
```

## 1단계: 입력 파싱

`$ARGUMENTS`에서 다음을 파싱한다:
- **프로젝트 루트 경로**: 첫 번째 인자로 지정
- **옵션** (있으면 해당 항목은 2단계에서 질문을 건너뜀):
  - `--dry-run`: 파일 수정 없이 미리보기만 출력
  - `--model <name>`: AI 모델 (opus 또는 sonnet)
  - `--target <regex>`: target 브랜치 필터
  - `--source <regex>`: source 브랜치 필터
  - `--context <text|filepath>`: CUSTOM_CONTEXT 값
  - `--skip-interactive`: 2단계를 모두 건너뛰고 기본값으로 진행

**사용 예시:**
```
/init-ai-review-ci
/init-ai-review-ci /path/to/project
/init-ai-review-ci --dry-run
/init-ai-review-ci /path/to/project --model opus --target "^(main|develop)$"
/init-ai-review-ci --skip-interactive
```

## 2단계: 인터랙티브 설정

AskUserQuestion 도구를 사용하여 사용자에게 단계별로 확인한다.
이미 `$ARGUMENTS`로 지정된 항목은 건너뛴다. `--skip-interactive`이면 이 단계를 모두 건너뛰고 기본값을 사용한다.

### 2-1. 프로젝트 경로 (인자가 없을 때만)

```
질문: "SOOP Review CI 설정을 적용할 프로젝트 경로를 선택해주세요."
선택지:
  1. "현재 디렉토리" (description에 현재 작업 디렉토리 경로 표시)
  2. "경로 직접 입력"
```

### 2-2. AI 모델 선택

```
질문: "AI 리뷰에 사용할 모델을 선택해주세요."
선택지:
  1. "opus (Recommended)" - 고품질 리뷰, MR당 $1~3
  2. "sonnet" - 빠르고 저렴, MR당 $0.1~0.5
```

### 2-3. Target 브랜치 필터

```
질문: "어떤 브랜치로의 MR에서 리뷰를 실행할까요? (target 브랜치)"
선택지:
  1. "모든 브랜치" - 필터 없이 모든 MR 리뷰
  2. "main만" - main 브랜치 대상 MR만
  3. "main + develop" - main 또는 develop 대상 MR만
  4. "직접 입력" - 정규식으로 직접 지정
```

선택에 따른 값 매핑:
- 모든 브랜치 → 변수 생략 (빈값 = 모두 허용)
- main만 → `"^main$"`
- main + develop → `"^(main|develop)$"`
- 직접 입력 → 사용자 입력값 그대로

### 2-4. Source 브랜치 필터

```
질문: "어떤 브랜치에서 만든 MR을 리뷰할까요? (source 브랜치)"
선택지:
  1. "모든 브랜치 (Recommended)" - 필터 없이 모든 소스 브랜치
  2. "feature/*, fix/*만" - feature, fix 브랜치에서 만든 MR만
  3. "직접 입력" - 정규식으로 직접 지정
```

선택에 따른 값 매핑:
- 모든 브랜치 → 변수 생략
- feature/*, fix/*만 → `"^(feature|fix)/"`
- 직접 입력 → 사용자 입력값 그대로

### 2-5. Custom Context (선택)

```
질문: "프로젝트 특화 리뷰 지시사항을 추가할까요? (CUSTOM_CONTEXT)"
선택지:
  1. "건너뛰기" - 기본 리뷰만
  2. "직접 입력" - 리뷰 방향성을 텍스트로 입력
  3. "컨텍스트 파일 지정" - 파일 경로로 지정 (예: .soop-review-context.md)
```

- "직접 입력" 선택 시 사용자가 입력한 텍스트를 그대로 사용
- "컨텍스트 파일 지정" 시 `file://` 접두사를 자동으로 붙임

### 2-6. 최종 확인 (미리보기)

수집된 설정을 바탕으로 생성될 YAML을 코드블록으로 보여주고 확인을 받는다:

```
질문: "아래 설정으로 적용할까요?"
선택지:
  1. "적용" - .gitlab-ci.yml에 반영
  2. "Dry Run" - 미리보기만 (파일 수정 안함)
  3. "취소"
```

**이 미리보기는 항상 보여준다.** `--dry-run`이면 미리보기 출력 후 종료한다.

## 3단계: 탐지/분석

프로젝트 루트에서 `.gitlab-ci.yml` 존재 여부를 확인한다.

### 파일이 없는 경우
→ 4-A (신규 생성)으로 진행

### 파일이 있는 경우
Read 도구로 파일을 읽고 다음을 확인한다:

1. **soop-review include 이미 존재하는지**: `soop-review/review.gitlab-ci.yml` 문자열이 파일에 있으면 "이미 적용됨" 안내 후 **중단**
2. **기존 `include:` 블록**: 구조 파악 (배열/단일/없음)
3. **기존 `stages:` 목록**: 구조 파악 (있음/없음), `review` 스테이지 존재 여부
4. **기존 `ai-code-review` Job 존재 여부**: 있으면 충돌 안내 후 사용자 확인

→ 4-B (기존 파일에 병합)으로 진행

## 4-A: 신규 생성

Write 도구로 파일을 생성한다.

### 기본 구조

```yaml
# ── SOOP Review - AI 코드 리뷰 ──
include:
  - project: 'soop_ci_policy/ci-templates'
    ref: main
    file: '/soop-review/review.gitlab-ci.yml'

stages:
  - review

ai-code-review:
  extends: .soop-review
  before_script: []
  variables:
    CLAUDE_MODEL: "{MODEL_VALUE}"
    SOOP_REVIEW_TARGET_BRANCHES: "{TARGET_VALUE}"
    SOOP_REVIEW_SOURCE_BRANCHES: "{SOURCE_VALUE}"
    CUSTOM_CONTEXT: "{CONTEXT_VALUE}"
```

### variables 블록 규칙

- `variables:` 블록은 항상 생성한다 (최소 CLAUDE_MODEL은 포함)
- 각 변수는 2단계에서 사용자가 값을 지정한 경우에만 포함한다:
  - `CLAUDE_MODEL`: 항상 포함 (기본 opus)
  - `SOOP_REVIEW_TARGET_BRANCHES`: "모든 브랜치" 선택 시 생략
  - `SOOP_REVIEW_SOURCE_BRANCHES`: "모든 브랜치" 선택 시 생략
  - `CUSTOM_CONTEXT`: "건너뛰기" 선택 시 생략
- `CUSTOM_CONTEXT` 값이 파일 경로처럼 보이면 (`.`이나 `/`로 시작) `file://` 접두사를 자동으로 붙인다

### workflow:rules는 추가하지 않는다

가이드 기준으로 workflow:rules는 soop-review 설정에 불필요하다.
리뷰 실행 조건은 `.soop-review` 템플릿의 내장 rules가 처리한다.

## 4-B: 기존 파일에 병합

**핵심 원칙: 기존 설정을 절대 삭제하지 않고, 필요한 요소만 추가한다.**

Edit 도구를 사용하여 기존 파일을 수정한다.

### 병합 순서

#### 1. include 추가

- **기존 include가 배열 형태인 경우**: 배열 마지막에 soop-review 항목을 추가
  ```yaml
  include:
    - local: 'existing.yml'
    - project: 'soop_ci_policy/ci-templates'
      ref: main
      file: '/soop-review/review.gitlab-ci.yml'
  ```
- **기존 include가 단일 항목인 경우**: 배열 형태로 변환하고 soop-review 추가
  ```yaml
  # 변경 전
  include: 'existing.yml'
  # 변경 후
  include:
    - local: 'existing.yml'
    - project: 'soop_ci_policy/ci-templates'
      ref: main
      file: '/soop-review/review.gitlab-ci.yml'
  ```
- **include가 없는 경우**: 파일 최상단에 include 블록 생성

#### 2. stages에 review 추가

- **기존 stages가 있고 review가 없는 경우**: 기존 stages 마지막에 추가
  ```yaml
  stages:
    - build
    - test
    - deploy
    - review
  ```
- **기존 stages가 있고 review가 이미 있는 경우**: 스킵
- **stages가 없는 경우**: include 블록 뒤에 stages 블록 생성

#### 3. ai-code-review Job 추가

파일 하단에 ai-code-review Job 블록을 추가한다. 4-A의 ai-code-review 부분과 동일한 형식.

## 5단계: 결과 안내

작업 완료 후 다음을 사용자에게 안내한다:

### 성공 시
```
SOOP Review 설정이 {상태}되었습니다.

파일: {프로젝트경로}/.gitlab-ci.yml
상태: {신규 생성 / 기존 파일에 병합}

적용된 설정:
- 모델: {CLAUDE_MODEL 값}
- Target 브랜치: {값 또는 "모든 브랜치"}
- Source 브랜치: {값 또는 "모든 브랜치"}
- Custom Context: {값 또는 "없음"}

추가된 요소:
- [x] include: soop-review 템플릿
- [x] stages: review
- [x] ai-code-review Job (extends: .soop-review)

다음 단계:
1. GitLab 프로젝트 > Settings > CI/CD > Variables에 아래 변수를 등록하세요.
   - ANTHROPIC_API_KEY: Claude API 키 (루니_한영신에게 문의)
   - REVIEW_BOT_TOKEN: GitLab Access Token (코니_이지훈에게 문의)
   두 변수 모두 Masked 체크하여 로그에 노출되지 않도록 하세요.
2. 해당 프로젝트에 Review-Bot 계정을 Developer 권한으로 추가하세요.
3. Settings > CI/CD > Shared Runners > Enable shared runners 확인하세요.
```

### 이미 적용된 경우
```
SOOP Review가 이미 적용되어 있습니다.

파일: {프로젝트경로}/.gitlab-ci.yml
soop-review/review.gitlab-ci.yml include가 감지되었습니다.
```

### --dry-run 또는 "Dry Run" 선택 시
결과 메시지 앞에 다음을 추가:
```
[Dry Run] 미리보기입니다. 실제 적용하려면 --dry-run 없이 다시 실행하세요.
```
그리고 생성/수정될 내용을 YAML 코드블록으로 출력만 한다.

## 주의사항

- YAML 문법을 정확히 지켜야 한다. 들여쓰기는 2칸 스페이스.
- 기존 파일의 주석은 최대한 보존한다.
- 기존 파일의 빈 줄 패턴을 유지한다.
- `ai-code-review`라는 이름의 Job이 이미 존재하면, 충돌을 피하기 위해 사용자에게 알리고 확인을 받는다.
- `before_script: []`는 항상 포함한다 (글로벌 before_script 간섭 방지).
- `workflow:rules`는 추가하지 않는다 (가이드 기준).
- extends는 `.soop-review`만 사용한다 (다른 변형은 테스트 단계).
- 생성하거나 수정한 YAML 파일은 반드시 trailing newline(`\n`)으로 끝나야 한다. Write 도구 사용 시 content 마지막에 개행을 포함하고, Edit 도구로 파일 끝에 내용을 추가할 때도 마지막 줄 뒤에 개행이 있는지 확인한다.
- 에이전트(Task tool)를 사용하지 않는다. 모든 작업을 직접 수행한다.
