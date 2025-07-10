import path from 'path';
import { writeFile, toCamel, capitalize } from './helperF.js'; // Assuming helperF.js provides these utilities

/**
 * Generates the main Pinia store index file with enterprise-grade authentication and Firestore collection integration.
 * @param {string} storeName - Name of the Pinia store (e.g., 'app').
 * @param {string} baseDir - Base directory path where the 'index.js' file will be created.
 * @param {string[]} collections - Array of all collection names to integrate (e.g., ['products', 'orders']).
 * @param {string[]} authCollections - Array of collection names specifically designated as authentication collections (e.g., ['users']).
 * @param {boolean} addActivityLogging - Whether to enable activity logging for all operations (including authentication).
 */
export const generateIndexFile = (storeName, baseDir, collections, authCollections, addActivityLogging) => {
  try {
    const storeNameCamel = toCamel(storeName);
    const pascalStoreName = capitalize(storeNameCamel);
    const primaryAuthCollection = authCollections.length > 0 ? authCollections[0] : null;

    // Generate imports for collection-specific actions
    const actionImports = collections.map(col =>
      `import { useFirestoreCollectionActions as use${capitalize(col)}Actions } from './actions/${col}.js';`
    ).join('\n');

    // Generate auth imports with all necessary Firebase Auth functions
    const authImports = authCollections.length > 0 ? `
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  updatePassword,
  setPersistence,
  browserSessionPersistence,
  browserLocalPersistence,
  reauthenticateWithCredential,
  EmailAuthProvider,
  onAuthStateChanged // New: For real-time auth state listening
} from 'firebase/auth';
import { auth } from '@/firebase'; // Assumed to be your initialized Firebase Auth instance` : '';

    // Generate initialization of Firestore collection actions
    // Note: The `state` object is passed to each action factory.
    // The `useFirestoreCollectionActions` from the previous step is now imported as a named export.
    const actionInits = collections.map(col =>
      `const ${col}Actions = use${capitalize(col)}Actions(state);`
    ).join('\n  ');

    // Generate action spreads for the return object
    const actionSpreads = collections.map(col =>
      `...${col}Actions`
    ).join(',\n    ');

    // Conditional Auth Actions block
    let authActions = '';
    if (authCollections.length > 0) {
      // Initialize the primary auth collection actions first, as auth actions will depend on it.
      const primaryAuthCollectionInit = primaryAuthCollection ?
        `const ${primaryAuthCollection}Actions = useFirestoreCollectionActions('${primaryAuthCollection}', state);` : '';

      authActions = `
    // Initialize primary authentication collection actions for profile management
    ${primaryAuthCollectionInit}

    /**
     * Authenticates a user with email and password.
     * @async
     * @param {string} email - User email.
     * @param {string} password - User password.
     * @returns {Promise<Object>} Authentication response with user data.
     * @throws {Error} If authentication fails.
     *
     * @example
     * try {
     * const user = await store.login('user@example.com', 'password123');
     * console.log('Logged in:', user);
     * } catch (error) {
     * console.error('Login failed:', error.message);
     * }
     */
    async login(email, password) {
      state.loading.value = true;
      state.error.value = null;
      try {
          // Set Firebase persistence based on user choice
        await setPersistence(auth, browserLocalPersistence);
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        let user = {
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          emailVerified: userCredential.user.emailVerified,
          displayName: userCredential.user.displayName,
          photoURL: userCredential.user.photoURL,
          metadata: {
            creationTime: userCredential.user.metadata.creationTime,
            lastSignInTime: userCredential.user.metadata.lastSignInTime
          }
        };

        // Fetch user profile from Firestore if primaryAuthCollection is defined
        if (user.uid && ${primaryAuthCollection ? primaryAuthCollection + 'Actions' : 'null'}) {
          try {
            const userProfile = await ${primaryAuthCollection}Actions.get${capitalize(primaryAuthCollection)}(user.uid);
            if (userProfile) {
              user = { ...user, ...userProfile }; // Merge Firestore data
            }
          } catch (profileError) {
            console.warn('User profile fetch failed during login:', profileError.message);
            // Do not block login if profile fetch fails
          }
        }

        state.currentUser.value = user;
        
        return { success: true, user: state.currentUser.value };
      } catch (error) {
        let errorMessage = 'Authentication failed';
        switch (error.code) {
          case 'auth/user-not-found':
            errorMessage = 'No user found with this email.';
            break;
          case 'auth/wrong-password':
            errorMessage = 'Incorrect password.';
            break;
          case 'auth/invalid-credential': // Modern Firebase Auth error for invalid email/password
            errorMessage = 'Invalid email or password.';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Too many failed login attempts. Account temporarily locked.';
            break;
          case 'auth/user-disabled':
            errorMessage = 'This account has been disabled.';
            break;
          default:
            errorMessage = error.message || 'An unknown authentication error occurred.';
        }
        state.error.value = errorMessage;
       
        throw { code: error.code, message: errorMessage, originalError: error };
      } finally {
        state.loading.value = false;
      }
    },

    /**
     * Creates a new user account with comprehensive registration.
     * Automatically sends email verification if enabled.
     * @async
     * @param {string} email - User email.
     * @param {string} password - User password.
     * @param {Object} [profileData={}] - Additional user profile data to store in Firestore (e.g., { displayName: 'John Doe', roles: ['customer'] }).
     * @param {boolean} [sendVerification=true] - Whether to send email verification after registration.
     * @returns {Promise<Object>} Registration response with user data.
     * @throws {Error} If registration fails.
     *
     * @example
     * try {
     * const result = await store.signUp(
     * 'newuser@example.com',
     * 'SecurePassword123!',
     * { displayName: 'John Doe', role: 'customer' },
     * true
     * );
     * console.log('User created:', result.user);
     * } catch (error) {
     * console.error('Registration failed:', error.message);
     * }
     */
    async signUp(email, password, profileData = {}, sendVerification = true) {
      state.loading.value = true;
      state.error.value = null;
      try {
        // Create user account with Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const firebaseUser = userCredential.user;

        // Update Firebase Auth profile (displayName, photoURL)
        if (profileData.displayName || profileData.photoURL) {
          await updateProfile(firebaseUser, {
            displayName: profileData.displayName,
            photoURL: profileData.photoURL
          });
        }

        // Prepare user data for Firestore profile
        const userFirestoreData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          emailVerified: firebaseUser.emailVerified,
          displayName: firebaseUser.displayName || profileData.displayName || null,
          photoURL: firebaseUser.photoURL || profileData.photoURL || null,
          createdAt: firebaseUser.metadata.creationTime,
          lastSignInTime: firebaseUser.metadata.lastSignInTime,
          ...profileData // Merge additional profile data
        };

        // Save user profile to Firestore if primaryAuthCollection is defined
        if (${primaryAuthCollection ? primaryAuthCollection + 'Actions' : 'null'}) {
          await ${primaryAuthCollection}Actions.add${capitalize(primaryAuthCollection)}(userFirestoreData);
        }

        // Send verification email if requested
        if (sendVerification) {
          await sendEmailVerification(firebaseUser);
          state.emailVerificationSent.value = true;
        }

        state.currentUser.value = userFirestoreData; // Update local state with full profile
       
        return { success: true, user: state.currentUser.value };
      } catch (error) {
        let errorMessage = 'Registration failed';
        switch (error.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'This email address is already registered.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'The email address is not valid.';
            break;
          case 'auth/weak-password':
            errorMessage = 'The password is too weak. Please choose a stronger password.';
            break;
          case 'auth/operation-not-allowed':
            errorMessage = 'Email/password accounts are not enabled. Please contact support.';
            break;
          default:
            errorMessage = error.message || 'An unknown registration error occurred.';
        }
        state.error.value = errorMessage;
        
        throw { code: error.code, message: errorMessage, originalError: error };
      } finally {
        state.loading.value = false;
      }
    },

    /**
     * Signs out the current user and cleans up session.
     * @async
     * @returns {Promise<{success: boolean}>} Logout result.
     *
     * @example
     * await store.logout();
     * console.log('User signed out');
     */
    async logout() {
      state.loading.value = true;
      state.error.value = null;
      try {
        const uid = state.currentUser.value?.uid;
        await signOut(auth);
        state.currentUser.value = null;
        state.emailVerificationSent.value = false;
        
        return { success: true };
      } catch (error) {
        state.error.value = error.message;
        
        throw { code: 'auth/logout-failed', message: 'Logout failed', originalError: error };
      } finally {
        state.loading.value = false;
      }
    },

    /**
     * Sends a password reset email to the specified address.
     * @async
     * @param {string} email - Email address to send reset instructions to.
     * @returns {Promise<{success: boolean}>} Reset email status.
     *
     * @example
     * try {
     * await store.sendPasswordReset('user@example.com');
     * console.log('Password reset email sent');
     * } catch (error) {
     * console.error('Reset failed:', error.message);
     * }
     */
    async sendPasswordReset(email) {
      state.loading.value = true;
      state.error.value = null;
      try {
        await sendPasswordResetEmail(auth, email);
       
        return { success: true };
      } catch (error) {
        let errorMessage = 'Password reset failed';
        switch (error.code) {
          case 'auth/user-not-found':
            errorMessage = 'No user found with this email address.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'The email address is not valid.';
            break;
          default:
            errorMessage = error.message || 'An unknown error occurred while sending reset email.';
        }
        state.error.value = errorMessage;
       
        throw { code: error.code, message: errorMessage, originalError: error };
      } finally {
        state.loading.value = false;
      }
    },

    /**
     * Updates the current user's profile information in Firebase Auth and Firestore.
     * @async
     * @param {Object} profileData - Profile data to update. Can include displayName and photoURL.
     * @returns {Promise<{success: boolean, user: Object}>} Update result with the updated user object.
     * @throws {Error} If the update fails.
     *
     * @example
     * await store.updateProfile({ displayName: 'New Name', photoURL: 'https://...' });
     */
    async updateProfile(profileData) {
      state.loading.value = true;
      state.error.value = null;
      try {
        if (!auth.currentUser) {
          throw new Error('No authenticated user to update profile.');
        }

        await updateProfile(auth.currentUser, profileData);

        // Update local state with Firebase Auth changes
        state.currentUser.value = {
          ...state.currentUser.value,
          displayName: auth.currentUser.displayName,
          photoURL: auth.currentUser.photoURL
        };

        // Update Firestore profile if we have a primary auth collection
        if (state.currentUser.value?.uid && ${primaryAuthCollection ? primaryAuthCollection + 'Actions' : 'null'}) {
          await ${primaryAuthCollection}Actions.update(
            state.currentUser.value.uid,
            { ...profileData, updatedAt: new Date().toISOString() } // Add a timestamp for Firestore
          );
          // Re-fetch the full user profile from Firestore to ensure local state is in sync
          const updatedProfile = await ${primaryAuthCollection}Actions.get${capitalize(primaryAuthCollection)}(state.currentUser.value.uid);
          if (updatedProfile) {
            state.currentUser.value = { ...state.currentUser.value, ...updatedProfile };
          }
        }

        
        return {
          success: true,
          user: state.currentUser.value
        };
      } catch (error) {
        state.error.value = error.message;
       
        throw { code: 'auth/profile-update-failed', message: 'Profile update failed', originalError: error };
      } finally {
        state.loading.value = false;
      }
    },

    /**
     * Changes the current user's password, requiring reauthentication with the current password.
     * @async
     * @param {string} currentPassword - Current password for reauthentication.
     * @param {string} newPassword - New password to set.
     * @returns {Promise<{success: boolean}>} Password change result.
     * @throws {Error} If the password change fails.
     *
     * @example
     * try {
     * await store.changePassword('oldPassword', 'newSecurePassword123!');
     * console.log('Password changed successfully');
     * } catch (error) {
     * console.error('Password change failed:', error.message);
     * }
     */
    async changePassword(currentPassword, newPassword) {
      state.loading.value = true;
      state.error.value = null;
      try {
        if (!auth.currentUser || !auth.currentUser.email) {
          throw new Error('No authenticated user or email not available for reauthentication.');
        }

        // Reauthenticate user with their current credentials
        const credential = EmailAuthProvider.credential(
          auth.currentUser.email,
          currentPassword
        );
        await reauthenticateWithCredential(auth.currentUser, credential);

        // Update password
        await updatePassword(auth.currentUser, newPassword);

       
        return { success: true };
      } catch (error) {
        let errorMessage = 'Password change failed';
        switch (error.code) {
          case 'auth/wrong-password':
            errorMessage = 'The current password you entered is incorrect.';
            break;
          case 'auth/requires-recent-login':
            errorMessage = 'Your session has expired. Please log in again to change your password.';
            break;
          case 'auth/weak-password':
            errorMessage = 'The new password is too weak. Please choose a stronger password.';
            break;
          default:
            errorMessage = error.message || 'An unknown error occurred while changing password.';
        }
        state.error.value = errorMessage;
       
        throw { code: error.code, message: errorMessage, originalError: error };
      } finally {
        state.loading.value = false;
      }
    },

    /**
     * Initializes authentication state by setting up a real-time listener for Firebase Auth changes.
     * This method should typically be called once when the application starts.
     * It fetches the current user's profile from Firestore and updates the store's currentUser state.
     * @async
     * @returns {Promise<Object|null>} The current user object or null if no user is authenticated.
     *
     * @example
     * // In your main app entry point (e.g., main.js)
     * const appStore = useAppStore();
     * await appStore.fetchUser();
     * console.log('Auth initialized. Current user:', appStore.currentUser.value);
     */
    async fetchUser() {
      return new Promise((resolve) => {
        // Only set up the listener once
        if (!state.authInitialized.value) {
          onAuthStateChanged(auth, async (firebaseUser) => {
            try {
              if (firebaseUser) {
                // Fetch additional user data from Firestore if primaryAuthCollection is defined
                  try {
                    const userProfile = await ${primaryAuthCollection}Actions.get${capitalize(primaryAuthCollection)}(firebaseUser.uid);
                    state.currentUser.value = {
                      uid: firebaseUser.uid,
                      email: firebaseUser.email,
                      emailVerified: firebaseUser.emailVerified,
                      displayName: firebaseUser.displayName,
                      photoURL: firebaseUser.photoURL,
                      metadata: {
                        creationTime: firebaseUser.metadata.creationTime,
                        lastSignInTime: firebaseUser.metadata.lastSignInTime
                      },
                      ...userProfile // Merge Firestore data
                    };
                  } catch (profileError) {
                    console.error('Error fetching user profile from Firestore:', profileError);
                    // Fallback to basic auth info if profile fetch fails
                    state.currentUser.value = {
                      uid: firebaseUser.uid,
                      email: firebaseUser.email,
                      emailVerified: firebaseUser.emailVerified,
                      displayName: firebaseUser.displayName,
                      photoURL: firebaseUser.photoURL,
                      metadata: {
                        creationTime: firebaseUser.metadata.creationTime,
                        lastSignInTime: firebaseUser.metadata.lastSignInTime
                      }
                    };
                  }
              } else {
                state.currentUser.value = null; // No user logged in
              }
            } catch (error) {
              console.error('Error processing auth state change:', error);
              state.currentUser.value = null;
              state.error.value = error.message;
            } finally {
              // Mark authentication as initialized after the first state change check
              state.authInitialized.value = true;
              resolve(state.currentUser.value);
            }
          });
        } else {
          // If listener already exists, just resolve with current user state
          resolve(state.currentUser.value);
        }
      });
    },

    /**
     * Resends email verification to the current user.
     * @async
     * @returns {Promise<{success: boolean}>} Verification email status.
     * @throws {Error} If no user is authenticated or sending fails.
     */
    async resendVerificationEmail() {
      state.loading.value = true;
      state.error.value = null;
      try {
        if (!auth.currentUser) {
          throw new Error('No authenticated user to send verification email.');
        }
        await sendEmailVerification(auth.currentUser);
        state.emailVerificationSent.value = true;
        
        return { success: true };
      } catch (error) {
        let errorMessage = 'Failed to send verification email.';
        switch (error.code) {
          case 'auth/too-many-requests':
            errorMessage = 'Too many requests. Please wait before trying again.';
            break;
          default:
            errorMessage = error.message || 'An unknown error occurred.';
        }
        state.error.value = errorMessage;
        
        throw { code: error.code, message: errorMessage, originalError: error };
      } finally {
        state.loading.value = false;
      }
    },
    `;
    }

    writeFile(
      path.join(baseDir, 'index.js'),
      `import { defineStore } from 'pinia';
import { ref } from 'vue'; // New: Import ref for internal state management
import use${pascalStoreName}State from './state.js'; // Assuming this defines initial reactive state
${authImports}
import { useFirestoreCollectionActions } from '@/utils/useFirestoreCollectionActions'; // Import the main Firestore utility
${actionImports}

/**
 * ${pascalStoreName} Store
 * Provides centralized state management and actions for the application,
 * including Firebase Authentication and Firestore data interactions.
 *
 * @typedef {Object} AuthResponse
 * @property {boolean} success - Indicates if the operation was successful.
 * @property {Object} [user] - The authenticated user object, if applicable.
 *
 * @typedef {Object} StoreError
 * @property {string} code - A specific error code (e.g., Firebase Auth error code).
 * @property {string} message - A human-readable error message.
 * @property {Error} [originalError] - The original error object from Firebase or other sources.
 */
export const use${pascalStoreName} = defineStore('${storeName}', () => {
  // Use the state defined in a separate file (e.g., src/stores/state.js)
  const state = use${pascalStoreName}State();

  // Internal state for managing auth listener unsubscribe
  const _authListenerUnsubscribe = ref(null);
  state._authListenerUnsubscribe = _authListenerUnsubscribe; // Expose to state for fetchUser to manage

  // Initialize all collection-specific actions
  ${actionInits}

  return {
    ...state, // Spread all reactive state properties from use${pascalStoreName}State()
    ${authActions} // Conditional Firebase Auth actions
    ${actionSpreads} // Spread all collection-specific actions
  };
});`
    );
  } catch (error) {
    throw new Error(`Error generating index file: ${error.message}`);
  }
};
