import path from 'path';
import { toCamel, writeFile, capitalize } from './helperF.js'; // Ensure these helper functions are available

/**
 * Generates action files for each collection following a generic pattern.
 * Each generated file will export a `use[CollectionName]Actions` function
 * that returns an object of standardized CRUD and utility actions.
 *
 * @param {string} actionsDir - The directory path where the action files will be created.
 * @param {string[]} collections - An array of collection names for which to generate action files.
 * @param {string[]} authCollections - An array of collection names that are considered authentication-related
 * and might have role assignment/revocation actions.
 * @param {string[]} roles - An array of user roles (not directly used in the generic output,
 * but kept for consistency if needed for future extensions).
 */
export const generateActionFiles = (actionsDir, collections, authCollections, roles) => {
  try {
    for (const col of collections) {
      const camelCol = toCamel(col);
      const pascalCol = capitalize(camelCol);
      const isAuth = authCollections.includes(col);

      // Dynamically create the content for each collection's action file
      const fileContent = `import { useFirestoreCollectionActions } from "../useFirestoreCollectionActions.js";

/**
 * Generates a set of Firestore actions scoped to the \`${col}\` collection.
 *
 * @param {Object} state - The reactive state from a Pinia store instance.
 * @returns {Object} A set of methods to interact with the \`${col}\` Firestore collection.
 */
export function use${pascalCol}Actions(state) {
  // IMPORTANT: Ensure this collection name exactly matches your Firestore collection.
  const collectionName = "${col}";

  // Create the generic actions instance once.
  const actions = useFirestoreCollectionActions(collectionName, state);

  return {
    /**
     * Fetches the initial page of \`${col}\` documents based on current filters and sorting.
     * @param {Object} [options] - Fetch options
     * @param {number} [options.pageSize] - Items per page
     * @param {Object} [options.filters] - Filters to apply
     * @param {Object} [options.orderBy] - Sorting configuration
     * @returns {Promise<void>}
     */
    fetchInitialPage${pascalCol}: actions.fetchInitialPage,

    /**
     * Fetches the next page of \`${col}\` documents (for load more functionality).
     * @returns {Promise<void>}
     */
    fetchNextPage${pascalCol}: actions.fetchNextPage,

    /**
     * Applies filters to the \`${col}\` collection and re-fetches the initial page.
     * @param {Object} filters - Filter configuration (e.g., { field: 'value' })
     * @returns {Promise<void>}
     */
    apply${pascalCol}Filters: actions.applyFilters,

    /**
     * Changes the sorting of the \`${col}\` collection and re-fetches the initial page.
     * @param {string} field - Field to sort by.
     * @param {string} [direction='asc'] - Sort direction ('asc' or 'desc').
     * @returns {Promise<void>}
     */
    change${pascalCol}Sorting: actions.changeSorting,

    /**
     * Adds a new document to the \`${col}\` collection.
     * @param {Object} data - The data for the new \`${col}\` document.
     * @returns {Promise<string>} The ID of the newly added document.
     */
    add${pascalCol}: actions.add,


    /**
     * Fetches documents from the collection where a field matches a value
     * @async
     * @function
     * @param {string} field - Field to filter
     * @param {string} operator - Firestore comparison operator (e.g., '==', '<=', '>=', 'array-contains')
     * @param {any} value - Value to match
     * @returns {Promise<Array>} Array of matched documents
     */
    getWhere${pascalCol}: actions.getWhere,

    /**
     * Updates an existing document in the \`${col}\` collection.
     * @param {string} id - The ID of the document to update.
     * @param {Object} data - The partial data to update the document with.
     * @returns {Promise<void>}
     */
    update${pascalCol}: actions.update,

    /**
     * get an existing document in the \`${col}\` collection.
     * @param {string} id - The ID of the document to update.
     * @param {Object} data - The partial data to update the document with.
     * @returns {Object}
     */
    get${pascalCol}: actions.get,

    /**
     * Performs a search on the \`${col}\` collection.
     * The specific search fields/logic depend on the \`useFirestoreCollectionActions\` implementation.
     * @param {string} term - The search term.
     * @param {string} [field] - Optional field to search within.
     * @returns {Promise<void>}
     */
    search${pascalCol}: actions.search,

    /**
     * Clears any active search results for the \`${col}\` collection.
     * @returns {void}
     */
    clear${pascalCol}Search: actions.clearSearch,

    /**
     * Deletes a document from the \`${col}\` collection.
     * @param {string} id - The ID of the document to delete.
     * @returns {Promise<void>}
     */
    delete${pascalCol}: actions.remove,
    ${isAuth ? `
    /**
     * Assigns roles to a user within the \`${col}\` context.
     * Applicable primarily to authentication-related collections (e.g., 'users').
     * @param {string} userId - The ID of the user.
     * @param {string[]} roles - An array of roles to assign.
     * @returns {Promise<void>}
     */
    assign${pascalCol}Roles: actions.assignRoles,

    /**
     * Revokes roles from a user within the \`${col}\` context.
     * Applicable primarily to authentication-related collections (e.g., 'users').
     * @param {string} userId - The ID of the user.
     * @param {string[]} roles - An array of roles to revoke.
     * @returns {Promise<void>}
     */
    revoke${pascalCol}Roles: actions.revokeRoles,
    ` : ''}
  };
}
`;

      // Write the generated content to the appropriate file
      writeFile(
        path.join(actionsDir, `${camelCol}.js`), // e.g., 'clientsubmissions.js'
        fileContent
      );
    }
  } catch (error) {
    throw new Error(`Error generating action files: ${error.message}`);
  }
};