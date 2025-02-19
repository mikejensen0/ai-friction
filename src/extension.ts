import * as vscode from 'vscode';

let chatHistory: string[] = ["Hello World\nhello", "Sample Text", "AI Response"];

export function activate(context: vscode.ExtensionContext) {
    const decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 255, 0, 0.3)', // Light yellow highlight
    });

    vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const text = editor.document.getText();
        const decorations: vscode.DecorationOptions[] = [];

        chatHistory.forEach(historyEntry => {
            // Temporarily replace newline characters with a placeholder
            const searchText = historyEntry.replace(/\n/g, "<NEWLINE>");

            // Search for the placeholder in the text
            let matchIndex = text.indexOf(searchText);
            if (matchIndex !== -1) {
                const startPos = editor.document.positionAt(matchIndex);
                const endPos = editor.document.positionAt(matchIndex + searchText.length);

                // Create decorations based on the matched positions
                decorations.push({ range: new vscode.Range(startPos, endPos) });
            }
        });

        // Apply the decorations to highlight the matched text
        editor.setDecorations(decorationType, decorations);
    });
}

export function deactivate() {}