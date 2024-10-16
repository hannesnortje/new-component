import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// Utility function to convert a string to PascalCase
function toPascalCase(str: string): string {
    return str
        .split(' ')
        .map(word => {
            return word === word.toUpperCase()
                ? word
                : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join('');
}

// Utility function to convert a string to KebabCase
function toKebabCase(str: string): string {
    return str
        .split(' ')
        .map(word => word.toLowerCase())
        .join('-');
}

// Function to load available versions (subfolders) from the templates folder in the workspace root
function getAvailableVersions(): string[] {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders) {
        const rootPath = workspaceFolders[0].uri.fsPath;
        const templateFolderPath = path.join(rootPath, 'templates');
        
        if (fs.existsSync(templateFolderPath)) {
            return fs.readdirSync(templateFolderPath).filter(folder => {
                return fs.lstatSync(path.join(templateFolderPath, folder)).isDirectory();
            });
        }
    }
    return [];
}

// Function to load the template from a versioned folder in the workspace's templates folder
function loadTemplate(version: string, templateFileName: string): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        throw new Error('No workspace folder found.');
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const templateFolderPath = path.join(rootPath, 'templates', version);
    const templateFilePath = path.join(templateFolderPath, templateFileName);

    if (fs.existsSync(templateFilePath)) {
        return fs.readFileSync(templateFilePath, 'utf8');
    } else {
        throw new Error(`Template not found: ${templateFileName} for version ${version}`);
    }
}

// Function to create component files and folder structure
async function createComponentFiles(selectedFolder: vscode.Uri, name: string, version: string, description: string) {
    // Convert component name to PascalCase and KebabCase
    const pascalCaseName = toPascalCase(name);
    const kebabCaseName = toKebabCase(name);
    const componentDir = vscode.Uri.file(`${selectedFolder.fsPath}/${pascalCaseName}`);

    try {
        // Check if the component folder already exists
        let componentDirExists = false;
        try {
            await vscode.workspace.fs.stat(componentDir);
            componentDirExists = true;
        } catch (error) {
            componentDirExists = false;
        }

        if (!componentDirExists) {
            // If component folder does not exist, create it
            await vscode.workspace.fs.createDirectory(componentDir);
        }

        const versionDir = vscode.Uri.file(`${componentDir.fsPath}/${version}`);

        // Check if the version folder already exists
        let versionDirExists = false;
        try {
            await vscode.workspace.fs.stat(versionDir);
            versionDirExists = true;
        } catch (error) {
            versionDirExists = false;
        }

        if (versionDirExists) {
            vscode.window.showInformationMessage(`Version ${version} already exists for component ${pascalCaseName}.`);
            return;
        }

        // Create the version folder
        await vscode.workspace.fs.createDirectory(versionDir);

        // Create an empty .component.xml file in the version folder
        const xmlFile = vscode.Uri.file(`${versionDir.fsPath}/${pascalCaseName}.component.xml`);
        const emptyContent = Buffer.from('', 'utf8');
        await vscode.workspace.fs.writeFile(xmlFile, emptyContent);

        // Create src, test directories inside the version folder
        const srcDir = vscode.Uri.file(`${versionDir.fsPath}/src`);
        const testDir = vscode.Uri.file(`${versionDir.fsPath}/test`);
        await vscode.workspace.fs.createDirectory(srcDir);
        await vscode.workspace.fs.createDirectory(testDir);

        // Create html/weBeans, js, less directories inside src
        const htmlDir = vscode.Uri.file(`${srcDir.fsPath}/html`);
        const jsDir = vscode.Uri.file(`${srcDir.fsPath}/js`);
        const lessDir = vscode.Uri.file(`${srcDir.fsPath}/less`);
        await vscode.workspace.fs.createDirectory(htmlDir);
        await vscode.workspace.fs.createDirectory(jsDir);
        await vscode.workspace.fs.createDirectory(lessDir);

        const weBeansDir = vscode.Uri.file(`${htmlDir.fsPath}/weBeans`);
        await vscode.workspace.fs.createDirectory(weBeansDir);

        // --- Create the test/html and test/js directories ---
        const testHtmlDir = vscode.Uri.file(`${testDir.fsPath}/html`);
        const testJsDir = vscode.Uri.file(`${testDir.fsPath}/js`);
        await vscode.workspace.fs.createDirectory(testHtmlDir);
        await vscode.workspace.fs.createDirectory(testJsDir);

        // --- Create the .weBean.html file ---
        const weBeanFileContent = loadTemplate(version, 'Template.weBean.html')
            .replace(/\$\{pascalCaseName\}/g, pascalCaseName)
            .replace(/\$\{kebabCaseName\}/g, kebabCaseName);

        const weBeanFile = vscode.Uri.file(`${weBeansDir.fsPath}/${pascalCaseName}.weBean.html`);
        await vscode.workspace.fs.writeFile(weBeanFile, Buffer.from(weBeanFileContent, 'utf8'));

        // --- Create the .class.js file ---
        const classJsFileContent = loadTemplate(version, 'Template.class.js')
            .replace(/\$\{pascalCaseName\}/g, pascalCaseName)
            .replace(/\$\{kebabCaseName\}/g, kebabCaseName)
            .replace(/\$\{componentDescription\}/g, description);

        const classJsFile = vscode.Uri.file(`${jsDir.fsPath}/${pascalCaseName}.class.js`);
        await vscode.workspace.fs.writeFile(classJsFile, Buffer.from(classJsFileContent, 'utf8'));

        // --- Create the .less file ---
        const lessFileContent = loadTemplate(version, 'Template.less')
            .replace(/\$\{kebabCaseName\}/g, kebabCaseName);

        const lessFile = vscode.Uri.file(`${lessDir.fsPath}/Default${pascalCaseName}.less`);
        await vscode.workspace.fs.writeFile(lessFile, Buffer.from(lessFileContent, 'utf8'));

        // --- Create the .html test file in test/html ---
        const componentPath = `/${pascalCaseName}/${version}/${pascalCaseName}.component.xml`;
        const testHtmlFileContent = loadTemplate(version, 'TemplateTest.html')
            .replace(/\$\{pascalCaseName\}/g, pascalCaseName)
            .replace(/\$\{version\}/g, version)
            .replace(/\$\{componentPath\}/g, componentPath);

        const testHtmlFile = vscode.Uri.file(`${testHtmlDir.fsPath}/${pascalCaseName}.html`);
        await vscode.workspace.fs.writeFile(testHtmlFile, Buffer.from(testHtmlFileContent, 'utf8'));

        vscode.window.showInformationMessage(`Component ${pascalCaseName} version ${version} created successfully with .weBean.html, .class.js, .less, and test .html files!`);
    } catch (err) {
        const error = err as Error;  // Explicitly cast err to Error
        vscode.window.showErrorMessage(`Error creating component files: ${error.message}`);
    }
}

// Function to handle directory selection and component creation
async function selectDirectoryAndCreateComponent(name: string, version: string, description: string) {
    const uri = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Component Directory',
    });

    if (!uri || uri.length === 0) {
        vscode.window.showErrorMessage('No folder selected for component creation.');
        return;
    }

    const selectedFolderUri = uri[0];
    await createComponentFiles(selectedFolderUri, name, version, description);
}

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('extension.createComponent', () => {
        // Create and show a new webview
        const panel = vscode.window.createWebviewPanel(
            'newComponent', // Identifies the type of the webview
            'Create New Component', // Title of the panel
            vscode.ViewColumn.One, // Editor column to show the new webview panel in
            { enableScripts: true } // Enable JavaScript in the webview
        );

        // Get available versions dynamically from the workspace's templates folder
        const availableVersions = getAvailableVersions();

        // HTML content for the webview, dynamically including version options
        panel.webview.html = getWebviewContent(availableVersions);

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'alert':
                        vscode.window.showInformationMessage(message.text);
                        return;
                    case 'createComponent':
                        await selectDirectoryAndCreateComponent(message.componentName, message.componentVersion, message.componentDescription);
                        return;
                }
            },
            undefined,
            context.subscriptions
        );
    });

    context.subscriptions.push(disposable);
}

// Generate the HTML content for the webview with dynamically populated version options
function getWebviewContent(availableVersions: string[]) {
    // Generate the version dropdown options
    const versionOptions = availableVersions.map(version => `<option value="${version}">${version}</option>`).join('');

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Component Creator</title>
        <style>
            body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px; }
            #new-component { background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); max-width: 600px; margin: auto; }
            h2 { text-align: center; color: #333; }
            label { display: block; margin-top: 20px; font-weight: bold; }
            input, textarea, select { width: 100%; padding: 10px; margin-top: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
            button { width: 100%; padding: 12px; margin-top: 20px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
            button:hover { background-color: #45a049; }
        </style>
    </head>
    <body>
        <div id="new-component">
            <h2>Create New Component</h2>
            <form id="newComponentForm">
                <label for="componentName">Component Name (2-3 words):</label>
                <input type="text" id="componentName" name="componentName" required />
                
                <label for="componentVersion">Component Version:</label>
                <select id="componentVersion" name="componentVersion" required>
                    ${versionOptions}
                </select>
                
                <label for="componentDescription">Description:</label>
                <textarea id="componentDescription" name="componentDescription" required></textarea>
                <button type="submit">Create Component</button>
            </form>
        </div>

        <script>
            const vscode = acquireVsCodeApi();

            document.getElementById('newComponentForm').addEventListener('submit', function(event) {
                event.preventDefault();
                const componentName = document.getElementById('componentName').value;
                const componentVersion = document.getElementById('componentVersion').value;
                const componentDescription = document.getElementById('componentDescription').value;

                vscode.postMessage({
                    command: 'createComponent',
                    componentName: componentName,
                    componentVersion: componentVersion,
                    componentDescription: componentDescription
                });
            });
        </script>
    </body>
    </html>`;
}
