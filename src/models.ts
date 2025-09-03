// Central models and minimal VS Code shims used across the extension and tests.
// Keep this file dependency-light so tests can run in plain Node environments.

// Resource categorization including MCP
export enum ResourceCategory {
	CHATMODES = 'chatmodes',
	INSTRUCTIONS = 'instructions',
	PROMPTS = 'prompts',
	TASKS = 'tasks',
	MCP = 'mcp'
}

export enum ResourceState { INACTIVE = 0, ACTIVE = 1, MODIFIED = 2 }

export type ResourceOrigin = 'catalog' | 'user' | 'remote';
export type HatSource = 'catalog' | 'workspace' | 'user';

// Configuration for multiple catalog sources
export interface CatalogSource {
	name: string;
	displayName?: string;   // Custom display name for the catalog
	rootCatalogPath?: string;
	chatmodes?: string;
	instructions?: string;
	prompts?: string;
	tasks?: string;
	mcp?: string;
}

export interface Repository {
	id: string;
	name: string;
	rootPath: string;       // Workspace folder root
	catalogPath: string;    // Path to copilot_catalog folder
	runtimePath: string;    // Typically ".github"
	isActive: boolean;
}

export interface Resource {
	id: string;
	relativePath: string;   // catalog-relative virtual path, e.g., chatmodes/foo.chatmode.md
	absolutePath: string;   // absolute path to the catalog file on disk
	category: ResourceCategory;
	targetSubdir: string;   // subdir under runtimePath (informational for tree), not always used for MCP
	repository: Repository;
	state: ResourceState;
	origin: ResourceOrigin;
	catalogName?: string;   // Name of the catalog source this resource came from
	// User resources can be disabled via rename (e.g., .disabled suffix)
	disabled?: boolean;
}

export interface OperationResult { success: boolean; resource: Resource; message: string; details?: string }

export interface ActivateOptions { merge?: boolean }

// Hat (preset) definition: a named set of catalog resource relative paths
export interface Hat {
	id: string;                 // unique id for tree/commands
	name: string;               // display name
	description?: string;       // optional description
	resources: string[];        // list of resource.relativePath entries to activate
	source: HatSource;          // where it came from
	definitionPath?: string;    // absolute file path where the hat is defined (for catalog/workspace), when applicable
}

export interface IFileService {
	readFile(p: string): Promise<string>;
	writeFile(p: string, content: string): Promise<void>;
	ensureDirectory(p: string): Promise<void>;
	pathExists(p: string): Promise<boolean>;
	listDirectory(p: string): Promise<string[]>;
	stat(p: string): Promise<'file'|'dir'|'other'|'missing'>;
	copyFile(src: string, dest: string): Promise<void>;
	deleteFile?(p: string): Promise<void>;
}

export interface IResourceService {
	discoverResources(repo: Repository): Promise<Resource[]>;
	getResourceState(resource: Resource): Promise<ResourceState>;
	activateResource(resource: Resource, options?: ActivateOptions): Promise<OperationResult>;
	deactivateResource(resource: Resource): Promise<OperationResult>;
	getTargetPath(resource: Resource): string;
	setSourceOverrides(overrides: Partial<Record<ResourceCategory,string>>): void;
	setRemoteCacheTtl(seconds: number): void;
	setRootCatalogOverride(root?: string): void;
	setTargetWorkspaceOverride(path?: string): void;
	setCurrentWorkspaceRoot(path?: string): void;
	setRuntimeDirectoryName(name: string): void;
	clearRemoteCache(): void;
	enableUserResource(resource: Resource): Promise<OperationResult>;
	disableUserResource(resource: Resource): Promise<OperationResult>;
}

// Minimal tree item that works both inside VS Code and in tests
// We avoid hard dependency on vscode typings.
export class CatalogTreeItem {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	constructor(public label: string, public collapsibleState: any, public meta?: any){
		this.contextValue = meta?.type;
	}
	contextValue?: string;
	// For VS Code runtime, these properties can be set by callers
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	iconPath?: any;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	command?: any;
}

