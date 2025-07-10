import fs from 'fs/promises';
import path from 'path';
import readline from 'readline';

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Prompts user with a question and returns trimmed response
 * @param {string} question - Prompt to display
 * @returns {Promise<string>} User's trimmed response
 */
const ask = question => new Promise(resolve => 
  rl.question(question, answer => resolve(answer.trim()))
);

/**
 * Converts string to camelCase
 * @param {string} str - Input string
 * @returns {string} camelCase formatted string
 */
const toCamel = str => str.replace(/-([a-z])/g, (_, char) => char.toUpperCase());

/**
 * Capitalizes the first letter of a string
 * @param {string} str - Input string
 * @returns {string} Capitalized string
 */
const capitalize = str => str.charAt(0).toUpperCase() + str.slice(1);

/**
 * Creates directory if it doesn't exist
 * @param {string} dirPath - Directory path
 */
const ensureDir = async (dirPath) => {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
};

/**
 * Creates file if it doesn't exist
 * @param {string} filePath - File path
 * @param {string} content - File content
 */
const ensureFile = async (filePath, content = '') => {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, content);
  }
};

/**
 * Generates helper functions file
 * @param {string} functionsDir - Functions directory path
 */
const generateHelpersFile = async (functionsDir) => {
  const helpersPath = path.join(functionsDir, 'helpers.js');
  const content = `const admin = require("firebase-admin");
const functions = require("firebase-functions");

  const db = admin.firestore();

/**
 * Extracts JWT token from Authorization header
 * @param {string} authHeader
 * @return {string|null}
 */
const extractToken = (authHeader) => {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.split("Bearer ")[1];
};

/**
 * Generate a random string password to be used as temporary password
 * @return {string}
 */
const generateTempPassword = () => {
  return Math.random().toString(36).slice(-10);
}

/**
 * Verifies Firebase ID token
 * @param {string} token
 * @return {Promise<admin.auth.DecodedIdToken>}
 */
const verifyFirebaseToken = async (token) => {
  if (!token) throw new Error("Missing authentication token");
  return admin.auth().verifyIdToken(token);
};

  /**
 * Create auth in firebase authentication
 * @param {string} email email for user unverified 
 * @param {string} password 
 * @name {string} user display name (firstname + lastname)
 * */
const createAuthUser = async (email, password, name) => {
  return admin.auth().createUser({
    email,
    password,
    displayName: name,
    emailVerified: false,
  });
}

/**
 * Validates required fields in request body
 * @param {Object} body
 * @param {string[]} fields
 * @return {string[]}
 */
const validateRequiredFields = (body, fields) => {
  return fields.filter((field) => !body[field]);
};
  /**
  * Set custom claims for user
  * @param {string} uid 
  * @param {string} role for user
  */
  const setCustomClaims = async (uid, role) {
  await admin.auth().setCustomUserClaims(uid, {
    forcePasswordReset: true,
    initialRole: role,
  });
}

  /**
 * Insert the new user in the admin collection
 * @param {Object} userRecord in the authentication
 * @param {object} data of the user from the html form
 * */
const createFirestoreUser = async (userRecord, data) => {
  const {firstName, lastName, role, title, qualification, callerUID} = data;
  await db.collection("admins").doc(userRecord.uid).set({
    uid: userRecord.uid,
    firstName, 
    lastName,
    role,
    title: title || "",
    qualification: qualification || "",
    createdBy: callerUID,
    status: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    
  });
}

/**
 * Reusable handler for CORS, auth, method, and error handling
 * @param {Function} handler - Your actual request logic
 * @param {string[]} methods - Allowed HTTP methods
 * @return {Function}
 */
const withAuthHandler = (handler, methods = ["POST"]) => {
  return functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.set("Access-Control-Allow-Methods", methods.join(", "));

      if (req.method === "OPTIONS") return res.status(204).send("");
      if (!methods.includes(req.method)) {
        return res
            .status(405)
            .json({error: \`Only \${methods.join(", ")} requests allowed\`});
      }

      try {
        const idToken = extractToken(req.headers.authorization);
        if (!idToken) {
          return res
              .status(401)
              .json({error: "Unauthorized: No token provided"});
        }

        const decoded = await verifyFirebaseToken(idToken);
        const callerUID = decoded.uid;
        if (!callerUID) {
          return res.status(403).json({error: "Invalid or expired token"});
        }

        await handler(req, res, decoded);
      } catch (err) {
        functions.logger.error("Function error:", err, {
          structuredData: true,
        });

        if (err.code === "EAUTH" || err.command === "API") {
          return res.status(502).json({
            error: "Email service error",
            message: "Failed to deliver email",
          });
        }

        if (err instanceof TypeError) {
          return res.status(400).json({
            error: "Bad Request",
            message: err.message,
          });
        }

        return res.status(500).json({
          error: "Internal server error",
          message: err.message || "An unexpected error occurred",
        });
      }
    });
  });
};

// Public handler without authentication
const withPublicHandler = (handler, methods = ["POST"]) => {
  return functions.https.onRequest((req, res) => {
    cors(req, res, async () => {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.set("Access-Control-Allow-Methods", methods.join(", "));

      if (req.method === "OPTIONS") return res.status(204).send("");
      if (!methods.includes(req.method)) {
        return res.status(405).json({
          error: \`Only \${methods.join(", ")} requests allowed\`,
        });
      }

      try {
        await handler(req, res);
      } catch (err) {
        functions.logger.error("Function error:", err, {
          structuredData: true,
        });

        if (err.code === "EAUTH" || err.command === "API") {
          return res.status(502).json({
            error: "Email service error",
            message: "Failed to deliver email",
          });
        }

        return res.status(500).json({
          error: "Internal server error",
          message: err.message || "An unexpected error occurred",
        });
      }
    });
  });
};

module.exports = {
  extractToken,
  verifyFirebaseToken,
  validateRequiredFields,
  withAuthHandler,
  withPublicHandler, 
  createAuthUser,
setCustomClaims,
generateTempPassword,
createFirestoreUser
};`;

  await ensureFile(helpersPath, content);
};

/**
 * Generates email sender file
 * @param {string} functionsDir - Functions directory path
 */
const generateEmailSender = async (functionsDir) => {
  const senderPath = path.join(functionsDir, 'emailSender.js');
  const content = `const nodemailer = require("nodemailer");

// Email configuration
const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@yourdomain.com";
const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST || "smtp.zoho.com",
  port: parseInt(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

// Create reusable transporter
const transporter = nodemailer.createTransport(EMAIL_CONFIG);

// Default footer template
const defaultFooter = () => \`
  <footer style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
    <p>© \${new Date().getFullYear()} Your Company. All rights reserved.</p>
  </footer>
\`;

/**
 * Sends an email using a template
 * @param {Object} params - Email parameters
 * @param {string} params.email - Recipient email
 * @param {string} params.subject - Email subject
 * @param {Object} params.templateData - Template data
 * @param {string} [params.templateData.header] - Email header content
 * @param {string} [params.templateData.body] - Email body content
 * @param {string} [params.templateData.footer] - Email footer content
 */
async function sendEmail({ email, subject, templateData }) {
  if (!email || !subject) {
    throw new Error("Missing required email parameters");
  }
  
  const { header = "", body = "", footer = defaultFooter() } = templateData;
  
  const html = \`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>\${subject}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f8f8f8; padding: 10px; text-align: center; }
        .content { padding: 20px; }
        .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">\${header}</div>
        <div class="content">\${body}</div>
        <div class="footer">\${footer}</div>
      </div>
    </body>
    </html>
  \`;

  try {
    await transporter.sendMail({
      from: EMAIL_FROM,
      to: email,
      subject,
      html,
    });
    functions.logger.info(\`Email sent to \${email}\`);
  } catch (error) {
    functions.logger.error("Email sending failed:", error);
    throw new Error(\`Email could not be sent: \${error.message}\`);
  }
}

/**
 * Sends admin notification
 * @param {string} type - Notification type
 * @param {Object} data - Notification data
 */
async function sendAdminNotification(type, data) {
  // Implement your admin notification logic here
  functions.logger.info(\`Admin notification: \${type}\`, data);
}

module.exports = {
  sendEmail,
  sendAdminNotification
};`;

  await ensureFile(senderPath, content);
};

/**
 * Generates email templates file
 * @param {string} functionsDir - Functions directory path
 */
const generateEmailTemplates = async (functionsDir) => {
  const templatesPath = path.join(functionsDir, 'emailTemplates.js');
  const content = `// Default footer template
const defaultFooter = () => \`
  <p>Best regards,<br>The Team</p>
\`;

// Template for application received
const applicationReceived = (fullName) => ({
  header: \`<h1>Welcome, \${fullName}!</h1>\`,
  body: \`
    <p>Thank you for applying to become a distributor.</p>
    <p>We'll review your application and get back to you soon.</p>
  \`,
  footer: defaultFooter()
});

// Template for account approval
const accountApproved = (name, distributorNumber) => ({
  header: \`<h1>Congratulations, \${name}!</h1>\`,
  body: \`
    <p>Your distributor account has been approved.</p>
    <p>Your distributor number: <strong>\${distributorNumber}</strong></p>
    <p>You can now log in to your dashboard.</p>
  \`,
  footer: defaultFooter()
});

// Add more templates as needed

module.exports = {
  emailTemplates: {
    applicationReceived,
    accountApproved
  }
};`;

  await ensureFile(templatesPath, content);
};

/**
 * Generates main index file
 * @param {string} functionsDir - Functions directory path
 */
const generateIndexFile = async (functionsDir) => {
  const indexPath = path.join(functionsDir, 'index.js');
  const content = `const functions = require("firebase-functions");
const admin = require("firebase-admin");
require("dotenv").config();
const cors = require("cors")({ origin: true });

// Import helpers
const { 
  withAuthHandler, 
  withPublicHandler,
  validateRequiredFields
} = require("./helpers");

// Import email modules
const eSender = require("./emailSender");
const { sendEmail, sendAdminNotification } = eSender;

const templates = require("./emailTemplates");
const emailTemplates = templates.emailTemplates;

// Initialize Firebase
admin.initializeApp();

// Export your functions below this line
// Generated functions will be appended here

module.exports = {};`;

  await ensureFile(indexPath, content);
};

/**
 * Generates function content
 * @param {Object} options - Function options
 * @returns {string} Generated function code
 */
const generateFunctionContent = (options) => {
  const {
    functionName,
    description,
    requiredFields,
    templateName,
    subject,
    isPublic,
    isEmail,
    isAdminNotification
  } = options;

  const handlerType = isPublic ? 'withPublicHandler' : 'withAuthHandler';
  const params = isPublic ? '(req, res)' : '(req, res, decoded)';
  
  let bodyContent = '';
  
  if (isEmail) {
    bodyContent += `
  const { ${requiredFields.join(', ')} } = req.body;
  
  ${templateName ? `const templateData = emailTemplates.${templateName}(${requiredFields.filter(f => f !== 'email').join(', ')});` : ''}
  
  await sendEmail({
    email,
    subject: "${subject || 'Email Subject'}",
    ${templateName ? 'templateData' : 'html: "<!-- Custom HTML content -->"'}
  });`;
  }
  
  if (isAdminNotification) {
    bodyContent += `
  await sendAdminNotification("${functionName}", {
    ${requiredFields.map(field => `${field}: ${field}`).join(',\n    ')}
  });`;
  }
  
  if (!isEmail && !isAdminNotification) {
    bodyContent += `
  // Add your custom logic here
  // Example: 
  // const result = await admin.firestore().collection('items').doc(id).get();
  // return res.status(200).json(result.data());`;
  }
  
  return `/**
 * ${description}
 *
 * Endpoint: ${isPublic ? 'Public' : 'Authenticated'} POST /${functionName}
 *
 * @name ${functionName}
 * @function
 * @param {Object} req - HTTP request object
 * @param {Object} res - HTTP response object
 */
exports.${functionName} = ${handlerType}(async ${params} => {
  const requiredFields = [${requiredFields.map(f => `"${f}"`).join(', ')}];
  const missingFields = validateRequiredFields(req.body, requiredFields);

  if (missingFields.length > 0) {
    return res.status(400).json({
      error: "Missing required fields",
      missingFields,
      message: \`Please provide: \${missingFields.join(", ")}\`,
    });
  }
  ${bodyContent}

  return res.status(200).json({
    success: true,
    message: "${isEmail ? 'Email sent successfully' : 'Operation completed successfully'}",
  });
});`;
};

/**
 * Main function to generate Firebase Cloud Function
 */
async function generateFirebaseFunction() {
  try {
    // Get project directory
    const projectDir = await ask('Enter project directory [./functions]: ') || './functions';
    await ensureDir(projectDir);
    
    // Create necessary files if they don't exist
    await generateHelpersFile(projectDir);
    await generateEmailSender(projectDir);
    await generateEmailTemplates(projectDir);
    await generateIndexFile(projectDir);
    
    // Get function details
    const functionName = await ask('Enter function name (e.g., newApplicantWelcome): ');
    if (!functionName) throw new Error('Function name is required');
    
    const description = await ask('Enter function description: ') || 'Function description';
    
    const isPublic = (await ask('Is this a public function? (y/n) [n]: ')).toLowerCase() === 'y';
    
    const isEmail = (await ask('Is this an email function? (y/n) [y]: ') || 'y').toLowerCase() === 'y';
    
    let templateName = '';
    let subject = '';
    if (isEmail) {
      templateName = await ask('Enter email template name (leave blank for custom HTML): ');
      subject = await ask('Enter email subject: ');
    }
    
    const isAdminNotification = isEmail && 
      (await ask('Send admin notification? (y/n) [n]: ') || 'n').toLowerCase() === 'y';
    
    const requiredFieldsInput = await ask('Enter required fields (comma-separated): ');
    const requiredFields = requiredFieldsInput
      .split(',')
      .map(f => f.trim())
      .filter(Boolean);
    
    if (requiredFields.length === 0) {
      throw new Error('At least one required field is needed');
    }

    // Generate function code
    const functionCode = generateFunctionContent({
      functionName,
      description,
      requiredFields,
      templateName,
      subject,
      isPublic,
      isEmail,
      isAdminNotification
    });
    
    // Append to index.js
    const indexPath = path.join(projectDir, 'index.js');
    const indexContent = await fs.readFile(indexPath, 'utf8');
    
    // Find where to insert the function
    const insertionPoint = indexContent.indexOf('// Export your functions below this line');
    if (insertionPoint === -1) {
      throw new Error('Could not find insertion point in index.js');
    }
    
    // Insert function code
    const newContent = 
      indexContent.slice(0, insertionPoint) + 
      `\n\n${functionCode}\n` + 
      indexContent.slice(insertionPoint);
    
    await fs.writeFile(indexPath, newContent);
    
    // Update module.exports
    const exportRegex = /module\.exports\s*=\s*{([^}]*)};/;
    const match = newContent.match(exportRegex);
    
    if (match) {
      const currentExports = match[1].trim();
      const newExports = currentExports ? 
        `${currentExports},\n  ${functionName}: exports.${functionName}` : 
        `${functionName}: exports.${functionName}`;
      
      const updatedContent = newContent.replace(
        exportRegex, 
        `module.exports = {\n  ${newExports}\n};`
      );
      
      await fs.writeFile(indexPath, updatedContent);
    }
    
    console.log(`✅ Function "${functionName}" added to ${indexPath}`);
    
  } catch (err) {
    console.error(`❌ Error generating function: ${err.message}`);
  } finally {
    rl.close();
  }
}

// Start generator
generateFirebaseFunction();