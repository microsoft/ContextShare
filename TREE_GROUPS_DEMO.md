# Tree Structure Groups Feature Demo

This document demonstrates the new hierarchical tree structure groups feature implemented for ContextShare.

## Feature Overview

The tree structure groups feature allows organizing instructions, chatmodes, and prompts in a hierarchical structure with the ability to enable/disable groups as a unit.

## Implementation Details

### Core Changes Made:

1. **Extended Resource Model**
   - Added `groupPath` property to track folder-based organization
   - Resources now automatically detect their group based on folder structure

2. **New ResourceGroup Interface**
   - Manages hierarchical groups with enable/disable states
   - Supports nested groups for complex organization
   - Tracks partially enabled states (some resources active, some inactive)

3. **Enhanced Resource Discovery**
   - `extractGroupPath()` method extracts group information from file paths
   - Example: `chatmodes/ai-agents/code-assistant.chatmode.md` → group: `ai-agents`
   - Example: `prompts/workflows/advanced/setup.prompt.md` → group: `workflows/advanced`

4. **Updated Tree Providers**
   - CategoryTreeProvider now displays groups as collapsible folder nodes
   - Group nodes show activation status with appropriate icons
   - Resources are organized under their respective groups

5. **Bulk Operations**
   - New commands: `copilotCatalog.activateGroup` and `copilotCatalog.deactivateGroup`
   - Context menus on group items for easy bulk operations
   - Recursive activation/deactivation of all resources in a group and its children

## Example Catalog Structure

```
copilot_catalog/
├── chatmodes/
│   ├── ai-agents/                    ← Group: "ai-agents"
│   │   ├── code-assistant.chatmode.md
│   │   ├── testing-assistant.chatmode.md
│   │   └── documentation-writer.chatmode.md
│   ├── workflows/                    ← Group: "workflows"
│   │   ├── review-process.chatmode.md
│   │   └── release-workflow.chatmode.md
│   └── simple.chatmode.md            ← Ungrouped (shows directly)
├── instructions/
│   ├── setup/                        ← Group: "setup"
│   │   ├── dev-setup.instructions.md
│   │   └── production-deployment.instructions.md
│   └── advanced/                     ← Group: "advanced"
│       └── api-design.instructions.md
└── prompts/
    ├── dev/                          ← Group: "dev"
    │   └── code-review.prompt.md
    └── user-guides/                  ← Group: "user-guides"
        └── getting-started.prompt.md
```

## Tree View Display

The new tree structure will display as:

```
📁 Chat Modes (2/5)
├── 📁 ai-agents (1/3) ✅             ← Partially enabled group
│   ├── ✅ code-assistant             ← Active resource
│   ├── ⏸️ testing-assistant          ← Inactive resource
│   └── ⏸️ documentation-writer       ← Inactive resource
├── 📁 workflows (0/2) ⏸️             ← Disabled group
│   ├── ⏸️ review-process             ← Inactive resource
│   └── ⏸️ release-workflow           ← Inactive resource
└── ✅ simple                         ← Ungrouped active resource

📁 Instructions (1/3)
├── 📁 setup (1/2) ✅                 ← Partially enabled group
│   ├── ✅ dev-setup                  ← Active resource
│   └── ⏸️ production-deployment      ← Inactive resource
└── 📁 advanced (0/1) ⏸️              ← Disabled group
    └── ⏸️ api-design                 ← Inactive resource
```

## Group State Management

Groups automatically calculate their state based on their resources:

- **Enabled** (✅): All resources in the group are active
- **Partially Enabled** (⚠️): Some but not all resources are active  
- **Disabled** (⏸️): No resources in the group are active

## Context Menu Operations

Right-clicking on a group provides:
- **"Group: Activate All"** - Activates all resources in the group and its children
- **"Group: Deactivate All"** - Deactivates all resources in the group and its children

## Backward Compatibility

- Resources without groups (directly in category folders) display normally
- Existing catalogs continue to work without modification
- Flat catalog structures remain unchanged

## Benefits

1. **Better Organization**: Large catalogs can be logically organized into related groups
2. **Bulk Operations**: Enable/disable related resources together with one click
3. **Visual Clarity**: Clear hierarchy makes navigation easier
4. **State Visibility**: Quickly see which groups are active/inactive
5. **Scalability**: Handles complex catalogs with many resources efficiently

## Testing Results

- ✅ Group path extraction works correctly for nested structures
- ✅ Resources are properly assigned to groups based on folder structure
- ✅ Group state calculation correctly handles partial activation
- ✅ Bulk activate/deactivate operations work recursively
- ✅ Ungrouped resources continue to display normally
- ✅ Context menus provide appropriate group operations

The feature is fully implemented and ready for use!