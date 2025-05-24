# ylog2 Design Document

## Vision

ylog2 reimagines the approach to capturing institutional knowledge in codebases. Instead of relying solely on GitHub PR data, ylog2 creates an interactive, game-like experience that continuously explores codebases and prompts developers to share the "why" behind their code decisions.

## Core Philosophy

### From PR History to Interactive Knowledge Mining

**Current ylog**: Syncs GitHub PRs → AI summarizes → Creates context files  
**ylog2**: Explores codebase → Asks targeted questions → Accumulates knowledge → Synthesizes understanding

### The Game-Like Experience

ylog2 transforms documentation into an engaging, never-ending process where developers:
- Are presented with intelligent, contextual questions about their code
- Can quickly respond through multiple-choice with freeform options
- See their knowledge contributing to growing institutional memory
- Experience a sense of progress and continuous improvement

## High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Code Explorer │    │  Question Engine│    │ Knowledge Store │
│                 │    │                 │    │                 │
│ • Git blame     │◄──►│ • LLM agents    │◄──►│ • Answer log    │
│ • File analysis │    │ • Question gen  │    │ • Synthesis     │
│ • Pattern recog │    │ • User prompts  │    │ • Context files │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ Interactive CLI │
                    │                 │
                    │ • Question UI   │
                    │ • Progress      │
                    │ • Session mgmt  │
                    └─────────────────┘
```

## Core Components

### 1. Code Explorer Agent

**Purpose**: Intelligently explores the codebase to identify areas needing context

**Capabilities**:
- Git blame analysis to identify code ownership and change patterns
- File dependency analysis to understand code relationships
- Pattern recognition for common code structures and architectural decisions
- Hot spot identification (frequently changed files, complex logic)
- Gap analysis (code without sufficient context)

**Data Sources**:
- Git history and blame
- File content and structure
- Existing comments and documentation
- Import/dependency graphs

### 2. Question Engine

**Purpose**: Generates intelligent, contextual questions and manages user interaction

**AI Agent Flow**:
1. **Context Analysis**: Use LLM to understand current code context
2. **Question Generation**: Create targeted questions about "why" decisions were made
3. **User Interaction**: Present multiple-choice questions with freeform options
4. **Answer Processing**: Clean up and validate user responses
5. **Follow-up Logic**: Generate follow-up questions based on responses

**Question Types**:
- **Architectural**: "Why did you choose this pattern/library/approach?"
- **Business Logic**: "What business requirement drove this implementation?"
- **Trade-offs**: "What alternatives did you consider? Why was this chosen?"
- **Dependencies**: "Why is this dependency necessary?"
- **Performance**: "What performance considerations influenced this design?"
- **Security**: "What security concerns does this address?"

### 3. Knowledge Store

**Purpose**: Lightweight, non-intrusive storage of accumulated knowledge

**Storage Strategy Options**:

**Option A: Centralized Log** (Recommended)
```
.ylog2/
├── session.log          # Raw Q&A log
├── knowledge.json       # Synthesized knowledge
├── areas/              # Area-specific context
│   ├── auth.md
│   ├── database.md
│   └── api.md
└── index.json          # Search index
```

**Option B: Inline Comments** (User opt-in)
```typescript
// @ylog2: This authentication approach was chosen because...
// Business context: We needed to support both OAuth and SAML...
// Alternatives considered: JWT-only, but enterprise customers required SAML
function authenticateUser(token: string) {
```

### 4. Interactive CLI Experience

**Purpose**: Seamless, engaging user interface for knowledge gathering

**Session Flow**:
```
$ ylog2
🔍 Exploring codebase... (3s)
📊 Found 15 areas that could use more context

🎯 Let's start with src/auth/middleware.ts (lines 45-67)

❓ Why did you implement rate limiting at the middleware level?

A) Performance - faster than database checks
B) Security - prevent brute force attacks  
C) Compliance - required by our security audit
D) Other (please specify)

[A,B,C,D or custom]: B

📝 Great! Any additional context about the security requirements?
> We had a penetration test that specifically flagged login endpoints...

✅ Added to knowledge base. Impact: Auth security understanding +25%

🎯 Next: src/database/migrations/002_add_indexes.sql
```

## Technical Implementation

### Core Dependencies

**AI & LLM**:
- Vercel AI SDK (existing)
- Ollama for local models (existing)
- Anthropic Claude for cloud (existing)

**Code Analysis**:
- `git` command-line integration
- Simple-git for JavaScript git operations
- AST parsers (TypeScript, JavaScript, Python, etc.)

**CLI Interface**:
- Inquirer.js for interactive prompts
- CLI-progress for progress bars
- Chalk for colors and formatting

### Agent Architecture

```typescript
interface ExplorerAgent {
  exploreCodebase(): Promise<CodeArea[]>
  analyzeArea(area: CodeArea): Promise<AreaAnalysis>
  identifyQuestionableCode(analysis: AreaAnalysis): Promise<QuestionTarget[]>
}

interface QuestionAgent {
  generateQuestion(target: QuestionTarget): Promise<Question>
  presentQuestion(question: Question): Promise<UserResponse>
  processResponse(response: UserResponse): Promise<ProcessedAnswer>
  determineNextQuestion(context: SessionContext): Promise<QuestionTarget | null>
}

interface KnowledgeAgent {
  storeAnswer(answer: ProcessedAnswer): Promise<void>
  synthesizeKnowledge(area: string): Promise<SynthesizedKnowledge>
  updateContextFiles(): Promise<void>
  searchKnowledge(query: string): Promise<KnowledgeResult[]>
}
```

### Parallel Processing Strategy

To keep the experience fast and responsive:

1. **Background Exploration**: While user answers one question, start analyzing the next area
2. **Parallel Synthesis**: Update knowledge files while user is responding
3. **Predictive Loading**: Pre-generate likely follow-up questions
4. **Async Workflows**: Use Promise.all() for concurrent AI calls

```typescript
// Example: Parallel processing while user responds
async function runSession() {
  const currentQuestion = await generateQuestion()
  
  // Start background work while user thinks
  const [userResponse, nextQuestion, updatedSynthesis] = await Promise.all([
    promptUser(currentQuestion),
    generateNextQuestion(),
    updateKnowledgeBase()
  ])
  
  // Process response and continue
  await processAnswer(userResponse)
  // Next iteration uses pre-generated question
}
```

### Configuration System

```json
{
  "ylog2": {
    "dataDir": ".ylog2",
    "storage": {
      "strategy": "centralized", // or "inline"
      "format": "json" // or "markdown"
    },
    "ai": {
      "provider": "ollama",
      "model": "llama3.2",
      "endpoint": "http://localhost:11434"
    },
    "exploration": {
      "maxDepth": 10,
      "ignorePatterns": ["node_modules", ".git", "dist"],
      "focusAreas": ["src", "lib", "app"]
    },
    "questions": {
      "maxPerSession": 20,
      "prioritize": ["recent_changes", "complex_code", "missing_context"],
      "questionTypes": ["why", "alternatives", "tradeoffs", "business"]
    },
    "synthesis": {
      "updateInterval": "after_each_question", // or "session_end"
      "contextFileThreshold": 5 // min answers before generating context file
    }
  }
}
```

## User Experience Design

### Initialization

```bash
$ cd my-project
$ ylog2 init
🎯 Initializing ylog2 in current repository...
📁 Created .ylog2/ directory
⚙️  Generated configuration
🔍 Scanning codebase... found 1,247 files
📊 Identified 8 main areas for exploration
✅ Ready! Run 'ylog2' to start your first session
```

### Session Experience

**Quick Sessions** (5-10 minutes):
- 3-5 targeted questions
- Focus on specific area or recent changes
- Immediate progress feedback

**Deep Dive Sessions** (30+ minutes):
- Comprehensive area exploration
- Follow-up questions and clarifications
- Architecture and design pattern discussions

**Smart Interruption Handling**:
```
⏸️  Session paused (Ctrl+C detected)
📊 Progress: 3/5 questions answered
💾 Saved session state
📝 Knowledge updated with current answers

Resume anytime with: ylog2 resume
```

### Progress Gamification

- **Knowledge Score**: Track how much context has been added
- **Area Coverage**: Visual progress for different code areas
- **Impact Metrics**: Show how answers help future development
- **Streak Tracking**: Encourage regular knowledge-building sessions

## Data Storage & Organization

### File Structure

```
.ylog2/
├── config.json              # Configuration
├── session.log              # Raw Q&A history
├── knowledge.json           # Structured knowledge base
├── areas/                   # Area-specific context
│   ├── auth/
│   │   ├── context.md       # Human-readable summary
│   │   ├── qa.json         # Q&A data for this area
│   │   └── synthesis.json   # AI-generated insights
│   ├── database/
│   └── api/
├── search/
│   ├── index.json          # Search index
│   └── embeddings.json     # Vector embeddings (optional)
└── cache/
    ├── git-analysis.json   # Cached git blame/log data
    └── file-analysis.json  # Cached AST/dependency data
```

### Knowledge Synthesis Format

```json
{
  "area": "src/auth",
  "lastUpdated": "2024-01-15T10:30:00Z",
  "coverage": 0.75,
  "keyInsights": [
    {
      "topic": "Authentication Strategy",
      "insight": "OAuth + SAML hybrid chosen for enterprise compatibility",
      "confidence": 0.9,
      "sources": ["q1", "q3", "q7"]
    }
  ],
  "architecturalDecisions": [
    {
      "decision": "Middleware-based rate limiting",
      "rationale": "Security requirements from penetration testing",
      "alternatives": ["Database-level", "API Gateway"],
      "tradeoffs": "Performance vs. accuracy"
    }
  ],
  "businessContext": [
    {
      "requirement": "Enterprise SSO support",
      "implementation": "SAML provider integration",
      "impact": "Increased enterprise customer adoption"
    }
  ]
}
```

## Integration with Existing ylog

### Migration Strategy

1. **Parallel Development**: ylog2 can coexist with ylog
2. **Data Import**: Import existing PR summaries as baseline knowledge
3. **Gradual Transition**: Teams can use both approaches initially
4. **Unified Context**: Combine PR history with interactive knowledge

### Shared Infrastructure

- **Config Management**: Reuse ylog's configuration patterns
- **AI Providers**: Leverage existing Ollama/Anthropic integration
- **CLI Framework**: Build on Commander.js foundation
- **Database**: Optional shared SQLite for cross-tool insights

## Success Metrics

### Developer Engagement
- **Session Frequency**: How often developers use ylog2
- **Question Completion Rate**: Percentage of questions answered
- **Session Duration**: Time spent in knowledge-building sessions
- **Return Rate**: Developers coming back for multiple sessions

### Knowledge Quality
- **Coverage Metrics**: Percentage of codebase with context
- **Depth Scores**: Quality of explanations and insights
- **Recency**: How up-to-date the knowledge remains
- **Searchability**: Ability to find relevant context quickly

### Development Impact
- **Onboarding Time**: Faster ramp-up for new team members
- **Code Review Quality**: Better understanding leads to better reviews
- **Technical Debt**: Reduced confusion and miscommunication
- **Decision Making**: Faster architectural and design decisions

## Deployment & Distribution

### Installation
```bash
npm install -g @graphite/ylog2
# or
npx @graphite/ylog2 init
```

### Repository Integration
- **Git Hooks**: Optional pre-commit hooks to prompt for context
- **CI Integration**: Automated context freshness checks
- **IDE Extensions**: Future VS Code extension for inline context

### Team Workflows
- **Knowledge Reviews**: Regular sessions to update context
- **Onboarding Sessions**: Guided tours for new team members
- **Architecture Sessions**: Deep dives into system design decisions

## Future Enhancements

### Phase 2: Advanced AI Features
- **Context-Aware Questions**: Use vector embeddings for smarter targeting
- **Cross-Repository Learning**: Share patterns across codebases
- **Automated Insights**: AI-generated architectural recommendations

### Phase 3: Collaborative Features
- **Team Knowledge**: Shared understanding across team members
- **Expert Identification**: Automatically identify domain experts
- **Knowledge Graphs**: Visual representation of code relationships

### Phase 4: Integration Ecosystem
- **Documentation Tools**: Sync with Notion, Confluence, etc.
- **Monitoring Integration**: Connect decisions to production metrics
- **Design Tools**: Link code decisions to design specifications

---

This design creates a fundamentally different approach to institutional knowledge - one that's interactive, engaging, and grows organically with the codebase. The game-like experience ensures developers actually want to participate, while the AI-driven approach ensures the questions are always relevant and valuable.