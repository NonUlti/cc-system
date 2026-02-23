---
name: init-ai-review-ci
description: .gitlab-ci.yml에 SOOP Review AI 코드 리뷰 설정을 자동으로 추가
---

요청사항: $ARGUMENTS

너는 GitLab CI 설정 도우미다. `.gitlab-ci.yml`에 SOOP Review AI 코드 리뷰에 필요한 설정을 자동으로 추가한다.

## 파이프라인 구조

```
[1. 입력 파싱] → [2. .gitlab-ci.yml 탐지/분석] → [3. 생성 또는 병합] → [4. 결과 안내]
```

## 1단계: 입력 파싱 (직접 수행)

`$ARGUMENTS`에서 다음을 파싱한다:
- **프로젝트 루트 경로**: 첫 번째 인자로 지정. 인자가 없으면 AskUserQuestion 도구로 사용자에게 확인한다:
  - 선택지 1: "현재 디렉토리" (현재 작업 디렉토리 경로를 description에 표시)
  - 선택지 2: "경로 직접 입력" (프로젝트 루트 경로를 직접 지정)
- **옵션**:
  - `--template <name>`: 템플릿 선택 (기본: `default`)
  - `--dry-run`: 파일 수정 없이 변경 내용만 출력
  - `--model <name>`: CLAUDE_MODEL 변수 추가 (sonnet 또는 opus)
  - `--custom-context <text|filepath>`: CUSTOM_CONTEXT 변수 추가

**사용 예시:**
```
/init-ai-review-ci
/init-ai-review-ci /path/to/project
/init-ai-review-ci --template auto
/init-ai-review-ci --dry-run
/init-ai-review-ci --model sonnet
/init-ai-review-ci --custom-context "이 프로젝트는 MVP이므로 성능 이슈는 Minor로 취급"
/init-ai-review-ci --template auto --model sonnet --dry-run
```

### 템플릿 매핑

| `--template` 값 | `extends` 값 | 설명 |
|---|---|---|
| `default` | `.soop-review` | 첫 리뷰 자동, 이후 수동 (기본) |
| `auto` | `.soop-review-auto` | 코드 변경 시 항상 자동 |
| `manual` | `.soop-review-manual` | 항상 수동 (Play 버튼) |
| `target-branch` | `.soop-review-target-branch` | main/develop 대상만 |
| `source-branch` | `.soop-review-source-branch` | feature/fix 브랜치만 |

## 2단계: 탐지/분석 (직접 수행)

프로젝트 루트에서 `.gitlab-ci.yml` 존재 여부를 확인한다.

### 파일이 없는 경우
→ 3-A (신규 생성)으로 진행

### 파일이 있는 경우
Read 도구로 파일을 읽고 다음을 확인한다:

1. **soop-review include 이미 존재하는지**: `soop-review/review.gitlab-ci.yml` 문자열이 파일에 있으면 "이미 적용됨" 안내 후 **중단**
2. **기존 `include:` 블록**: 구조 파악 (배열/단일/없음)
3. **기존 `workflow:` → `rules:` 블록**: 구조 파악 (있음/없음), `merge_request_event` 규칙 존재 여부
4. **기존 `stages:` 목록**: 구조 파악 (있음/없음), `review` 스테이지 존재 여부

→ 3-B (기존 파일에 병합)으로 진행

## 3-A: 신규 생성

`--dry-run`이 아니면 Write 도구로, `--dry-run`이면 코드블록으로 출력만 한다.

생성할 내용:

```yaml
# ── SOOP Review - AI 코드 리뷰 ──
include:
  - project: 'soop_ci_policy/ci-templates'
    ref: main
    file: '/soop-review/review.gitlab-ci.yml'

workflow:
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH && $CI_OPEN_MERGE_REQUESTS
      when: never
    - if: $CI_COMMIT_BRANCH

stages:
  - review

code-review:
  extends: {EXTENDS_VALUE}
```

- `{EXTENDS_VALUE}`: 템플릿 매핑 테이블에 따라 결정 (기본: `.soop-review`)

### variables 추가 조건

`--model` 또는 `--custom-context` 옵션이 있을 때만 `code-review` Job에 `variables:` 블록을 추가한다:

```yaml
code-review:
  extends: {EXTENDS_VALUE}
  variables:
    CLAUDE_MODEL: "{MODEL_VALUE}"       # --model 있을 때만
    CUSTOM_CONTEXT: "{CONTEXT_VALUE}"   # --custom-context 있을 때만
```

- `--custom-context` 값이 파일 경로처럼 보이면 (`.`이나 `/`로 시작) `file://` 접두사를 자동으로 붙인다.
  - 예: `--custom-context ".soop-review-context.md"` → `CUSTOM_CONTEXT: "file://.soop-review-context.md"`
  - 예: `--custom-context "이 프로젝트는 MVP"` → `CUSTOM_CONTEXT: "이 프로젝트는 MVP"`

## 3-B: 기존 파일에 병합

**핵심 원칙: 기존 설정을 절대 삭제하지 않고, 필요한 요소만 추가한다.**

Edit 도구를 사용하여 기존 파일을 수정한다. `--dry-run`이면 수정 사항을 코드블록으로 출력만 한다.

### 병합 순서

#### 1. include 추가

- **기존 include가 배열 형태인 경우**: 배열 마지막에 soop-review 항목을 추가
  ```yaml
  include:
    - local: 'existing.yml'    # 기존 유지
    - project: 'soop_ci_policy/ci-templates'    # 추가
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

#### 2. workflow:rules에 merge_request_event 추가

- **기존 workflow:rules가 있고 merge_request_event가 없는 경우**: 기존 rules 맨 앞에 3줄 추가
  ```yaml
  workflow:
    rules:
      - if: $CI_PIPELINE_SOURCE == "merge_request_event"    # 추가
      - if: $CI_COMMIT_BRANCH && $CI_OPEN_MERGE_REQUESTS    # 추가
        when: never                                          # 추가
      # ... 기존 rules 유지 ...
  ```
- **기존 workflow:rules가 있고 merge_request_event가 이미 있는 경우**: 스킵
- **workflow 자체가 없는 경우**: include 블록 뒤에 workflow 블록 생성

#### 3. stages에 review 추가

- **기존 stages가 있고 review가 없는 경우**: 기존 stages 마지막에 추가
  ```yaml
  stages:
    - build      # 기존 유지
    - test       # 기존 유지
    - deploy     # 기존 유지
    - review     # 추가
  ```
- **기존 stages가 있고 review가 이미 있는 경우**: 스킵
- **stages가 없는 경우**: workflow 블록 뒤에 stages 블록 생성

#### 4. code-review Job 추가

파일 하단에 code-review Job 블록을 추가한다. 3-A의 code-review 부분과 동일한 형식.

## 4단계: 결과 안내 (직접 수행)

작업 완료 후 다음을 사용자에게 안내한다:

### 성공 시
```
SOOP Review 설정이 {상태}되었습니다.

파일: {프로젝트경로}/.gitlab-ci.yml
상태: {신규 생성 / 기존 파일에 병합}
템플릿: {extends 값}

추가된 요소:
- [x] include: soop-review 템플릿
- [x] workflow:rules: merge_request_event
- [x] stages: review
- [x] code-review Job

다음 단계:
GitLab 프로젝트 > Settings > CI/CD > Variables에 아래 변수를 등록하세요.
- ANTHROPIC_API_KEY: Claude API 키 (SDK팀 루니께 요청)
- REVIEW_BOT_TOKEN: GitLab Access Token (DevOps 델라께 요청)
두 변수 모두 Masked 체크하여 로그에 노출되지 않도록 하세요.
```

### 이미 적용된 경우
```
SOOP Review가 이미 적용되어 있습니다.

파일: {프로젝트경로}/.gitlab-ci.yml
soop-review/review.gitlab-ci.yml include가 감지되었습니다.
```

### --dry-run인 경우
결과 메시지 앞에 다음을 추가:
```
[Dry Run] 미리보기입니다. 실제 적용하려면 --dry-run 없이 다시 실행하세요.
```
그리고 생성/수정될 내용을 YAML 코드블록으로 출력한다.

## 주의사항

- YAML 문법을 정확히 지켜야 한다. 들여쓰기는 2칸 스페이스.
- 기존 파일의 주석은 최대한 보존한다.
- 기존 파일의 빈 줄 패턴을 유지한다.
- `code-review`라는 이름의 Job이 이미 존재하면, 충돌을 피하기 위해 사용자에게 알리고 확인을 받는다.
- 에이전트(Task tool)를 사용하지 않는다. 모든 작업을 직접 수행한다.
