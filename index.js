#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { generateIndexFile } from './helper/generateIndexFile.js';
import { generateStateFile } from './helper/generateStateFile.js';
import { generateActivityLogger } from './helper/generateActivityLogger.js';
import { generateDocumentation } from './helper/generateDocumentation.js';
import { generateCollectionActionModule } from './helper/generateCollectionActionModule.js';
import { generateFirestoreUtilFile } from './helper/generateFirestoreUtilFile.js';
import { toCamel, writeFile, toCamelCase, capitalize } from './helper/helperF.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (question) => 
  new Promise(resolve => rl.question(question, answer => resolve(answer.trim())));

const ensureDir = (dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  } catch (error) {
    throw new Error(`Failed to create directory: ${dirPath}\n${error.message}`);
  }
};

const isAuthCollection = (collectionName) => {
  const authCollections = ['users', 'user', 'customer', 'client', 'clients', 'customers', 'student','students', 'admins', 'admin', 'accounts', 'account'];
  return authCollections.includes(collectionName.toLowerCase());
};

async function generateStore() {
  try {
    const storeName = await ask('Enter store name (e.g. appStore): ');
    if (!storeName) throw new Error('Store name is required');
    
    const collectionsInput = await ask('Enter Firestore collections (comma-separated): ');
    const collections = collectionsInput.split(',').map(c => toCamelCase(c).trim()).filter(Boolean);
    if (collections.length === 0) throw new Error('At least one collection is required');
    
    const authCollections = collections.filter(isAuthCollection);
    let roles = [];
    
    if (authCollections.length > 0) {
      const rolesInput = await ask('Enter roles for authorization (comma-separated, e.g., admin,editor,user): ');
      roles = rolesInput.split(',').map(r => r.trim()).filter(Boolean);
    }

    const baseDir = path.join('stores', storeName);
    const actionsDir = path.join(baseDir, 'actions');

    ensureDir(actionsDir);

    let addActivityLogging = false;
    if (authCollections.length > 0) {
      const activityLogInput = await ask('Add activity logging system? (y/n): ');
      addActivityLogging = activityLogInput.toLowerCase() === 'y';
    }

    // Generate files in correct order
    generateStateFile(baseDir, collections, authCollections, addActivityLogging);
    generateFirestoreUtilFile(baseDir, authCollections, roles, addActivityLogging);
    
    // Generate collection action modules
    collections.forEach(collection => {
      generateCollectionActionModule(baseDir, collection);
    });

    generateIndexFile(storeName, baseDir, collections, authCollections, addActivityLogging);

    if (addActivityLogging) {
      generateActivityLogger(baseDir);
    }

    generateDocumentation(storeName, baseDir, collections, authCollections, roles, addActivityLogging);

    console.log(`✅ Store ${storeName} generated successfully.`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error.stack);
  } finally {
    rl.close();
  }
}

generateStore();