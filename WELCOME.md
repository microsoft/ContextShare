<!-- Copyright (c) Microsoft Corporation.
 Licensed under the MIT License. -->
# Welcome to ContextShare! 🎉

Thank you for installing **ContextShare**! You're about to transform how your team manages and shares AI assistant resources in VS Code.

## What You Can Do Now

✨ **Organize AI Resources**: Keep chat modes, instructions, prompts, and tasks in one place  
🤝 **Share with Your Team**: Store everything in Git so your team can collaborate and improve together  
🎩 **Use Hats (Presets)**: Switch between different AI configurations with one click  
🔄 **Stay in Sync**: Activate the exact same setup across different projects and team members  

## Why You Need This (The Problems We Solve)

### 🎯 **Context Control** - No More AI Overwhelm
**The Problem**: Too much context = confused AI. When you load every instruction and prompt at once, your AI assistant gets distracted, burns through tokens, and loses track of what you're actually trying to accomplish.

**Our Solution**: **Selective activation**. Only activate the resources you need for your current task. Code review? Activate review-specific instructions. Bug fixing? Switch to debugging prompts. Keep your AI focused and efficient.

### 🧹 **Context Clarity** - End Contradictory Instructions  
**The Problem**: Multiple context files with conflicting guidance create "context pollution." Your AI gets mixed signals: "Use TypeScript strict mode" vs "Allow any types for rapid prototyping" - which should it follow?

**Our Solution**: **Curated resource sets**. Use Hats to activate only compatible, complementary resources. No more contradictory instructions fighting each other in your AI's context.

### 🤝 **Team Alignment** - Stop Copy-Paste Chaos
**The Problem**: Teams sharing AI resources via Slack, email, or copy-paste leads to version drift, outdated instructions, and inconsistent AI behavior across team members.

**Our Solution**: **Git-based sharing** with version control. Your team's AI resources live in your repo, get reviewed in PRs, and everyone stays in sync automatically.

### ⚡ **Token Efficiency** - Save Money and time, Get Better Results
**The Problem**: Loading unnecessary context wastes tokens and degrades response quality. Why pay for 50 irrelevant instructions when you only need 5 relevant ones?

**Our Solution**: **Just-in-time activation**. Your AI gets exactly the context it needs, nothing more. Better responses, lower costs, happier developers.

## Quick Start (2 Minutes)

### Option 1: Start Fresh 🆕
1. **Open the ContextShare View**: Click the 📚 icon in the Activity Bar (left sidebar)
2. **Create Template**: Click **Dev** → **Create Template Catalog** in the title bar
3. **Explore**: Browse the created `copilot_catalog/` folder with sample resources
4. **Activate**: Right-click any resource and select "Activate" to try it out

### Option 2: Use Existing Catalog 📁
1. **Open the ContextShare View**: Click the 📚 icon in the Activity Bar
2. **Point to Your Catalog**: If you have a catalog elsewhere, go to **Settings** → **ContextShare** → set **Root Catalog Path**
3. **Refresh**: Click the refresh button in the ContextShare view
4. **Start Activating**: Right-click resources to activate them

### Option 3: Team Setup 👥
1. **Clone a repo** with a `copilot_catalog/` folder
2. **Open the ContextShare View**: Click the 📚 icon in the Activity Bar  
3. **Apply Team Preset**: Click **Hats** → **Apply Hat** and choose a team preset
4. **You're Ready**: All team resources are now active and ready to use

## What's Next?

🎯 **Try Hats**: Save your current setup as a Hat (preset) so you can switch back anytime  
📖 **Read the Guide**: Check out [SETUP_GUIDE.md](./SETUP_GUIDE.md) for detailed configuration options  
🔧 **Customize**: Visit **Settings** → **ContextShare** to configure directories and behavior  

## Need Help?

- 📋 **Commands**: Press `Ctrl+Shift+P` and type "ContextShare" to see all available commands
- ⚙️ **Settings**: Go to **File** → **Preferences** → **Settings** → search "ContextShare"
- 🐛 **Issues**: Check the Output panel → "ContextShare" for diagnostic information

## Key Concepts

### 📚 **Catalog**
Your source of truth - a folder containing `chatmodes/`, `instructions/`, `prompts/`, `tasks/`, `mcp/`, and `hats/` subfolders with your AI resources.

### 🎩 **Hats (Presets)**
Named collections of resources that you can activate as a set. Perfect for roles like "Code Reviewer", "HW Designer", or project-specific setups.

### ✅ **Active Resources** 
Resources that are currently copied to your runtime directory (default: `.github/`) where VS Code can use them.

### 🏠 **Target Workspace**
Where your active resources get copied. Usually the same as your current workspace, but can be configured to activate resources elsewhere.

## How It Works: Catalog → Workspace Flow

```
📁 CATALOG SOURCES                     🎯 YOUR LOCAL WORKSPACE
(Source of Truth)                      (Where You Work)

┌─────────────────────────┐            ┌─────────────────────────┐
│    Remote Catalog       │            │ 📂 my-project/         │
│ github.com/team/catalog │   ────┐    │                         │
│ ├── instructions/       │       │    │ ├── src/                │
│ ├── prompts/            │       │    │ ├── .vscode/            │
│ └── hats/               │       │    │ └── .github/  ⬅ ACTIVE │
└─────────────────────────┘       │    │     ├── 📋 instructions/ │
                                  │    │     ├── 💬 prompts/     │
┌─────────────────────────┐       │    │     └── 🎩 chatmodes/   │
│    Local Catalog        │       │    └─────────────────────────┘
│ ./copilot_catalog/      │   ────┤             ⬆️
│ ├── chatmodes/          │       │      🔄 ACTIVATE 
│ ├── instructions/       │       │    
│ ├── prompts/            │       │
│ └── tasks/              │   ────┘
└─────────────────────────┘

🎩 HAT PRESETS: Apply multiple resources at once
   "Frontend Dev" → activates 5 resources instantly
   "Code Review"  → activates 3 different resources
```

**The Magic**: Resources stay in your catalog (versioned, shared), but get copied to `.github/` only when you need them active in VS Code.

---

> 💡 **Pro Tip**: Start by creating a simple Hat with just a few resources, then gradually add more as you discover what works best for your workflow.
