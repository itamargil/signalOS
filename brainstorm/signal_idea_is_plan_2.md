# Signal / Idea OS — Execution Plan

> Working name: **Signal OS** or **Idea OS**. Name can change later.  
> Core objective: turn raw ideas into real-world signal through research, AI-assisted strategy, execution, signal collection, and reporting.

---

## 1. Core Vision

The system takes an initial idea and helps generate signal around it.

```text
Idea
→ Research
→ Strategy
→ Human Review
→ Execution
→ Signal Collection
→ Report
→ Decision
```

The goal is **not** to immediately build MVPs.  
The goal is to build a repeatable machine that answers:

```text
Do people care about this?
Where do they care?
What language do they use?
What content gets attention?
What landing page converts?
What should we try next?
```

The system should eventually become a web dashboard with a backend, worker dispatching, modular services, context-aware agents, prompt control, and signal reporting.

The first version should be runnable with Markdown prompt files, capable agents, quality third-party tools, simple tables, and lightweight infrastructure. Human effort should focus on direction, review, approval, and optional overrides rather than work an agent or existing tool can perform.

---

## 2. Guiding Principles

### 2.1 Ride the LLM Wave

Assume LLMs keep getting better.

Do not overbuild brittle custom intelligence that future models will outperform. Instead, build:

- context infrastructure
- prompt infrastructure
- data pipelines
- tool integrations
- evaluation loops
- human review workflows

The durable asset is not one model’s intelligence. The durable asset is the system that feeds models the right context, data, tools, and constraints.

---

### 2.2 Buy / Use / Build Pragmatically

Use high-quality third-party tools when they save time, provide better data, or avoid unnecessary infrastructure.

But do not overspend prematurely.

Principle:

```text
Use third parties when they create leverage.
Build cheaply when the need is simple, core, or cost-sensitive.
```

Examples:

| Area             | Early Choice                                      | Later Choice                          |
| ---------------- | ------------------------------------------------- | ------------------------------------- |
| Landing pages    | LLM website generation / Lovable / Emergent       | Automated generation + deployment    |
| Analytics        | Plausible / PostHog free tier                     | PostHog / Segment / warehouse         |
| Forms            | Tally / Typeform / custom form                    | Native forms + CRM integration        |
| Social research  | Agent research + Apify or another quality service | Deeper platform/API integrations      |
| Video generation | Runway / Kling / Luma / Fal                       | Provider abstraction and automation   |
| Image generation | OpenAI Images / Ideogram / Fal                    | Provider abstraction and automation   |
| Scheduling       | Buffer / Later / manual approval                  | Platform APIs and automated workflows |

Avoid building expensive infrastructure before workflow validity is proven.
Prefer agent-led discovery and data collection. The human can take over, inspect suggested accounts, or provide additional data whenever useful.

---

### 2.3 Modular Components with Explicit Contracts

Every component should work in isolation.

Each module has:

- defined input
- defined output
- context dependencies
- prompt files or system prompts
- artifact output
- later automation path

Example:

```text
Market Research Service
Input: Idea Context
Output: Market Research Report
```

```text
Landing Page Research Service
Input: Idea Context + Market Research Report
Output: Landing Page Strategy Report
```

Modules should not be tightly coupled. They should pass structured artifacts to each other.

---

### 2.4 AI-Native Does Not Mean LLM-Only

The LLM is not the entire system.

The LLM should use:

- APIs
- MCPs
- social analytics tools
- scraping services
- screenshots
- comments
- search data
- landing page examples
- analytics exports
- databases
- human feedback

Bad:

```text
Ask LLM what works on TikTok.
```

Good:

```text
Collect TikTok examples + engagement data + comments
→ feed into LLM
→ synthesize patterns
→ generate strategy
```

The LLM should reason over evidence, not hallucinate strategy from vibes.

---

### 2.5 Human Control Over Prompts and Execution

The system should be AI-native but not black-box.

Default pattern:

```text
Agent proposes
→ human reviews / edits
→ human approves
→ execution happens
```

Especially early on, nothing important should happen invisibly.

Prompts are first-class artifacts.

Execution limits are also first-class configuration. Before generation or publishing, the human should be able to set quantities, time windows, budgets, schedules, and approval checkpoints.

---

### 2.6 Every Phase Must Be Runnable

Each phase must produce usable signal.

Not:

```text
Phase 0: build infrastructure
Phase 1: build more infrastructure
Phase 2: finally use it
```

Instead:

```text
Phase 0: lightweight, human-directed system works
Phase 1: semi-automated system works
Phase 2: automated system works
Phase 3: scalable system works
```

The workflow stays mostly the same. The amount of automation increases.

---

## 3. System Overview

The system has six major layers.

```text
1. Idea Intake
2. Research Layer
3. Strategy Layer
4. Execution Layer
5. Signal Collection Layer
6. Reporting / Decision Layer
```

---

## 4. Core Workflow

### Step 1: Idea Input

Example ideas:

- AI Handstand Coach
- AI Mental OS
- Natural powders kit
- Coffee beans sample kit
- AI calisthenics trainer
- Mind practice AI influencer

Input should support vague ideas.

Example:

```text
I want to validate an AI handstand coach that watches my form and tells me how to improve.
```

The system turns this into an Idea Context.

---

### Step 2: Research

Research happens before generation.

Four core research services:

1. Market Research Service
2. Social Research Service
3. Landing Page Research Service
4. SEO Research Service

Output must be backed by real data and linked sources. The system should separate evidence from inference, state uncertainty, and say "I don't know" when evidence is insufficient. Agents should use an extensible registry of suitable third-party tools, MCPs, and APIs.

### Step 3: Strategy

The system generates:

- market insight
- social media persona strategy
- content strategy
- landing page strategy
- SEO opportunity strategy
- signal plan

Strategy must be evidence-backed, traceable to the research, and held to a high quality bar. Generic recommendations should be rejected or revised.

---

### Step 4: Human Review

You review/edit:

- research assumptions
- generated prompts
- content prompts
- image prompts
- video prompts
- landing page copy
- landing page design direction
- publishing plan

Before execution, you can configure quantities, budgets, time windows, publishing cadence, and review checkpoints. Generation should happen in small reviewable batches before larger runs.

### Step 5: Execution

Execution may include:

- generating AI influencer content
- generating images
- generating videos
- creating landing page
- deploying landing page
- setting up waitlist
- posting or manually publishing content

---

### Step 6: Signal Collection

Signals include:

- views
- likes
- comments
- saves
- shares
- follower growth
- profile clicks
- landing page visitors
- waitlist signups
- conversion rate
- relevant keyword demand
- search trend direction
- search intent and competition
- Reddit mentions
- repeated pain points
- purchase intent
- DMs
- qualitative comments

The metric model should have a small stable core while allowing agents to add relevant signal types with a definition and source. New metrics should only be added when they improve the decision.

### Step 7: Report

Report answers:

```text
What happened?
What signal did we get?
What did people care about?
What should we try next?
Should this idea continue, pause, pivot, or die?
```

Each end-to-end run is a persistent experiment instance. Its report may create a new iteration that returns to Step 1 with the prior run's evidence, decisions, and unresolved questions. This is idea-specific iteration, not a self-learning system.

## 5. Context Architecture

Agents need shared context so they understand what is happening around them.

There are four primary context layers.

---

### 5.1 Global Context

Stable context about the whole system.

Example:

```text
This system exists to generate real-world signal from business ideas.
It prioritizes learning, fast experiments, human prompt control, and evidence-based strategy.
It does not optimize for perfection. It optimizes for repeated signal generation.
```

Used by every agent.

---

### 5.2 Idea Context

Specific to one idea.

Example:

```text
Idea: AI Handstand Coach
Hypothesis: people learning handstands want fast feedback on form and progression.
Target users: beginner/intermediate calisthenics learners.
Goal: validate demand through social content and landing page waitlist.
```

---

### 5.3 Research Context

Generated by research agents.

Includes:

- market pain report
- social research findings
- landing page research findings
- SEO research findings
- competitor patterns
- audience language
- engagement patterns
- keyword demand and search trends

---

### 5.4 Agent-Specific System Prompt

Defines the agent’s role.

Example:

```text
You are the Social Research Agent.
Your job is to analyze what content is working in this niche and produce evidence-backed recommendations for persona, content pillars, hooks, formats, and posting strategy.
```

---

### 5.5 Approved Working Prompt

Generated by one agent and approved by the human before being used by another agent.

Example:

```text
Create 20 TikTok scripts for an AI handstand coach persona.
Use the following winning patterns from research:
- beginner mistakes
- fear of falling
- side-by-side progress analysis
- comment-bait questions
```

---

## 6. Prompt Management Architecture

Prompts are core product objects.

There are two types.

---

### 6.1 Stable Prompts

These are versioned, reusable system prompts.

Examples:

- `global_context.md`
- `idea_intake_agent.md`
- `market_research_agent.md`
- `social_research_agent.md`
- `landing_page_research_agent.md`
- `influencer_strategy_agent.md`
- `content_generation_agent.md`
- `landing_page_generation_agent.md`
- `signal_report_agent.md`

---

### 6.2 Working Prompts

These are generated for a specific idea and execution.

Examples:

- TikTok content generation prompt
- image generation prompt
- video generation prompt
- landing page copy prompt
- landing page design prompt
- Reddit mining prompt
- report synthesis prompt

Working prompts should be editable and versioned.

---

## 7. Core Services

## 7.1 Idea Intake Service

### Purpose

Turn vague ideas into structured Idea Context.

### Input

```text
Raw idea
Optional notes
Target audience guess
Personal motivation
```

### Output

```json
{
  "idea_name": "AI Handstand Coach",
  "hypothesis": "People learning handstands want fast feedback on form and progression.",
  "target_users": [
    "beginner calisthenics learners",
    "intermediate handstand learners"
  ],
  "possible_signal_channels": ["TikTok", "Instagram", "Reddit", "landing page"],
  "initial_risks": [
    "hard to generate good video feedback",
    "fitness content is crowded"
  ]
}
```

### Phase 0 Fundamental

Markdown prompt file manually pasted into LLM.

### Future Enhancements

- web form
- saved idea records
- auto-created idea context
- idea comparison
- idea scoring

---

## 7.2 Market Research Service

### Purpose

Find pain, desire, language, and existing behavior.

### Sources

- Reddit
- forums
- app reviews
- YouTube comments
- product reviews
- communities
- search results

### Output

```json
{
  "pain_points": [],
  "recurring_questions": [],
  "existing_solutions": [],
  "language_patterns": [],
  "purchase_intent_signals": [],
  "market_risks": []
}
```

### Phase 0 Fundamental

An agent gathers evidence using web research and available third-party tools, then uses an LLM to synthesize it.

Use a Markdown prompt:

```text
Given this idea, identify target communities, search terms, recurring pains, and language patterns.
Link every material claim to a source, distinguish evidence from inference, and synthesize the findings into a Market Research Report.
```

The human may provide additional sources or correct the agent's research.

### Future Enhancements

- Reddit API / Apify scraper
- automated review scraping
- scheduled research jobs
- pain clustering
- frequency scoring
- source-linked citations

---

## 7.3 Social Research Service

### Purpose

Understand what is working on social media before creating an AI influencer or content.

### Sources

- TikTok
- Instagram
- X
- YouTube Shorts
- competitor accounts
- trending posts
- social analytics platforms such as Sprout Social, Buffer, Hootsuite, or similar

### Output

```json
{
  "winning_formats": [],
  "hooks": [],
  "visual_patterns": [],
  "creator_archetypes": [],
  "caption_patterns": [],
  "engagement_benchmarks": [],
  "comment_themes": [],
  "recommended_persona_direction": [],
  "recommended_content_pillars": []
}
```

### Important Feature

Social research may be long-running.

Example:

```text
Track 50 posts for 3 days.
Check engagement velocity.
Analyze which formats continue gaining traction.
```

### Phase 0 Fundamental

The agent or a third-party research service collects:

- 10-30 posts
- 5-10 competitor accounts
- available views/likes/comments and posting dates
- screenshots or links

Research may run for several days to compare post snapshots and engagement velocity. The human can inspect suggested accounts, take over any step, or add manually collected data. If the agent cannot collect reliable data directly, use a quality third party from the start.

### Future Enhancements

- social analytics API integration
- post snapshot workers
- engagement velocity calculation
- competitor account tracking
- automated trend detection
- platform-specific strategy models

---

## 7.4 Landing Page Research Service

### Purpose

Research successful landing pages before generating one.

### Sources

- direct competitors
- adjacent products
- SaaS landing pages
- ecommerce landing pages
- conversion-focused pages
- design galleries
- screenshots
- page copy

### Output

```json
{
  "layout_patterns": [],
  "hero_patterns": [],
  "cta_placement": [],
  "cta_copy": [],
  "section_order": [],
  "color_palettes": [],
  "trust_elements": [],
  "pricing_patterns": [],
  "visual_style": [],
  "recommended_page_structure": []
}
```

These fields form a stable core, not a closed schema. The agent may add relevant findings when they are sourced and useful.

### Granularity

The service should be specific, including:

- where CTA should appear
- whether CTA repeats
- section ordering
- hero layout
- testimonial placement
- color palette
- typography direction
- amount of copy
- trust elements
- FAQ placement
- whether to include video/demo

### Phase 0 Fundamental

An agent discovers direct and adjacent competitors, captures available pages or screenshots, and records source URLs. The human may add or replace examples.

Feed screenshots/copy into LLM with prompt:

```text
Analyze these landing pages for conversion patterns.
Extract layout, CTA placement, color palette, hierarchy, copy strategy, and recommended structure for our idea.
```

### Future Enhancements

- screenshot crawler
- visual extraction with vision models
- palette extraction
- DOM parsing
- section classifier
- landing page pattern database
- A/B test tracking

---

## 7.5 SEO Research Service

### Purpose

Determine whether the idea has relevant search demand and whether that demand is growing, stable, declining, or seasonal.

### Sources

- Google Trends
- keyword research tools
- search engine results
- related and rising queries
- competitor search visibility

### Output

```json
{
  "relevant_keywords": [],
  "search_intent": [],
  "trend_direction": [],
  "seasonality": [],
  "related_queries": [],
  "rising_queries": [],
  "competition_notes": [],
  "content_opportunities": []
}
```

The output should distinguish relative trend data from absolute search volume and state when reliable volume or competition data is unavailable.

### Phase 0 Fundamental

An agent proposes a focused set of relevant keywords and researches their demand, trend direction, intent, seasonality, related queries, and competition using available tools. Findings must include sources and should influence landing page language, content topics, and the overall signal report.

### Future Enhancements

- Google Trends integration
- Google Ads Keyword Planner integration
- Ahrefs / Semrush or similar provider integration
- automated keyword expansion and clustering
- regional demand analysis
- Search Console ingestion after a landing page is live

---

## 7.6 AI Influencer / Content Factory Service

### Purpose

Create an AI-native influencer/content pipeline based on research.

This is not just a planner. It should actually generate content.

### Inputs

- Idea Context
- Market Research Report
- Social Research Report
- SEO Research Report
- approved influencer strategy prompt

### Outputs

- persona
- account name
- bio
- visual identity
- content pillars
- content calendar
- scripts
- captions
- image prompts
- video prompts
- generated images
- generated videos

### Content Pipeline

```text
Research Context
→ Influencer Persona
→ Content Strategy
→ Human Review
→ Content Briefs
→ Human Review
→ Text/Image/Video Generation
→ Human Review
→ Publish / Queue
```

### Phase 0 Fundamental

Use prompt files to direct agents and existing generation tools:

- `influencer_strategy_agent.md`
- `content_brief_agent.md`
- `script_generation_agent.md`
- `image_prompt_agent.md`
- `video_prompt_agent.md`

Prepare a coherent 2-4 week campaign rather than a handful of unrelated assets. Generate small, configurable batches through tools such as Claude/OpenAI, OpenAI Images/Ideogram, and Runway/Kling/Luma. Review each batch before generating more or publishing.

Use SEO findings to inform searchable questions, recurring topics, and content angles without replacing the social research strategy.

### Future Enhancements

- provider abstraction
- image API integration
- video API integration
- voice generation
- automated editing with FFmpeg / Remotion
- content scheduler
- auto-publishing
- engagement collection

---

## 7.7 Landing Page Generation Service

### Purpose

Generate and deploy a landing page based on market, landing page, and SEO research.

### Inputs

- Idea Context
- Market Research Report
- Landing Page Research Report
- SEO Research Report
- approved landing page prompt

### Outputs

- page strategy
- copy
- layout
- design tokens
- CTA
- waitlist form
- deployed page
- analytics tracking

### Phase 0 Fundamental

Use a detailed, research-backed prompt with an LLM website generator or coding agent to generate the complete website, including copy, design, responsive implementation, waitlist form, deployment, and analytics.

Infrastructure may be simple, but the published page must be visually and strategically strong enough to provide a fair test of the idea.

### Future Enhancements

- automated Next.js page generation
- component library
- variant generation
- deployment worker
- A/B testing
- analytics integration
- automatic report ingestion

---

## 7.8 Signal Collection Service

### Purpose

Collect and normalize signals from all channels.

### Signal Types

Social:

- views
- likes
- comments
- shares
- saves
- followers
- profile clicks
- DMs

Landing Page:

- visitors
- signups
- conversion rate
- button clicks
- scroll depth
- email replies

Research:

- pain frequency
- repeated phrases
- competitor density
- purchase intent
- community activity

SEO:

- relevant keyword demand
- trend direction
- seasonality
- search intent
- related and rising queries
- keyword competition

This is a minimum set. Additional signal types may be recorded when they have a clear definition, source, and decision value.

### Phase 0 Fundamental

Use a spreadsheet or Notion table.

Columns:

```text
idea
source
channel
signal_type
value
qualitative_note
url
created_at
```

### Future Enhancements

- Postgres signal table
- analytics API ingestion
- social API ingestion
- SEO data ingestion
- scheduled collectors
- signal normalization
- signal scoring
- dashboards

---

## 7.9 Reporting Service

### Purpose

Turn collected signals into a decision report.

### Output

```text
Idea Report
- Summary
- Research findings
- Social findings
- Landing page findings
- SEO findings
- Signal metrics
- Strongest evidence
- Weakest evidence
- Open questions
- Recommended next experiment
- Continue / pause / pivot / kill
```

### Phase 0 Fundamental

Markdown prompt file that ingests:

- idea context
- research reports
- signal spreadsheet export
- notes

The report must cite its evidence, identify uncertainty, and avoid forcing a confident decision when the available signal is weak.

### Future Enhancements

- auto-generated reports
- weekly scheduled reporting
- cross-idea comparisons
- opportunity scoring
- decision history

---

## 8. Suggested Data Model

Phase 0 can use Markdown files and spreadsheets.

Later, move to Postgres.

### Entities

```text
Idea
GlobalContext
IdeaContext
ResearchReport
PromptTemplate
PromptArtifact
AgentRun
ExecutionJob
GeneratedAsset
LandingPage
Signal
Report
```

---

### Example Tables

#### ideas

```sql
id
name
description
status
created_at
updated_at
```

#### contexts

```sql
id
scope -- global / idea / research
idea_id
content
version
created_at
```

#### prompt_templates

```sql
id
name
agent_type
content
version
created_at
```

#### prompt_artifacts

```sql
id
idea_id
source_agent
target_agent
content
status -- draft / approved / rejected
version
created_at
```

#### agent_runs

```sql
id
idea_id
agent_type
prompt_template_id
input_context_ids
input_artifact_ids
output_artifact_id
model
status
created_at
```

#### signals

```sql
id
idea_id
source
channel
signal_type
signal_value
metadata
url
created_at
```

---

## 9. Phase Plan

# Phase 0 — Lightweight Signal OS

## Goal

Run the entire system with almost no custom software. Agents and quality third-party tools perform the work; the human directs, configures, reviews, approves, and overrides.

The goal is to prove the complete workflow and receive a useful report within one week.

```text
Idea
→ Markdown agents
→ Agent-led research over several days
→ Evidence-backed strategy
→ Configured content and landing page generation
→ Human approval
→ Execution and early signal collection
→ Quality report
```

## Timeline

1 week.

## Tools

- Markdown prompt files
- ChatGPT / Claude with research and tool access
- scraping, browser, MCP, API, or research services as needed
- Google Trends or another keyword research tool
- Google Sheets / Notion
- LLM website generator / coding agent
- Tally / Supabase form
- Vercel
- Buffer / Later or manual approval and posting
- Plausible / PostHog

## Phase 0 Deliverables

### 1. Prompt Folder

```text
/prompts
  global_context.md
  idea_intake_agent.md
  market_research_agent.md
  social_research_agent.md
  landing_page_research_agent.md
  seo_research_agent.md
  influencer_strategy_agent.md
  content_brief_agent.md
  script_generation_agent.md
  image_prompt_agent.md
  video_prompt_agent.md
  landing_page_generation_agent.md
  signal_report_agent.md
```

### 2. Idea Folder

```text
/ideas/ai-handstand-coach
  idea_context.md
  market_research.md
  social_research.md
  landing_page_research.md
  seo_research.md
  influencer_strategy.md
  content_briefs.md
  landing_page_strategy.md
  signal_report.md
```

### 3. Signal Sheet

Simple extensible table:

```text
idea | source | channel | signal_type | value | note | url | date
```

### 4. Landing Page

A complete, high-quality page with:

- headline
- subheadline
- CTA
- waitlist form
- analytics

### 5. AI Influencer Test

Minimum:

- 1 persona
- a researched content strategy
- a prepared 2-4 week campaign
- a small first batch generated and approved
- content published or queued
- early metrics tracked

### 6. Report

A Markdown report answering:

```text
What did we learn?
What signals appeared?
Should we continue?
What should be tested next?
```

## Phase 0 Success Criteria

The system is successful if you can take one idea and produce:

- one market research report
- one social research report
- one landing page research report
- one SEO research report
- one landing page
- one AI influencer/content strategy
- one prepared 2-4 week campaign with an approved first batch
- at least one place collecting signals
- one evidence-backed initial report

The report may conclude that more signal is needed, but it must still provide sourced research, execution results, uncertainty, and a concrete next iteration.

## Phase 0 Future Enhancements

- turn Markdown prompts into app-managed prompt templates
- automate context assembly
- create lightweight dashboard
- persist artifacts in DB

---

# Phase 1 — Lightweight Web Dashboard

## Goal

Move from folders/spreadsheets to a basic dashboard while keeping human review.

```text
Idea input
→ prompt selection
→ agent output saved
→ human approves
→ generated artifacts saved
→ signals recorded
→ report generated
```

## Suggested Stack

- Next.js
- Tailwind
- shadcn/ui
- Supabase Postgres
- Supabase Auth
- Vercel
- simple server actions / API routes
- OpenAI / Anthropic SDK

Avoid complex queues at first unless needed.

## Build Fundamentals

### 1. Idea Dashboard

- create idea
- view idea status
- view related reports/assets/signals

### 2. Prompt Registry

- store prompt templates
- edit prompts
- version prompts
- run prompts manually

### 3. Context Builder

- assemble global context
- assemble idea context
- attach research reports
- feed to LLM

### 4. Artifact Store

- store generated research reports
- store generated strategies
- store working prompts
- store generated copy/assets links

### 5. Signal Entry UI

- manually enter signals
- upload CSV
- link signals to idea/source/channel

### 6. Report Generator

- generate idea report from stored context and signals

## Phase 1 Success Criteria

One idea can move through the dashboard from intake to report.

Manual external execution is still acceptable.

## Phase 1 Future Enhancements

- background jobs
- approval queues
- external API integrations
- automated landing page deployment
- analytics ingestion

---

# Phase 2 — Worker-Based Automation

## Goal

Introduce backend services and worker dispatching.

```text
User clicks Run Research
→ worker executes
→ output saved
→ approval queue
→ next worker runs
```

## Suggested Stack

- Next.js frontend
- FastAPI or Next.js backend
- Postgres
- Redis + BullMQ / RQ
- object storage for assets
- LLM provider abstraction

## Build Fundamentals

### 1. Worker Queue

Job types:

- market_research
- social_research
- landing_research
- influencer_strategy
- content_generation
- landing_page_generation
- signal_report

### 2. Agent Execution Layer

Each agent gets:

```text
Global Context
Idea Context
Research Context
System Prompt
Approved Working Prompt
```

### 3. Approval Queue

Statuses:

```text
draft
needs_review
approved
rejected
executed
```

### 4. Provider Abstractions

Interfaces:

```ts
TextProvider;
ImageProvider;
VideoProvider;
SocialAnalyticsProvider;
LandingPageProvider;
AnalyticsProvider;
```

### 5. Asset Store

Store:

- generated scripts
- images
- videos
- landing page files
- screenshots
- reports

## Phase 2 Success Criteria

At least one research service and one generation service can run through workers and save outputs automatically.

## Phase 2 Future Enhancements

- retry logic
- scheduled jobs
- provider switching
- cost tracking
- run comparison
- model evaluation

---

# Phase 3 — Research Automation and External Data

## Goal

Turn the agent-led research process into repeatable, deeper data pipelines.

## Build Fundamentals

### Market Research Automation

- Reddit API / scraping provider
- review scraping
- YouTube comment collection
- pain clustering

### Social Research Automation

- Sprout Social / Buffer / Hootsuite / platform APIs where practical
- competitor tracking
- post snapshots
- engagement velocity
- winning format extraction

### Landing Page Research Automation

- competitor URL crawler
- screenshot capture
- DOM extraction
- visual analysis
- color palette extraction
- CTA/section detection

### SEO Research Automation

- keyword discovery and clustering
- search trend and seasonality collection
- related and rising query discovery
- search intent and competition analysis
- regional demand analysis

## Phase 3 Success Criteria

Given an idea and a few seed keywords/accounts/URLs, the system can gather enough market, social, landing page, and SEO data to generate evidence-based strategy.

## Phase 3 Future Enhancements

- fully automated competitor discovery
- trend detection
- long-running social observation
- research quality scoring
- source citations

---

# Phase 4 — Execution Automation

## Goal

Automate content and landing page execution.

## Build Fundamentals

### AI Influencer Execution

- generate scripts
- generate captions
- generate image prompts
- generate videos
- generate thumbnails
- prepare posts
- schedule/publish where possible

### Landing Page Execution

- generate Next.js page
- deploy to Vercel
- create waitlist form
- attach analytics
- create experiment variants

### Signal Collection

- social analytics ingestion
- landing page analytics ingestion
- waitlist ingestion
- comment ingestion

## Phase 4 Success Criteria

One idea can automatically produce and launch a landing page and content assets, then collect early signals.

## Phase 4 Future Enhancements

- A/B testing
- multi-platform posting
- automated comment analysis
- adaptive content generation based on performance

---

## 10. One-Week Execution Plan for Phase 0

## Day 1 — Setup and Start the First Run

Create:

```text
/signal-os
  /prompts
  /ideas
  /templates
  /signals
```

Create core prompt files:

- global context
- idea intake
- market research
- social research
- landing page research
- SEO research
- influencer strategy
- content generation
- landing page generation
- report generation

Create signal spreadsheet.

Input the first idea, configure research depth and execution limits, and start market, social, landing page, and SEO research.

---

## Days 2-4 — Research and Strategy

Continue agent-led research, especially social research that benefits from observing posts over several days, while SEO research evaluates keyword relevance and demand trends.

Recommended first idea:

```text
AI Handstand Coach
```

Run:

- idea intake prompt
- market research prompt
- social research prompt
- landing page research prompt
- SEO research prompt

The agents should:

- collect and cite evidence
- identify uncertainty and missing data
- generate influencer, content, landing page, and SEO opportunity strategies
- save outputs as Markdown artifacts

Review the research and approve or edit the strategies and execution limits.

---

## Day 5 — Generate Assets and Landing Page

Create:

- a 2-4 week content campaign
- a small first batch of high-quality social assets
- one complete, high-quality landing page
- one waitlist form
- analytics tracking

Use lightweight infrastructure and strong generation tools:

- LLM website generator or coding agent
- Vercel
- Supabase/Tally
- Plausible/PostHog

---

## Day 6 — Publish and Collect Early Signal

Publish or queue the approved first batch and deploy the landing page.

Start tracking:

- views
- comments
- likes
- saves
- keyword demand and trend findings
- landing visitors
- waitlist signups
- qualitative notes

---

## Day 7 — Generate the Report

Feed signal sheet + all reports into Report Agent.

Produce:

- signal report
- next action recommendation
- workflow friction notes
- a recommendation to continue, pause, pivot, kill, or gather more signal
- the next idea-specific iteration, carrying forward evidence and unresolved questions

The report must be useful even when early execution metrics are limited. It should rely on sourced research, clearly label early signals, and state when more observation is required.

---

## 11. Phase 0 Prompt File Template

Each prompt file should follow this structure:

```md
# Agent Name

## Role

What this agent does.

## Goal

What output this agent must produce.

## Inputs

- Global Context
- Idea Context
- Research Context, if any
- Human notes

## Instructions

Step-by-step instructions.

## Output Format

The exact Markdown or JSON structure expected.

## Quality Bar

What makes the output useful.

## Human Review Questions

Questions for the human to review before approving.
```

---

## 12. Signal Model

Signals should be normalized early.

Minimum schema:

```text
idea
source
channel
signal_type
value
qualitative_note
url
date
```

Example:

```text
AI Handstand Coach | TikTok | social | views | 1200 | beginner mistake hook performed best | url | 2026-06-12
```

```text
AI Handstand Coach | Landing Page | web | waitlist_signup | 7 | people mention form feedback | url | 2026-06-12
```

```text
AI Handstand Coach | Google Trends | SEO | keyword_trend | rising | "handstand coach" interest is increasing | url | 2026-06-12
```

---

## 13. Decision Framework

Each report should end with one of:

```text
Continue
Pause
Pivot
Kill
Need More Signal
```

Do not overinterpret weak data.

Early signal should guide next experiments, not create false certainty.

---

## 14. What Not To Build Yet

Avoid in Phase 0:

- complex dashboard
- full auth
- multi-user support
- custom analytics platform
- complex scraping infrastructure
- fine-tuned models
- custom ML classifiers
- elaborate scoring algorithms

The goal is signal, not infrastructure.

---

## 15. Near-Term North Star

Within one week, you should be able to say:

```text
I can input an idea and direct my Signal OS through a complete run.
Agents research it over several days, generate a quality campaign and landing page, execute an approved first batch, collect early signals, and produce an evidence-backed report.
```

Then the job becomes obvious:

```text
Automate the most painful repeated step.
```

That is how the system should evolve.

---

## 16. Long-Term North Star

Eventually:

```text
Input idea
→ system researches market/social/landing/SEO patterns
→ proposes prompts and strategies
→ human approves
→ system generates landing page and content
→ system publishes or queues assets
→ system collects signals
→ system reports learnings
→ system recommends next experiment
```

The final asset is not one business.

The final asset is a repeatable system for discovering opportunities.
