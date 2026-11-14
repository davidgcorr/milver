import { createContext } from 'react';
import type { BlockNode, SavedBlock, Diagram } from '../model';
import type { ModuleInfo, NodeResult } from './engine';
import type { ProjectModule } from './schema';
export const ProjectContext = createContext<{
  myBlocks: SavedBlock[]; saveBlock: (block: BlockNode) => void; removeSavedBlock: (id: string) => void; insertSavedBlock: (block: SavedBlock, position?: { x: number; y: number }) => void;
  openProject: (project: Diagram) => void;
  modules: ProjectModule[]; catalog: ModuleInfo[]; values: Record<string, NodeResult>;
  loadExample: (example?: 'transformer' | 'attention' | 'dictionary' | 'nanogpt') => void;
  createModule: (source?: string, filename?: string, url?: string) => void;
  updateModule: (module: ProjectModule) => void; removeModule: (id: string) => void; addBlock: (block: BlockNode) => void;
}>({ myBlocks: [], saveBlock() {}, removeSavedBlock() {}, insertSavedBlock() {}, openProject() {}, modules: [], catalog: [], values: {}, loadExample() {}, createModule() {}, updateModule() {}, removeModule() {}, addBlock() {} });
