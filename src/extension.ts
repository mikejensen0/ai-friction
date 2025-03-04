// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

const ANNOTATION_PROMPT = `You are a code tutor who helps students learn how to write better code. 
Your job is to evaluate a block of code that the user gives you. 
The user is writing You will then annotate any lines that could be improved with a brief suggestion and the reason why you are making that suggestion.
Only make suggestions when you feel the severity is enough that it will impact the readibility and maintainability of the code. 
Be friendly with your suggestions and remember that these are students so they need gentle guidance.
Do not not make suggestions to empty lines. 
Format each suggestion as a single JSON object. 
It is not necessary to wrap your response in triple backticks.
If you do not have a suggestion for a line leave the suggestion empty.
Here is an example of what your response should look like:

{ "line": 1, "suggestion": "I think you should use a for loop instead of a while loop. A for loop is more concise and easier to read." }
{ "line": 12, "suggestion": "I think you should use a for loop instead of a while loop. A for loop is more concise and easier to read." }
{ "line": 23, "suggestion": ""}
`;

const decorationTypes: Map<number, vscode.TextEditorDecorationType> = new Map();

let debounceTimer: NodeJS.Timeout | undefined;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    vscode.workspace.onDidChangeTextDocument((e) => {
        if (vscode.window.activeTextEditor?.document !== e.document) return;

        e.contentChanges.forEach(change => {
            const startLine = change.range.start.line + 1;
            const endLine = change.range.end.line + 1;

            for (let line = startLine; line <= endLine; line++) {
                if (decorationTypes.has(line)) {
                    decorationTypes.get(line)?.dispose();
                    decorationTypes.delete(line);
                }
            }
        });
		if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(async () => {
            await annotateVisibleEditor();
        }, 3000); 
    });
    // Optional: run immediately at startup if you want
    annotateVisibleEditor().catch(console.error);
}

async function annotateVisibleEditor() {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        console.log("No active editor");
        return;
    }

    // The logic from your command, directly placed into this function
    const codeWithLineNumbers = getVisibleCodeWithLineNumbers(activeEditor);

    const [model] = await vscode.lm.selectChatModels({
        vendor: 'copilot',
        family: 'gpt-4o',
    });

    const messages = [
        vscode.LanguageModelChatMessage.User(ANNOTATION_PROMPT),
        vscode.LanguageModelChatMessage.User(codeWithLineNumbers),
    ];

    if (model) {
        const chatResponse = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
        await parseChatResponse(chatResponse, activeEditor);
    }
}

async function parseChatResponse(chatResponse: vscode.LanguageModelChatResponse, textEditor: vscode.TextEditor) {
	let accumulatedResponse = "";

	for await (const fragment of chatResponse.text) {
		accumulatedResponse += fragment;

		// if the fragment is a }, we can try to parse the whole line
		if (fragment.includes("}")) {
			try {
				const annotation = JSON.parse(accumulatedResponse);
				applyDecoration(textEditor, annotation.line, annotation.suggestion);
				// reset the accumulator for the next line
				accumulatedResponse = "";
			}
			catch {
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


function applyDecoration(editor: vscode.TextEditor, line: number, suggestion: string) {

    if (decorationTypes.has(line) || suggestion === "") {
        decorationTypes.get(line)?.dispose();
    }
	if (suggestion === "") {
		return;
	}
	const decorationType = vscode.window.createTextEditorDecorationType({
		after: {
			contentText: ` ${suggestion.substring(0, 25) + "..."}`,
			color: "grey",
		},
	});
    decorationTypes.set(line, decorationType);

	// get the end of the line with the specified line number
	const lineLength = editor.document.lineAt(line - 1).text.length;
	const range = new vscode.Range(
		new vscode.Position(line - 1, lineLength),
		new vscode.Position(line - 1, lineLength),
	);

	const decoration = { range: range, hoverMessage: suggestion };
	vscode.window.activeTextEditor?.setDecorations(decorationType, [decoration]);

}

// This method is called when your extension is deactivated
export function deactivate() {}