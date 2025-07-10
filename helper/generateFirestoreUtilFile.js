import path from 'path';
import { writeFile } from './helperF.js';

/**
 * Generates the Firestore utility file
 * @param {string} baseDir - Base directory path
 * @param {string[]} authC - Authentication collections
 * @param {string[]} roles - User roles for authorization
 * @param {boolean} addActivityLogging - Whether to add activity logging
 */
export const generateFirestoreUtilFile = (baseDir, authC, roles, addActivityLogging) => {
  try {
    // Stringify authCollections once to embed it directly into the generated file
    const authCollectionsString = JSON.stringify(authC);

    // Role-based authorization check (remains inside the function where 'state' is available)
    const roleCheck = roles.length > 0 ? `
    /**
     * Checks if user has required role
     * @param {string} requiredRole - Required role
     * @throws {Error} If user doesn't have required role
     */
    _checkRole(requiredRole) {
      if (!state.currentUser.value || !state.currentUser.value.roles) {
        throw new Error('User not authenticated or roles not defined');
      }
      
      if (!state.currentUser.value.roles.includes(requiredRole)) {
        throw new Error(\`User lacks required role: \${requiredRole}\`);
      }
    },` : '';

    // Auth role actions (now entirely conditional based on authCollections.includes(collectionName) within the function)
    const authRoleActions = roles.length > 0 ? `
    , ...(authCollections.includes(collectionName) ? {
      /**
       * Assigns roles to a user
       * @async
       * @function
       * @param {string} userId - User ID
       * @param {string[]} roles - Roles to assign
       * @returns {Promise<void>}
       */
      async assignRoles(userId, roles) {
        state.loading.value = true;
        try {
          this._checkRole('admin');
          await updateDoc(doc(db, collectionName, userId), {
            roles: Array.isArray(roles) ? roles : [roles]
          });
          if (${addActivityLogging}) {
            const { actorId, actorEmail, actorName, actorType, isAdminAction } = _getActorContext(state);
            await logActivity(
              {
                type: \`\${collectionName.toUpperCase()}_ROLES_ASSIGNED\`,
                description: \`\${actorName} assigned roles to user \${userId} in \${collectionName}. New roles: \${Array.isArray(roles) ? roles.join(', ') : roles}\`,
                targetId: userId,
                targetType: collectionName,
                actorId, actorEmail, actorName, actorType, isAdminAction
              },
              state
            );
          }
        } catch (error) {
          state.error.value = error.message;
          throw error;
        } finally {
          state.loading.value = false;
        }
      },
      
      /**
       * Revokes roles from a user
       * @async
       * @function
       * @param {string} userId - User ID
       * @param {string[]} roles - Roles to revoke
       * @returns {Promise<void>}
       */
      async revokeRoles(userId, roles) {
        state.loading.value = true;
        try {
          this._checkRole('admin');
          const userRef = doc(db, collectionName, userId);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {
            const currentRoles = userDoc.data().roles || [];
            const newRoles = currentRoles.filter(role => !roles.includes(role));
            
            await updateDoc(userRef, { roles: newRoles });
            if (${addActivityLogging}) {
              const { actorId, actorEmail, actorName, actorType, isAdminAction } = _getActorContext(state);
              await logActivity(
                {
                  type: \`\${collectionName.toUpperCase()}_ROLES_REVOKED\`,
                  description: \`\${actorName} revoked roles from user \${userId} in \${collectionName}. Revoked roles: \${Array.isArray(roles) ? roles.join(', ') : roles}\`,
                  targetId: userId,
                  targetType: collectionName,
                  actorId, actorEmail, actorName, actorType, isAdminAction
                },
                state
              );
            }
          }
        } catch (error) {
          state.error.value = error.message;
          throw error;
        } finally {
          state.loading.value = false;
        }
      }
    } : {}),` : '';

    // Conditionally generate admin check for remove method (now inside the function)
    const adminCheckInRemove = roles.length > 0 ? `
      // Require admin role for auth collections
      if (authCollections.includes(collectionName)) {
        this._checkRole('admin');
      }
    ` : '';

    writeFile(
      path.join(baseDir, 'useFirestoreCollectionActions.js'),
      `import { 
  collection, 
  getDocs, 
  addDoc, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter,
  getCountFromServer,
  getDoc
} from 'firebase/firestore';
import { db } from '@/firebase';
import {ref} from 'vue'
${addActivityLogging ? `import { logActivity, _getActorContext } from './activityLogger';` : ''} // Adjust path if activityLogger is elsewhere
${authC.length > 0 ? `import { getAuth } from 'firebase/auth';` : ''}

// Auth collections configuration is defined once here
const authCollections = ${authCollectionsString};

/**
 * Firestore Collection Actions Factory
 * @param {string} collectionName - Name of Firestore collection
 * @param {Object} state - Pinia store state (assumes state has .loading and .error refs, and .currentUser)
 * @returns {Object} Collection CRUD actions
 */
export function useFirestoreCollectionActions(collectionName, state) {
  return {${roleCheck}
    /**
     * Fetches initial page of documents from the collection
     * @async
     * @function
     * @param {Object} [options] - Fetch options
     * @param {number} [options.pageSize=10] - Number of items per page
     * @param {Object} [options.filters] - Filters to apply
     * @param {Object} [options.orderBy] - Sorting configuration
     * @returns {Promise<void>}
     */
    async fetchInitialPage(options = {}) {
      state.loading.value = true;
      try {
        // Get reference to the collection
        const colRef = collection(db, collectionName);
        
        // Build query constraints
        const constraints = [];
        
        // Apply filters if provided
        const filters = options.filters || state[collectionName].value.filters;
        if (filters && Object.keys(filters).length > 0) {
          for (const [field, value] of Object.entries(filters)) {
            if (value !== undefined && value !== null && value !== '') {
              constraints.push(where(field, '==', value));
            }
          }
        }
        
        // Apply sorting
        const sortConfig = options.orderBy || state[collectionName].value.orderBy;
        if (sortConfig && sortConfig.field) {
          constraints.push(orderBy(sortConfig.field, sortConfig.direction || 'asc'));
        }
        
        // Set pagination size
        const pageSize = options.pageSize || state[collectionName].value.pageSize;
        constraints.push(limit(pageSize));
        
        // Execute query
        const q = query(colRef, ...constraints);
        const snapshot = await getDocs(q);
        
        // Update state
        state[collectionName].value = {
          ...state[collectionName].value,
          items: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
          lastVisible: snapshot.docs[snapshot.docs.length - 1] || null,
          hasMore: snapshot.docs.length === pageSize,
          filters: filters || {},
          orderBy: sortConfig || state[collectionName].value.orderBy,
          pageSize
        };
        
        // Get total count (for UI display)
        const countQuery = query(colRef, ...constraints.filter(c => !(c.type === 'limit' || c.type === 'startAfter')));
        const countSnapshot = await getCountFromServer(countQuery);
        state[collectionName].value.total = countSnapshot.data().count;
      } catch (error) {
        state.error.value = error.message;
        throw error;
      } finally {
        state.loading.value = false;
      }
    },

    /**
     * Fetches next page of documents (load more)
     * @async
     * @function
     * @returns {Promise<void>}
     */
    async fetchNextPage() {
      if (!state[collectionName].value.lastVisible || !state[collectionName].value.hasMore) return;
      
      state.loading.value = true;
      try {
        // Get reference to the collection
        const colRef = collection(db, collectionName);
        
        // Build query constraints
        const constraints = [];
        
        // Apply existing filters
        const filters = state[collectionName].value.filters;
        if (filters && Object.keys(filters).length > 0) {
          for (const [field, value] of Object.entries(filters)) {
            if (value !== undefined && value !== null && value !== '') {
              constraints.push(where(field, '==', value));
            }
          }
        }
        
        // Apply existing sorting
        const sortConfig = state[collectionName].value.orderBy;
        if (sortConfig && sortConfig.field) {
          constraints.push(orderBy(sortConfig.field, sortConfig.direction || 'asc'));
        }
        
        // Add pagination
        constraints.push(startAfter(state[collectionName].value.lastVisible));
        constraints.push(limit(state[collectionName].value.pageSize));
        
        // Execute query
        const q = query(colRef, ...constraints);
        const snapshot = await getDocs(q);
        
        // Update state
        state[collectionName].value = {
          ...state[collectionName].value,
          items: [...state[collectionName].value.items, ...snapshot.docs.map(doc => ({ 
            id: doc.id, 
            ...doc.data() 
          }))],
          lastVisible: snapshot.docs[snapshot.docs.length - 1] || null,
          hasMore: snapshot.docs.length === state[collectionName].value.pageSize
        };
      } catch (error) {
        state.error.value = error.message;
        throw error;
      } finally {
        state.loading.value = false;
      }
    },

    /**
    * Retrieves a document from the collection by ID
    * @async
    * @function
    * @param {string} id - Document ID to retrieve
    * @returns {Promise<Object|null>} The retrieved document data with ID, or null if not found.
    */
    async get(id) {
      state.loading.value = true;
      try {
        // Create document reference
        const docRef = doc(db, collectionName, id);
        
        // Fetch document snapshot
        const docSnap = await getDoc(docRef);
        
        // Check if document exists
        if (!docSnap.exists()) {
          return null; // Return null if not found, don't throw
        }
        
        // Return document data with ID
        return { 
          id: docSnap.id, 
          ...docSnap.data() 
        };
      } catch (error) {
        state.error.value = error.message;
        throw error;
      } finally {
        state.loading.value = false;
      }
    },

    /**
     * Fetches documents from the collection where a field matches a value
     * @async
     * @function
     * @param {string} field - Field to filter
     * @param {string} operator - Firestore comparison operator (e.g., '==', '<=', '>=', 'array-contains')
     * @param {any} value - Value to match
     * @returns {Promise<Array>} Array of matched documents
     */
    async getWhere(field, operator, value) {
      state.loading.value = true;
      try {
        const colRef = collection(db, collectionName);
        const q = query(colRef, where(field, operator, value));
        const snapshot = await getDocs(q);

         // Update store with new items and pagination info
        store[collectionName].value = {
          ...store[collectionName].value, // Keep existing properties
          specificItems: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
          hasMore: snapshot.docs.length === pageSize,
        };
      } catch (error) {
        state.error.value = error.message;
        throw error;
      } finally {
        state.loading.value = false;
      }
    },

    /**
     * Applies new filters and fetches first page
     * @async
     * @function
     * @param {Object} filters - New filters to apply
     * @returns {Promise<void>}
     */
    async applyFilters(filters) {
      store.loading.value = true;
      try {
        store[collectionName].value.filters = filters; // Update filters in store state

        const colRef = collection(db, collectionName);
        const constraints = [];

        // Apply filters from the new 'filters' parameter
        if (filters && Object.keys(filters).length > 0) {
          for (const [field, value] of Object.entries(filters)) {
            if (value !== undefined && value !== null && value !== "") {
              constraints.push(where(field, "==", value));
            }
          }
        }

        // Apply current sorting from store state
        const sortConfig = store[collectionName].value.orderBy;
        if (sortConfig && sortConfig.field) {
          constraints.push(
            orderBy(sortConfig.field, sortConfig.direction || "asc")
          );
        }

        // Apply current page size from store state
        const pageSize = store[collectionName].value.pageSize;
        constraints.push(limit(pageSize));

        const q = query(colRef, ...constraints);
        const snapshot = await getDocs(q);

        // Update store with new items and pagination info
        store[collectionName].value = {
          ...store[collectionName].value, // Keep existing properties
          items: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
          lastVisible: snapshot.docs[snapshot.docs.length - 1] || null,
          hasMore: snapshot.docs.length === pageSize,
          filters: filters, // Use the newly applied filters
          // orderBy remains as it was, as changeSorting handles it
          // pageSize remains as it was
        };

        // Get total count based on *applied filters* (excluding limit/startAfter)
        const countQuery = query(colRef, ...constraints.filter(c => !(c.type === 'limit' || c.type === 'startAfter')));
        const countSnapshot = await getCountFromServer(countQuery);
        store[collectionName].value.total = countSnapshot.data().count;

      } catch (error) {
        store.error.value = error.message;
        throw error;
      } finally {
        store.loading.value = false;
      }
    },

    /**
     * Changes sorting and fetches first page
     * @async
     * @function
     * @param {string} field - Field to sort by
     * @param {string} [direction='asc'] - Sort direction
     * @returns {Promise<void>}
     */
    async changeSorting(field, direction = "asc") {
      store.loading.value = true;
      try {
        store[collectionName].value.orderBy = { field, direction }; // Update sorting in store state

        const colRef = collection(db, collectionName);
        const constraints = [];

        // Apply current filters from store state
        const filters = store[collectionName].value.filters;
        if (filters && Object.keys(filters).length > 0) {
          for (const [fField, fValue] of Object.entries(filters)) {
            if (fValue !== undefined && fValue !== null && fValue !== "") {
              constraints.push(where(fField, "==", fValue));
            }
          }
        }

        // Apply the new sorting from parameters
        const sortConfig = { field, direction };
        constraints.push(orderBy(sortConfig.field, sortConfig.direction || "asc"));


        // Apply current page size from store state
        const pageSize = store[collectionName].value.pageSize;
        constraints.push(limit(pageSize));

        const q = query(colRef, ...constraints);
        const snapshot = await getDocs(q);

        // Update store with new items and pagination info
        store[collectionName].value = {
          ...store[collectionName].value, // Keep existing properties
          items: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
          lastVisible: snapshot.docs[snapshot.docs.length - 1] || null,
          hasMore: snapshot.docs.length === pageSize,
          // filters remain as they were, as applyFilters handles them
          orderBy: sortConfig, // Use the newly applied sortConfig
          // pageSize remains as it was
        };

        // Get total count based on *applied filters and sorting* (excluding limit/startAfter)
        const countQuery = query(colRef, ...constraints.filter(c => !(c.type === 'limit' || c.type === 'startAfter')));
        const countSnapshot = await getCountFromServer(countQuery);
        store[collectionName].value.total = countSnapshot.data().count;

      } catch (error) {
        store.error.value = error.message;
        throw error;
      } finally {
        store.loading.value = false;
      }
    },
    
    /**
     * Adds a new document to the collection
     * @async
     * @function
     * @param {Object} data - Document data to add
     * @returns {Promise<string>} The ID of the newly added document.
     */
    async add(data) {
      state.loading.value = true;
      try {
        ${addActivityLogging ? `const { actorId, actorEmail, actorName, actorType, isAdminAction } = _getActorContext(state);` : ''}
        const d = ref(null);
           // For auth collections, add current user ID
        if (authCollections.includes(collectionName)) {
           if (state.currentUser.value && state.currentUser.value.uid) {
            data.createdBy = state.currentUser.value.uid;
          }
          d.value = await setDoc(doc(db, collectionName, data.uid), data);
        } else {
          d.value = await addDoc(collection(db, collectionName), data);
        }

        if (${addActivityLogging}) {
          await logActivity(
            {
              type: \`\${collectionName.toUpperCase()}_CREATED\`, // e.g., 'PRODUCTS_CREATED', 'USERS_CREATED'
              description: \`\${actorName} created a new \${collectionName} document.\`,
              targetId: docRef.id,
              targetType: collectionName,
              targetName: data.name || data.title || docRef.id, // Try to get a meaningful name
              actorId, actorEmail, actorName, actorType, isAdminAction,
              // ipAddress: 'YOUR_IP_ADDRESS_HERE' // Add if you can get it from request context
            },
            state
          );
        }
        return d.value.id;
      } catch (error) {
        state.error.value = error.message;
        throw error;
      } finally {
        state.loading.value = false;
      }
    },
    
    /**
     * Updates an existing document
     * @async
     * @function
     * @param {string} id - Document ID
     * @param {Object} data - Partial document data to update
     * @returns {Promise<void>}
     */
    async update(id, data) {
      state.loading.value = true;
      try {
        ${addActivityLogging ? `const { actorId, actorEmail, actorName, actorType, isAdminAction } = _getActorContext(state);` : ''}

        // For auth collections, add current user ID
        if (authCollections.includes(collectionName)) {
          if (state.currentUser.value && state.currentUser.value.uid) {
            data.updatedBy = state.currentUser.value.uid;
          }
        }
        
        await updateDoc(doc(db, collectionName, id), data);

        if (${addActivityLogging}) {
          await logActivity(
            {
              type: \`\${collectionName.toUpperCase()}_UPDATED\`,
              description: \`\${actorName} updated a \${collectionName} document (\${id}).\`,
              targetId: id,
              targetType: collectionName,
              targetName: data.name || data.title || id,
              actorId, actorEmail, actorName, actorType, isAdminAction,
            },
            state
          );
        }
      } catch (error) {
        state.error.value = error.message;
        throw error;
      } finally {
        state.loading.value = false;
      }
    },

    /**
     * Search documents in the collection
     * @async
     * @function
     * @param {string} term - Search term
     * @param {string} [field='name'] - Field to search in
     * @returns {Promise<void>}
     */
    async search(term, field = 'name') {
      state.loading.value = true;
      try {
        // Store search parameters
        state[collectionName].value.search = {
          term,
          field,
          isActive: true
        };
        
        const colRef = collection(db, collectionName);
        const constraints = [];
        
        // Add search constraint
        constraints.push(
          where(field, '>=', term.toLowerCase()),
          where(field, '<=', term.toLowerCase() + '\\uf8ff') // Escaped \\uf8ff for template literal
        );
        
        // Apply existing filters
        const filters = state[collectionName].value.filters;
        if (filters && Object.keys(filters).length > 0) {
          for (const [f, value] of Object.entries(filters)) {
            if (value !== undefined && value !== null && value !== '') {
              constraints.push(where(f, '==', value));
            }
          }
        }
        
        // Execute query
        const q = query(colRef, ...constraints);
        const snapshot = await getDocs(q);
        
        // Update search results
        state[collectionName].value.search.results = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      } catch (error) {
        state.error.value = error.message;
        throw error;
      } finally {
        state.loading.value = false;
      }
    },
    
    /**
     * Clears search results
     * @function
     */
    clearSearch() {
      state[collectionName].value.search = {
        term: '',
        field: 'name',
        results: [],
        isActive: false
      };
    },

    /**
     * Deletes a document from the collection
     * @async
     * @function
     * @param {string} id - Document ID to delete
     * @returns {Promise<void>}
     */
    async remove(id) {
      state.loading.value = true;
      try {
        ${adminCheckInRemove}
        ${addActivityLogging ? `const { actorId, actorEmail, actorName, actorType, isAdminAction } = _getActorContext(state);` : ''}

        await deleteDoc(doc(db, collectionName, id));

        if (${addActivityLogging}) {
          await logActivity(
            {
              type: \`\${collectionName.toUpperCase()}_DELETED\`,
              description: \`\${actorName} deleted a \${collectionName} document (\${id}).\`,
              targetId: id,
              targetType: collectionName,
              targetName: id, // Name might not be available after deletion
              actorId, actorEmail, actorName, actorType, isAdminAction,
            },
            state
          );
        }
      } catch (error) {
        state.error.value = error.message;
        throw error;
      } finally {
        state.loading.value = false;
      }
    }${authRoleActions}
  };
}`
    );
  } catch (error) {
    // Re-throwing the original error message for clarity during generation
    throw new Error(`Error generating Firestore utility file: ${error.message}`);
  }
};