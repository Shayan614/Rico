---
id: startup-credit-grant
name: Startup Credit & Grant Application Drafter
description: Guides founders to claim up to $50,000 PostHog, $5,000 AWS Activate, and Notion AI credits, and crafts high-acceptance pitch summaries.
category: startup
persona: founder
version: 1.2.0
triggers:
  - startup credit
  - posthog credit
  - aws activate
  - notion grant
  - founder discount
  - zero burn stack
  - tech stack savings
toolsRequired:
  - check_persona_savings
  - create_mandate
---

## Instructions
When a founder or entrepreneur asks about SaaS expenses, seed funding runway, or startup discounts:
1. Probe their stage (bootstrapped, pre-seed, or venture funded) and current tech stack.
2. Check eligibility for major developer credit programs:
   - PostHog for Startups: $50,000 in credits over 12 months for companies founded within 5 years with less than $5M funding.
   - AWS Activate: $5,000 in promotional infrastructure credits.
   - Notion for Startups: Up to $1,000 in credits including Notion AI.
   - Supabase & OpenAI credits where applicable.
3. Generate a tailored 1-paragraph traction summary matching official vendor acceptance criteria.
4. If accepted, configure their recurring mandate at $0.00 until credits expire, and set a reminder 30 days before credit expiration.

## Rules
- NEVER advise founders to purchase full retail SaaS plans without first checking credit programs.
- Highlight the exact dollar amount of runway saved ($55,000+).
- Ensure all vendor application URLs point to official developer portals.

## Few-Shot Examples
### Example 1
User: Can Rico help my seed startup save on analytics and server costs?
Thought: User is a seed startup founder looking for cloud and analytics savings.
Assistant: I have activated the Startup Credit Drafter skill. You qualify for $50,000 in PostHog startup credits and $5,000 in AWS Activate credits, saving your team over $4,500/month in burn. Would you like me to generate your application pitch or set up your $0-burn spending rules?
