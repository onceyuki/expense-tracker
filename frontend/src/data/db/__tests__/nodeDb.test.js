// @vitest-environment node
import { createNodeDatabase } from '../nodeDb.js';
import { runAdapterConformance } from './conformance.js';

runAdapterConformance('node:sqlite', () => createNodeDatabase(':memory:'));
