// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

const pastedTextDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(0, 255, 0, 0.3)' // Light green background
});
const annotatedLines = new Set<number>();
const decorationTypes = new Map<number, vscode.TextEditorDecorationType>();
export function activate(context: vscode.ExtensionContext) {

	//const disposable = vscode.commands.registerTextEditorCommand('code-tutor.annotate', async (textEditor: vscode.TextEditor) => {	
	//	const codeWithLineNumbers = getVisibleCodeWithLineNumbers(textEditor);
	vscode.workspace.onDidChangeTextDocument(async (event) => {
        const textEditor = vscode.window.activeTextEditor;
        if (textEditor && event.document === textEditor.document) {
            const codeWithLineNumbers = getVisibleCodeWithLineNumbers(textEditor);

		
		for (const line of annotatedLines) {
            const lineText = textEditor.document.lineAt(line - 1).text;
            if (lineText.includes('...')) { // Replace with the actual condition to check if the suggestion is fulfilled
                const decorationType = decorationTypes.get(line);
                if (decorationType) {
                    textEditor.setDecorations(decorationType, []);
                    annotatedLines.delete(line);
                    decorationTypes.delete(line);
                }
            }
        }

		for (const change of event.contentChanges) {
			if (change.text.length > 1) { // Assuming paste operation if the change is more than one character
				const startLine = change.range.start.line + 1;
				const endLine = change.range.end.line + 1;
				for (let line = startLine; line <= endLine; line++) {
					applyDecoration(textEditor, line, 'Pasted text', pastedTextDecorationType);
				}				
				// You can add additional logic here to handle pasted text
			}
		}
	}});
	
function applyDecoration(editor: vscode.TextEditor, line: number, suggestion: string, decorationType: vscode.TextEditorDecorationType) {
	if (annotatedLines.has(line)) {
        return;
    }
    const commandId = `code-tutor.removeSuggestion-${line}`;


	/*const decorationType = vscode.window.createTextEditorDecorationType({
	  after: {
		contentText: ` ${suggestion.substring(0, 25) + '...'}`,
		color: color,
		margin: '0 0 0 1em',
	  }
	});*/
	vscode.commands.registerCommand(commandId, () => {
        editor.setDecorations(decorationType, []);
        annotatedLines.delete(line);
        decorationTypes.delete(line);
    });
	// get the end of the line with the specified line number
	const lineLength = editor.document.lineAt(line - 1).text.length;
	const range = new vscode.Range(
	  new vscode.Position(line - 1, lineLength),
	  new vscode.Position(line - 1, lineLength)
	);
  
    const decoration = { range: range, hoverMessage: new vscode.MarkdownString(`Click [Remove](command:${commandId}) to remove this suggestion.`) };
	decoration.hoverMessage.isTrusted = true; // Allow the command link to be trusted

  
	vscode.window.activeTextEditor?.setDecorations(decorationType, [decoration]);
	annotatedLines.add(line);
	decorationTypes.set(line, decorationType);
    
	// Add a command to remove the suggestion when the link is clicked

  }

async function parseChatResponse(
	chatResponse: vscode.LanguageModelChatResponse,
	textEditor: vscode.TextEditor
  ) {
	let accumulatedResponse = '';
  
	for await (const fragment of chatResponse.text) {
	  accumulatedResponse += fragment;
  
	  // if the fragment is a }, we can try to parse the whole line
	  if (fragment.includes('}')) {
		try {
		  const annotation = JSON.parse(accumulatedResponse);
		  applyDecoration(textEditor, annotation.line, annotation.suggestion);
		  // reset the accumulator for the next line
		  accumulatedResponse = '';
		} catch (e) {
		  // do nothing
		}
	  }
	}
  }

  function getVisibleCodeWithLineNumbers(textEditor: vscode.TextEditor) {
	// get the position of the first and last visible lines
	let currentLine = textEditor.visibleRanges[0].start.line;
	const endLine = textEditor.visibleRanges[0].end.line;
  
	let code = '';
  
	// get the text from the line at the current position.
	// The line number is 0-based, so we add 1 to it to make it 1-based.
	while (currentLine < endLine) {
	  code += `${currentLine + 1}: ${textEditor.document.lineAt(currentLine).text} \n`;
	  // move to the next line position
	  currentLine++;
	}
	return code;
  }
// This method is called when your extension is deactivated
export function deactivate() {}
