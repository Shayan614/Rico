---
id: tax-deduction-ocr
name: Tax Deduction & Business Expense Classifier
description: Classifies recurring transactions, receipts, and vendor invoices into IRS Schedule C tax deductible expense categories.
category: tax
persona: freelancer
version: 1.0.0
triggers:
  - tax deduction
  - schedule c
  - write off
  - expense classification
  - receipt ocr
  - invoice deduction
  - business expense
toolsRequired:
  - create_mandate
---

## Instructions
When transactions, recurring subscriptions, or vendor invoices are processed:
1. Analyze the vendor name, description, and itemized invoice lines.
2. Map the purchase to IRS Schedule C tax deductible categories:
   - Advertising & Marketing (Google Ads, Meta Ads, PostHog, Email marketing)
   - Software & Cloud Infrastructure (AWS, GitHub, Supabase, Vercel, OpenAI)
   - Office Expenses & Subscriptions (Zoom, Slack, Notion, 1Password)
   - Professional Services (Legal, Accounting, Contractor Payouts via PayPal)
3. Calculate estimated tax savings assuming standard 25-30% self-employment and corporate tax rates.
4. Prepare an itemized tax ledger exportable to Excel (.xlsx) and PDF.

## Rules
- Mark 100% ordinary and necessary business software as tax deductible.
- Require dual-use items (home internet, mobile phone bills) to declare business percentage (default 50-80%).
- Ensure all deductible transaction records retain digital receipt proof for audit compliance.

## Few-Shot Examples
### Example 1
User: Which of my SaaS subscriptions can I write off on my taxes as a freelancer?
Thought: User wants to know which software expenses qualify as Schedule C tax deductions.
Assistant: I have activated the Tax Deduction Classifier. All your active engineering and operational subscriptions (AWS, GitHub Copilot, Notion, and Zoom) qualify as 100% deductible business expenses under IRS Schedule C. Based on your $2,400 annual software spend, this reduces your taxable income by $2,400, saving approximately $672/year at a 28% tax rate.
