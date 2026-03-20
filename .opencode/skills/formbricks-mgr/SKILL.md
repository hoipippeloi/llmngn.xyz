---
name: formbricks-mgr
description: Senior Formbricks specialist with deep expertise in survey creation, form management, and API automation. Use when creating new surveys for Hoi Pippeloi, updating existing survey structures and questions, generating single-use links for survey distribution, exporting and backing up survey definitions, implementing conditional question logic, managing survey responses and data, setting up hidden fields and URL parameters, or automating survey workflows.
---

# Formbricks Manager

Senior Formbricks specialist with deep expertise in survey creation, form management, and API automation.

## Role Definition

You are a senior form automation engineer with extensive experience in building and managing surveys using Formbricks. You specialize in creating complex survey structures, implementing conditional logic, managing survey lifecycles, and integrating with the Formbricks Management API. You build reliable, user-friendly forms that collect data effectively.

## When to Use This Skill

- Creating new surveys for Hoi Pippeloi
- Updating existing survey structures and questions
- Generating single-use links for survey distribution
- Exporting and backing up survey definitions
- Implementing conditional question logic
- Managing survey responses and data
- Setting up hidden fields and URL parameters
- Automating survey workflows
- Updating survey-config.json for Formbricks results table integration

## Tool Operation Guidelines

### Working with tools/formbricks-mgr Scripts

**IMPORTANT:** The `tools/formbricks-mgr` directory contains standalone JavaScript/TypeScript scripts for survey operations. Follow these guidelines to avoid errors.

#### Script Location and Structure

```
tools/formbricks-mgr/
├── update-script-name.js           # Standalone update scripts (preferred)
├── verify-script-name.js            # Verification scripts
├── export-script-name.js             # Export scripts
└── forms/
    └── [form-name]/
        ├── survey.json                # Current survey export
        ├── update-script-name.ts     # TypeScript update scripts (if needed)
        └── README.md                   # Survey documentation
```

#### Running Scripts (Preferred Method)

**For standalone scripts in tools/formbricks-mgr:**

```bash
# Navigate to tools/formbricks-mgr directory
cd tools/formbricks-mgr

# Run standalone script (uses ES modules)
node update-script-name.js

# Verify script ran successfully
node verify-script-name.js
```

**Why standalone scripts?**
- No import path issues (everything is in the same directory)
- No module type conflicts with src/
- ES modules work natively with node-fetch
- Simpler to debug and test

#### Using TypeScript Scripts (Alternative)

**For TypeScript scripts in forms/[form-name]/:**

```bash
# Navigate to project root (NOT tools/formbricks-mgr)
cd /path/to/project-root

# Run TypeScript script using tsx
npx tsx tools/formbricks-mgr/forms/[form-name]/update-[form-name].ts
```

**When to use TypeScript vs JavaScript:**
- Use TypeScript for complex survey logic (logic blocks, conditional flows)
- Use JavaScript for simple updates (quick fixes, text changes)
- Always prefer standalone scripts in tools/formbricks-mgr/ for initial work

#### Common Issues and Solutions

**Issue 1: Import Path Errors**
```
Error: Cannot find module '../src/api/formbricks-client'
```

**Cause:** Scripts in tools/formbricks-mgr/forms/[form-name]/ trying to import from '../src/*'

**Solution:**
- For scripts in `tools/formbricks-mgr/` directory, use direct API calls instead of imports
- Create standalone scripts that use `node-fetch` directly
- Or run scripts from project root: `npx tsx tools/formbricks-mgr/forms/[form-name]/script.ts`

**Issue 2: Module Type Warnings**
```
(node:1420) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file is not specified...
```

**Cause:** ES module syntax in .js file without "type": "module" in package.json

**Solution:**
- Use ES module syntax: `import fetch from 'node-fetch';` (not `require`)
- Add `"type": "module"` to package.json if persistent (but not required for one-time scripts)

**Issue 3: TypeScript Build Errors**
```
error TS6059: File '...' is not under 'rootDir'
```

**Cause:** Running TypeScript from wrong directory with wrong tsconfig

**Solution:**
- Don't run `npm run build` in tools/formbricks-mgr
- Use `npx tsx` directly for TypeScript scripts
- Or create standalone JavaScript scripts instead

#### Working with Forms Directory

**Survey Source of Truth:**
- Formbricks API (live survey)
- This is always the most current version

**Local Backup:**
- `tools/formbricks-mgr/forms/[form-name]/survey.json`
- This is exported from Formbricks API
- Contains complete survey definition with all questions, logic blocks, endings

**Best Practices:**

1. **Always fetch from Formbricks API first**
   ```javascript
   const survey = await fetch(`${BASE_URL}/surveys/${SURVEY_ID}`, { ...headers });
   ```

2. **Preserve IDs when updating**
   ```javascript
   const existingQuestions = survey.questions || [];
   const existingQuestionMap = new Map();
   existingQuestions.forEach(q => {
     const headline = q.headline?.default;
     if (headline) existingQuestionMap.set(headline, q);
   });
   ```

3. **Update with complete survey object**
   ```javascript
   const updatedSurvey = {
     ...survey,
     questions: updatedQuestions,
     welcomeCard: newWelcomeCard
   };
   ```

4. **Add logic blocks with correct choice IDs**
   ```javascript
   const jaChoiceId = q4.choices?.find(c => c.label?.default === 'Ja')?.id;
   q4.logic = [{
     conditions: [{
       operator: 'equals',
       leftOperand: { type: 'question', value: q4.id },
       rightOperand: { type: 'static', value: jaChoiceId }
     }],
     actions: [{ id: generateId(), target: q5.id, objective: 'jumpToQuestion' }]
   }];
   ```

5. **Always update survey-config.json after survey changes**
   ```javascript
   const questionMappings = updatedSurvey.questions.map(q => ({
     id: q.id,
     question: q.headline?.default,
     columnName: generateColumnName(q.headline?.default)
   }));

   await fetch('/api/formbricks/survey-config', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       survey: { id: survey.id, name: survey.name },
       questions: questionMappings
     })
   });
   ```

6. **Export survey.json after updates**
   ```javascript
   const fs = await import('fs');
   fs.writeFileSync('forms/[form-name]/survey.json', JSON.stringify(surveyData, null, 2));
   ```

#### Survey Configuration Management

**Automatic Updates (CRITICAL):**

When creating or updating surveys via formbricks-mgr scripts, you MUST:

1. **Update survey-config.json** automatically to ensure Formbricks results table can display question data
2. **Use auto-generated column names** (slugified from question text)
3. **Include complete survey metadata** (ID, name, questions, mappings)

**API Endpoint:**
```
POST /api/formbricks/survey-config
Content-Type: application/json

{
  "survey": {
    "id": "survey-id",
    "name": "Survey Name",
    "questions": [
      {
        "id": "question-id",
        "question": "Question text",
        "columnName": "auto-generated-column-name"
      }
    ]
  }
}
```

**Why this matters:**
- Formbricks results table reads from survey-config.json
- Without updates, results table will show raw question text instead of clean headers
- Column names must match what users see in the results table

#### Quick Reference

**Recommended Script Template:**

```javascript
import 'dotenv/config';
import fetch from 'node-fetch';

const API_KEY = process.env.FORMBRICKS_API_KEY || 'your-api-key-here';
const BASE_URL = 'https://formbricks-production-f895.up.railway.app/api/v1/management';
const SURVEY_ID = 'your-survey-id-here';

async function updateSurvey() {
  try {
    // 1. Fetch current survey
    const survey = await fetch(`${BASE_URL}/surveys/${SURVEY_ID}`, {
      method: 'GET',
      headers: { 'x-api-key': API_KEY, 'Content-Type': 'application/json' }
    });
    const data = await survey.json();

    // 2. Build updated questions with preserved IDs
    const updatedQuestions = [
      // ... preserve existing questions
    ];

    // 3. Update welcome card
    // 4. Add new questions
    // 5. Update logic blocks
    // 6. Update survey
    // 7. Update survey-config.json
    // 8. Export survey.json backup

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

updateSurvey();
```

---

## Core Workflow

1. **Plan survey structure** - Define questions, logic, and user flow
2. **Configure environment** - Set up API keys and environment IDs
3. **Create or update survey** - Use TypeScript builders or direct API calls
4. **Update survey-config.json** - Automatically update question mappings for results table
5. **Test thoroughly** - Validate questions, logic, and user experience
6. **Deploy and share** - Generate links and distribute to users
7. **Monitor responses** - Track submissions and manage data
8. **Maintain and update** - Iterate based on feedback and requirements

## Setup and Configuration

### Environment Setup

```typescript
// src/constants/config.ts
export const FORMBRICKS_CONFIG = {
  apiKey: process.env.FORMBRICKS_API_KEY || 'your-api-key-here',
  baseUrl: process.env.FORMBRICKS_BASE_URL || 'https://app.formbricks.com',
  environmentId: process.env.FORMBRICKS_ENVIRONMENT_ID || 'your-environment-id'
};
```

### Getting Credentials

**API Key:**
1. Navigate to Formbricks account settings
2. Go to "API Keys" section
3. Click "Add Production API Key"
4. Copy the generated key immediately (won't be shown again)

**Environment ID:**
1. In Formbricks, go to Settings
2. Find Environment ID in environment settings
3. Copy for use in configuration

### Installation

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Or run in development mode
npm run dev
```

## Survey Creation and Updates

### Using Survey Builder

```typescript
import { createSimpleSurvey, createSurveyStructure } from './src/builders/survey-builder';
import { FormbricksAPI } from './src/api/formbricks-client';

const api = new FormbricksAPI();

// Simple survey with basic questions
const questions = [
  { question: 'What is your name?', type: 'openText', required: true },
  { question: 'How do you feel?', type: 'multipleChoiceSingle', choices: ['Good', 'Bad', 'Okay'] }
];

const surveyData = createSimpleSurvey(
  'Customer Feedback',
  questions,
  {
    description: 'We value your opinion',
    thankYouMessage: 'Thank you for your feedback!'
  }
);

const result = await api.createSurvey(surveyData);
console.log('Survey created:', result.id);
```

### Advanced Survey Structure

```typescript
const advancedSurvey = createSurveyStructure({
  name: 'Employee Satisfaction',
  type: 'link',
  description: 'Annual employee feedback survey',

  welcomeCard: {
    enabled: true,
    headline: { default: 'Employee Satisfaction Survey' },
    html: { default: '<p>Please help us improve by sharing your feedback.</p>' }
  },

  questions: [
    {
      id: 'q_name',
      type: 'openText',
      headline: { default: 'Your Name' },
      required: true,
      placeholder: { default: 'Enter your name' }
    },
    {
      id: 'q_satisfaction',
      type: 'rating',
      headline: { default: 'How satisfied are you?' },
      required: true,
      min: 1,
      max: 5,
      lowerLabel: { default: 'Very Dissatisfied' },
      upperLabel: { default: 'Very Satisfied' }
    }
  ],

  thankYouCard: {
    enabled: true,
    headline: { default: 'Thank You!' },
    html: { default: '<p>We appreciate your feedback.</p>' }
  },

  showProgressBar: true
});
```

### Updating Existing Surveys

**Best Practice:** Always fetch the existing survey first to preserve question IDs, choice IDs, and configuration.

```typescript
// Check if survey already exists
const surveysResponse = await api.listSurveys();
const surveys = surveysResponse?.data || surveysResponse || [];
const existingSurvey = Array.isArray(surveys)
  ? surveys.find((s) => s.name === SURVEY_NAME)
  : null;

if (existingSurvey) {
  console.log(`✅ Found existing survey with ID: ${existingSurvey.id}`);
  console.log('   Will update instead of creating new survey.\n');
} else {
  console.log('ℹ️  No existing survey found. Will create new survey.\n');
}

// Fetch existing survey to preserve IDs
const currentSurvey = await api.getSurvey(existingSurveyId);

// Preserve existing question IDs by matching questions by headline
const existingQuestions = currentSurvey.questions || [];
const updatedQuestions = newQuestions.map((newQ) => {
  const existingQ = existingQuestions.find((eq) =>
    eq.headline?.default === newQ.headline?.default &&
    eq.type === newQ.type
  );

  // Preserve existing ID if question matches
  if (existingQ) {
    return { ...newQ, id: existingQ.id };
  }

  // New question - will get new ID from Formbricks
  return { ...newQ };
});

// Update survey with preserved IDs
const updatedSurvey = {
  ...currentSurvey,
  questions: updatedQuestions,
  welcomeCard: newWelcomeCard
};

await api.updateSurvey(existingSurveyId, updatedSurvey);
```

### Automatic survey-config.json Updates

**CRITICAL:** When creating or updating surveys via formbricks-mgr, you MUST automatically update `src/routes/tools/formbricks/survey-config.json` to ensure the Formbricks results table can display question data correctly.

```typescript
// After creating/updating survey, automatically update config
const questions = survey.questions.map(q => ({
  id: q.id,
  question: extractQuestionHeadline(q),
  columnName: generateColumnName(extractQuestionHeadline(q))
}));

await fetch('/api/formbricks/survey-config', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    survey: {
      id: survey.id,
      name: survey.name,
      questions
    }
  })
});

console.log('✅ survey-config.json updated automatically');
```

**Example Workflow:**

```typescript
// 1. Create/update survey in Formbricks
const survey = await formbricksService.createSurvey(surveyData);
const surveyId = survey.id;

// 2. Extract questions and generate column names
const questionMappings = survey.questions.map(q => ({
  id: q.id,
  question: q.headline?.default || q.question,
  columnName: generateColumnName(q.headline?.default || q.question)
}));

// 3. Update survey-config.json
const configUpdate = await fetch('/api/formbricks/survey-config', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    survey: {
      id: surveyId,
      name: survey.name,
      questions: questionMappings
    }
  })
});

console.log('✅ Survey created and config updated automatically');
```

### Real-World Example: Updating "Aanvullende Zorgverzekering 2026"

**What we did:**
1. Updated welcome card text with new Dutch content about childcare contribution
2. Changed question from "Heeft u" to "Heb je"
3. Added location selection question after "Achternaam" with 4 Hoi Pippeloi locations
4. Changed "Upload bewijs polis 2026" from text input to file upload type
5. Updated survey-config.json automatically with new question structure

**The workflow:**
```typescript
// Fetch existing survey
const existingSurvey = await api.getSurvey('cml4wxxmi0000pc01cixg0311');

// Build updated questions array
const updatedQuestions = [
  // Preserve IDs of existing questions
  { id: existingSurvey.questions[0].id, headline: { default: 'Voornaam' }, type: 'openText' },
  { id: existingSurvey.questions[1].id, headline: { default: 'Achternaam' }, type: 'openText' },

  // NEW: Location question
  {
    id: generateId(), // Will get new ID
    type: 'multipleChoiceSingle',
    headline: { default: 'Wat is de locatie waar je onder contract staat?' },
    choices: [
      { id: 'choice_0', label: { default: 'Hoi Pippeloi Groningenlaan' } },
      { id: 'choice_1', label: { default: 'Hoi Pippeloi Agaatlaan' } },
      { id: 'choice_2', label: { default: 'Hoi Pippeloi Petersenstraat' } },
      { id: 'choice_3', label: { default: 'Hoi Pippeloi Holding' } }
    ]
  },

  // Preserve ID and update question text
  {
    id: existingSurvey.questions[2].id,
    headline: { default: 'Heb je een aanvullende zorgverzekering afgesloten voor 2026?' }, // Was: "Heeft u"
    type: 'multipleChoiceSingle',
    choices: [/* preserve choice IDs */]
  },

  // NEW: File upload (was openText)
  {
    id: existingSurvey.questions[3].id,
    headline: { default: 'Upload bewijs polis 2026' },
    type: 'fileUpload', // Was: 'openText'
    required: true,
    allowMultipleFiles: false,
    maxFiles: 1,
    fileTypes: ['image/*', '.pdf']
  }
];

// Update welcome card
const updatedSurvey = {
  ...existingSurvey,
  questions: updatedQuestions,
  welcomeCard: {
    enabled: true,
    headline: { default: 'Aanvullende Zorgverzekering 2026' },
    html: {
      default: '<p>Alle werknemers hebben volgens CAO kinderopvang 2025 recht op een extra bijdrage van €8 per maand als men aanvullend verzekerd is voor de zorgverzekering 2026. Deze bijdrage wordt vergoed via het salaris. Via dit formulier vragen we je te bevestigen of je over deze aanvullende verzekering beschikt.</p><p>Heb je een aanvullende zorgverzekering? Upload dan een bewijs zoals een printscreen van je polisblad, zodat we kunnen nagaan of je recht hebt op deze vergoeding.</p><p>Bij vragen neem contact op via Blue.</p>'
    }
  }
};

// Update survey in Formbricks
await api.updateSurvey('cml4wxxmi0000pc01cixg0311', updatedSurvey);

// Extract question mappings and update config
const questionMappings = updatedSurvey.questions.map(q => ({
  id: q.id,
  question: q.headline?.default,
  columnName: generateColumnName(q.headline?.default)
}));

await fetch('/api/formbricks/survey-config', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    survey: {
      id: 'cml4wxxmi0000pc01cixg0311',
      name: 'Aanvullende Zorgverzekering 2026',
      questions: questionMappings
    }
  })
});

console.log('✅ Survey updated and survey-config.json synced');
```

## Question Types

### Supported Question Types

| Type | Description | Use Case |
|------|-------------|----------|
| `openText` | Single-line text input | Names, short answers |
| `longText` | Multi-line text area | Detailed feedback |
| `multipleChoiceSingle` | Single choice from options | Yes/No, selections |
| `multipleChoiceMulti` | Multiple selections | Select all that apply |
| `rating` | Numeric rating scale | Satisfaction scores |
| `nps` | Net Promoter Score (0-10) | Loyalty measurement |
| `cta` | Call to action button | External links, information |
| `consent` | Checkbox agreement | Terms acceptance |
| `pictureChoice` | Image-based selection | Visual preference |
| `date` | Date picker | Scheduling, dates |
| `fileUpload` | File attachment | Document submission, evidence upload |
| `matrix` | Grid-based questions | Comparative ratings |
| `address` | Address input fields | Location data |
| `ranking` | Order items by preference | Prioritization |

### Question Examples

```typescript
// Open text question
{
  id: 'q_name',
  type: 'openText',
  headline: { default: 'Your Name' },
  required: true,
  placeholder: { default: 'Enter your name' },
  buttonLabel: { default: 'Continue' }
}

// Multiple choice question
{
  id: 'q_department',
  type: 'multipleChoiceSingle',
  headline: { default: 'Which department?' },
  required: true,
  choices: [
    { id: 'choice_0', label: { default: 'HR' } },
    { id: 'choice_1', label: { default: 'IT' } },
    { id: 'choice_2', label: { default: 'Finance' } }
  ]
}

// Rating question
{
  id: 'q_satisfaction',
  type: 'rating',
  headline: { default: 'Rate your experience' },
  required: true,
  min: 1,
  max: 5,
  lowerLabel: { default: 'Very Dissatisfied' },
  upperLabel: { default: 'Very Satisfied' }
}

// CTA question (information with button)
{
  id: 'q_info',
  type: 'cta',
  headline: { default: 'Important Information' },
  html: { default: '<p>Read this before continuing.</p>' },
  buttonLabel: { default: 'I understand' }
}

// File upload question (NEW - for evidence, document uploads)
{
  id: 'q_file_upload',
  type: 'fileUpload',
  headline: { default: 'Upload your document' },
  description: { default: 'Please upload required document as proof.' },
  required: true,
  allowMultipleFiles: false,
  maxFiles: 1,
  fileTypes: ['image/*', '.pdf', '.doc', '.docx'],
  maxFileSize: 10 // Optional: Maximum file size in MB
}

// File upload for evidence (real example from Aanvullende Zorgverzekering)
{
  id: 'q_upload_bewijs',
  type: 'fileUpload',
  headline: { default: 'Upload bewijs polis 2026' },
  description: { default: 'Upload een printscreen van je polisblad als bewijs van aanvullende verzekering.' },
  required: true,
  allowMultipleFiles: false,
  maxFiles: 1,
  fileTypes: ['image/*', '.pdf']
}
```

## Conditional Logic

### Display Logic

```typescript
// Show question based on previous answer
{
  id: 'q_hours',
  type: 'openText',
  headline: { default: 'How many hours per week?' },
  required: false,
  displayLogic: {
    condition: 'equals',
    questionId: 'q_contract_type',
    value: 'fixed_hours'
  }
}
```

### Example: Contract Type Logic

```typescript
const questions = [
  {
    id: 'q_contract_type',
    type: 'multipleChoiceSingle',
    headline: { default: 'What type of contract?' },
    required: true,
    choices: [
      { id: 'choice_fixed', label: { default: 'Fixed hours' } },
      { id: 'choice_minmax', label: { default: 'Min-max contract' } },
      { id: 'choice_zero', label: { default: 'Zero hours' } }
    ]
  },
  // Only shown if user selects "Fixed hours"
  {
    id: 'q_fixed_hours',
    type: 'openText',
    headline: { default: 'How many fixed hours?' },
    required: false,
    displayLogic: {
      condition: 'equals',
      questionId: 'q_contract_type',
      value: 'choice_fixed'
    }
  },
  // Only shown if user selects "Min-max contract"
  {
    id: 'q_min_hours',
    type: 'openText',
    headline: { default: 'Minimum hours per week?' },
    required: false,
    displayLogic: {
      condition: 'equals',
      questionId: 'q_contract_type',
      value: 'choice_minmax'
    }
  }
];
```

### Adding Logic Blocks Programmatically

**When updating surveys with conditional flow, you need to:**

1. **Get choice IDs** from the choice selection question
2. **Create logic blocks** that reference those choice IDs
3. **Add logic to questions** before updating the survey

```typescript
// Get choice IDs for logic blocks
const qContractType = questions.find(q => q.headline?.default === 'What type of contract?');
const jaChoiceId = qContractType?.choices?.find(c => c.label?.default === 'Ja')?.id;
const neeChoiceId = qContractType?.choices?.find(c => c.label?.default === 'Nee')?.id;

// Add logic to the choice question
qContractType.logic = [
  {
    id: generateId(),
    actions: [{ id: generateId(), target: 'q_file_upload', objective: 'jumpToQuestion' }],
    conditions: {
      id: generateId(),
      connector: 'and',
      conditions: [{
        id: generateId(),
        operator: 'equals',
        leftOperand: { type: 'question', value: qContractType.id },
        rightOperand: { type: 'static', value: jaChoiceId }
      }]
    }
  },
  {
    id: generateId(),
    actions: [{ id: generateId(), target: 'end_screen', objective: 'jumpToQuestion' }],
    conditions: {
      id: generateId(),
      connector: 'and',
      conditions: [{
        id: generateId(),
        operator: 'equals',
        leftOperand: { type: 'question', value: qContractType.id },
        rightOperand: { type: 'static', value: neeChoiceId }
      }]
    }
  }
];

// Add logic to file upload question
qFileUpload.logic = [{
  id: generateId(),
  actions: [{ id: generateId(), target: 'end_screen', objective: 'jumpToQuestion' }],
  conditions: {
    id: generateId(),
    connector: 'and',
    conditions: []
  }
}];
```

## API Operations

### Initialize API Client

```typescript
import { FormbricksAPI } from './src/api/formbricks-client';

// Use environment configuration
const api = new FormbricksAPI();

// Or pass custom configuration
const api = new FormbricksAPI(
  'your-api-key',
  'https://your-formbricks-instance.com',
  'your-environment-id'
);
```

### Survey CRUD Operations

```typescript
// List all surveys
const surveys = await api.listSurveys();
console.log('Total surveys:', surveys.data.length);

// Get specific survey
const survey = await api.getSurvey('survey-id-here');
console.log('Survey name:', survey.name);

// Create new survey
const newSurvey = await api.createSurvey(surveyData);
console.log('Created survey ID:', newSurvey.id);

// Update survey
await api.updateSurvey('survey-id', {
  name: 'Updated Name',
  status: 'published'
});

// Delete survey
await api.deleteSurvey('survey-id');
```

### Single-Use Links

```typescript
// Generate multiple single-use links
const links = await api.generateSingleUseLinks('survey-id', 10);

links.forEach((link, index) => {
  console.log(`Link ${index + 1}:`, link.url);
});
```

### Response Management

```typescript
// Get responses for a survey
const responses = await api.getSurveyResponses('survey-id');

console.log(`Total responses: ${responses.data.length}`);

// Process response data
responses.data.forEach(response => {
  console.log('Response ID:', response.id);
  console.log('Data:', response.data);
});
```

## Hidden Fields and URL Parameters

### Hidden Fields Configuration

```typescript
const surveyData = createSurveyStructure({
  name: 'Employee Survey',
  type: 'link',
  hiddenFields: {
    enabled: true,
    fieldIds: ['email', 'department', 'employee_id']
  },
  questions: [
    // ... questions
  ]
});
```

### Prefilling Hidden Fields via URL

```typescript
// Base survey URL
const surveyUrl = 'https://app.formbricks.com/s/survey-id';

// Prefill with parameters
const prefilledUrl = `${surveyUrl}?email=user@example.com&department=IT&employee_id=12345`;

// User accesses prefilled URL:
// https://app.formbricks.com/s/survey-id?email=john@hoipippeloi.nl&department=Groningenlaan&employee_id=EMP001
```

### Usage Examples

```typescript
// Generate prefilled link for employee
function generateEmployeeLink(surveyId: string, employee: Employee) {
  const baseUrl = 'https://app.formbricks.com/s';
  const params = new URLSearchParams({
    email: employee.email,
    department: employee.department,
    employee_id: employee.id
  });
  return `${baseUrl}/${surveyId}?${params.toString()}`;
}

// Example usage
const link = generateEmployeeLink('survey-id', {
  email: 'john@hoipippeloi.nl',
  department: 'Groningenlaan',
  id: 'EMP001'
});
console.log('Prefilled link:', link);
```

### Hidden Fields for Hoi Pippeloi

**Common hidden fields for Hoi Pippeloi:**
- `email` - Employee email (always include for identification)
- `employee_id` - Internal employee ID (for HR systems)
- `department` - Work location (Groningenlaan, Agaatlaan, Petersenstraat, Holding)
- `location` - Specific location within department

## Survey File Structure

### Form Directory Structure

```
forms/
└── aanvullende-zorgverzekering-2026/
    ├── README.md                 # Survey metadata and info
    ├── form-fields.md            # Question definitions in markdown
    ├── survey.json               # Complete survey export
    ├── testplan.txt              # Testing checklist
    ├── update-script.ts          # Update script for this form
    └── _archive/                 # Previous versions
```

### Creating a New Form

```bash
# 1. Create form directory
mkdir forms/my-new-form

# 2. Create README.md
echo "# My New Form" > forms/my-new-form/README.md

# 3. Create form-fields.md with question definitions
echo "## Form Fields" > forms/my-new-form/form-fields.md

# 4. Create update script
echo "// Update script" > forms/my-new-form/update-my-form.ts

# 5. Create testplan.txt
echo "# Test Plan" > forms/my-new-form/testplan.txt
```

## Exporting and Backups

### Export Survey to File

```typescript
import { exportSurveyToFile, createSafeFilename } from './src/utils/helpers';

// Get survey
const survey = await api.getSurvey('survey-id');

// Generate safe filename
const filename = createSafeFilename(survey.name);

// Export to JSON
exportSurveyToFile(
  survey,
  `forms/my-form/${filename}.json`,
  survey.name
);

console.log('Exported to:', filename);
```

### Bulk Export All Surveys

```typescript
async function exportAllSurveys() {
  const { data: surveys } = await api.listSurveys();

  for (const survey of surveys) {
    const fullSurvey = await api.getSurvey(survey.id);
    const filename = createSafeFilename(survey.name);
    const path = `exports/${filename}.json`;

    exportSurveyToFile(fullSurvey, path, survey.name);
    console.log(`Exported: ${survey.name} -> ${path}`);
  }
}

exportAllSurveys();
```

## Testing and Validation

### Test Plan Template

```
# Test Plan for [Form Name]

## Functionality Tests
- [ ] Form loads correctly
- [ ] All questions display properly
- [ ] Required validation works
- [ ] Conditional logic triggers correctly
- [ ] Navigation works (back/forward)

## Logic Tests
- [ ] All conditional paths work
- [ ] Hidden fields prefill correctly
- [ ] Thank you screen displays

## API Tests
- [ ] Survey created successfully
- [ ] Single-use links generate
- [ ] Responses save correctly

## Browser Tests
- [ ] Works in Chrome
- [ ] Works in Firefox
- [ ] Works in Safari
- [ ] Mobile responsive

## Integration Tests
- [ ] URL parameters work
- [ ] Hidden fields capture data
- [ ] Webhooks fire correctly
```

### Manual Testing Checklist

```typescript
async function testSurvey(surveyId: string) {
  console.log('=== Testing Survey ===');

  // 1. Verify survey exists
  const survey = await api.getSurvey(surveyId);
  console.log('✓ Survey exists:', survey.name);

  // 2. Check question count
  console.log('✓ Questions:', survey.questions.length);

  // 3. Generate test link
  const links = await api.generateSingleUseLinks(surveyId, 1);
  console.log('✓ Test link:', links[0].url);

  // 4. Test link in browser (manual step)
  console.log('⚠ Manual: Open link and test in browser');

  return survey;
}

testSurvey('survey-id');
```

## Common Patterns

### Employee Onboarding Survey

```typescript
const onboardingSurvey = createSurveyStructure({
  name: 'Employee Onboarding',
  type: 'link',
  description: 'New employee onboarding information',

  hiddenFields: {
    enabled: true,
    fieldIds: ['email', 'employee_id', 'start_date']
  },

  questions: [
    {
      id: 'q_name',
      type: 'openText',
      headline: { default: 'Full Name' },
      required: true
    },
    {
      id: 'q_location',
      type: 'multipleChoiceSingle',
      headline: { default: 'Work Location' },
      required: true,
      choices: [
        { id: 'loc_groningen', label: { default: 'Groningenlaan' } },
        { id: 'loc_agat', label: { default: 'Agaatlaan' } },
        { id: 'loc_petersen', label: { default: 'Petersenstraat' } }
      ]
    },
    {
      id: 'q_contract_type',
      type: 'multipleChoiceSingle',
      headline: { default: 'Contract Type' },
      required: true,
      choices: [
        { id: 'ct_fixed', label: { default: 'Fixed Hours' } },
        { id: 'ct_minmax', label: { default: 'Min-Max' } },
        { id: 'ct_zero', label: { default: 'Zero Hours' } }
      ]
    }
  ],

  thankYouCard: {
    enabled: true,
    headline: { default: 'Welcome to the Team!' },
    html: { default: '<p>We are excited to have you join us.</p>' }
  }
});
```

### Feedback Survey with Rating

```typescript
const feedbackSurvey = createSurveyStructure({
  name: 'Service Feedback',
  type: 'link',

  questions: [
    {
      id: 'q_nps',
      type: 'nps',
      headline: { default: 'How likely are you to recommend us?' },
      required: true
    },
    {
      id: 'q_satisfaction',
      type: 'rating',
      headline: { default: 'Overall Satisfaction' },
      required: true,
      min: 1,
      max: 5,
      lowerLabel: { default: 'Very Dissatisfied' },
      upperLabel: { default: 'Very Satisfied' }
    },
    {
      id: 'q_comments',
      type: 'longText',
      headline: { default: 'Additional Comments' },
      required: false,
      placeholder: { default: 'Share your thoughts...' }
    }
  ]
});
```

### Evidence Collection with File Upload

```typescript
const evidenceSurvey = createSurveyStructure({
  name: 'Document Upload',
  type: 'link',
  description: 'Upload supporting documents',

  questions: [
    {
      id: 'q_employee_id',
      type: 'openText',
      headline: { default: 'Employee ID' },
      required: true,
      placeholder: { default: 'Enter your employee ID' }
    },
    {
      id: 'q_upload_document',
      type: 'fileUpload',
      headline: { default: 'Upload Document' },
      description: { default: 'Please upload PDF, JPG, or PNG file as evidence.' },
      required: true,
      allowMultipleFiles: false,
      maxFiles: 1,
      fileTypes: ['.pdf', 'image/*', '.jpg', '.png'],
      maxFileSize: 5 // 5MB limit
    }
  ]
});
```

## Best Practices

### MUST DO

- Use TypeScript for type safety
- Store API keys in environment variables
- Test all conditional logic paths
- Validate required fields properly
- Use clear, concise question text
- Provide helpful placeholders
- Test on multiple browsers and devices
- Export backups before major changes
- Use safe filenames for exports
- Document hidden fields and URL parameters
- **Automatically update survey-config.json when creating/updating surveys**
- Preserve question and choice IDs when updating existing surveys
- Test file upload questions with actual file types
- Verify conditional logic uses correct choice IDs

### MUST NOT DO

- Hardcode API keys in code
- Commit API keys to version control
- Skip testing conditional logic
- Use ambiguous question wording
- Overload forms with too many questions
- Forget to set required fields
- Ignore mobile responsiveness
- Delete surveys without backup
- Mix up single vs multiple choice types
- Forget to configure hidden fields
- Forget to update survey-config.json after survey changes
- Use incorrect question IDs in logic blocks
- Change file upload from openText without proper configuration

### Question Design

```typescript
// Good: Clear and specific
{
  headline: { default: 'What is your department?' },
  type: 'multipleChoiceSingle',
  required: true,
  choices: [
    { id: 'hr', label: { default: 'Human Resources' } },
    { id: 'it', label: { default: 'Information Technology' } }
  ]
}

// Bad: Vague and unclear
{
  headline: { default: 'Department?' },
  required: false  // Should be required if important
}
```

## Troubleshooting

### API Authentication Issues

**Problem:** `Authentication failed` error

**Solution:**
```bash
# Check API key is set
echo $FORMBRICKS_API_KEY

# Verify API key is active in Formbricks settings
# Ensure key has Management API permissions
```

### Survey Not Accessible

**Problem:** Survey returns 404 or not found

**Solution:**
```typescript
// Check survey status
const survey = await api.getSurvey('survey-id');
console.log('Status:', survey.status);

// Survey must be 'published' to be accessible
await api.updateSurvey('survey-id', { status: 'published' });
```

### Conditional Logic Not Working

**Problem:** Questions not showing/hiding based on answers

**Solution:**
```typescript
// Verify displayLogic structure
{
  displayLogic: {
    condition: 'equals',  // Must match condition type
    questionId: 'q_previous_question',  // Must match exact ID
    value: 'choice_id'  // Must match choice ID, not label
  }
}
```

### File Upload Not Working

**Problem:** File upload not accepting files

**Solution:**
```typescript
// Check type is 'fileUpload' (not 'openText')
{
  type: 'fileUpload',
  headline: { default: 'Upload Document' },
  required: true,
  allowMultipleFiles: false,
  maxFiles: 1,
  fileTypes: ['image/*', '.pdf', '.doc', '.docx'],
  maxFileSize: 10 // Optional: max size in MB
}
```

### survey-config.json Not Updating

**Problem:** Formbricks results table not showing correct column names

**Solution:**
```typescript
// 1. Extract questions from survey
const questions = survey.questions.map(q => ({
  id: q.id,
  question: q.headline?.default,
  columnName: generateColumnName(q.headline?.default)
}));

// 2. Update survey-config.json via API
await fetch('/api/formbricks/survey-config', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    survey: {
      id: survey.id,
      name: survey.name,
      questions
    }
  })
});

// 3. Verify update was successful
console.log('✅ survey-config.json updated');
```

## Performance Optimization

### Batch Operations

```typescript
// Export multiple surveys efficiently
async function batchExportSurvey(surveyIds: string[]) {
  const results = await Promise.all(
    surveyIds.map(async (id) => {
      try {
        const survey = await api.getSurvey(id);
        return { id, survey, success: true };
      } catch (error) {
        return { id, error, success: false };
      }
    })
  );

  results.forEach(({ id, success, survey, error }) => {
    if (success) {
      console.log(`✓ Exported ${id}: ${survey.name}`);
    } else {
      console.error(`✗ Failed ${id}:`, error);
    }
  });
}
```

### Rate Limiting

```typescript
// Implement delay between requests
import { delay } from './src/utils/helpers';

async function createManySurveys(surveyDataArray: any[]) {
  for (const data of surveyDataArray) {
    await api.createSurvey(data);
    await delay(1000); // Wait 1 second between requests
  }
}
```

## Output Templates

### Survey Creation Output

```typescript
Survey Created Successfully!
===========================

Survey ID: cmid2kxgz001vn201w5emfmpq
Name: Employee Onboarding
Status: published
Questions: 12

Share URL: https://app.formbricks.com/s/cmid2kxgz001vn201w5emfmpq
Test Link: https://app.formbricks.com/s/cmid2kxgz001vn201w5emfmpq?email=test@example.com

Hidden Fields:
  - email (prefill with ?email=...)
  - employee_id (prefill with ?employee_id=...)

Next Steps:
  1. Test survey in browser
  2. Generate single-use links if needed
  3. Distribute to users
  4. Monitor responses
  5. Update survey-config.json automatically
```

### Survey Update Summary

```typescript
Survey Updated Successfully!
===========================

Survey ID: cml4wxxmi0000pc01cixg0311
Changes Made:
  - Welcome Card: Updated with new content
  - Questions: 4 → 5
  - Added: "q_location" (multipleChoiceSingle, location selection)
  - Updated: "q_insurance" (headline: "Heeft u" → "Heb je")
  - Changed: "q_upload" (openText → fileUpload)
  - Logic: Updated choice IDs for conditional flow

Exported backup to: forms/my-form/survey-backup-2025-01-15.json

survey-config.json: Updated automatically
```

## Survey Configuration Management

### survey-config.json Structure

The `survey-config.json` file (located at `src/routes/tools/formbricks/survey-config.json`) stores survey metadata and question mappings for the Formbricks results table display.

```json
{
  "surveys": {
    "survey-id": {
      "name": "Survey Name",
      "emailSubject": "Email Subject",
      "emailMessage": "Email message template",
      "questions": [
        {
          "id": "question-id",
          "question": "Full question text",
          "columnName": "auto_generated_column_name"
        }
      ]
    }
  }
}
```

### Automatic Survey Discovery

When using formbricks-mgr to create or update surveys, the system can automatically:

1. **Discover all surveys** from Formbricks API
2. **Extract questions** from each survey
3. **Generate column names** by slugifying question text:
   - Convert to lowercase
   - Replace non-alphanumeric characters with hyphens
   - Limit to 100 characters
   - Example: "What is your name?" → "what-is-your-name"

4. **Populate survey-config.json** with all surveys and their questions

```typescript
// Generate config for all surveys
POST /api/formbricks/survey-config
{
  "surveys": [...] // Array of survey objects from Formbricks API
}
```

### Manual Configuration Updates

You can manually edit `columnName` values in `survey-config.json` to customize table headers without re-generating from the API.

### API Endpoint

Use the survey-config API to generate or update configuration:

```typescript
// Generate config for all surveys
POST /api/formbricks/survey-config
{
  "surveys": [...] // Array of survey objects from Formbricks API
}

// Update single survey configuration
POST /api/formbricks/survey-config
{
  "survey": {
    "id": "survey-id",
    "name": "Survey Name",
    "questions": [...]
  }
}
```

### Automated Config Population

**When creating a new form via formbricks-mgr skill:**

1. **Create survey** in Formbricks using the survey creation API
2. **Generate question mappings** automatically:
   - Extract all questions from the created survey
   - Generate columnName by slugifying question text
   - Create question mappings array
3. **Update survey-config.json** automatically via API:
   ```typescript
   POST /api/formbricks/survey-config
   {
     "survey": {
       "id": "survey-id",
       "name": "Survey Name",
       "questions": [
         {
           "id": "question-id",
           "question": "Question text",
           "columnName": "auto-generated-column-name"
         }
       ]
     }
   }
   ```
4. **Formbricks results page** will automatically:
   - Read columnName from survey-config.json for each question
   - Display columnName as table header instead of question text
   - Allow manual editing of columnName in survey-config.json

### Example Implementation

```typescript
// After creating survey, call API to update config
const survey = await formbricksService.createSurvey(surveyData);

const questions = survey.questions.map(q => ({
  id: q.id,
  question: extractQuestionHeadline(q),
  columnName: generateColumnName(extractQuestionHeadline(q))
}));

await fetch('/api/formbricks/survey-config', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    survey: {
      id: survey.id,
      name: survey.name,
      questions
    }
  })
});

console.log('✅ Survey created and config updated automatically');
```

## Knowledge Reference

**Formbricks API:**
- Management API v1
- Survey endpoints: GET, POST, PUT, DELETE
- Response endpoints: GET, POST, PUT, DELETE
- Single-use link generation
- Hidden field configuration

**Supported Question Types:**
- openText, longText
- multipleChoiceSingle, multipleChoiceMulti
- rating, nps
- cta, consent
- pictureChoice, date, fileUpload
- matrix, address, ranking

**Conditional Logic:**
- Display conditions (equals, not equals, contains)
- Question dependencies
- Multi-path workflows

**Integration Points:**
- URL parameter prefilling
- Hidden fields
- Webhooks
- API authentication
- **survey-config.json synchronization**

## Related Skills

- **spec-execute** - For implementing survey requirements
- **spec-store** - For storing survey specifications
- **Backend Developer** - For API integrations and webhooks
- **UI/UX Designer** - For question design and user flow

## Important Notes

- Always test surveys in multiple browsers before distribution
- Keep backups of survey definitions before major changes
- Use single-use links for sensitive or one-time surveys
- Validate all conditional logic paths
- Document hidden fields and URL parameters for team reference
- Rotate API keys regularly for security
- Monitor survey responses for data quality issues
- Consider user experience when designing question order
- Use clear, simple language in question text
- Test mobile responsiveness for all surveys
- **CRITICAL: Always update survey-config.json when creating or updating surveys**
- Preserve question IDs when updating existing surveys to maintain response data integrity
- Use fileUpload type for evidence/document upload questions, not openText
- Verify fileTypes configuration matches actual expected file types

**Real-World Example: Aanvullende Zorgverzekering 2026 Update**

When we updated this survey, we:

1. ✅ Updated welcome card text with new Dutch content about childcare contribution
2. ✅ Changed question from "Heeft u" to "Heb je" for insurance question
3. ✅ Added location selection question with 4 Hoi Pippeloi locations
4. ✅ Changed "Upload bewijs polis 2026" from openText to fileUpload type
5. ✅ Updated conditional logic with correct choice IDs
6. ✅ Preserved question and choice IDs from existing survey
7. ✅ Updated survey-config.json automatically with new question structure

**The workflow demonstrates all best practices:**
- Preserving IDs when updating existing surveys
- Using proper question types (fileUpload for evidence)
- Implementing conditional logic correctly
- Keeping survey-config.json in sync with Formbricks
- Testing changes before finalizing
