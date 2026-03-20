---
name: te9-spec
description: Spec-driven development workflow for AI agents. Orchestrates requirements gathering, implementation, testing, and deployment in a structured 6-step process. Use when building software, implementing features, or managing development workflows.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
---

# TE9-Spec: Spec-Driven Development

Transform high-level feature requests into executable TDD task plans.

## Workflow

### Step 1: Create Spec Directory

```bash
mkdir -p .specs/feature-name/
```

### Step 2: Write Complete Spec

Create `.specs/feature-name/spec.md` with all required sections:

| Section | Content |
|---------|---------|
| Feature Overview | 2-3 paragraphs: what, who, problem solved |
| Success Criteria | Measurable outcomes defining "done" |
| Design Goals | Primary (must) and secondary (nice to have) |
| User Experience | 1-2 paragraphs: interaction, journey |
| Design Rationale | 1-2 paragraphs: why this approach, trade-offs |
| Constraints/Assumptions | Technical constraints, business assumptions |
| Functional Requirements | FR-N format, max 6-8, with acceptance criteria |
| Edge Cases | Unusual inputs, failure scenarios |

### Step 3: Generate tasks.json

Break spec into TDD tasks in `.specs/feature-name/tasks.json`:

```json
{
  "project": "feature-name",
  "spec": ".specs/feature-name/spec.md",
  "developmentMethodology": "TDD (RED-GREEN-REFACTOR cycle)",
  "tasks": [
    {
      "id": "core-001",
      "phase": "Core Functionality",
      "title": "Implement feature requirement",
      "description": "FR-1: Description of requirement",
      "acceptanceCriteria": [
        "TDD: Write test for behavior before implementation",
        "TDD: Test fails when feature is missing",
        "TDD: Refactor after test passes"
      ],
      "priority": 1,
      "status": "pending",
      "mapsTo": "FR-1"
    }
  ],
  "tddWorkflow": {
    "enforced": true,
    "cycle": "RED-GREEN-REFACTOR",
    "rules": [
      "Write test first (RED) - test must fail",
      "Write minimal code to pass (GREEN) - no optimization",
      "Refactor only after test passes (REFACTOR) - maintain quality",
      "All tasks must follow TDD cycle as acceptance criteria"
    ]
  }
}
```

### Step 4: Task Structure

Each task includes:

- **id**: Unique identifier (phase-NNN)
- **phase**: Project phase (Setup, Core, Testing, etc.)
- **title**: Short task name
- **description**: What the task does, mapped to spec requirement
- **acceptanceCriteria**: TDD workflow (RED → GREEN → REFACTOR)
- **priority**: 1 (must have), 2 (should have), 3 (nice to have)
- **status**: pending, in_progress, completed, cancelled
- **mapsTo**: Spec requirement (FR-N, Edge Cases, etc.)

### Step 5: TDD Acceptance Criteria Pattern

Every task acceptance criteria follows:

```markdown
- TDD: Write test for [behavior] before implementation
- TDD: Test fails when [condition]
- TDD: Refactor after test passes
```

### Step 6: Execute Development

Use tasks.json to drive development:

1. Load tasks.json
2. For each task (by priority):
   - RED: Write failing test
   - GREEN: Write minimal code
   - REFACTOR: Improve quality
3. Update task status to "completed"
4. Move to next task

## Output Locations

- **Spec**: `.specs/feature-name/spec.md`
- **Tasks**: `.specs/feature-name/tasks.json`

## Differences from spec-writer

| Aspect | spec-writer | te9-spec |
|--------|-------------|----------|
| Spec filename | README.md | spec.md |
| Spec directory | specs/ | .specs/ |
| Tasks | Not generated | tasks.json with TDD |
| Development method | Not specified | TDD enforced |
| Output | Spec only | Spec + executable task plan |

## Example Usage

When user requests a feature:

1. Gather requirements
2. Create `.specs/feature-name/spec.md` (complete spec)
3. Generate `.specs/feature-name/tasks.json` (TDD tasks)
4. Begin development following tasks.json

## Validation Checklist

- [ ] Spec in `.specs/*/spec.md` (not README.md)
- [ ] Tasks in `.specs/*/tasks.json`
- [ ] All tasks have TDD acceptance criteria
- [ ] Tasks mapped to spec requirements (FR-N)
- [ ] Priority ordering for MVP sequencing
- [ ] Edge cases covered in tasks
