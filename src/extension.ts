import * as vscode from 'vscode';

let chatHistory: string[] = ["console.log('Hello World');\r\nlet b = 10;\r\nlet a = b + b\r\nconsole.log(a)", "Sample Text", "AI Response"];

export function activate(context: vscode.ExtensionContext) {
    const decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 255, 0, 0.3)', // Light yellow highlight
    });

    vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        if (event.contentChanges[0].text.length > 10) {
            const pastedContent = event.contentChanges[0].text;
            vscode.window.showInformationMessage(`Pasted content: ${pastedContent}`);
            // Store the pasted content in a variable
            let capturedContent = pastedContent;
            console.log(`Captured content: ${capturedContent}`);
        }

        const text = editor.document.getText();
        const decorations: vscode.DecorationOptions[] = [];

        chatHistory.forEach(historyEntry => {
            let matchIndex = text.indexOf(historyEntry);
            while (matchIndex !== -1) {
                const startPos = editor.document.positionAt(matchIndex);
                const endPos = editor.document.positionAt(matchIndex + historyEntry.length);
                decorations.push({ range: new vscode.Range(startPos, endPos) });
                matchIndex = text.indexOf(historyEntry, matchIndex + 1);
            }
        });

        editor.setDecorations(decorationType, decorations);
    });
}

export function deactivate() {}
