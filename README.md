# 🏦 RD PRO - PostSaver RD

> **India's #1 Digital Ledger & Automation System for Post Office RD Agents.**  
> Streamline client management, track monthly cash/online collections, auto-calculate interest, and launch bulk reminders effortlessly.

---

## 🚀 Overview

**RD PRO (PostSaver RD)** is a secure, full-stack cloud web application engineered specifically for Indian Post Office Recurring Deposit (RD) agents. It completely replaces paper registers, manual ledgers, and cluttered Excel sheets with a robust digital interface. 

With multi-device real-time sync, agents can seamlessly record payments on the go via mobile and review details on a desktop at home without any data loss.

### 🌟 Key Problem Solved
Traditional tracking is prone to calculation errors, missing payment history, and hours of manual verification. **RD PRO** automates the entire compound interest calculation based on official Post Office guidelines, segments payment collections, and connects directly to WhatsApp for 1-click customer reminders.

---

## ✨ Features & Modules

### 🔐 1. Secure Authentication & Multi-Device Cloud Sync
* **User Accounts:** Secure Login/Signup with automated session persistence.
* **Forgot & Reset Password:** Complete email-based reset workflow.
* **Show/Hide Password Toggle:** Added `Eye`/`EyeOff` toggle inside input boxes for accurate mobile typing.
* **Row-Level Security (RLS):** Bulletproof database architecture where each agent can only view and manage *their own* clients' data.

### 📊 2. Post Office RD Ledger (Interactive Excel Grid)
* **Real-time Table:** Instantly search clients by Name, Mobile, or Account Number.
* **Dual-Mode Tracking:** Mark collections distinctly as **[Online]** (Vibrant Green) or **[Cash]** (Calm Blue). Overdue payments are automatically flagged in **Red**.
* **Sub-Surface Logs:** Timestamps and payment modes are securely stored in the background for detailed audits.
* **Bulk Transaction Groups:** Create family/colony groups of 5-10 users and mark the whole group as "Paid" with just **one click**.

### 👤 3. Customer Financial Dossier (Deep Profiles)
* **Demographics:** Records Account Number, Age, Starting Date, and Mobile Number.
* **Auto-Financial Calculator:** Displays Cumulative Investments, Total Interest Earned, and accurate Maturity Values dynamically.
* **Legacy Data Migration:** Entering a historical starting date automatically fills past years as a generic "Paid" state—allowing instant onboarding of old clients.

### 💬 4. WhatsApp Message Studio
* **Dynamic Placeholders:** Create template messages using tags like `{name}`, `{amount}`, and `{month}`.
* **Direct Routing Integration:** Trigger a secure `window.open(https://wa.me/)` link from the client’s profile to open the WhatsApp chat with the text pre-filled.

### 🧮 5. Built-in Financial Tools & Alerts
* **App-Inspired Calculator:** Month-over-month compounding projections and interactive investment-to-profit pie charts.
* **Monthly Notification Alerts:** Auto-trigger collection reminder banners from the 1st to the 5th of every month (with a dismiss toggle).
* **Quick Reference Bracket Matrix:** Readymade calculations for fixed brackets ranging from ₹100 to ₹10,000 for instant on-field consultation.

---

## 🛠️ Tech Stack & Integrations

* **Frontend:** React.js / Next.js
* **Styling:** Tailwind CSS (Responsive Design, Custom High-Contrast Color Palette)
* **Icons:** Lucide React
* **Backend Database & Auth:** Supabase (PostgreSQL with RLS Enabled)
* **Deployment Platform:** Lovable / Vercel

---

## 📁 Database Schema Preview

The backend utilizes structured relational tables guarded by strict security policies:
* **`profiles` / `users`**: Handles core agent details and authentication mapping.
* **`customers`**: Stores investor metadata linked to the respective authenticated `agent_id`.
* **`payments`**: Chronological log of entries, timestamps, and transaction types ([Cash]/[Online]).
* **`groups`**: Clusters client relations for bulk processing actions.

---
