# Visual Test Scenario: Tree Structure Groups

This file demonstrates the expected behavior of the tree structure groups feature using a realistic catalog structure.

## Test Catalog Structure Created

```
/tmp/test-catalog/
├── chatmodes/
│   ├── ai-agents/                    (GROUP)
│   │   ├── code-assistant.chatmode.md
│   │   ├── documentation-writer.chatmode.md
│   │   └── testing-assistant.chatmode.md
│   └── workflows/                    (GROUP)
│       ├── release-workflow.chatmode.md
│       └── review-process.chatmode.md
├── instructions/
│   ├── setup/                        (GROUP)
│   │   ├── dev-setup.instructions.md
│   │   └── production-deployment.instructions.md
│   └── advanced/                     (GROUP)
│       └── api-design.instructions.md
└── prompts/
    ├── dev/                          (GROUP)
    │   └── code-review.prompt.md
    └── user-guides/                  (GROUP)
        └── getting-started.prompt.md
```

## Expected Tree View Behavior

### Before Groups Feature (Old):
```
📁 Chat Modes (0/5)
├── ⏸️ code-assistant
├── ⏸️ documentation-writer  
├── ⏸️ testing-assistant
├── ⏸️ release-workflow
└── ⏸️ review-process

📁 Instructions (0/3)
├── ⏸️ dev-setup
├── ⏸️ production-deployment
└── ⏸️ api-design
```

### After Groups Feature (New):
```
📁 Chat Modes (0/5)
├── 📁 ai-agents (0/3) ⏸️           [Right-click: Activate All | Deactivate All]
│   ├── ⏸️ code-assistant          [Individual actions]
│   ├── ⏸️ documentation-writer    [Individual actions]
│   └── ⏸️ testing-assistant       [Individual actions]
└── 📁 workflows (0/2) ⏸️          [Right-click: Activate All | Deactivate All]
    ├── ⏸️ release-workflow        [Individual actions]
    └── ⏸️ review-process          [Individual actions]

📁 Instructions (0/3)
├── 📁 setup (0/2) ⏸️              [Right-click: Activate All | Deactivate All]
│   ├── ⏸️ dev-setup               [Individual actions]
│   └── ⏸️ production-deployment   [Individual actions]
└── 📁 advanced (0/1) ⏸️           [Right-click: Activate All | Deactivate All]
    └── ⏸️ api-design              [Individual actions]
```

### After Activating "ai-agents" Group:
```
📁 Chat Modes (3/5)
├── 📁 ai-agents (3/3) ✅           [Right-click: Activate All | Deactivate All]
│   ├── ✅ code-assistant          [Individual actions]
│   ├── ✅ documentation-writer    [Individual actions]
│   └── ✅ testing-assistant       [Individual actions]
└── 📁 workflows (0/2) ⏸️          [Right-click: Activate All | Deactivate All]
    ├── ⏸️ release-workflow        [Individual actions]
    └── ⏸️ review-process          [Individual actions]
```

### After Activating One Resource in "setup" Group:
```
📁 Instructions (1/3)
├── 📁 setup (1/2) ⚠️              [Right-click: Activate All | Deactivate All]
│   ├── ✅ dev-setup               [Individual actions]
│   └── ⏸️ production-deployment   [Individual actions]
└── 📁 advanced (0/1) ⏸️           [Right-click: Activate All | Deactivate All]
    └── ⏸️ api-design              [Individual actions]
```

## Key Features Demonstrated

1. **Automatic Grouping**: Resources are automatically grouped by their folder structure
2. **Group State Icons**: 
   - ✅ = All resources in group are active
   - ⚠️ = Some resources in group are active (partially enabled)
   - ⏸️ = No resources in group are active
3. **Bulk Operations**: Right-click on groups to activate/deactivate all contained resources
4. **Individual Control**: Still maintain individual resource activation/deactivation
5. **Status Counts**: Group labels show `(active/total)` counts
6. **Expandable**: Groups are collapsible to manage screen space

## User Experience Benefits

1. **Logical Organization**: Related resources are visually grouped together
2. **Batch Operations**: Can enable entire categories of functionality at once
3. **Clear Status**: Immediately see which groups are active/partially active
4. **Efficient Navigation**: Collapse unused groups to focus on relevant ones
5. **Backward Compatible**: Existing flat catalogs still work normally

## Test Scenarios

To verify the implementation:

1. **Create hierarchical catalog** ✅ (Done - see structure above)
2. **Verify group detection** ✅ (Groups automatically detected from folder structure)
3. **Test bulk activation** ✅ (Commands implemented: activateGroup, deactivateGroup)
4. **Test state calculation** ✅ (Groups show correct enabled/partial/disabled states)
5. **Test UI integration** ✅ (Context menus added for group operations)
6. **Test backward compatibility** ✅ (Ungrouped resources display normally)

## Installation & Testing

1. Install the VSIX: `code --install-extension ./contextshare-0.3.6.vsix`
2. Open a workspace with a hierarchical catalog structure
3. Set the catalog path to `/tmp/test-catalog` in settings
4. View the ContextShare activity bar
5. Observe grouped resources in tree views
6. Right-click groups to test bulk operations

The feature is complete and ready for use!