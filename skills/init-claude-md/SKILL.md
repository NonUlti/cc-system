---
name: init-claude-md
description: 프로젝트를 탐색하여 적절한 위치에 CLAUDE.md를 자동 생성
---

요청사항: $ARGUMENTS

너는 파이프라인 오케스트레이터다. 프로젝트를 스캔하고 분석하여 적절한 위치에 CLAUDE.md를 자동 생성한다.

## 파이프라인 구조

```
[1. 입력 수집] → [2. codebase-scanner: 스캔+분석] → [3. CLAUDE.md 생성/병합]
```

## 1단계: 입력 수집 (직접 수행)

`$ARGUMENTS`에서 다음을 파싱한다:
- **프로젝트 루트 경로**: 첫 번째 인자 (없으면 현재 작업 디렉토리 사용)
- **옵션**:
  - `--depth <N>`: 탐색 깊이 제한 (기본: 3)
  - `--dry-run`: 실제 파일 생성 없이 어떤 디렉토리에 생성할지만 미리보기
  - `--root-only`: 루트 CLAUDE.md만 생성
  - `--force`: 기존 CLAUDE.md 병합 대신 덮어쓰기

**사용 예시:**
```
/init-claude-md
/init-claude-md --dry-run
/init-claude-md --root-only
/init-claude-md /path/to/project --depth 2
/init-claude-md --force --root-only
```

## 2단계: codebase-scanner 서브에이전트 실행

Task tool로 서브에이전트를 생성한다:
- `~/.claude/agents/codebase-scanner.md` 내용을 읽어서 역할 지시로 전달
- 프로젝트 루트 경로, 깊이 제한, root-only 여부를 전달
- 에이전트가 프로젝트 구조 스캔 + 디렉토리별 분석 + CLAUDE.md 배치 계획까지 수행
- 결과를 JSON으로 반환받음

## 3단계: CLAUDE.md 생성/병합 (직접 수행)

### 3-0. 결과 검증

에이전트 반환값에서 JSON 코드블록을 추출하고 다음을 확인한다:
1. **JSON 파싱**: 유효한 JSON인지 확인한다. 파싱 실패 시 에이전트를 재실행한다.
2. **필수 필드 확인**: `project.name`, `project.tech_stack`, `targets` 배열이 존재하는지 확인한다.
3. **루트 타겟 확인**: `targets[0].path`가 `"."`인지 확인한다.
4. 검증 실패 시 사용자에게 에러를 안내하고 중단한다.

### 3-1. 생성/병합

검증 통과 후, `targets` 배열을 순회하며 각 위치에 CLAUDE.md를 생성한다.

### 생성 규칙

1. **기존 CLAUDE.md가 없는 경우**: 새로 생성
2. **기존 CLAUDE.md가 있는 경우** (기본 동작: 병합):
   - 기존 파일을 Read로 읽는다
   - `##` 헤더 기준으로 섹션을 비교한다:
     - 기존 파일의 `##` 헤더 목록을 추출한다
     - 새로 생성할 내용의 `##` 헤더 목록을 추출한다
     - 기존에 **이미 존재하는 섹션은 건드리지 않는다** (기존 내용 우선)
     - 기존에 **없는 섹션만 파일 하단에 추가한다**
   - `#` 제목(H1)은 기존 것을 유지한다
3. **`--force` 옵션**: 기존 파일을 무시하고 새로 덮어쓴다
4. **`--dry-run` 옵션**: 파일을 생성하지 않고, 어떤 위치에 어떤 내용으로 생성할지 목록만 출력한다

### CLAUDE.md 내용 템플릿

**루트 CLAUDE.md** (`targets[0]` — `path: "."` 사용):

```markdown
# Project Overview
{project.description}

## Tech Stack
- {project.tech_stack[].name}: {project.tech_stack[].version}

## Project Structure
- `{targets[0].structure[].path}` - {targets[0].structure[].role}

## Commands
- Build: `{targets[0].commands.build}`
- Test: `{targets[0].commands.test}`
- Run: `{targets[0].commands.run}`
- Lint: `{targets[0].commands.lint}`

## Conventions
- {targets[0].conventions[]}

## Important Notes
- {targets[0].notes[]}
```

**하위 CLAUDE.md** (`targets[N]` — `path`가 `.`이 아닌 항목):

```markdown
# {디렉토리명}
{targets[N].role}

## Key Files
- `{targets[N].key_files[].file}` - {targets[N].key_files[].role}

## Patterns
- {targets[N].patterns[]}

## Notes
- {targets[N].notes[]}
```

### 생성 후 안내

생성 완료 후 다음을 사용자에게 안내한다:
- 생성/수정된 CLAUDE.md 파일 경로 목록
- 각 파일의 상태 (신규 생성 / 기존 병합 / 덮어쓰기)
- `--dry-run`이면 "미리보기입니다. 실제 생성하려면 `--dry-run` 없이 다시 실행하세요." 안내

## 주의사항

- 빌드 산출물 디렉토리(`node_modules`, `dist`, `build`, `vendor` 등)에는 절대 CLAUDE.md를 생성하지 않는다.
- 빈 섹션(내용이 null이거나 빈 배열)은 CLAUDE.md에 포함하지 않는다.
- Commands 섹션에서 값이 null인 커맨드는 생략한다.
- 병합 시 기존 CLAUDE.md의 포맷/스타일을 최대한 유지한다.
- 생성하거나 수정한 파일은 반드시 trailing newline(`\n`)으로 끝나야 한다. Write 도구 사용 시 content 마지막에 개행을 포함하고, Edit 도구로 파일 끝에 내용을 추가할 때도 마지막 줄 뒤에 개행이 있는지 확인한다.
