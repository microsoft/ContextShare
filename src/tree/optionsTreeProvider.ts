// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import { getVSCode } from '../utils/vscode';
import { CatalogTreeItem } from '../models';

const vscode = getVSCode();

type OptionNode = {
  id: string;
  label: string;
  icon?: string;
  command?: string;
  children?: OptionNode[];
  tooltip?: string;
};

export class OptionsTreeProvider {
  private _onDidChangeTreeData = (vscode ? new vscode.EventEmitter<CatalogTreeItem | void>() : { fire: (_?: any) => {} }) as any;
  readonly onDidChangeTreeData = (this._onDidChangeTreeData as any).event || (() => {});

  refresh() { this._onDidChangeTreeData.fire(); }
  getTreeItem(e: CatalogTreeItem) { return e; }

  getChildren(e?: CatalogTreeItem): CatalogTreeItem[] {
    if (!e) {
      // Root groups
      return this.buildNodes(this.getRootNodes());
    }
    const node: OptionNode | undefined = (e as any).__node;
    if (node?.children?.length) {
      return this.buildNodes(node.children);
    }
    return [];
  }

  private buildNodes(nodes: OptionNode[]): CatalogTreeItem[] {
    return nodes.map(n => {
      const collapsible = n.children && n.children.length > 0;
      const ti = new CatalogTreeItem(n.label, vscode ? (collapsible ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None) : (collapsible ? 1 : 0), { type: collapsible ? 'options-group' : 'options-command' });
      (ti as any).id = n.id;
      (ti as any).__node = n;
      if (n.icon && vscode) (ti as any).iconPath = new vscode.ThemeIcon(n.icon);
      if (n.command && vscode) (ti as any).command = { command: n.command, title: n.label };
      if (n.tooltip) (ti as any).tooltip = n.tooltip;
      ti.contextValue = collapsible ? 'options-group' : 'options-command';
      return ti;
    });
  }

  private getRootNodes(): OptionNode[] {
    return [
      {
        id: 'catalog',
        label: 'Catalog',
        icon: 'library',
        tooltip: 'Manage catalogs and resources',
        children: [
          { id: 'catalog-refresh', label: 'Refresh All Catalogs', icon: 'refresh', command: 'copilotCatalog.refresh', tooltip: 'Reload all resources from all configured catalogs' },
          { id: 'catalog-filter', label: 'Filter by Catalog', icon: 'filter', command: 'copilotCatalog.filterCatalog', tooltip: 'Show resources from selected catalogs only' },
          {
            id: 'git',
            label: 'Git Repositories',
            icon: 'repo',
            tooltip: 'Manage Git-based catalogs',
            children: [
              { id: 'git-discover', label: 'Discover Git Repository…', icon: 'search', command: 'copilotCatalog.dev.scanGitRepository', tooltip: 'Scan a Git repository for a catalog' },
              { id: 'git-refresh', label: 'Refresh Git Repositories', icon: 'sync', command: 'copilotCatalog.dev.refreshGitRepositories', tooltip: 'Refresh all discovered Git repositories' },
              { id: 'git-list', label: 'List Git Remotes', icon: 'list-unordered', command: 'copilotCatalog.dev.listGitRemotes', tooltip: 'List all configured Git remotes' }
            ]
          }
        ]
      },
      {
        id: 'presets',
        label: 'Presets',
        icon: 'kebab-vertical',
        tooltip: 'Manage resource presets',
        children: [
          { id: 'presets-apply', label: 'Apply Preset', icon: 'play', command: 'copilotCatalog.presets.apply', tooltip: 'Activate a collection of resources from a preset' },
          { id: 'presets-save-workspace', label: 'Save Preset from Active (Workspace)', icon: 'save', command: 'copilotCatalog.presets.createWorkspace', tooltip: 'Save the currently active resources as a new workspace preset' },
          { id: 'presets-save-user', label: 'Save Preset from Active (User)', icon: 'account', command: 'copilotCatalog.presets.createUser', tooltip: 'Save the currently active resources as a new user preset' },
          { id: 'presets-delete', label: 'Delete Preset (Workspace/User)', icon: 'trash', command: 'copilotCatalog.presets.delete', tooltip: 'Delete a workspace or user preset' }
        ]
      },
      {
        id: 'dev',
        label: 'Dev',
        icon: 'tools',
        tooltip: 'Developer and advanced options',
        children: [
          { id: 'dev-open-settings', label: 'Open Settings', icon: 'gear', command: 'copilotCatalog.openSettings', tooltip: 'Open the settings for this extension' },
          { id: 'dev-create-template', label: 'Create Template Catalog', icon: 'new-folder', command: 'copilotCatalog.dev.createTemplateCatalog', tooltip: 'Create a new, empty catalog from a template' },
          { id: 'dev-add-dir', label: 'Add Catalog Directory…', icon: 'folder-opened', command: 'copilotCatalog.addCatalogDirectory', tooltip: 'Add a local directory as a catalog' }
        ]
      }
    ];
  }
}
