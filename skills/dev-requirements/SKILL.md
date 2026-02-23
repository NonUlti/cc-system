---
name: dev-requirements
description: 기획서를 읽고 레포지토리를 분석하여 개발 요구사항을 도출
---

요청사항: $ARGUMENTS

너는 파이프라인 오케스트레이터다. 기획서를 읽고 레포지토리 코드를 분석하여 개발 요구사항을 도출한다.

## 파이프라인 구조

```
[1. 입력 수집] → [1.5 섹션 선별] → [2. spec-reviewer] → [3. dev-analyzer (검토결과 반영)] → [4. 결과 저장]
```

## 1단계: 입력 수집 (직접 수행)

`$ARGUMENTS`에서 다음을 파싱한다:
- **기획서 경로**: 첫 번째 인자 (PDF/MD 등)
- **레포지토리**: 두 번째 인자부터 (복수 가능, 공백 구분)
- **옵션**:
  - `--no-review`: 기획서 검토(2단계)를 건너뛰고 3단계로 직행한다 (검토 결과 없이 기획서만으로 요구사항 도출)
  - `--no-filter`: 섹션 선별(1.5단계)을 건너뛰고 전체 텍스트를 그대로 사용한다
  - `--exclude-pages <범위>`: 지정한 페이지를 제외하고 읽는다 (PDF 전용). 이 옵션이 있으면 1.5단계 인터랙티브 선별을 건너뛴다
    - 형식: 쉼표로 구분, 범위는 하이픈 사용. 예: `3,5-8,12`
    - pdftotext 실행 시 해당 페이지를 제외하여 텍스트를 추출한다

### 레포지토리 경로 해석

`~/.claude/skills/dev-requirements/repos.json`을 읽어 등록된 레포 목록을 확인한다.

- 인자가 등록된 이름이면 → JSON에서 경로를 조회하여 변환
- 인자가 `/`로 시작하면 → 직접 경로로 사용
- 인자가 없으면 → AskUserQuestion으로 사용자에게 레포 선택 요청 (등록 목록 + 직접 입력)

**사용 예시:**
```
/dev-requirements 기획서.pdf mobilemembership pc
/dev-requirements 기획서.pdf /Users/cjs/Documents/회사/soop/mobilemembership
/dev-requirements 기획서.pdf mobilemembership --no-review
/dev-requirements 기획서.pdf mobilemembership --no-filter       ← 섹션 선별 없이 전체 처리
/dev-requirements 기획서.pdf mobilemembership --exclude-pages 12-15,20  ← 특정 페이지 제외
/dev-requirements 기획서.pdf              ← 레포 미지정 시 사용자에게 질문
```

### 기획서 읽기

- PDF 파일: Bash로 `pdftotext "파일경로" -` 실행하여 텍스트 추출
  - `--exclude-pages` 옵션이 있으면: 전체 페이지에서 제외 페이지를 뺀 나머지만 추출한다. pdftotext의 `-f`(first page)와 `-l`(last page) 옵션을 페이지 범위별로 반복 실행하여 제외 페이지를 건너뛴 텍스트를 조합한다.
  - 예: 총 20페이지, `--exclude-pages 5-8,15` → p.1-4, p.9-14, p.16-20을 각각 추출하여 합침
- MD/텍스트 파일: Read tool로 직접 읽기 (`--exclude-pages`는 PDF 전용이므로 무시)

## 1.5단계: 섹션 선별 (직접 수행)

기획서 텍스트에서 섹션/목차 구조를 파악하고, 사용자에게 제외할 섹션을 선택받는다.

1. **섹션 추출**: 기획서 텍스트를 분석하여 주요 섹션 목록을 도출한다.
   - 제목/소제목 패턴 (번호 붙은 제목, 굵은 텍스트, 페이지 구분 등)
   - PDF라면 페이지 번호도 함께 표기
2. **사용자 확인**: AskUserQuestion의 multiSelect로 **제외할 섹션**을 물어본다.
   - 질문: "제외할 섹션을 선택하세요 (선택하지 않으면 전체 포함)"
   - 옵션: 추출된 섹션 목록 (최대 4개씩 나눠서 질문, 섹션이 많으면 여러 번)
   - "제외 없음 (전체 포함)" 옵션을 항상 첫 번째로 제공
3. **텍스트 필터링**: 사용자가 선택한 섹션에 해당하는 텍스트를 제거한다.
4. **필터링 결과 안내**: 제외된 섹션 목록과 남은 범위를 사용자에게 간략히 알려준다.

- `--no-filter` 또는 `--exclude-pages` 옵션이 있으면 이 단계를 건너뛴다. (`--exclude-pages`는 이미 1단계에서 페이지 단위로 필터링 완료)
- 필터링된 텍스트를 이후 단계에 전달한다.

## 2단계: spec-reviewer (기획서 검토)

- `~/.claude/agents/spec-reviewer.md` 내용을 읽어서 역할 지시로 전달
- 다음 정보를 프롬프트에 포함:
  - 기획서 텍스트 전문
- `--no-review` 플래그 시 이 단계를 건너뛴다
- **이 단계의 결과(검토 리포트)를 3단계에 전달한다.**

## 3단계: dev-analyzer (개발 요구사항 분석)

- `~/.claude/agents/dev-analyzer.md` 내용을 읽어서 역할 지시로 전달
- 다음 정보를 프롬프트에 포함:
  - 기획서 텍스트 전문
  - 분석 대상 레포지토리 경로 목록
  - **2단계 spec-reviewer의 검토 결과 전문** (`--no-review` 시 생략)
- dev-analyzer는 검토 결과에서 발견된 누락/모호 사항을 고려하여 요구사항을 도출한다.

## 4단계: 최종 저장 (직접 수행)

- dev-analyzer 결과 → `{기획서명}_개발요구사항.md`로 저장
- spec-reviewer 결과 → `{기획서명}_검토리포트.md`로 저장
  - 예: `이용정지자환전.pdf` → `이용정지자환전_개발요구사항.md`, `이용정지자환전_검토리포트.md`
- 사용자가 출력 경로를 별도 지정한 경우 해당 경로에 저장한다.
- 결과 파일 경로를 사용자에게 안내한다.

## 주의사항

- 생성하는 파일은 반드시 trailing newline(`\n`)으로 끝나야 한다. Write 도구 사용 시 content 마지막에 개행을 포함한다.
