import * as vscode from 'vscode';

let chatHistory: string[] = ["console.log('Hello World');\r\nlet b = 10;\r\nlet a = b + b\r\nconsole.log(a)", "Sample Text", "AI Response"];
let array1: number[] = [];
let array2: number[] = [];
export function activate(context: vscode.ExtensionContext) {
    stuff();
}

export function deactivate() {}

function stuff()  {
    const decorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 255, 0, 0.3)', // Light yellow highlight
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    });

    vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        if (event.contentChanges[0].text.length > 10 && chatHistory.includes(event.contentChanges[0].text)) {
            const pastedContent = event.contentChanges[0].text;
            vscode.window.showInformationMessage(`Pasted content: ${pastedContent}`);
            // Store the pasted content in a variable
            let capturedContent = pastedContent;
            console.log(`Captured content: ${capturedContent}`);
            const text = editor.document.getText();
            const decorations: vscode.DecorationOptions[] = [];
            array1.push(event.contentChanges[0].rangeOffset);
            array2.push(event.contentChanges[0].rangeOffset + pastedContent.length);
            //chatHistory.forEach(historyEntry => {
                //let matchIndex = text.indexOf(historyEntry);
               // while (matchIndex !== -1) {
               for (let i = 0; i < array1.length; i++) {
                    const startPos = editor.document.positionAt(array1[i]);
                    const endPos = editor.document.positionAt(array2[i]);
                    decorations.push({ range: new vscode.Range(startPos, endPos) });
               }
                  //  matchIndex = text.indexOf(historyEntry, matchIndex + 1);
                //}
           // });
    
            editor.setDecorations(decorationType, decorations);
        }


    });
}