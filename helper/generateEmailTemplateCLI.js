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
 * Generates elegant HTML email template based on user preferences
 * @param {Object} options - User preferences
 * @returns {string} Generated HTML email template
 */
const generateEmailTemplate = (options) => {
    const {
        templateName,
        primaryColor = '#4a86e8',
        secondaryColor = '#f3f6fc',
        accentColor = '#ff7043',
        textColor = '#333333',
        backgroundColor = '#f7f9fc',
        alignment = 'center',
        fontFamily = "'Helvetica Neue', Helvetica, Arial, sans-serif",
        borderRadius = '8px',
        buttonStyle = 'solid',
        headerStyle = 'color-block',
        layoutStyle = 'card',
        includeFeatures = true,
        includeSocial = true,
        includeUnsubscribe = true
    } = options;

    // Header styles
    const headerStyles = {
        'color-block': `background-color: ${primaryColor};`,
        'gradient': `background: linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%);`,
        'image': `background: url('https://via.placeholder.com/600x150/${primaryColor.slice(1)}/ffffff?text=Your+Brand') center/cover;`
    };

    // Button styles
    const buttonStyles = {
        'solid': `background-color: ${primaryColor}; color: white;`,
        'outline': `background-color: transparent; border: 2px solid ${primaryColor}; color: ${primaryColor};`,
        'gradient': `background: linear-gradient(135deg, ${primaryColor} 0%, ${accentColor} 100%); color: white;`,
        'soft-shadow': `background-color: ${primaryColor}; color: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1);`,
        'rounded': `background-color: ${primaryColor}; color: white; border-radius: 30px;`
    };

    // Layout styles
    const layoutStyles = {
        'card': 'box-shadow: 0 4px 12px rgba(0,0,0,0.05); border-radius: 8px;',
        'minimal': 'box-shadow: none; border-radius: 0;',
        'bordered': `border: 1px solid ${secondaryColor}; border-radius: 4px;`,
        'flat': 'box-shadow: none; border-radius: 0; background: transparent;'
    };

    // Generate elegant template
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${templateName}</title>
    <style>
        /* Base styles */
        body {
            margin: 0;
            padding: 0;
            background-color: ${backgroundColor};
            font-family: ${fontFamily};
            color: ${textColor};
            line-height: 1.6;
        }
        
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            ${layoutStyles[layoutStyle]}
            overflow: hidden;
        }
        
        .header {
            ${headerStyles[headerStyle]}
            color: #ffffff;
            padding: 40px 32px;
            text-align: ${alignment};
        }
        
        .header h1 {
            margin: 0;
            font-weight: 600;
            font-size: 32px;
            text-shadow: ${headerStyle === 'image' ? '0 1px 3px rgba(0,0,0,0.3)' : 'none'};
        }
        
        .preheader {
            background-color: #f0f4f8;
            color: #6c757d;
            font-size: 14px;
            padding: 8px 32px;
            text-align: ${alignment};
        }
        
        .content {
            padding: 40px;
            text-align: ${alignment};
        }
        
        .content p {
            margin-bottom: 24px;
            font-size: 16px;
        }
        
        .cta-button {
            display: inline-block;
            ${buttonStyles[buttonStyle]}
            text-decoration: none;
            padding: 14px 36px;
            border-radius: ${borderRadius};
            font-weight: 600;
            font-size: 16px;
            margin: 20px 0;
            transition: all 0.3s ease;
        }
        
        .cta-button:hover {
            opacity: 0.9;
            transform: translateY(-2px);
            box-shadow: ${buttonStyle === 'outline' ? 'none' : '0 4px 12px rgba(0,0,0,0.1)'};
        }
        
        .features {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            margin: 30px 0;
        }
        
        .feature {
            flex: 0 0 calc(33.333% - 20px);
            margin: 10px;
            padding: 25px 15px;
            background: ${secondaryColor};
            border-radius: ${borderRadius};
            text-align: center;
            transition: transform 0.3s ease;
        }
        
        .feature:hover {
            transform: translateY(-5px);
        }
        
        .feature-icon {
            font-size: 36px;
            margin-bottom: 15px;
            color: ${primaryColor};
        }
        
        .divider {
            height: 1px;
            background: linear-gradient(90deg, transparent, ${secondaryColor}, transparent);
            margin: 40px 0;
        }
        
        .footer {
            background-color: #f8f9fa;
            padding: 32px 24px;
            text-align: center;
            font-size: 14px;
            color: #6c757d;
            border-top: 1px solid #e9ecef;
        }
        
        .social-links {
            margin: 24px 0;
        }
        
        .social-links a {
            display: inline-block;
            margin: 0 10px;
            color: ${primaryColor};
            text-decoration: none;
            font-weight: 600;
        }
        
        .unsubscribe {
            color: #6c757d;
            font-size: 13px;
            margin-top: 20px;
        }
        
        /* Responsive styles */
        @media screen and (max-width: 600px) {
            .email-container {
                border-radius: 0;
            }
            
            .header, .content {
                padding: 30px 20px;
            }
            
            .feature {
                flex: 0 0 100%;
            }
        }
    </style>
</head>
<body>
    <div class="preheader">
        This is preview text that shows in email inboxes
    </div>
    
    <div class="email-container">
        <div class="header">
            <h1>Your Brand Name</h1>
            <p>Tagline or secondary message</p>
        </div>
        
        <div class="content">
            <h2>Hello [Recipient Name],</h2>
            <p>Thank you for being a valued customer. We're excited to share our latest updates with you.</p>
            
            ${includeFeatures ? `
            <div class="features">
                <div class="feature">
                    <div class="feature-icon">✨</div>
                    <h3>Feature One</h3>
                    <p>Brief description of this exciting feature</p>
                </div>
                <div class="feature">
                    <div class="feature-icon">🚀</div>
                    <h3>Feature Two</h3>
                    <p>Brief description of this exciting feature</p>
                </div>
                <div class="feature">
                    <div class="feature-icon">💡</div>
                    <h3>Feature Three</h3>
                    <p>Brief description of this exciting feature</p>
                </div>
            </div>
            ` : ''}
            
            <a href="[Action URL]" class="cta-button">Call to Action</a>
            
            <div class="divider"></div>
            
            <p>If you have any questions, reply to this email or contact our support team.</p>
            
            <p>Best regards,<br>The [Your Brand] Team</p>
        </div>
        
        <div class="footer">
            ${includeSocial ? `
            <div class="social-links">
                <a href="[Twitter URL]">Twitter</a> • 
                <a href="[Facebook URL]">Facebook</a> • 
                <a href="[Instagram URL]">Instagram</a> • 
                <a href="[LinkedIn URL]">LinkedIn</a>
            </div>
            ` : ''}
            
            <p>&copy; ${new Date().getFullYear()} Your Brand. All rights reserved.</p>
            <p>123 Business Street, City, Country</p>
            
            ${includeUnsubscribe ? `
            <p class="unsubscribe">
                <a href="[Unsubscribe URL]">Unsubscribe</a> | 
                <a href="[Preferences URL]">Email Preferences</a> | 
                <a href="[Privacy Policy URL]">Privacy Policy</a>
            </p>
            ` : ''}
        </div>
    </div>
</body>
</html>`;
};

/**
 * Main function to generate email template
 */
async function generateEmailTemplateCLI() {
    try {
        console.log('✨ Create Beautiful Email Templates ✨\n');
        
        const templateName = await ask('Template name (e.g., WelcomeEmail): ');
        if (!templateName) throw new Error('Template name is required');
        
        // Color options
        const primaryColor = await ask('Primary color (hex code) [default: #4a86e8]: ') || '#4a86e8';
        const secondaryColor = await ask('Secondary color (hex code) [default: #f3f6fc]: ') || '#f3f6fc';
        const accentColor = await ask('Accent color (hex code) [default: #ff7043]: ') || '#ff7043';
        const textColor = await ask('Text color (hex code) [default: #333333]: ') || '#333333';
        const backgroundColor = await ask('Background color (hex code) [default: #f7f9fc]: ') || '#f7f9fc';
        
        // Layout options
        const alignmentOptions = ['left', 'center', 'right'];
        let alignment = await ask('Text alignment (left/center/right) [default: center]: ') || 'center';
        if (!alignmentOptions.includes(alignment.toLowerCase())) {
            console.log('Invalid alignment. Defaulting to center.');
            alignment = 'center';
        }
        
        const fontOptions = [
            "'Helvetica Neue', Helvetica, Arial, sans-serif",
            "'Georgia', serif",
            "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
            "'Montserrat', sans-serif",
            "'Merriweather', serif"
        ];
        console.log('\nFont options:');
        fontOptions.forEach((font, i) => console.log(`${i + 1}. ${font}`));
        const fontChoice = await ask('Select font (1-5) [default: 1]: ') || '1';
        const fontFamily = fontOptions[parseInt(fontChoice) - 1] || fontOptions[0];
        
        const borderRadiusOptions = ['none', 'slight', 'rounded', 'pill'];
        let borderRadius = await ask('Border radius (none/slight/rounded/pill) [default: rounded]: ') || 'rounded';
        if (!borderRadiusOptions.includes(borderRadius.toLowerCase())) {
            console.log('Invalid choice. Defaulting to rounded.');
            borderRadius = 'rounded';
        }
        
        // Convert to actual values
        borderRadius = borderRadius === 'none' ? '0' : 
                      borderRadius === 'slight' ? '4px' : 
                      borderRadius === 'pill' ? '30px' : '8px';
        
        // Button style
        const buttonStyles = ['solid', 'outline', 'gradient', 'soft-shadow', 'rounded'];
        console.log('\nButton styles:');
        buttonStyles.forEach((style, i) => console.log(`${i + 1}. ${style}`));
        const buttonChoice = await ask('Select button style (1-5) [default: 1]: ') || '1';
        const buttonStyle = buttonStyles[parseInt(buttonChoice) - 1] || buttonStyles[0];
        
        // Header style
        const headerStyles = ['color-block', 'gradient', 'image'];
        console.log('\nHeader styles:');
        console.log('1. Solid color block');
        console.log('2. Color gradient');
        console.log('3. Background image');
        const headerChoice = await ask('Select header style (1-3) [default: 1]: ') || '1';
        const headerStyle = headerStyles[parseInt(headerChoice) - 1] || headerStyles[0];
        
        // Layout style
        const layoutStyles = ['card', 'minimal', 'bordered', 'flat'];
        console.log('\nLayout styles:');
        console.log('1. Card (with shadow)');
        console.log('2. Minimal (clean)');
        console.log('3. Bordered');
        console.log('4. Flat (no background)');
        const layoutChoice = await ask('Select layout style (1-4) [default: 1]: ') || '1';
        const layoutStyle = layoutStyles[parseInt(layoutChoice) - 1] || layoutStyles[0];
        
        // Content options
        const includeFeatures = (await ask('Include features section? (y/n) [y]: ') || 'y').toLowerCase() === 'y';
        const includeSocial = (await ask('Include social links? (y/n) [y]: ') || 'y').toLowerCase() === 'y';
        const includeUnsubscribe = (await ask('Include unsubscribe links? (y/n) [y]: ') || 'y').toLowerCase() === 'y';
        
        // Generate template
        const template = generateEmailTemplate({
            templateName,
            primaryColor,
            secondaryColor,
            accentColor,
            textColor,
            backgroundColor,
            alignment,
            fontFamily,
            borderRadius,
            buttonStyle,
            headerStyle,
            layoutStyle,
            includeFeatures,
            includeSocial,
            includeUnsubscribe
        });
        
        // Create output directory
        const outputDir = path.join('email_templates');
        await fs.mkdir(outputDir, { recursive: true });
        
        // Save template
        const fileName = `${templateName.toLowerCase().replace(/\s+/g, '-')}.html`;
        const filePath = path.join(outputDir, fileName);
        await fs.writeFile(filePath, template);
        
        console.log(`\n✅ Email template created successfully: ${filePath}`);
        console.log('Tip: Customize the template with your brand details and content');
        console.log('Design features:');
        console.log(`- Primary color: ${primaryColor}`);
        console.log(`- Button style: ${buttonStyle}`);
        console.log(`- Header style: ${headerStyle}`);
        console.log(`- Layout style: ${layoutStyle}`);
        console.log(`- Features section: ${includeFeatures ? 'Included' : 'Excluded'}`);
        
    } catch (err) {
        console.error(`❌ Error generating template: ${err.message}`);
    } finally {
        rl.close();
    }
}

// Start generator
generateEmailTemplateCLI();