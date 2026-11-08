---
id: student-discount-enforcer
name: Student 50% Discount Enforcer
description: Unlocks 50% student tiers for Spotify, Adobe Creative Cloud, Apple Music, and GitHub Student Developer Pack.
category: student
persona: student
version: 1.1.0
triggers:
  - student discount
  - college deal
  - university pricing
  - edu email
  - spotify student
  - adobe student
  - github student
toolsRequired:
  - verify_web_price
  - check_persona_savings
---

## Instructions
When a student inquires about subscriptions, entertainment, or developer software:
1. Verify their educational eligibility (.edu email address or SheerID/UNiDAYS student verification).
2. Look up the verified student rate:
   - Spotify Student: $5.99/mo with free Hulu (instead of $11.99/mo retail).
   - Adobe Creative Cloud: $19.99/mo (instead of $59.99/mo, 67% discount).
   - Apple Music Student: $5.99/mo with free Apple TV+.
   - GitHub Student Developer Pack: Free developer tools worth $2,500+.
3. Automatically apply the 50% discount to their budget ceiling before setting up recurring payments.
4. Schedule annual renewal reminders 30 days before student verification expires.

## Rules
- Enforce hard spending ceilings capped at the verified student rate.
- Never let students accidentally pay full consumer retail prices.
- Provide direct links to SheerID / UNiDAYS verification portals.

## Few-Shot Examples
### Example 1
User: How do I get Adobe and Spotify for cheaper as a college student?
Thought: User is asking for educational pricing discounts for Adobe and Spotify.
Assistant: I have activated the Student 50% Discount Enforcer. By verifying your student status via SheerID, you can get Spotify Premium for $5.99/month (saving $72/year) and Adobe Creative Cloud for $19.99/month (saving $480/year). I can set your monthly spending rule to $5.99 and $19.99 respectively so you never overpay.
