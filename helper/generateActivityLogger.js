// generateActivityLogger.js
import path from 'path';
import { writeFile } from './helperF.js';

/**
 * Generates enterprise-grade activity logger with advanced features
 * @param {string} baseDir - Base directory path
 */
export const generateActivityLogger = (baseDir) => {
  try {
    writeFile(
      path.join(baseDir, 'activityLogger.js'),
      `import { addDoc, collection, query, orderBy, limit, onSnapshot, getDoc, getDocs, where, startAfter } from "firebase/firestore";
import { Timestamp } from "firebase/firestore";
import { db } from "@/firebase";

let unsubscribeActivity = null;

/**
 * Activity Logger Module
 * @namespace ActivityLogger
 * @description Provides enterprise-grade activity tracking with real-time updates for comprehensive auditing.
 */

/**
 * Internal helper to get actor context from the store.
 * @param {Object} store - Pinia store instance
 * @returns {Object} Actor context (actorId, actorEmail, actorName, actorType, isAdminAction)
 * @private
 */
export const _getActorContext = (store) => {
  const currentUser = store.currentUser?.value;
  return currentUser
    ? {
        actorId: currentUser.uid,
        actorEmail: currentUser.email,
        actorName: currentUser.displayName || currentUser.email,
        actorType: currentUser.roles?.includes('admin') ? 'Admin' : 'User', // Determine type based on roles
        isAdminAction: currentUser.roles?.includes('admin') || false,
      }
    : {
        actorId: 'system_generated',
        actorEmail: 'system@yourdomain.com',
        actorName: 'System',
        actorType: 'System',
        isAdminAction: false,
      };
};

/**
 * Logs system activity with comprehensive context, including actor and target information.
 * @memberof ActivityLogger
 * @param {Object} activity - Activity data to log
 * @param {string} activity.type - Activity type (e.g., "USER_LOGIN", "ORDER_CREATED", "USER_DISABLED")
 * @param {string} activity.description - Detailed activity description
 * @param {string} [activity.actorId] - ID of the entity performing the action. Defaults to 'system_generated' if not provided.
 * @param {string} [activity.actorEmail] - Email of the entity performing the action.
 * @param {string} [activity.actorName] - Display name of the entity performing the action.
 * @param {string} [activity.actorType='User'] - Type of the entity performing the action ('User', 'Admin', 'System'). Defaults to 'User'.
 * @param {string} [activity.targetId] - ID of the entity the action was performed *on* or *for*.
 * @param {string} [activity.targetType] - Type of the target entity (e.g., 'User', 'Order', 'Product').
 * @param {string} [activity.targetName] - Display name of the target entity (e.g., a username, order ID, product name).
 * @param {string} [activity.ipAddress] - IP address from which the action originated.
 * @param {boolean} [activity.isAdminAction=false] - True if the action was performed by an administrator.
 * @param {Object} store - Pinia store instance
 * @returns {Promise<{success: boolean, activityId?: string}>} Operation result
 *
 * @example
 * // Log user login activity
 * await logActivity({
 * type: 'USER_LOGIN',
 * description: 'User logged in via email',
 * ipAddress: '192.168.1.100' // Assuming you have access to this
 * }, store);
 */
export const logActivity = async (activity, store) => {
  try {
    const activityRef = await addDoc(collection(db, "recentActivity"), {
      type: activity.type,
      description: activity.description,
      actorId: activity.actorId || 'system_generated',
      actorEmail: activity.actorEmail || 'system@yourdomain.com',
      actorName: activity.actorName || 'System',
      actorType: activity.actorType || 'System',
      targetId: activity.targetId || null,
      targetType: activity.targetType || null,
      targetName: activity.targetName || null,
      ipAddress: activity.ipAddress || null,
      isAdminAction: activity.isAdminAction || false,
      timestamp: Timestamp.now(),
    });

    return { success: true, activityId: activityRef.id };
  } catch (err) {
    console.error("[Activity Logger] Log error:", err);
    store.error.value = "Failed to log activity";
    return { success: false, error: err.message };
  }
};

/**
 * Initializes real-time activity listener with advanced features for recent activity feeds.
 * Supports filtering for all activities (admin) or user-specific activities.
 * @memberof ActivityLogger
 * @param {Object} store - Pinia store instance
 * @param {Object} [options] - Configuration options
 * @param {number} [options.limit=50] - Number of activities to fetch
 * @param {string} [options.forUserId] - Specific user ID to filter activities where *they* are the actor OR the target.
 * If null or undefined, fetches general recent activity (e.g., for admin dashboard).
 * @param {string|string[]} [options.types] - Activity types to include.
 * @param {boolean} [options.isAdminView=false] - Set to true to fetch all activities for an admin dashboard view.
 * Overrides \`forUserId\` if true, showing all site activity.
 *
 * @example
 * // Initialize listener for admin dashboard (all recent activity)
 * initRecentActivityListener(store, {
 * limit: 100,
 * isAdminView: true
 * });
 */
export const initRecentActivityListener = (store, options = {}) => {
  try {
    cleanupActivityListener();

    const { limit = 50, forUserId, types, isAdminView = false } = options;
    const constraints = [orderBy("timestamp", "desc"), limit(limit)];

    if (isAdminView) {
      console.debug("[Activity Logger] Initializing listener for admin view (all activities).");
    } else if (forUserId) {
      constraints.push(where("actorId", "==", forUserId));
      console.debug(\`[Activity Logger] Initializing listener for user \${forUserId} (actions by them).\`);
    }

    if (types) {
      const typeArray = Array.isArray(types) ? types : [types];
      if (typeArray.length > 0) {
        constraints.push(where("type", "in", typeArray));
      }
    }

    const q = query(collection(db, "recentActivity"), ...constraints);

    unsubscribeActivity = onSnapshot(q,
      (snapshot) => {
        store.recentActivity.value = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            timestamp: data.timestamp?.toDate()
          };
        });
      },
      (error) => {
        console.error("[Activity Listener] Error:", error);
        store.error.value = "Activity feed update failed";
      }
    );

    console.debug("[Activity Logger] Listener initialized");
  } catch (error) {
    console.error("[Activity Logger] Listener setup failed:", error);
    store.error.value = "Activity listener initialization error";
  }
};

/**
 * Cleans up activity listener resources
 * @memberof ActivityLogger
 *
 * @example
 * // Clean up when component is unmounted
 * onUnmounted(() => cleanupActivityListener());
 */
export const cleanupActivityListener = () => {
  if (unsubscribeActivity) {
    unsubscribeActivity();
    unsubscribeActivity = null;
    console.debug("[Activity Logger] Listener cleaned up");
  }
};

/**
 * Advanced activity search with pagination.
 * @memberof ActivityLogger
 * @param {Object} criteria - Search criteria
 * @param {string} [criteria.actorId] - Filter by the ID of the user who performed the action.
 * @param {string} [criteria.targetId] - Filter by the ID of the user/entity the action was performed *on*.
 * @param {string|string[]} [criteria.types] - Activity types.
 * @param {Date} [criteria.startDate] - Start date range.
 * @param {Date} [criteria.endDate] - End date range.
 * @param {boolean} [criteria.isAdminAction] - Filter for actions performed by admins.
 * @param {number} [pageSize=25] - Results per page.
 * @param {DocumentSnapshot} [lastVisible] - Last document from previous page for pagination.
 * @returns {Promise<{activities: Array, lastVisible: DocumentSnapshot}>} Search results
 */
export const searchActivities = async (criteria, pageSize = 25, lastVisible = null) => {
  try {
    const { actorId, targetId, types, startDate, endDate, isAdminAction } = criteria;
    let baseQuery = collection(db, "recentActivity");
    let constraints = [orderBy("timestamp", "desc"), limit(pageSize)];

    if (startDate) {
      constraints.push(where("timestamp", ">=", Timestamp.fromDate(startDate)));
    }

    if (endDate) {
      constraints.push(where("timestamp", "<=", Timestamp.fromDate(endDate)));
    }

    if (isAdminAction !== undefined) {
      constraints.push(where("isAdminAction", "==", isAdminAction));
    }

    if (actorId && targetId) {
      const q1 = query(baseQuery, where("actorId", "==", actorId), ...constraints);
      const q2 = query(baseQuery, where("targetId", "==", targetId), ...constraints);

      const [snapshot1, snapshot2] = await Promise.all([getDocs(q1), getDocs(q2)]);

      let combinedDocs = {};
      snapshot1.docs.forEach(doc => combinedDocs[doc.id] = doc);
      snapshot2.docs.forEach(doc => combinedDocs[doc.id] = doc);

      const uniqueDocs = Object.values(combinedDocs);
      uniqueDocs.sort((a, b) => b.data().timestamp.toMillis() - a.data().timestamp.toMillis());

      const activities = uniqueDocs.slice(0, pageSize).map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate()
      }));
      const lastDoc = uniqueDocs[pageSize - 1] || null;

      return {
        activities: activities,
        lastVisible: lastDoc
      };

    } else if (actorId) {
      constraints.push(where("actorId", "==", actorId));
    } else if (targetId) {
      constraints.push(where("targetId", "==", targetId));
    }

    if (types) {
      const typeArray = Array.isArray(types) ? types : [types];
      constraints.push(where("type", "in", typeArray));
    }

    if (lastVisible) {
      constraints.push(startAfter(lastVisible));
    }

    const q = query(baseQuery, ...constraints);
    const snapshot = await getDocs(q);

    return {
      activities: snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate()
      })),
      lastVisible: snapshot.docs[snapshot.docs.length - 1] || null
    };
  } catch (error) {
    console.error("[Activity Search] Failed:", error);
    throw new Error("Activity search operation failed: " + error.message);
  }
};

/**
 * Export all activity logger functions
 */
export default {
  logActivity,
  initRecentActivityListener,
  cleanupActivityListener,
  searchActivities,
  _getActorContext // Export the internal helper for use in other modules
};`
    );
  } catch (error) {
    throw new Error(`[Activity Logger] Generation failed: ${error.message}`);
  }
};