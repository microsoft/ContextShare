/// <reference path="./shims-node.d.ts" />

import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import { Repository, Resource, ResourceCategory, ResourceState } from './models';
import { FileService } from './services/fileService';
import { HatService } from './services/hatService';
import { ResourceService } from './services/resourceService';
import { CategoryTreeProvider } from './tree/categoryTreeProvider';
import { OverviewTreeProvider } from './tree/overviewTreeProvider';
import { getCatalogDisplayName } from './utils/display';
import { preserveFileWithVariant } from './utils/fileOperations';
import { handleErrorWithNotification, getErrorMessage } from './utils/errors';

// Lightweight logging helper (avoids creating multiple channels)
let logChannel: vscode.OutputChannel | undefined;
const LOG_FILENAME = 'copilot-catalog-debug.log';
let enableFileLogging = false;
let logFilePath: string | undefined;
async function log(msg: string){
	const line = `[${new Date().toISOString()}] ${msg}`;
	try {
		if(!logChannel){ logChannel = vscode.window.createOutputChannel('Copilot Catalog'); }
		logChannel.appendLine(line);
		// Optional mirror to a log file under user global storage (not in workspace)
		if(enableFileLogging && logFilePath){
			try {
				await fs.mkdir(path.dirname(logFilePath), { recursive: true });
				await fs.appendFile(logFilePath, line + '\n');
			} catch { /* ignore file logging errors */ }
		}
	} catch { /* ignore logging errors */ }
}

async function discoverRepositories(runtimeDirName: string): Promise<Repository[]> {
	const repos: Repository[] = [];
	const config = vscode.workspace.getConfiguration();
	const catalogDirectories = config.get<Record<string, string>>('copilotCatalog.catalogDirectory', {});

	function normalizeFsPath(p: string): string {
		// Ensure consistent separators so tests comparing Windows paths don't fail due to stray '/'
		if(process.platform === 'win32'){
			return p.replace(/\\+/g,'\\').replace(/\//g,'\\');
		}
		return p;
	}
	
	// If no catalog directories are configured, try to find default ones in workspace folders
	if (Object.keys(catalogDirectories).length === 0) {
		const folders = vscode.workspace.workspaceFolders || [];
		for (const folder of folders) {
			const root = folder.uri.fsPath;
			const catalogPath = path.join(root, 'copilot_catalog'); // Default fallback
			const runtimePath = path.join(root, runtimeDirName);
			try {
				await vscode.workspace.fs.stat(vscode.Uri.file(catalogPath));
				repos.push({
					id: path.basename(root),
					name: path.basename(root),
					rootPath: root,
					catalogPath,
					runtimePath,
					isActive: true
				});
			} catch { /* not a catalog repo */ }
		}
	} else {
		// Use explicitly configured catalog directories
		for (const [catalogPath, displayName] of Object.entries(catalogDirectories)) {
			try {
				// Handle both absolute and relative paths
				let absoluteCatalogPath: string;
				if (path.isAbsolute(catalogPath)) {
					absoluteCatalogPath = catalogPath;
				} else {
					const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
					if (!workspaceFolder) continue;
					absoluteCatalogPath = path.join(workspaceFolder.uri.fsPath, catalogPath);
				}
				
				await vscode.workspace.fs.stat(vscode.Uri.file(absoluteCatalogPath));
				
				// Determine the repo root and runtime path based on target workspace setting
				let repoRoot: string;
				let runtimePath: string;
				
				// Check if targetWorkspace is explicitly set
				const targetWorkspace = config.get<string>('copilotCatalog.targetWorkspace');
				if (targetWorkspace && targetWorkspace.trim()) {
					// When targetWorkspace is set, use it as the repository root
					repoRoot = targetWorkspace.trim();
					runtimePath = path.join(repoRoot, runtimeDirName);
				} else {
					// Fallback to old logic when no targetWorkspace is set
					if (path.basename(absoluteCatalogPath).toLowerCase() === 'copilot_catalog') {
						// Traditional structure: repo/copilot_catalog -> repo root is parent
						repoRoot = path.dirname(absoluteCatalogPath);
						runtimePath = path.join(repoRoot, runtimeDirName);
					} else {
						// Direct catalog directory: use catalog directory as repo root
						repoRoot = absoluteCatalogPath;
						runtimePath = path.join(repoRoot, runtimeDirName);
					}
				}
				
				const repoName = displayName || path.basename(absoluteCatalogPath);
				
				// Normalize paths for consistency across platforms & tests
				repos.push({
					id: path.basename(repoRoot) + '_' + path.basename(absoluteCatalogPath),
					name: repoName,
					rootPath: normalizeFsPath(repoRoot),
					catalogPath: normalizeFsPath(absoluteCatalogPath),
					runtimePath: normalizeFsPath(runtimePath),
					isActive: true
				});
			} catch { /* invalid catalog path */ }
		}
	}
	return repos;
}

export async function activate(context: vscode.ExtensionContext) {
	// Pre-flight check to ensure we can log any startup errors
	const preflightLog = (msg: string) => console.log(`[Copilot Catalog Pre-flight] ${msg}`);
	const preflightError = (msg: string, err: any) => {
		console.error(`[Copilot Catalog Pre-flight ERROR] ${msg}`, err);
		vscode.window.showErrorMessage(`Copilot Catalog failed to activate: ${msg}. See Developer Tools console.`);
	};

	preflightLog('Activating...');

	try {
		const fileService = new FileService();
		const resourceService = new ResourceService(fileService);
		// Create tree providers for each category and overview
		const overviewTree = new OverviewTreeProvider();
		const chatmodesTree = new CategoryTreeProvider(ResourceCategory.CHATMODES);
		const instructionsTree = new CategoryTreeProvider(ResourceCategory.INSTRUCTIONS);
		const promptsTree = new CategoryTreeProvider(ResourceCategory.PROMPTS);
		const tasksTree = new CategoryTreeProvider(ResourceCategory.TASKS);
		const mcpTree = new CategoryTreeProvider(ResourceCategory.MCP);
		const hatService = new HatService(fileService, resourceService, context.globalStorageUri.fsPath);

		// Track whether we've warned user about read-only catalog views
		let shownReadonlyNotice = false;

		// Multiple catalog support
		let catalogFilter: string | undefined;
		let allResources: Resource[] = []; // All resources before filtering

		const config = vscode.workspace.getConfiguration();
		const runtimeDirName = config.get<string>('copilotCatalog.runtimeDirectory', '.github');
		// Configure logging destination
		enableFileLogging = !!config.get<boolean>('copilotCatalog.enableFileLogging', false);
		logFilePath = path.join(context.globalStorageUri.fsPath, LOG_FILENAME);
		// Respect target workspace override on startup
		resourceService.setTargetWorkspaceOverride(config.get<string>('copilotCatalog.targetWorkspace'));
		// Set current workspace root as fallback for target workspace
		const currentWorkspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (currentWorkspaceRoot) {
			resourceService.setCurrentWorkspaceRoot(currentWorkspaceRoot);
		}
		resourceService.setRuntimeDirectoryName(runtimeDirName);
		resourceService.setRemoteCacheTtl(config.get<number>('copilotCatalog.remoteCacheTtlSeconds', 300));

		let repositories: Repository[] = await discoverRepositories(runtimeDirName);
		let currentRepo: Repository | undefined = repositories[0];
		let resources: Resource[] = [];

		// Helper function to refresh all tree providers
		function refreshAllTrees() {
			overviewTree.refresh();
			chatmodesTree.refresh();
			instructionsTree.refresh();
			promptsTree.refresh();
			tasksTree.refresh();
			mcpTree.refresh();
		}

		// Helper function to apply catalog filter to all trees
		function applyCatalogFilter(filter?: string) {
			catalogFilter = filter;
			overviewTree.setCatalogFilter(filter);
			chatmodesTree.setCatalogFilter(filter);
			instructionsTree.setCatalogFilter(filter);
			promptsTree.setCatalogFilter(filter);
			tasksTree.setCatalogFilter(filter);
			mcpTree.setCatalogFilter(filter);
		}

		// Helper function to discover resources from multiple catalog directories
		async function discoverMultipleCatalogs(repository: Repository): Promise<Resource[]> {
			const cfg = vscode.workspace.getConfiguration();
			const catalogDirectories = cfg.get<Record<string, string>>('copilotCatalog.catalogDirectory', {});
			const allResources: Resource[] = [];
			// We'll collect catalog resources first, then add user/runtime resources exactly once
			const catalogOnly: Resource[] = [];
			let addedUserRuntime = false;
			
			// If catalog directories are configured, use them
			const directoryPaths = Object.keys(catalogDirectories);
			if (directoryPaths.length > 0) {
				for (const directory of directoryPaths) {
					try {
						// Capture previous overrides so we can restore after each catalog scan
						const prevRoot = (resourceService as any).rootCatalogOverride;
						// Set ONLY for catalog scanning – user runtime scan must not use this root override
						resourceService.setRootCatalogOverride(directory);
						resourceService.setSourceOverrides({});
						const sourceResources = await resourceService.discoverResources(repository);
						// Restore root override so subsequent user runtime discovery (later) uses target workspace
						resourceService.setRootCatalogOverride(prevRoot);

						// On first loop, add user/runtime resources (those with origin 'user') once
						if(!addedUserRuntime){
							for(const r of sourceResources){ if(r.origin === 'user') catalogOnly.push(r); }
							addedUserRuntime = true; // Prevent duplication across catalogs
						}
						// Always add catalog / remote resources (non-user)
						const pureCatalog = sourceResources.filter(r => r.origin !== 'user');
						
						// Use custom display name or fall back to directory basename
						const catalogName = getCatalogDisplayName(directory, catalogDirectories);
						pureCatalog.forEach(r => {
							r.catalogName = catalogName;
							// Ensure unique IDs across catalogs
							r.id = `${repository.name}:${catalogName}:${r.relativePath}`;
						});
						catalogOnly.push(...pureCatalog);
					} catch (e: any) {
						await log(`Failed to load catalog directory "${directory}": ${e?.message || e}`);
					}
				}
				// Merge catalog resources with (single) user runtime resources
				allResources.push(...catalogOnly);
			} else {
				// Fall back to default catalog discovery
				const resources = await resourceService.discoverResources(repository);
				resources.forEach(r => {
					r.catalogName = 'Default';
				});
				allResources.push(...resources);
			}
			
			return allResources;
		}

		async function loadResources() {
			allResources = currentRepo ? await discoverMultipleCatalogs(currentRepo) : [];

			// Collapse duplicate entries (catalog + user runtime copy) by hiding the user-origin entry
			// when a catalog/remote resource with the same category + basename is ACTIVE or MODIFIED.
			// Rationale: users expect to see the catalog asset itself (with checkmark) rather than a
			// synthetic "user" row for activated catalog resources. True user-only assets (no catalog
			// source) must continue to appear.
			try {
				const activeCatalogKeys = new Set<string>();
				for(const r of allResources){
					if((r as any).origin !== 'user' && (r.state === ResourceState.ACTIVE || r.state === ResourceState.MODIFIED)){
						const key = r.category + '::' + path.basename(r.relativePath).toLowerCase();
						activeCatalogKeys.add(key);
					}
				}
				if(activeCatalogKeys.size){
					allResources = allResources.filter(r => {
						if((r as any).origin === 'user'){
							const key = r.category + '::' + path.basename(r.relativePath).toLowerCase();
							// Hide the user entry if there is an active catalog counterpart
							if(activeCatalogKeys.has(key)) return false;
						}
						return true; // keep catalog + remote + unmatched user assets
					});
				}
			} catch { /* best-effort duplicate collapse */ }
			
			// Apply current filter
			const filteredResources = catalogFilter ? 
				allResources.filter(r => r.catalogName === catalogFilter) : 
				allResources;
			
			// Update all tree providers with filtered resources
			overviewTree.setRepository(currentRepo, filteredResources);
			chatmodesTree.setRepository(currentRepo, filteredResources);
			instructionsTree.setRepository(currentRepo, filteredResources);
			promptsTree.setRepository(currentRepo, filteredResources);
			tasksTree.setRepository(currentRepo, filteredResources);
			mcpTree.setRepository(currentRepo, filteredResources);
			
			// Set context for showing/hiding views
			const hasResources = filteredResources.length > 0;
			vscode.commands.executeCommand('setContext', 'copilotCatalog.hasResources', hasResources);
		}

		async function deriveVirtualRepoFromOverride(absPath: string, runtimeRootPreference?: string): Promise<Repository | undefined> {
			if(!absPath) return undefined;
			let catalogPath = absPath;
			try {
				const stat = await vscode.workspace.fs.stat(vscode.Uri.file(absPath));
				if(stat.type !== vscode.FileType.Directory){ catalogPath = path.dirname(absPath); }
			} catch { /* ignore */ }
			const runtimeRoot = runtimeRootPreference || path.dirname(catalogPath);
			return {
				id: `virtual:${catalogPath}`,
				name: path.basename(catalogPath) + ' (virtual)',
				rootPath: runtimeRoot,
				catalogPath,
				runtimePath: path.join(runtimeRoot, runtimeDirName),
				isActive: true
			};
		}

		async function ensureVirtualRepoIfNeeded(){
			if(repositories.length>0) return;
			const config = vscode.workspace.getConfiguration();
			const catalogDirectories = config.get<Record<string, string>>('copilotCatalog.catalogDirectory', {});
			const candidatePaths: string[] = [];
			
			for(const directory of Object.keys(catalogDirectories)){
				if(path.isAbsolute(directory)) {
					candidatePaths.push(directory);
				} else {
					const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
					if(ws) candidatePaths.push(path.join(ws, directory));
				}
			}
			
			for(const abs of candidatePaths){
				try {
					await vscode.workspace.fs.stat(vscode.Uri.file(abs));
					const workspaceRoot = (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0]?.uri.fsPath) || undefined;
					const virt = await deriveVirtualRepoFromOverride(abs, workspaceRoot);
					if(virt){ repositories.push(virt); await log(`Created virtual repository for external catalog: ${virt.catalogPath}`); break; }
				} catch (e:any) { await log(`Virtual repo candidate failed ${abs}: ${getErrorMessage(e)}`); }
			}
		}

		async function refresh() {
			try {
				log('Refresh started');
				repositories = await discoverRepositories(runtimeDirName);
				await ensureVirtualRepoIfNeeded();
				if (!currentRepo || !repositories.find(r => r.id === currentRepo?.id)) {
					currentRepo = repositories[0];
					if(!currentRepo){
						await log('No repositories detected after refresh.');
					}
				}
				await loadResources();
				// No-op: hats are discovered on demand when command is invoked
				log(`Refresh complete. Repo count=${repositories.length} resources=${resources.length}`);
				try { updateStatus(); } catch { /* ignore */ }
			} catch(e:any){
				log('Refresh error: ' + (e?.stack || e));
				vscode.window.showErrorMessage('Copilot Catalog refresh failed: ' + getErrorMessage(e));
			}
		}

		log('Activating Copilot Catalog extension');

			const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
			status.command = 'copilotCatalog.refresh';
				function updateStatus() {
					const filteredResources = catalogFilter ? 
						allResources.filter(r => r.catalogName === catalogFilter) : 
						allResources;
					const active = filteredResources.filter(r => r.state === ResourceState.ACTIVE).length;
					const statusText = catalogFilter ? 
						`Copilot Catalog $(library) ${active}/${filteredResources.length} [${catalogFilter}]` :
						`Copilot Catalog $(library) ${active}/${filteredResources.length}`;
					status.text = statusText;
					status.tooltip = 'Copilot Catalog: Refresh';
					status.show();
				}
			context.subscriptions.push(status);

		context.subscriptions.push(
			// Provide read-only virtual documents for catalog resources to prevent accidental edits
			vscode.workspace.registerTextDocumentContentProvider('copilot-catalog', {
				provideTextDocumentContent: async (uri: vscode.Uri) => {
					// uri.path should be the absolute fs path (normalized with forward slashes). Convert for Windows.
					let realPath = uri.path;
					// On Windows VS Code may prefix with /c:/...
					if(process.platform === 'win32' && /^\/[A-Za-z]:\//.test(realPath)){
						realPath = realPath.substring(1); // drop leading slash
					}
					try { return await fs.readFile(realPath, 'utf8'); } catch { return `⚠ Unable to load catalog resource: ${realPath}`; }
				}
			}),
			vscode.window.registerTreeDataProvider('copilotCatalogOverview', overviewTree),
			vscode.window.registerTreeDataProvider('copilotCatalogChatmodes', chatmodesTree),
			vscode.window.registerTreeDataProvider('copilotCatalogInstructions', instructionsTree),
			vscode.window.registerTreeDataProvider('copilotCatalogPrompts', promptsTree),
			vscode.window.registerTreeDataProvider('copilotCatalogTasks', tasksTree),
			vscode.window.registerTreeDataProvider('copilotCatalogMcp', mcpTree),
			vscode.commands.registerCommand('copilotCatalog.refresh', async () => refresh()),
			vscode.commands.registerCommand('copilotCatalog.openResource', async (item: any) => {
				const res = pickResourceFromItem(item);
				if(!res) return;
				// If user resource or active copy exists, open the runtime (editable) file; else open read-only catalog view
				const runtimeTarget = resourceService.getTargetPath(res);
				const activeExists = await fileService.pathExists(runtimeTarget);
				if((res as any).origin === 'user' || activeExists){
					vscode.window.showTextDocument(vscode.Uri.file(activeExists ? runtimeTarget : res.absolutePath));
					// After a short delay, recompute state if file was edited (auto-detect modifications without manual refresh)
					setTimeout(async ()=>{
						try { res.state = await resourceService.getResourceState(res); refreshAllTrees(); updateStatus(); } catch {}
					}, 750);
				} else {
					const uri = vscode.Uri.from({ scheme:'copilot-catalog', path: res.absolutePath.replace(/\\/g,'/') });
					if(!shownReadonlyNotice){
						shownReadonlyNotice = true;
						vscode.window.showInformationMessage('Opened read-only catalog resource. Activate it first to edit a runtime copy.');
					}
					vscode.window.showTextDocument(uri, { preview: true });
				}
			}),
			vscode.commands.registerCommand('copilotCatalog.editActivatedCopy', async (item: any) => {
				// Convenience: if inactive, activate then open runtime copy; if already active just open
				const res = pickResourceFromItem(item);
				if(!res) return;
				const runtimeTarget = resourceService.getTargetPath(res);
				const exists = await fileService.pathExists(runtimeTarget);
				if(res.state === ResourceState.INACTIVE && (res as any).origin !== 'user'){
					await resourceService.activateResource(res);
				}
				const finalPath = await fileService.pathExists(runtimeTarget) ? runtimeTarget : res.absolutePath;
				vscode.window.showTextDocument(vscode.Uri.file(finalPath));
				// Optionally refresh state to update icon (inactive -> active)
				try { res.state = await resourceService.getResourceState(res); refreshAllTrees(); updateStatus(); } catch {}
			}),
			vscode.commands.registerCommand('copilotCatalog.diagnostics', async () => {
				const redact = (p?: string) => p ? path.basename(p) : p;
				const config = vscode.workspace.getConfiguration();
				const catalogDirectories = config.get<Record<string, string>>('copilotCatalog.catalogDirectory', {});
				const diag: any = {
					catalogDirectories: Object.keys(catalogDirectories).map(redact),
					repositories: repositories.map(r=>({id:r.id, catalogPath: redact(r.catalogPath), runtimePath: redact(r.runtimePath)})),
					resourceCount: resources.length,
					workspaceFolders: (vscode.workspace.workspaceFolders||[]).map((f: vscode.WorkspaceFolder)=>redact(f.uri.fsPath)),
					runtimeDirName
				};
				await log('Diagnostics:\n'+ JSON.stringify(diag,null,2));
				vscode.window.showInformationMessage('Copilot Catalog diagnostics written to output channel.');
			}),
			vscode.commands.registerCommand('copilotCatalog.dumpResources', async () => {
				await log(`DumpResources: count=${resources.length}`);
				for(const r of resources.slice(0,200)){
					await log(` - ${r.category} ${r.state} ${r.origin} :: ${r.absolutePath}`);
				}
				vscode.window.showInformationMessage('Resource list written to log');
			}),
			vscode.commands.registerCommand('copilotCatalog.activate', async (item: any) => {
				const res = pickResourceFromItem(item);
				if (!res) return;
				// If activating over a modified runtime copy, warn user before overwriting
				if(res.state === ResourceState.MODIFIED){
					const runtimePath = resourceService.getTargetPath(res);
					const choice = await vscode.window.showWarningMessage(
						'Local copy has modifications that differ from catalog',
						{ modal: true },
						'Discard Changes', 'Preserve as New File', 'Cancel'
					);
					if(!choice || choice === 'Cancel') return;
					if(choice === 'Preserve as New File'){
						try {
							const newPath = await preserveFileWithVariant(runtimePath, log);
							vscode.window.showInformationMessage(`Preserved as: ${path.basename(newPath)}`);
							// Force refresh to show the new user resource in the tree
							setTimeout(async () => {
								await refresh();
							}, 500);
						} catch(e:any){ 
							await handleErrorWithNotification(e, 'preserve file', log, vscode);
						}
					}
				}
				await resourceService.activateResource(res);
				refreshAllTrees();
				updateStatus();
			}),
			vscode.commands.registerCommand('copilotCatalog.deactivate', async (item: any) => {
				const res = pickResourceFromItem(item);
				if (!res) return;
				// If modified, offer preservation choices
				if(res.state === ResourceState.MODIFIED){
					const choice = await vscode.window.showWarningMessage('Resource has local modifications. How would you like to proceed?', { modal:true }, 'Discard Changes', 'Preserve as New', 'Cancel');
					if(choice === 'Cancel' || !choice) return;
					if(choice === 'Preserve as New'){
						// Copy current runtime file to a new user resource name before deactivation
						const runtimePath = resourceService.getTargetPath(res);
						try {
							const newPath = await preserveFileWithVariant(runtimePath, log);
							vscode.window.showInformationMessage(`Preserved as: ${path.basename(newPath)}`);
							// Force refresh to show the new user resource in the tree
							setTimeout(async () => {
								await refresh();
							}, 500);
						} catch(e:any){ 
							await handleErrorWithNotification(e, 'preserve file', log, vscode);
						}
					}
				}
				await resourceService.deactivateResource(res);
				res.state = await resourceService.getResourceState(res);
				refreshAllTrees();
				updateStatus();
			}),
			vscode.commands.registerCommand('copilotCatalog.activateAll', async () => {
				const currentResources = catalogFilter ? 
					allResources.filter(r => r.catalogName === catalogFilter) : 
					allResources;
				for (const r of currentResources) { await resourceService.activateResource(r); }
				refreshAllTrees();
				updateStatus();
			}),
			vscode.commands.registerCommand('copilotCatalog.deactivateAll', async () => {
				const currentResources = catalogFilter ? 
					allResources.filter(r => r.catalogName === catalogFilter) : 
					allResources;
				for (const r of currentResources) { if((r as any).origin !== 'user') await resourceService.deactivateResource(r); }
				refreshAllTrees();
				updateStatus();
			}),
			vscode.commands.registerCommand('copilotCatalog.showDiff', async (item: any) => {
				const res = pickResourceFromItem(item);
				if (!res) return;
				const targetPath = resourceService.getTargetPath(res);
				const left = vscode.Uri.file(res.absolutePath);
				const right = vscode.Uri.file(targetPath);
				vscode.commands.executeCommand('vscode.diff', left, right, `${path.basename(res.relativePath)} (catalog ↔ active)`);
			}),
			vscode.commands.registerCommand('copilotCatalog.selectRepository', async () => {
				if (repositories.length === 0) {
					vscode.window.showWarningMessage('No repositories with copilot catalog found.');
					return;
				}
				const pick = await vscode.window.showQuickPick(repositories.map(r => ({ label: r.name, description: r.rootPath })), { placeHolder: 'Select repository' });
				if (!pick) return;
				currentRepo = repositories.find(r => r.name === pick.label);
				await loadResources();
				updateStatus();
			})
			,
			// --- Dev submenu commands ---
			vscode.commands.registerCommand('copilotCatalog.dev.createTemplateCatalog', async () => {
				// Choose base directory via folder picker with manual fallback
				const wsDefault = vscode.workspace.workspaceFolders?.[0]?.uri;
				let baseUri: vscode.Uri | undefined;
				let picked: vscode.Uri[] | undefined;
				try {
					picked = await vscode.window.showOpenDialog({
						canSelectFiles: false,
						canSelectFolders: true,
						canSelectMany: false,
						openLabel: 'Select base folder',
						defaultUri: wsDefault
					});
				} catch(e:any){ await log('showOpenDialog failed (createTemplateCatalog), falling back to manual: ' + getErrorMessage(e)); }
				if(picked && picked.length){ baseUri = picked[0]; }
				else {
					// fallback to manual path input
					const manual = await vscode.window.showInputBox({ prompt: 'Absolute path to the folder where the catalog should be created', value: wsDefault?.fsPath || '' });
					if(manual === undefined) return; // cancelled
					if(!manual.trim()){ vscode.window.showWarningMessage('No base folder provided.'); return; }
					baseUri = vscode.Uri.file(manual.trim());
				}
				const cfg = vscode.workspace.getConfiguration();
				const name = await vscode.window.showInputBox({ prompt: 'Folder name for the catalog', value: 'copilot_catalog' });
				if(!name) return;
				const root = path.join(baseUri.fsPath, name);
				try {
					await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.join(root, 'chatmodes')));
					await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.join(root, 'instructions')));
					await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.join(root, 'prompts')));
					await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.join(root, 'tasks')));
					await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.join(root, 'mcp')));
					await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.join(root, 'hats')));
					// Seed sample files (best-effort) – catalog setup only
					await fs.writeFile(
						path.join(root, 'chatmodes', 'catalog-manager-agent.chatmode.md'),
						[
							'# Catalog Setup Helper (Chatmode)',
							'',
							'This chatmode must ONLY help the user set up and manage a Copilot Catalog using this extension. It must NOT answer or perform any unrelated tasks.',
							'',
							'Rules:',
							'- Scope strictly to catalog setup: scaffolding folders, configuring settings, activating/deactivating resources, understanding Hats, and packaging/installation steps.',
							'- If asked anything outside catalog setup, politely refuse and redirect: "I can only help with Copilot Catalog setup and management. Please ask a catalog-related question."',
							'- Remind the user of their duties: they own repo structure, security reviews, versioning, and Marketplace publishing credentials.',
							'- Never run shell commands unless explicitly asked; provide minimal, copyable commands and explain effects.',
							'- Be concise, concrete, and avoid speculative answers.',
							'',
							'Quick references:',
							'- Dev menu (title bar) → Create Template Catalog, Configure Source/Target Settings',
							'- Settings: "Copilot Catalog" → rootCatalogPath, targetWorkspace, catalogDirectory, runtimeDirectory',
							'- Hats: presets to activate/deactivate groups of resources',
						].join('\n')
					);
					await fs.writeFile(
						path.join(root, 'instructions', 'catalog-setup-guardrails.instruction.md'),
						[
							'# Instruction: Catalog-Setup-Only Guardrails',
							'',
							'When this instruction is active:',
							'- Answer only questions about setting up and managing the Copilot Catalog.',
							'- If the user asks about coding, debugging, or anything unrelated, respond with a brief refusal and suggest a catalog-related next step.',
							'- Always remind the user they are responsible for repository structure, security policies, and versioning decisions.',
							'- Prefer short actionable guidance referencing VS Code UI locations (e.g., view title bar → Dev menu).',
						].join('\n')
					);
					await fs.writeFile(
						path.join(root, 'prompts', 'init-catalog.prompt.md'),
						[
							'# Prompt: Initialize a Copilot Catalog in this Workspace',
							'',
							'Goal: Help me set up a Copilot Catalog that I can share with my team, and remind me of my responsibilities.',
							'',
							'Constraints:',
							'- Do NOT answer non-catalog questions; refuse and redirect to catalog setup.',
							'- Keep responses concise; show only the minimal steps.',
							'',
							'What I need now:',
							'1) How to create the template catalog and where to put it',
							'2) How to configure rootCatalogPath or per-category sources and targetWorkspace',
							'3) How to activate/deactivate a resource and apply a Hat',
							'4) What I must own (security reviews, versioning, publishing)',
						].join('\n')
					);
					await fs.writeFile(
						path.join(root, 'tasks', 'catalog-setup-walkthrough.task.json'),
						JSON.stringify({
							name: 'Task: Catalog Setup Walkthrough',
							description: 'Step-by-step guide to initialize and use the Copilot Catalog (setup-only).',
							steps: [
								'Open the Copilot Catalog view and use the Dev menu to Create Template Catalog.',
								'Place the catalog in your desired folder and name it (default: copilot_catalog).',
								'Configure catalog directories using Dev menu → Configure Settings, then add catalog directories.',
								'Use Activate on a resource to copy it to your runtime (e.g., .github).',
								'Create/apply a Hat to quickly activate a set of resources.',
								'Remember: you own security reviews, repo layout, version bumps, and publishing.'
							]
						}, null, 2)
					);
					await fs.writeFile(path.join(root, 'mcp', 'catalog-servers.mcp.json'), '{"servers": {}}');
					await fs.writeFile(path.join(root, 'hats', 'Copilot-Catalog-Setup.json'), JSON.stringify({ name: 'Copilot Catalog Setup', description: 'Only the example assets generated by the template', resources: [
						'chatmodes/catalog-manager-agent.chatmode.md',
						'instructions/catalog-setup-guardrails.instruction.md',
						'prompts/init-catalog.prompt.md',
						'tasks/catalog-setup-walkthrough.task.json'
					]}, null, 2));
					vscode.window.showInformationMessage(`Template catalog created at ${root}`);
					// If created outside current workspace, auto-point rootCatalogPath to it so it shows up immediately
					const inWorkspace = (vscode.workspace.workspaceFolders||[]).some((f: vscode.WorkspaceFolder) => {
						const ws = f.uri.fsPath.replace(/\\/g,'/');
						const dir = root.replace(/\\/g,'/');
						return dir.startsWith(ws + '/') || dir === ws;
					});
					if(!inWorkspace){
						try {
							const cfg = vscode.workspace.getConfiguration(undefined, baseUri);
							const currentCatalogDirectories = cfg.get<Record<string, string>>('copilotCatalog.catalogDirectory', {});
							const newCatalogDirectories = {...currentCatalogDirectories, [root]: ''};
							await cfg.update('copilotCatalog.catalogDirectory', newCatalogDirectories, vscode.ConfigurationTarget.WorkspaceFolder);
							vscode.window.showInformationMessage('Configured Copilot Catalog to use the new template directory.');
						} catch { /* ignore */ }
					}
					await refresh();
				} catch(e:any){ vscode.window.showErrorMessage('Failed to create template catalog: ' + getErrorMessage(e)); }
			}),
			vscode.commands.registerCommand('copilotCatalog.dev.configureSettings', async () => {
				let pick: { label: string; action: 'openSettings'|'addDirectory'|'setTarget' } | undefined;
				try {
					pick = await vscode.window.showQuickPick([
						{ label: 'Open Settings UI (Copilot Catalog)', action: 'openSettings' },
						{ label: 'Add Catalog Directory…', action: 'addDirectory' },
						{ label: 'Set Target Workspace…', action: 'setTarget' }
					], { placeHolder: 'Configure catalog directories and settings' });
				} catch(e:any){
					await log('showQuickPick failed (configureSettings), falling back to manual selection: ' + getErrorMessage(e));
					const choice = await vscode.window.showInputBox({ prompt: 'Type one: openSettings | addDirectory | setTarget' });
					if(!choice) return;
					const v = choice.trim().toLowerCase();
					if(v==='opensettings') pick = { label:'Open Settings UI (Copilot Catalog)', action:'openSettings' };
					else if(v==='adddirectory') pick = { label:'Add Catalog Directory…', action:'addDirectory' } as any;
					else if(v==='settarget') pick = { label:'Set Target Workspace…', action:'setTarget' } as any;
					else return;
				}
				if(!pick) return;
				const cfg = vscode.workspace.getConfiguration();
				if(pick.action === 'openSettings'){
					try {
						await vscode.commands.executeCommand('workbench.action.openSettings', 'copilotCatalog');
					} catch(e:any){
						await log('openSettings UI failed, falling back to settings.json: ' + getErrorMessage(e));
						const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
						if(ws){
							const settingsPath = path.join(ws, '.vscode', 'settings.json');
							try {
								await fs.mkdir(path.dirname(settingsPath), { recursive: true });
								if(!(await fileService.pathExists(settingsPath))){ await fs.writeFile(settingsPath, '{\n}\n'); }
								await vscode.window.showTextDocument(vscode.Uri.file(settingsPath));
							} catch(err:any){ await log('Failed to open settings.json: ' + (err?.message||err)); }
						}
					}
					return;
				}
				if(pick.action === 'addDirectory'){
					// prefer folder picker; user can cancel and choose manual
					let chosen: vscode.Uri[] | undefined;
					try {
						chosen = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, openLabel: 'Select catalog directory' });
					} catch(e:any){ await log('showOpenDialog failed (addDirectory), falling back to manual: ' + getErrorMessage(e)); }
					let val: string | undefined;
					if(chosen && chosen.length){ val = chosen[0].fsPath; }
					else {
						const manual = await vscode.window.showInputBox({ prompt: 'Path to catalog directory (absolute or relative to workspace)' });
						if(manual === undefined) return; // cancelled
						val = manual.trim();
					}
					if (!val) return;
					
					const currentCatalogDirectories = cfg.get<Record<string, string>>('copilotCatalog.catalogDirectory', {});
					if (!currentCatalogDirectories.hasOwnProperty(val)) {
						const newCatalogDirectories = {...currentCatalogDirectories, [val]: ''};
						const targetWorkspaceUri = vscode.workspace.workspaceFolders?.find((f: vscode.WorkspaceFolder) => val!.startsWith(f.uri.fsPath))?.uri;
						await cfg.update('copilotCatalog.catalogDirectory', newCatalogDirectories, targetWorkspaceUri ? vscode.ConfigurationTarget.WorkspaceFolder : vscode.ConfigurationTarget.Workspace);
						vscode.window.showInformationMessage(`Added catalog directory: ${val}`);
					} else {
						vscode.window.showInformationMessage(`Directory already configured: ${val}`);
					}
				}
				if(pick.action === 'setTarget'){
					let chosen: vscode.Uri[] | undefined;
					try {
						chosen = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, openLabel: 'Select target workspace folder' });
					} catch(e:any){ await log('showOpenDialog failed (setTarget), falling back to manual: ' + getErrorMessage(e)); }
					let val: string | undefined;
					if(chosen && chosen.length){ val = chosen[0].fsPath; }
					else {
						const manual = await vscode.window.showInputBox({ prompt: 'Absolute path to target workspace (where active copies go). Leave empty to clear.' });
						if(manual === undefined) return; // cancelled
						val = manual.trim();
					}
					const targetWorkspaceUri = vscode.workspace.workspaceFolders?.find((f: vscode.WorkspaceFolder) => f.uri.fsPath === val)?.uri;
					await cfg.update('copilotCatalog.targetWorkspace', val, targetWorkspaceUri ? vscode.ConfigurationTarget.WorkspaceFolder : vscode.ConfigurationTarget.Workspace);
				}
				await refresh();
			})
			,
			// --- Hats (Presets) ---
			vscode.commands.registerCommand('copilotCatalog.hats.apply', async () => {
				if(!currentRepo){ vscode.window.showWarningMessage('No repository available.'); return; }
				const hats = await hatService.discoverHats(currentRepo);
				if(hats.length===0){ vscode.window.showInformationMessage('No hats found (check catalog hats/, workspace .vscode/copilot-hats.json, or user hats).'); return; }
				const pick = await vscode.window.showQuickPick(hats.map(h=> ({ label: h.name, description: h.description || h.source, detail: `${h.resources.length} items`, hat: h })), { placeHolder: 'Select a Hat to apply' });
				if(!pick) return;
				// Ask whether to enforce exclusivity (deactivate non-hat resources)
				const mode = await vscode.window.showQuickPick([
					{ label: 'Apply (keep others active)', value: 'nonExclusive' },
					{ label: 'Apply Exclusively (deactivate others)', value: 'exclusive' }
				], { placeHolder: 'How should the Hat be applied?' });
				if(!mode) return;
				const exclusive = mode.value === 'exclusive';
				const currentResources = catalogFilter ? 
					allResources.filter(r => r.catalogName === catalogFilter) : 
					allResources;
				const res = await hatService.applyHat(currentRepo, currentResources, pick.hat, { exclusive });
				await log(`Applied hat ${pick.hat.name}: activated=${res.activated} deactivated=${res.deactivated} missing=${res.missing.length} errors=${res.errors.length}`);
				if(res.errors.length){ vscode.window.showWarningMessage(`Hat applied with errors. Activated ${res.activated}, Deactivated ${res.deactivated}. Missing: ${res.missing.length}.`); } else { vscode.window.showInformationMessage(`Hat applied. Activated ${res.activated}, Deactivated ${res.deactivated}. Missing: ${res.missing.length}.`); }
				await loadResources(); updateStatus();
			}),
			vscode.commands.registerCommand('copilotCatalog.hats.createWorkspace', async () => {
				if(!currentRepo){ vscode.window.showWarningMessage('No repository available.'); return; }
				const name = await vscode.window.showInputBox({ prompt: 'Name for the workspace Hat', placeHolder: 'My Hat' });
				if(!name) return;
				const desc = await vscode.window.showInputBox({ prompt: 'Optional description' });
				const currentResources = catalogFilter ? 
					allResources.filter(r => r.catalogName === catalogFilter) : 
					allResources;
				const hat = await hatService.createHatFromActive(name, desc, currentResources, 'workspace', currentRepo);
				await log(`Created workspace hat ${hat.name} with ${hat.resources.length} resources`);
				vscode.window.showInformationMessage(`Saved Hat "${hat.name}" to workspace (.vscode/copilot-hats.json).`);
			}),
			vscode.commands.registerCommand('copilotCatalog.hats.createUser', async () => {
				const name = await vscode.window.showInputBox({ prompt: 'Name for the user Hat', placeHolder: 'My Hat' });
				if(!name) return;
				const desc = await vscode.window.showInputBox({ prompt: 'Optional description' });
				const currentResources = catalogFilter ? 
					allResources.filter(r => r.catalogName === catalogFilter) : 
					allResources;
				const hat = await hatService.createHatFromActive(name, desc, currentResources, 'user');
				await log(`Created user hat ${hat.name} with ${hat.resources.length} resources`);
				vscode.window.showInformationMessage(`Saved Hat "${hat.name}" to user settings (global storage).`);
			}),
			vscode.commands.registerCommand('copilotCatalog.hats.delete', async () => {
				if(!currentRepo){ vscode.window.showWarningMessage('No repository available.'); return; }
				const hats = await hatService.discoverHats(currentRepo);
				const deletable = hats.filter(h=> h.source === 'workspace' || h.source === 'user');
				if(deletable.length === 0){ vscode.window.showInformationMessage('No workspace/user hats to delete.'); return; }
				const pick = await vscode.window.showQuickPick(deletable.map(h=> ({ label: h.name, description: h.description || h.source, detail: `${h.source} hat`, hat: h })), { placeHolder: 'Select a Hat to delete' });
				if(!pick) return;
				const confirm = await vscode.window.showWarningMessage(`Delete Hat "${pick.hat.name}" from ${pick.hat.source}?`, { modal: true }, 'Delete');
				if(confirm !== 'Delete') return;
				const ok = await hatService.deleteHat(pick.hat, currentRepo);
				if(ok) vscode.window.showInformationMessage(`Deleted Hat "${pick.hat.name}" (${pick.hat.source}).`);
				else vscode.window.showWarningMessage('Hat not found or could not be deleted.');
			})
			,
			// User resource enable/disable
			vscode.commands.registerCommand('copilotCatalog.user.disable', async (item: any) => {
				const res = pickResourceFromItem(item);
				if(!res || (res as any).origin !== 'user'){ vscode.window.showWarningMessage('Select a user-created resource.'); return; }
				try { await resourceService.disableUserResource(res as any); refreshAllTrees(); } catch(e:any){ vscode.window.showErrorMessage('Disable failed: ' + getErrorMessage(e)); }
			}),
			vscode.commands.registerCommand('copilotCatalog.user.enable', async (item: any) => {
				const res = pickResourceFromItem(item);
				if(!res || (res as any).origin !== 'user'){ vscode.window.showWarningMessage('Select a user-created resource.'); return; }
				try { await resourceService.enableUserResource(res as any); refreshAllTrees(); } catch(e:any){ vscode.window.showErrorMessage('Enable failed: ' + getErrorMessage(e)); }
			}),
			// Catalog filter command
			vscode.commands.registerCommand('copilotCatalog.filterCatalog', async () => {
				// Get available catalog names
				const catalogNames = new Set(allResources.map(r => r.catalogName).filter(Boolean));
				const catalogOptions = [
					{ label: '$(clear-all) Show All Catalogs', value: undefined },
					...Array.from(catalogNames).map(name => ({ label: `$(book) ${name}`, value: name }))
				];
				
				if (catalogOptions.length === 1) {
					vscode.window.showInformationMessage('No additional catalogs found to filter by.');
					return;
				}
				
				const selection = await vscode.window.showQuickPick(catalogOptions, {
					placeHolder: catalogFilter ? `Current: ${catalogFilter} (click to change)` : 'Select catalog to show'
				});
				
				if (selection !== undefined) {
					applyCatalogFilter(selection.value);
					await loadResources(); // Refresh with new filter
					updateStatus();
					
					if (selection.value) {
						vscode.window.showInformationMessage(`Showing resources from: ${selection.value}`);
					} else {
						vscode.window.showInformationMessage('Showing all catalogs');
					}
				}
			})
		);

		// Perform the initial refresh after registration so commands are available even if refresh throws in headless/tunnel
		try {
			await refresh();
			log('Initial refresh completed inside activate()');
		} catch(e:any){
			log('Initial refresh failed (continuing with commands registered): ' + getErrorMessage(e));
		}
		try { updateStatus(); } catch {}

		// React to configuration changes (single consolidated handler)
		context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async (e: vscode.ConfigurationChangeEvent) => {
			const reloadKeys = [
				'copilotCatalog.runtimeDirectory'
			];
					const refreshKeys = [
				'copilotCatalog.catalogDirectory',
				'copilotCatalog.remoteCacheTtlSeconds',
				'copilotCatalog.targetWorkspace'
			];

			const needsReload = reloadKeys.some(k => e.affectsConfiguration(k));
			const needsRefresh = refreshKeys.some(k => e.affectsConfiguration(k));

			if (needsReload) {
				const selection = await vscode.window.showInformationMessage(
					'Copilot Catalog settings have changed that require a reload to take effect.',
					'Reload Window'
				);
				if (selection === 'Reload Window') {
					vscode.commands.executeCommand('workbench.action.reloadWindow');
				}
			} else if (needsRefresh) {
				const cfg = vscode.workspace.getConfiguration();
				resourceService.setTargetWorkspaceOverride(cfg.get<string>('copilotCatalog.targetWorkspace'));
				// Update current workspace root in case it changed
				const currentWorkspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
				if (currentWorkspaceRoot) {
					resourceService.setCurrentWorkspaceRoot(currentWorkspaceRoot);
				}
				resourceService.setRuntimeDirectoryName(cfg.get<string>('copilotCatalog.runtimeDirectory', '.github'));
				resourceService.setRemoteCacheTtl(cfg.get<number>('copilotCatalog.remoteCacheTtlSeconds', 300));
				await log('Configuration change: directories updated, refreshing...');
				refresh();
			}
		}));

		// Watch runtime directory for edits to auto-refresh modified states quickly
		if(currentRepo){
			const runtimeGlob = new vscode.RelativePattern(currentRepo.runtimePath, '**/*');
			const watcher = vscode.workspace.createFileSystemWatcher(runtimeGlob, false, false, false);
			const schedule = () => setTimeout(()=> refresh(), 400);
			watcher.onDidChange(schedule, null, context.subscriptions);
			watcher.onDidCreate(schedule, null, context.subscriptions);
			watcher.onDidDelete(schedule, null, context.subscriptions);
			context.subscriptions.push(watcher);
		}

		function pickResourceFromItem(item: any): Resource | undefined {
			if (!item) return undefined;
			const id = item.id as string | undefined;
			if (!id) return undefined;
			return allResources.find(r => r.id === id);
		}
	} catch (e: any) {
		preflightError('A critical error occurred during activation.', e);
	}
}

export function deactivate() { }
