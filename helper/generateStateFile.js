import path from 'path';
import { writeFile, capitalize } from './helperF.js';

/**
 * Generates the state.js file
 * @param {string} baseDir - Base directory path
 * @param {string[]} collections - Array of collection names
 * @param {string[]} authCollections - Authentication collections
 * @param {boolean} addActivityLogging - Whether to add activity logging
 */
export const generateStateFile = (baseDir, collections, authCollections, addActivityLogging) => {
  try {
    // Generate collection state definitions
    const collectionStates = collections.map(col => {
      return `
  /** 
   * ${capitalize(col)} collection state
   * @type {import('vue').Ref<{
   *   items: Array<Object>,
   *   lastVisible: import('firebase/firestore').DocumentSnapshot|null,
   *   hasMore: boolean,
   *   filters: Object,
   *   orderBy: {field: string, direction: 'asc'|'desc'},
   *   pageSize: number,
   *   total: number,
   *   specificItems: Array<Object>,
   *   search: {
   *     term: string,
   *     field: string,
   *     results: Array<Object>,
   *     isActive: boolean
   *   }
   * }>}
   */
  ${col}: ref({
    items: [],
    specificItems: [],
    lastVisible: null,
    hasMore: true,
    filters: {},
    orderBy: { field: 'createdAt', direction: 'desc' },
    pageSize: 10,
    total: 0,
    search: {
      term: '',
      field: 'name',
      results: [],
      isActive: false
    }
  }),`;
    }).join('\n');

    // Add auth-specific state if needed
    const authState = authCollections.length > 0 ? `
  /** 
   * Currently authenticated user
   * @type {import('vue').Ref<{
   *   uid: string,
   *   email: string,
   *   roles?: string[]
   * }|null>}
   */
  currentUser: ref(null),` : '';

    // Add activity logging state if needed
    const activityState = addActivityLogging ? `
  /** 
   * Recent user activity logs
   * @type {import('vue').Ref<Array<{
   *   type: string,
   *   description: string,
   *   timestamp: Date
   * }>>}
   */
  recentActivity: ref([]),` : '';

    const storeName = path.basename(baseDir);
    
    writeFile(
      path.join(baseDir, 'state.js'),
      `import { ref } from 'vue';

/**
 * @file State configuration for ${storeName} store
 * @typedef {Object} StoreState
${collections.map(col => ` * @property {import('vue').Ref} ${col} - ${capitalize(col)} collection state`).join('\n')}
${authCollections.length > 0 ? ` * @property {import('vue').Ref} currentUser - Currently authenticated user` : ''}
${addActivityLogging ? ` * @property {import('vue').Ref} recentActivity - Recent user activity logs` : ''}
 * @property {import('vue').Ref} loading - Global loading state
 * @property {import('vue').Ref} error - Error message
 */
  
export default function use${capitalize(storeName)}State() {
  return {${collectionStates}${authState}${activityState}
  /** Global loading state */
  loading: ref(false),
  
  /** Error message */
  error: ref(null),
/** auth initialization*/
  authInitialized: ref(false),
};
}`
    );
  } catch (error) {
    throw new Error(`Error generating state file: ${error.message}`);
  }
};