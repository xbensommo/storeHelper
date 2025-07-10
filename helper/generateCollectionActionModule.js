import path from 'path';
import { mkdirSync, existsSync } from 'fs';
import { writeFile, capitalize } from './helperF.js';

const actionDescriptors = [
  {
    key: 'fetchInitialPage',
    exportName: (suffix) => `fetchInitialPage${suffix}`,
    jsdoc: (name) => `/**
 * Fetches the first page of ${name} with optional filters and sorting.
 * @function
 * @param {...any} args - Arguments forwarded to fetchInitialPage
 * @returns {Promise<void>}
 */`
  },
  {
    key: 'fetchNextPage',
    exportName: (suffix) => `fetchNextPage${suffix}`,
    jsdoc: (name) => `/**
 * Fetches the next page of ${name} (pagination).
 * @function
 * @param {...any} args - Arguments forwarded to fetchNextPage
 * @returns {Promise<void>}
 */`
  },
  {
    key: 'applyFilters',
    exportName: (suffix) => `apply${suffix}Filters`,
    jsdoc: (name) => `/**
 * Applies filters to the ${name} collection query.
 * @function
 * @param {...any} args - Arguments forwarded to applyFilters
 * @returns {Promise<void>}
 */`
  },
  {
    key: 'changeSorting',
    exportName: (suffix) => `change${suffix}Sorting`,
    jsdoc: (name) => `/**
 * Changes the sorting of the ${name} collection.
 * @function
 * @param {...any} args - Arguments forwarded to changeSorting
 * @returns {Promise<void>}
 */`
  },
  {
    key: 'add',
    exportName: (suffix) => `add${suffix}`,
    jsdoc: (name) => `/**
 * Adds a new ${name} document to the collection.
 * @function
 * @param {...any} args - Arguments forwarded to add
 * @returns {Promise<void>}
 */`
  },
  {
    key: 'get',
    exportName: (suffix) => `get${suffix}`,
    jsdoc: (name) => `/**
 * Gets a document from the collection.
 * @function
 * @param {...any} args - Arguments forwarded to get
 * @returns {Promise<void>}
 */`
  },
  {
    key: 'getWhere',
    exportName: (suffix) => `getWhere${suffix}`,
    jsdoc: (name) => `/**
 * Gets a document based on the condition from the collection, e.g clientId = 'xxx'.
 * @function
 * @param {...any} args - Arguments forwarded to get
 * @returns {Promise<void>}
 */`
  },
  {
    key: 'update',
    exportName: (suffix) => `update${suffix}`,
    jsdoc: (name) => `/**
 * Updates an existing ${name} document.
 * @function
 * @param {...any} args - Arguments forwarded to update
 * @returns {Promise<void>}
 */`
  },
  {
    key: 'search',
    exportName: (suffix) => `search${suffix}`,
    jsdoc: (name) => `/**
 * Searches ${name} documents by a term and optional field.
 * @function
 * @param {...any} args - Arguments forwarded to search
 * @returns {Promise<void>}
 */`
  },
  {
    key: 'clearSearch',
    exportName: (suffix) => `clear${suffix}Search`,
    jsdoc: (name) => `/**
 * Clears the current ${name} search results.
 * @function
 * @param {...any} args - Arguments forwarded to clearSearch
 * @returns {Promise<void>}
 */`
  },
  {
    key: 'remove',
    exportName: (suffix) => `delete${suffix}`,
    jsdoc: (name) => `/**
 * Deletes a ${name} document by ID.
 * @function
 * @param {...any} args - Arguments forwarded to remove
 * @returns {Promise<void>}
 */`
  },
  {
    key: 'assignRoles',
    exportName: (suffix) => `assign${suffix}Roles`,
    jsdoc: (name) => `/**
 * Assigns roles to a ${name.toLowerCase()} user.
 * @function
 * @param {...any} args - Arguments forwarded to assignRoles
 * @returns {Promise<void>}
 */`
  },
  {
    key: 'revokeRoles',
    exportName: (suffix) => `revoke${suffix}Roles`,
    jsdoc: (name) => `/**
 * Revokes roles from a ${name.toLowerCase()} user.
 * @function
 * @param {...any} args - Arguments forwarded to revokeRoles
 * @returns {Promise<void>}
 */`
  }
];

export const generateCollectionActionModule = (baseDir, collectionName) => {
  try {
    if (!/^[a-z][a-z0-9_-]{0,63}$/i.test(collectionName)) {
      throw new Error(`Invalid Firestore collection name: ${collectionName}`);
    }

    const suffix = capitalize(collectionName);
    const actionsDir = path.join(baseDir, 'actions');

    if (!existsSync(actionsDir)) {
      mkdirSync(actionsDir, { recursive: true });
    }

    const filePath = path.join(actionsDir, `${collectionName}.js`);

    let content = `import { useFirestoreCollectionActions } from '../useFirestoreCollectionActions.js';\n\n`;

    content += `/**\n`;
    content += ` * Generates a set of Firestore actions scoped to the \`${collectionName}\` collection.\n`;
    content += ` *\n`;
    content += ` * @param {Object} state - Pinia store state\n`;
    content += ` * @returns {Object} ${collectionName}Actions - A set of methods to interact with the ${collectionName} Firestore collection\n`;
    content += ` */\n`;
    content += `export function use${suffix}Actions(state) {\n`;
    content += `  let actionsInstance = null;\n\n`;
    content += `  /**\n`;
    content += `   * Lazily initializes and retrieves the ${collectionName} collection actions.\n`;
    content += `   * @returns {Object} Firestore collection methods for '${collectionName}'\n`;
    content += `   */\n`;
    content += `  const getActions = () => {\n`;
    content += `    if (!actionsInstance) {\n`;
    content += `      actionsInstance = useFirestoreCollectionActions('${collectionName}', state);\n`;
    content += `    }\n`;
    content += `    return actionsInstance;\n`;
    content += `  };\n\n`;
    content += `  return {\n`;

    actionDescriptors.forEach(({ key, exportName, jsdoc }) => {
      const funcName = exportName(suffix);
      content += `    ${jsdoc(suffix).replace(/\n/g, '\n    ')}\n`;
      content += `    ${funcName}(...args) {\n`;
      content += `      return getActions().${key}(...args);\n`;
      content += `    },\n\n`;
    });

    content += `  };\n`;
    content += `}\n`;

    writeFile(filePath, content);
    return { success: true, path: filePath };
  } catch (error) {
    throw new Error(`[Action Generator] ${collectionName} failed: ${error.message}`);
  }
};
