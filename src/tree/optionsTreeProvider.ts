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
        children: [
          { id: 'catalog-refresh', label: 'Refresh', icon: 'refresh', command: 'copilotCatalog.refresh' },
          { id: 'catalog-filter', label: 'Filter by Catalog', icon: 'filter', command: 'copilotCatalog.filterCatalog' }
        ]
      },
      {
        id: 'presets',
        label: 'Presets',
        icon: 'kebab-vertical',
        children: [
          { id: 'presets-apply', label: 'Apply Preset', icon: 'play', command: 'copilotCatalog.presets.apply' },
          { id: 'presets-save-workspace', label: 'Save Preset from Active (Workspace)', icon: 'save', command: 'copilotCatalog.presets.createWorkspace' },
          { id: 'presets-save-user', label: 'Save Preset from Active (User)', icon: 'account', command: 'copilotCatalog.presets.createUser' },
          { id: 'presets-delete', label: 'Delete Preset (Workspace/User)', icon: 'trash', command: 'copilotCatalog.presets.delete' }
        ]
      },
      {
        id: 'dev',
        label: 'Dev',
        icon: 'tools',
        children: [
          { id: 'dev-open-settings', label: 'Open Settings', icon: 'gear', command: 'copilotCatalog.openSettings' },
          { id: 'dev-create-template', label: 'Create Template Catalog', icon: 'new-folder', command: 'copilotCatalog.dev.createTemplateCatalog' },
          { id: 'dev-add-dir', label: 'Add Catalog Directory…', icon: 'folder-opened', command: 'copilotCatalog.addCatalogDirectory' },
          { id: 'dev-scan-git', label: 'Scan Git Repository…', icon: 'repo', command: 'copilotCatalog.dev.scanGitRepository' },
          { id: 'dev-refresh-git', label: 'Refresh Git Repositories', icon: 'sync', command: 'copilotCatalog.dev.refreshGitRepositories' },
          { id: 'dev-list-git', label: 'List Git Remotes', icon: 'list-unordered', command: 'copilotCatalog.dev.listGitRemotes' }
        ]
      }
    ];
  }
}
